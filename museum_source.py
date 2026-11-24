from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional


ArtifactPayload = Dict[str, Any]


@dataclass(frozen=True)
class GenerationTarget:
    kind: Literal["artifact", "chapter"]
    context: ArtifactPayload
    display_name: str
    museum_name: Optional[str]
    chapter_title: Optional[str]
    artifact_count: int


def _first_non_empty_string(*values: Any) -> Optional[str]:
    for value in values:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                return stripped
    return None


def _extract_museum_info(payload: ArtifactPayload) -> Optional[ArtifactPayload]:
    museum = payload.get("museum")
    if isinstance(museum, dict):
        return museum

    museum_name = _first_non_empty_string(
        payload.get("museumName"),
        payload.get("museum_name"),
    )
    if museum_name:
        return {"name": museum_name}
    return None


def _extract_artifacts(payload: ArtifactPayload) -> list[ArtifactPayload]:
    candidates = payload.get("artifacts")
    if not isinstance(candidates, list):
        candidates = payload.get("samples")

    if not isinstance(candidates, list):
        return []

    return [item for item in candidates if isinstance(item, dict)]


def _resolve_single_artifact(payload: ArtifactPayload) -> GenerationTarget:
    display_name = _first_non_empty_string(
        payload.get("nameKr"),
        payload.get("artifactName"),
        payload.get("artifactId"),
        payload.get("title"),
    ) or "untitled_artifact"

    museum = _extract_museum_info(payload)
    museum_name = museum.get("name") if museum else None

    return GenerationTarget(
        kind="artifact",
        context=payload,
        display_name=display_name,
        museum_name=museum_name,
        chapter_title=None,
        artifact_count=1,
    )


def _resolve_inline_chapter(payload: ArtifactPayload) -> GenerationTarget:
    artifacts = _extract_artifacts(payload)
    if not artifacts:
        raise ValueError("챕터 입력에는 artifacts 또는 samples 배열이 필요합니다.")

    museum = _extract_museum_info(payload)
    museum_name = museum.get("name") if museum else None
    chapter_meta = payload.get("chapter")
    if not isinstance(chapter_meta, dict):
        chapter_meta = {
            "title": _first_non_empty_string(
                payload.get("chapterTitle"),
                payload.get("title"),
            )
            or "Untitled Chapter"
        }

    chapter_title = _first_non_empty_string(
        chapter_meta.get("title"),
        chapter_meta.get("name"),
    ) or "Untitled Chapter"

    context = {
        "sourceType": "chapter",
        "museum": museum,
        "chapter": chapter_meta,
        "artifacts": artifacts,
        "artifactCount": len(artifacts),
    }

    return GenerationTarget(
        kind="chapter",
        context=context,
        display_name=chapter_title,
        museum_name=museum_name,
        chapter_title=chapter_title,
        artifact_count=len(artifacts),
    )


def _resolve_chapter_bundle(
    payload: ArtifactPayload,
    chapter_index: Optional[int],
) -> GenerationTarget:
    raw_chapters = payload.get("chapters")
    if not isinstance(raw_chapters, list) or not raw_chapters:
        raise ValueError("박물관 번들 입력에는 chapters 배열이 필요합니다.")

    chapters = [chapter for chapter in raw_chapters if isinstance(chapter, dict)]
    if not chapters:
        raise ValueError("chapters 배열에 유효한 챕터 객체가 없습니다.")

    selected_index = chapter_index or 0
    if selected_index < 0 or selected_index >= len(chapters):
        raise ValueError(
            f"chapter_index={selected_index} 가 범위를 벗어났습니다. "
            f"유효 범위는 0..{len(chapters) - 1} 입니다."
        )

    selected = chapters[selected_index]
    artifacts = _extract_artifacts(selected)
    if not artifacts:
        raise ValueError("선택한 챕터에 artifacts 또는 samples 배열이 비어 있습니다.")

    museum = _extract_museum_info(payload)
    museum_name = museum.get("name") if museum else None
    chapter_title = _first_non_empty_string(
        selected.get("title"),
        selected.get("name"),
    ) or f"Chapter {selected_index + 1}"

    chapter_meta = {
        key: value
        for key, value in selected.items()
        if key not in {"artifacts", "samples"}
    }

    context = {
        "sourceType": "chapter",
        "museum": museum,
        "chapter": chapter_meta,
        "artifacts": artifacts,
        "artifactCount": len(artifacts),
        "chapterIndex": selected_index,
        "chapterCount": len(chapters),
    }

    return GenerationTarget(
        kind="chapter",
        context=context,
        display_name=chapter_title,
        museum_name=museum_name,
        chapter_title=chapter_title,
        artifact_count=len(artifacts),
    )


def resolve_generation_target(
    *,
    artifact: Optional[ArtifactPayload] = None,
    source: Optional[ArtifactPayload] = None,
    chapter_index: Optional[int] = None,
) -> GenerationTarget:
    payload = source if source is not None else artifact
    if not isinstance(payload, dict):
        raise ValueError("artifact 또는 source 에 유효한 JSON 객체가 필요합니다.")

    if isinstance(payload.get("chapters"), list):
        return _resolve_chapter_bundle(payload, chapter_index)

    if isinstance(payload.get("artifacts"), list) or isinstance(payload.get("samples"), list):
        return _resolve_inline_chapter(payload)

    return _resolve_single_artifact(payload)
