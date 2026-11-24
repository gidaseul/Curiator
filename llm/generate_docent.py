import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types


def _extract_json_from_text(raw: str) -> Dict[str, Any]:
    """
    LLM 응답에서 JSON 블록만 안전하게 추출한다.
    - ```json ... ``` 로 감싼 경우 제거
    - 앞뒤 설명이 섞인 경우 첫 { 와 마지막 } 사이를 추출
    """
    cleaned = raw.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and start < end:
        cleaned = cleaned[start : end + 1]

    return json.loads(cleaned)


def _build_language_instruction(language_label: Optional[str]) -> str:
    if language_label == "영어":
        return (
            "위의 모든 해설 텍스트는 자연스럽고 유창한 영어로 작성하라. "
            "JSON 안의 text 값에는 한국어를 사용하지 말고, 영어만 사용하라."
        )
    if language_label == "일본어":
        return (
            "上のすべての解説テキストは、自然で読みやすい日本語で書いてください。"
            "JSON の text には韓国語を使わず、日本語のみを使ってください。"
        )
    if language_label == "스페인어":
        return (
            "Escribe todos los textos de la explicación en un español natural y claro. "
            "En los valores de text del JSON, no uses coreano; usa solo español."
        )
    if language_label == "프랑스어":
        return (
            "Rédige tous les textes d'explication en français naturel et clair. "
            "Dans les champs text du JSON, n'utilise pas le coréen, utilise uniquement le français."
        )
    return (
        "위의 모든 해설 텍스트는 자연스럽고 공손한 한국어로 작성하라. "
        "JSON의 text 값에는 영어를 섞지 말고 한국어만 사용하라."
    )


AUDIENCE_LEVELS = ("child", "general", "expert")


def _build_level_instruction(level: Optional[str]) -> str:
    """관람객 수준에 따라 말의 난이도만 바꾼다. 사실은 더하지 않는다."""
    if level == "child":
        return (
            "듣는 사람은 초등학생이다. 쉬운 낱말과 짧은 문장을 쓰고, 어려운 한자어는 "
            "풀어서 말하라. 비유는 입력에 적힌 모습을 설명할 때만 쓴다. "
            "입력에 없는 사실은 쉽게 설명하려는 목적이라도 추가하지 마라."
        )
    if level == "expert":
        return (
            "듣는 사람은 전공자나 연구자다. 분류, 재질, 양식, 지정 정보 같은 용어를 "
            "풀어 쓰지 않고 정확하게 사용하고, 입력에 있는 서지 정보를 빠짐없이 언급하라. "
            "입력에 없는 학설, 연대, 비교 대상은 추가하지 마라."
        )
    return ""


def _build_reference_block(references: Optional[List[Dict[str, Any]]]) -> str:
    """검색으로 찾은 같은 전시의 다른 자료를 프롬프트에 붙인다."""
    if not references:
        return ""
    items = [
        {"title": ref.get("title", ""), "text": ref.get("text", "")}
        for ref in references
        if ref.get("text")
    ]
    if not items:
        return ""
    return (
        "아래는 같은 박물관 자료에서 찾은 관련 자료다. 해설의 중심은 [입력 정보]의 대상이다. "
        "참고 자료는 대상과 이어지는 맥락을 한두 문장 덧붙일 때만 쓰고, "
        "참고 자료에 적힌 내용 밖의 사실은 만들지 마라. 관련이 없어 보이면 쓰지 않아도 된다.\n"
        + json.dumps(items, ensure_ascii=False, indent=2)
    )


def build_docent_prompt(
    source_payload: Dict[str, Any],
    template: str,
    language_label: Optional[str] = None,
    level: Optional[str] = None,
    references: Optional[List[Dict[str, Any]]] = None,
) -> str:
    prompt = template.replace(
        "{{DESC}}",
        json.dumps(source_payload, ensure_ascii=False, indent=2),
    )

    reference_block = _build_reference_block(references)
    if reference_block:
        prompt += "\n\n[참고 자료]\n" + reference_block

    level_instruction = _build_level_instruction(level)
    if level_instruction:
        prompt += "\n\n[관람객 수준]\n" + level_instruction

    language_instruction = _build_language_instruction(language_label)
    if language_instruction:
        prompt += "\n\n[언어 규칙]\n" + language_instruction
    return prompt


def _generate_text(api_key: str, prompt: str) -> str:
    client = genai.Client(api_key=api_key)
    model_name = os.environ.get("DOCENT_MODEL", "gemini-2.0-flash")

    response = client.models.generate_content(
        model=model_name,
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)],
            )
        ],
    )
    return response.text or ""


def _call_llm_with_source(
    api_key: str,
    source_payload: Dict[str, Any],
    template: str,
    language_label: Optional[str] = None,
    level: Optional[str] = None,
    references: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    prompt = build_docent_prompt(
        source_payload=source_payload,
        template=template,
        language_label=language_label,
        level=level,
        references=references,
    )

    raw_text = _generate_text(api_key, prompt)
    try:
        return _extract_json_from_text(raw_text)
    except Exception as exc:
        raise RuntimeError(
            "LLM 응답에서 JSON만 분리하지 못했습니다. 프롬프트 포맷을 다시 확인하세요.\n"
            f"=== RAW RESPONSE ===\n{raw_text}"
        ) from exc


def generate_docent_from_source(
    api_key: str,
    source_payload: Dict[str, Any],
    template_path: Path,
    language_label: Optional[str] = None,
    level: Optional[str] = None,
    references: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()

    return _call_llm_with_source(
        api_key=api_key,
        source_payload=source_payload,
        template=template,
        language_label=language_label,
        level=level,
        references=references,
    )


def answer_question(
    api_key: str,
    question: str,
    references: List[Dict[str, Any]],
    template_path: Path,
    language_label: Optional[str] = None,
    level: Optional[str] = None,
) -> str:
    """관람객 질문에, 검색으로 찾은 자료 안에서만 답한다."""
    template = template_path.read_text(encoding="utf-8")
    items = [
        {"title": ref.get("title", ""), "text": ref.get("text", "")} for ref in references
    ]
    prompt = template.replace("{{QUESTION}}", question.strip()).replace(
        "{{REFERENCES}}", json.dumps(items, ensure_ascii=False, indent=2)
    )
    level_instruction = _build_level_instruction(level)
    if level_instruction:
        prompt += "\n\n[관람객 수준]\n" + level_instruction
    prompt += "\n\n[언어 규칙]\n" + _build_language_instruction(language_label).replace(
        "JSON 안의 text 값에는", "답변에는"
    ).replace("JSON의 text 값에는", "답변에는")
    return _generate_text(api_key, prompt).strip()


def generate_docent_from_artifact(
    api_key: str,
    artifact: Dict[str, Any],
    template_path: Path,
    language_label: Optional[str] = None,
) -> Dict[str, Any]:
    return generate_docent_from_source(
        api_key=api_key,
        source_payload=artifact,
        template_path=template_path,
        language_label=language_label,
    )


def generate_docent_json(
    api_key: str,
    desc_path: Path,
    template_path: Path,
    output_path: Path,
) -> None:
    raw = desc_path.read_text(encoding="utf-8").strip()

    try:
        source_payload = json.loads(raw)
    except json.JSONDecodeError:
        source_payload = {"description": raw}

    data = generate_docent_from_source(
        api_key=api_key,
        source_payload=source_payload,
        template_path=template_path,
        language_label="한국어",
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
