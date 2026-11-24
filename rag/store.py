"""전시 지식 저장소: 문서를 모으고, 저장하고, 찾는다."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set

from rag.documents import Document, documents_from_payload
from rag.embedder import GeminiEmbedder, LexicalIndex, cosine

# 이 값보다 낮으면 관련이 없다고 보고 버린다.
MIN_LEXICAL_SCORE = 0.08
MIN_EMBEDDING_SCORE = 0.55


@dataclass(frozen=True)
class SearchHit:
    document: Document
    score: float
    method: str  # "embedding" | "lexical"

    def to_reference(self) -> Dict[str, Any]:
        return {
            "id": self.document.id,
            "kind": self.document.kind,
            "title": self.document.title,
            "score": round(self.score, 4),
            "method": self.method,
        }


class KnowledgeStore:
    """문서와 (있다면) 임베딩 벡터를 JSON 파일 하나에 보관한다.

    벡터가 모든 문서에 대해 있고 검색 시 embedder 가 주어지면 임베딩으로 찾는다.
    그렇지 않으면 글자 기반(TF-IDF) 검색으로 찾는다.
    """

    def __init__(self, index_path: Optional[Path] = None):
        self.index_path = index_path
        self._documents: Dict[str, Document] = {}
        self._vectors: Dict[str, List[float]] = {}
        self._embedding_model: Optional[str] = None
        self._lexical: Optional[LexicalIndex] = None
        if index_path and index_path.exists():
            self._load(index_path)

    # ── 보관 ────────────────────────────────────────────────────────────
    def _load(self, path: Path) -> None:
        data = json.loads(path.read_text(encoding="utf-8"))
        for raw in data.get("documents", []):
            document = Document.from_dict(raw)
            self._documents[document.id] = document
        self._embedding_model = data.get("embedding_model")
        vectors = data.get("vectors") or {}
        self._vectors = {key: list(value) for key, value in vectors.items() if key in self._documents}

    def save(self) -> None:
        if not self.index_path:
            return
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "embedding_model": self._embedding_model,
            "documents": [document.to_dict() for document in self._documents.values()],
            "vectors": self._vectors,
        }
        self.index_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # ── 넣기 ────────────────────────────────────────────────────────────
    def add_documents(
        self, documents: Iterable[Document], embedder: Optional[GeminiEmbedder] = None
    ) -> int:
        """문서를 넣는다(같은 id 는 덮어쓴다). embedder 가 있으면 전체 벡터를 다시 맞춘다."""
        added = 0
        for document in documents:
            if self._documents.get(document.id) != document:
                self._vectors.pop(document.id, None)
            self._documents[document.id] = document
            added += 1
        self._lexical = None

        if embedder is not None:
            if self._embedding_model != embedder.model:
                self._vectors = {}
            missing = [d for d in self._documents.values() if d.id not in self._vectors]
            if missing:
                vectors = embedder.embed_documents([d.text for d in missing])
                for document, vector in zip(missing, vectors):
                    self._vectors[document.id] = vector
            self._embedding_model = embedder.model
        return added

    def add_payload(
        self, payload: Dict[str, Any], embedder: Optional[GeminiEmbedder] = None
    ) -> int:
        return self.add_documents(documents_from_payload(payload), embedder)

    def add_directory(self, directory: Path, embedder: Optional[GeminiEmbedder] = None) -> int:
        count = 0
        for path in sorted(directory.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))
            count += self.add_documents(documents_from_payload(payload))
        if embedder is not None and count:
            self.add_documents([], embedder)
        return count

    def clear(self) -> None:
        self._documents = {}
        self._vectors = {}
        self._embedding_model = None
        self._lexical = None

    # ── 상태 ────────────────────────────────────────────────────────────
    def __len__(self) -> int:
        return len(self._documents)

    @property
    def has_embeddings(self) -> bool:
        return bool(self._documents) and all(d in self._vectors for d in self._documents)

    def stats(self) -> Dict[str, Any]:
        kinds: Dict[str, int] = {}
        for document in self._documents.values():
            kinds[document.kind] = kinds.get(document.kind, 0) + 1
        return {
            "documents": len(self._documents),
            "by_kind": kinds,
            "embedding_model": self._embedding_model if self.has_embeddings else None,
            "search_method": "embedding" if self.has_embeddings else "lexical",
        }

    # ── 찾기 ────────────────────────────────────────────────────────────
    def search(
        self,
        query: str,
        top_k: int = 3,
        exclude_ids: Optional[Set[str]] = None,
        embedder: Optional[GeminiEmbedder] = None,
    ) -> List[SearchHit]:
        if not query.strip() or not self._documents or top_k <= 0:
            return []
        exclude = exclude_ids or set()
        documents = list(self._documents.values())

        hits: List[SearchHit] = []
        use_embedding = (
            embedder is not None
            and self.has_embeddings
            and self._embedding_model == embedder.model
        )
        if use_embedding:
            try:
                query_vector = embedder.embed_query(query)
                hits = [
                    SearchHit(d, cosine(query_vector, self._vectors[d.id]), "embedding")
                    for d in documents
                ]
                threshold = MIN_EMBEDDING_SCORE
            except Exception as exc:  # 네트워크·키 문제면 글자 검색으로 내려간다
                print(f"[RAG] 임베딩 검색 실패, 글자 검색으로 대신합니다: {exc}")
                hits = []
        if not hits:
            if self._lexical is None:
                self._lexical = LexicalIndex([d.text for d in documents])
            hits = [
                SearchHit(d, score, "lexical")
                for d, score in zip(documents, self._lexical.scores(query))
            ]
            threshold = MIN_LEXICAL_SCORE

        kept = [h for h in hits if h.document.id not in exclude and h.score >= threshold]
        kept.sort(key=lambda hit: hit.score, reverse=True)
        return kept[:top_k]
