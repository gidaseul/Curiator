"""API 동작: LLM 과 TTS 는 가짜로 바꾸고, 그 사이의 연결을 확인한다."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import main
from llm.generate_docent import build_docent_prompt
from rag import KnowledgeStore
from tts.generate_tts import GeneratedAudio

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = json.loads((ROOT / "data" / "knowledge" / "sample_museum.json").read_text(encoding="utf-8"))
PENSIVE = BUNDLE["chapters"][0]["artifacts"][0]
FAKE_DOCENT = {
    "types": {
        "story": {"title": "이야기 중심 해설", "text": "이야기 해설 예시입니다."},
        "history": {"title": "역사·정석 해설", "text": "역사 해설 예시입니다."},
    }
}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """테스트마다 새 저장소를 쓰고, API 키는 없는 상태(글자 검색)로 둔다."""
    store = KnowledgeStore(tmp_path / "knowledge.json")
    store.add_payload(BUNDLE)
    monkeypatch.setattr(main, "_knowledge_store", store)
    monkeypatch.setattr(main, "_maybe_load_api_key", lambda: None)
    monkeypatch.setattr(main, "_load_api_key", lambda: "dummy-key")
    return TestClient(main.app)


def test_text_generation_passes_level_and_references(client):
    with patch.object(main, "generate_docent_from_source", return_value=FAKE_DOCENT) as fake:
        response = client.post(
            "/generate-text",
            json={"artifact": PENSIVE, "language": "한국어", "level": "child", "use_knowledge": True},
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["level"] == "child"
    assert body["story_text"] == "이야기 해설 예시입니다."

    kwargs = fake.call_args.kwargs
    assert kwargs["level"] == "child"
    titles = [ref["title"] for ref in kwargs["references"]]
    assert "금동 작은 반가사유상" in titles          # 같은 챕터의 다른 작품을 찾는다
    assert "금동 반가사유상" not in titles            # 자기 자신은 참고 자료가 아니다
    assert [ref["title"] for ref in body["references"]] == titles
    assert all("text" not in ref for ref in body["references"])


def test_text_generation_without_knowledge_keeps_old_contract(client):
    with patch.object(main, "generate_docent_from_source", return_value=FAKE_DOCENT) as fake:
        response = client.post("/generate-text", json={"artifact": PENSIVE, "language": "영어"})
    assert response.status_code == 200
    assert response.json()["references"] == []
    assert fake.call_args.kwargs["references"] == []
    assert fake.call_args.kwargs["level"] == "general"


def test_chapter_target_does_not_cite_its_own_chapter(client):
    with patch.object(main, "generate_docent_from_source", return_value=FAKE_DOCENT) as fake:
        response = client.post(
            "/generate-text",
            json={"source": BUNDLE, "chapter_index": 0, "language": "한국어", "use_knowledge": True},
        )
    assert response.status_code == 200
    titles = [ref["title"] for ref in fake.call_args.kwargs["references"]]
    assert "사유의 형상" not in titles
    assert "금동 반가사유상" not in titles


def test_invalid_level_is_rejected(client):
    response = client.post(
        "/generate-text", json={"artifact": PENSIVE, "language": "한국어", "level": "toddler"}
    )
    assert response.status_code == 422


def test_generate_returns_audio_and_references(client):
    audio = GeneratedAudio(path=Path("/tmp/fake.mp3"), provider="opensource")
    with patch.object(main, "generate_docent_from_source", return_value=FAKE_DOCENT), patch.object(
        main, "generate_tts_for_text", return_value=audio
    ):
        response = client.post(
            "/generate",
            json={
                "artifact": PENSIVE, "language": "한국어", "mode": "history", "voice": "Noah",
                "provider": "opensource", "save": "local", "level": "expert", "use_knowledge": True,
            },
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["text"] == "역사 해설 예시입니다."
    assert body["level"] == "expert"
    assert body["audio_path"].endswith("/audio/fake.mp3")
    assert body["references"]


def test_knowledge_stats_search_and_ingest(client):
    assert client.get("/knowledge").json()["documents"] == 5

    found = client.post("/knowledge/search", json={"query": "돌로 만든 보살", "top_k": 2}).json()
    assert found["results"][0]["title"] == "석조 보살 입상"
    assert found["results"][0]["method"] == "lexical"

    added = client.post(
        "/knowledge/ingest",
        json={"source": {"artifactId": "T-1", "nameKr": "청자 상감 매병", "materialPrimary": "청자"}},
    ).json()
    assert added["added"] == 1 and added["documents"] == 6

    replaced = client.post(
        "/knowledge/ingest",
        json={"source": {"artifactId": "T-1", "nameKr": "청자 상감 매병"}, "replace": True},
    ).json()
    assert replaced["documents"] == 1


def test_ask_answers_from_retrieved_documents(client):
    with patch.object(main, "answer_question", return_value="돌로 만든 보살 입상이에요.") as fake:
        response = client.post("/ask", json={"question": "돌로 만든 보살상이 있나요?"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["grounded"] is True
    assert body["answer"] == "돌로 만든 보살 입상이에요."
    assert body["references"][0]["title"] == "석조 보살 입상"
    assert fake.call_args.kwargs["references"][0]["text"].startswith("석조 보살 입상")


def test_ask_without_related_documents_skips_the_llm(client):
    with patch.object(main, "answer_question") as fake:
        response = client.post("/ask", json={"question": "근처 피자 맛집 추천해 주세요", "language": "영어"})
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is False
    assert body["references"] == []
    assert "could not find" in body["answer"]
    fake.assert_not_called()


def test_voice_clone_reports_missing_optional_packages(client):
    """torch/OpenVoice 가 없는 환경에서는 501 로 알려 준다 (서버가 죽지 않는다)."""
    import importlib.util

    if importlib.util.find_spec("torch") is not None:
        pytest.skip("torch 가 설치된 환경에서는 해당 없음")
    response = client.post(
        "/generate-audio-clone",
        data={"text": "안녕하세요", "language": "한국어"},
        files={"reference_audio": ("ref.wav", b"RIFF0000", "audio/wav")},
    )
    assert response.status_code == 501


def test_prompt_orders_reference_level_language():
    prompt = build_docent_prompt(
        {"nameKr": "금동 반가사유상"},
        "[입력 정보]\n{{DESC}}",
        language_label="영어",
        level="expert",
        references=[{"title": "사유의 형상", "text": "반가사유상 계열 작품"}],
    )
    order = [prompt.index(tag) for tag in ("[입력 정보]", "[참고 자료]", "[관람객 수준]", "[언어 규칙]")]
    assert order == sorted(order)
    assert "반가사유상 계열 작품" in prompt

    plain = build_docent_prompt({"nameKr": "x"}, "{{DESC}}", language_label="한국어")
    assert "[참고 자료]" not in plain and "[관람객 수준]" not in plain
