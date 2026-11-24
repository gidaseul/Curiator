"""전시 지식 검색: 외부 API 없이 도는 부분을 확인한다."""

import json
from pathlib import Path

import pytest

from rag import KnowledgeStore, documents_from_payload
from rag.documents import artifact_id, artifact_text

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = json.loads((ROOT / "data" / "knowledge" / "sample_museum.json").read_text(encoding="utf-8"))
PENSIVE = BUNDLE["chapters"][0]["artifacts"][0]


def test_bundle_becomes_chapter_and_artifact_documents():
    documents = documents_from_payload(BUNDLE)
    kinds = [d.kind for d in documents]
    assert kinds.count("chapter") == 2
    assert kinds.count("artifact") == 3
    pensive = next(d for d in documents if d.title == "금동 반가사유상")
    assert pensive.meta == {"museum": "국립중앙박물관", "chapter": "사유의 형상"}


def test_artifact_text_uses_only_given_fields():
    text = artifact_text({"nameKr": "석조 보살 입상", "materialPrimary": "석조"})
    assert text == "석조 보살 입상\n재질: 석조"


def test_single_artifact_and_inline_chapter_inputs():
    assert [d.kind for d in documents_from_payload(PENSIVE)] == ["artifact"]
    inline = {"chapter": {"title": "사유의 형상"}, "artifacts": [PENSIVE]}
    assert [d.kind for d in documents_from_payload(inline)] == ["chapter", "artifact"]


def test_non_object_input_is_rejected():
    with pytest.raises(ValueError):
        documents_from_payload(["not", "an", "object"])  # type: ignore[arg-type]


def test_lexical_search_finds_related_and_drops_unrelated():
    store = KnowledgeStore()
    store.add_payload(BUNDLE)
    assert store.stats()["search_method"] == "lexical"

    hits = store.search("돌로 만든 보살", top_k=3)
    assert hits and hits[0].document.title == "석조 보살 입상"
    assert all(hit.method == "lexical" for hit in hits)

    assert store.search("피자 맛집 추천", top_k=3) == []


def test_exclude_ids_removes_the_target_itself():
    store = KnowledgeStore()
    store.add_payload(BUNDLE)
    own = {artifact_id(PENSIVE)}
    hits = store.search(artifact_text(PENSIVE), top_k=5, exclude_ids=own)
    assert hits
    assert own.isdisjoint({hit.document.id for hit in hits})


def test_index_round_trips_through_disk(tmp_path):
    path = tmp_path / "index" / "knowledge.json"
    store = KnowledgeStore(path)
    store.add_payload(BUNDLE)
    store.save()

    reloaded = KnowledgeStore(path)
    assert len(reloaded) == len(store) == 5
    assert reloaded.search("반가사유상", top_k=1)[0].document.kind in {"artifact", "chapter"}


class FakeEmbedder:
    """글자 수와 '보살' 포함 여부만 보는 가짜 임베딩 (호출 경로 확인용)."""

    model = "fake-embedding"

    def __init__(self):
        self.document_calls = 0

    @staticmethod
    def _vector(text):
        return [1.0 if "보살" in text else 0.0, 1.0 if "반가사유상" in text else 0.0, 0.1]

    def embed_documents(self, texts):
        self.document_calls += 1
        return [self._vector(t) for t in texts]

    def embed_query(self, text):
        return self._vector(text)


def test_embedding_search_is_used_when_vectors_exist():
    embedder = FakeEmbedder()
    store = KnowledgeStore()
    store.add_payload(BUNDLE, embedder)
    assert store.has_embeddings and store.stats()["search_method"] == "embedding"

    hits = store.search("보살", top_k=2, embedder=embedder)
    assert [hit.method for hit in hits] == ["embedding", "embedding"]
    # 가짜 임베딩은 '보살'이 든 문서 둘(작품과 그 챕터)을 똑같이 가깝게 본다
    assert {hit.document.title for hit in hits} == {"석조 보살 입상", "예배의 공간"}

    # 벡터가 이미 있으면 다시 만들지 않는다
    store.add_payload(BUNDLE, embedder)
    assert embedder.document_calls == 1


def test_embedding_failure_falls_back_to_lexical():
    class Broken(FakeEmbedder):
        def embed_query(self, text):
            raise RuntimeError("network down")

    embedder = Broken()
    store = KnowledgeStore()
    store.add_payload(BUNDLE, embedder)
    hits = store.search("돌로 만든 보살", top_k=1, embedder=embedder)
    assert hits and hits[0].method == "lexical"
