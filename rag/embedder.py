"""문서와 질문을 벡터로 바꾸는 두 가지 방법.

1. GeminiEmbedder: Gemini 임베딩 API 를 쓴다. 뜻이 비슷하면 글자가 달라도 가깝다.
2. LexicalIndex: 글자 2~3개 묶음의 TF-IDF. API 키 없이 동작하고 결과가 항상 같다.
   글자가 겹쳐야 찾을 수 있으므로 뜻 검색은 아니다. 키가 없거나 호출이 실패할 때 쓴다.
"""

from __future__ import annotations

import math
import os
import re
from collections import Counter
from typing import Dict, List, Optional, Sequence

DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"

_SPACE = re.compile(r"\s+")
_WORD = re.compile(r"[0-9A-Za-z가-힣一-龥ぁ-んァ-ヶ]+")


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _terms(text: str) -> List[str]:
    """낱말과, 낱말 안의 글자 2~3개 묶음을 함께 쓴다 (한국어 조사 변화에 덜 민감하다)."""
    lowered = _SPACE.sub(" ", text.lower())
    terms: List[str] = []
    for word in _WORD.findall(lowered):
        terms.append(word)
        for size in (2, 3):
            if len(word) > size:
                terms.extend(word[i : i + size] for i in range(len(word) - size + 1))
    return terms


class LexicalIndex:
    """작은 말뭉치용 TF-IDF 색인. 문서가 바뀌면 새로 만든다."""

    def __init__(self, texts: Sequence[str]):
        self._counts = [Counter(_terms(text)) for text in texts]
        document_frequency: Counter = Counter()
        for counts in self._counts:
            document_frequency.update(counts.keys())
        total = max(len(texts), 1)
        self._idf = {
            term: math.log((1 + total) / (1 + freq)) + 1.0
            for term, freq in document_frequency.items()
        }
        self._vectors = [self._weigh(counts) for counts in self._counts]

    def _weigh(self, counts: Counter) -> Dict[str, float]:
        return {
            term: (1 + math.log(freq)) * self._idf.get(term, 0.0)
            for term, freq in counts.items()
            if term in self._idf
        }

    @staticmethod
    def _sparse_cosine(a: Dict[str, float], b: Dict[str, float]) -> float:
        if not a or not b:
            return 0.0
        small, large = (a, b) if len(a) <= len(b) else (b, a)
        dot = sum(weight * large.get(term, 0.0) for term, weight in small.items())
        norm_a = math.sqrt(sum(w * w for w in a.values()))
        norm_b = math.sqrt(sum(w * w for w in b.values()))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def scores(self, query: str) -> List[float]:
        query_vector = self._weigh(Counter(_terms(query)))
        return [self._sparse_cosine(query_vector, vector) for vector in self._vectors]


class GeminiEmbedder:
    """Gemini 임베딩 API 호출을 감싼다."""

    def __init__(self, api_key: str, model: Optional[str] = None):
        self.model = model or os.environ.get("EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        self._api_key = api_key

    def _embed(self, texts: Sequence[str], task_type: str) -> List[List[float]]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self._api_key)
        vectors: List[List[float]] = []
        for start in range(0, len(texts), 50):
            batch = list(texts[start : start + 50])
            response = client.models.embed_content(
                model=self.model,
                contents=batch,
                config=types.EmbedContentConfig(task_type=task_type),
            )
            vectors.extend(list(item.values) for item in response.embeddings)
        if len(vectors) != len(texts):
            raise RuntimeError("임베딩 개수가 입력 개수와 다릅니다.")
        return vectors

    def embed_documents(self, texts: Sequence[str]) -> List[List[float]]:
        return self._embed(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> List[float]:
        return self._embed([text], "RETRIEVAL_QUERY")[0]
