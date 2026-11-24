from __future__ import annotations

import py_compile
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import main
from museum_source import resolve_generation_target
from tts.generate_tts import GeneratedAudio


EXAMPLE_ARTIFACT = {
    "artifactId": "PS0100100100100331200000",
    "nameKr": "금동 반가사유상",
    "museumName": "국립중앙박물관",
    "desc": "깊은 명상에 잠긴 반가사유상입니다.",
}


EXAMPLE_BUNDLE = {
    "museum": {"name": "국립중앙박물관"},
    "chapters": [
        {
            "title": "사유의 형상",
            "description": "사유상 중심 구성",
            "artifacts": [
                EXAMPLE_ARTIFACT,
                {
                    "artifactId": "PS0100100100100000000002",
                    "nameKr": "금동 작은 반가사유상",
                    "desc": "작은 규모의 반가사유상입니다.",
                },
            ],
        }
    ],
}


def check_py_compile() -> None:
    for path in [
        ROOT / "main.py",
        ROOT / "museum_source.py",
        ROOT / "llm" / "generate_docent.py",
        ROOT / "tts" / "generate_tts.py",
        ROOT / "tts" / "generate_openvoice_tts.py",
    ]:
        py_compile.compile(str(path), doraise=True)
    print("[validate] python compile ok")


def check_source_resolution() -> None:
    artifact_target = resolve_generation_target(artifact=EXAMPLE_ARTIFACT)
    assert artifact_target.kind == "artifact"
    assert artifact_target.display_name == "금동 반가사유상"

    chapter_target = resolve_generation_target(source=EXAMPLE_BUNDLE, chapter_index=0)
    assert chapter_target.kind == "chapter"
    assert chapter_target.chapter_title == "사유의 형상"
    assert chapter_target.artifact_count == 2
    print("[validate] source resolution ok")


def check_fastapi_routes() -> None:
    client = TestClient(main.app)

    fake_docent = {
        "types": {
            "story": {"title": "이야기 중심 해설", "text": "이야기 해설 예시입니다."},
            "history": {"title": "역사·정석 해설", "text": "역사 해설 예시입니다."},
        }
    }

    with patch.object(main, "_load_api_key", return_value="dummy-key"), patch.object(
        main,
        "generate_docent_from_source",
        return_value=fake_docent,
    ), patch.object(
        main,
        "generate_tts_for_text",
        return_value=GeneratedAudio(path=Path("/tmp/fake.mp3"), provider="opensource"),
    ):
        response = client.post(
            "/generate",
            json={
                "source": EXAMPLE_BUNDLE,
                "chapter_index": 0,
                "language": "한국어",
                "mode": "story",
                "voice": "Adam",
                "provider": "opensource",
                "save": "local",
            },
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["provider"] == "opensource"
        assert payload["text"] == "이야기 해설 예시입니다."

    with patch.object(main, "_maybe_load_api_key", return_value=None), patch.object(
        main,
        "generate_tts_for_text",
        return_value=GeneratedAudio(path=Path("/tmp/fake.mp3"), provider="opensource"),
    ):
        response = client.post(
            "/generate-audio",
            json={
                "text": "테스트 음성입니다.",
                "voice": "Chloe",
                "language": "한국어",
                "provider": "opensource",
            },
        )
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["provider"] == "opensource"
        assert payload["audio_url"].endswith("/audio/fake.mp3")

    print("[validate] fastapi smoke routes ok")


def main_validate() -> None:
    check_py_compile()
    check_source_resolution()
    check_fastapi_routes()
    print("[validate] backend validation complete")


if __name__ == "__main__":
    main_validate()
