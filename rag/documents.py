"""박물관 입력(JSON)을 검색 단위 문서로 바꾼다.

입력 형태는 museum_source.py 가 받는 것과 같다.
- 단일 작품 객체
- {"museum": ..., "chapters": [{"title": ..., "artifacts": [...]}]} 묶음
- {"chapter": ..., "artifacts": [...]} 한 챕터
"""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class Document:
    id: str
    kind: str  # "artifact" | "chapter"
    title: str
    text: str
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Document":
        return cls(
            id=str(data["id"]),
            kind=str(data.get("kind", "artifact")),
            title=str(data.get("title", "")),
            text=str(data.get("text", "")),
            meta=dict(data.get("meta") or {}),
        )


# 작품 객체에서 문장으로 풀어 쓸 필드. (표시 이름, 키 후보)
_ARTIFACT_FIELDS = [
    ("다른 이름", ["nameCn", "nameEn"]),
    ("국적", ["nationalityCountry"]),
    ("시대", ["nationalityEra"]),
    ("지정", ["designationInfo"]),
    ("재질", ["materialPrimary", "materialCategory"]),
    ("크기", ["fo", "size"]),
]
_PURPOSE_KEYS = ["purposeType1", "purposeType2", "purposeType3", "purposeType4"]


def _text(value: Any) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _first(payload: Dict[str, Any], keys: List[str]) -> Optional[str]:
    for key in keys:
        found = _text(payload.get(key))
        if found:
            return found
    return None


def _stable_id(prefix: str, *parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def _museum_name(payload: Dict[str, Any]) -> Optional[str]:
    museum = payload.get("museum")
    if isinstance(museum, dict):
        return _first(museum, ["name", "title"])
    return _first(payload, ["museumName", "museum_name"])


def artifact_title(artifact: Dict[str, Any]) -> str:
    return _first(artifact, ["nameKr", "artifactName", "title", "artifactId"]) or "이름 없는 작품"


def artifact_id(artifact: Dict[str, Any]) -> str:
    explicit = _first(artifact, ["artifactId", "id"])
    if explicit:
        return f"artifact-{explicit}"
    return _stable_id("artifact", artifact_title(artifact), _text(artifact.get("desc")) or "")


def artifact_text(artifact: Dict[str, Any]) -> str:
    """작품 하나를 검색과 프롬프트에 쓸 한 덩어리 글로 만든다. 입력에 있는 값만 쓴다."""
    lines = [artifact_title(artifact)]
    for label, keys in _ARTIFACT_FIELDS:
        value = _first(artifact, keys)
        if value:
            lines.append(f"{label}: {value}")
    purposes = [p for p in (_text(artifact.get(k)) for k in _PURPOSE_KEYS) if p]
    if purposes:
        lines.append("분류: " + " - ".join(purposes))
    description = _first(artifact, ["desc", "description"])
    if description:
        lines.append(description)
    return "\n".join(lines)


def _artifact_document(
    artifact: Dict[str, Any], museum: Optional[str], chapter: Optional[str]
) -> Document:
    meta: Dict[str, Any] = {}
    if museum:
        meta["museum"] = museum
    if chapter:
        meta["chapter"] = chapter
    return Document(
        id=artifact_id(artifact),
        kind="artifact",
        title=artifact_title(artifact),
        text=artifact_text(artifact),
        meta=meta,
    )


def _chapter_document(
    chapter: Dict[str, Any], museum: Optional[str], index: int, artifact_titles: List[str]
) -> Optional[Document]:
    title = _first(chapter, ["title", "name"]) or f"Chapter {index + 1}"
    lines = [title]
    description = _first(chapter, ["description", "desc", "theme"])
    if description:
        lines.append(description)
    if artifact_titles:
        lines.append("포함 작품: " + ", ".join(artifact_titles))
    if len(lines) == 1:
        return None
    meta: Dict[str, Any] = {"chapter": title}
    if museum:
        meta["museum"] = museum
    return Document(
        id=_stable_id("chapter", museum or "", title),
        kind="chapter",
        title=title,
        text="\n".join(lines),
        meta=meta,
    )


def _artifacts_of(container: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = container.get("artifacts")
    if not isinstance(items, list):
        items = container.get("samples")
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def documents_from_payload(payload: Dict[str, Any]) -> List[Document]:
    """입력 하나에서 문서 목록을 만든다. 같은 id 는 한 번만 넣는다."""
    if not isinstance(payload, dict):
        raise ValueError("지식 입력은 JSON 객체여야 합니다.")

    museum = _museum_name(payload)
    documents: List[Document] = []

    def add_chapter(chapter: Dict[str, Any], index: int) -> None:
        artifacts = _artifacts_of(chapter)
        title = _first(chapter, ["title", "name"]) or f"Chapter {index + 1}"
        chapter_doc = _chapter_document(
            chapter, museum, index, [artifact_title(a) for a in artifacts]
        )
        if chapter_doc:
            documents.append(chapter_doc)
        for artifact in artifacts:
            documents.append(_artifact_document(artifact, museum, title))

    chapters = payload.get("chapters")
    if isinstance(chapters, list):
        for index, chapter in enumerate(c for c in chapters if isinstance(c, dict)):
            add_chapter(chapter, index)
    elif _artifacts_of(payload):
        meta = payload.get("chapter")
        chapter = dict(meta) if isinstance(meta, dict) else {}
        if not chapter:
            title = _first(payload, ["chapterTitle", "title"])
            if title:
                chapter["title"] = title
            description = _first(payload, ["description"])
            if description:
                chapter["description"] = description
        chapter["artifacts"] = _artifacts_of(payload)
        add_chapter(chapter, 0)
    else:
        documents.append(_artifact_document(payload, museum, None))

    unique: Dict[str, Document] = {}
    for document in documents:
        unique.setdefault(document.id, document)
    return list(unique.values())
