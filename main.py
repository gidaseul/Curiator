import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Set

import boto3
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from llm.generate_docent import (
    answer_question,
    generate_docent_from_source,
    generate_docent_json,
)
from museum_source import GenerationTarget, resolve_generation_target
from rag import KnowledgeStore
from rag.documents import artifact_id, artifact_text
from rag.embedder import GeminiEmbedder
from tts.generate_tts import generate_tts_for_text, tts_from_docent_json


BASE_DIR = Path(__file__).resolve().parent
TtsProvider = Literal["auto", "gemini", "opensource"]
Language = Literal["한국어", "영어", "일본어", "스페인어", "프랑스어"]
# 관람객 수준: 말의 난이도만 바꾼다 (어린이 / 일반 / 전문가)
AudienceLevel = Literal["child", "general", "expert"]


class DocentRequest(BaseModel):
    artifact: Optional[Dict[str, Any]] = Field(
        None,
        description="작품 정보 JSON (DB에서 그대로 전달된 객체, 임의의 필드 허용)",
        example={
            "id": 1,
            "artifactId": "PS0100100100100331200000",
            "nameKr": "금동 반가사유상",
            "nameCn": "金銅半跏思惟像",
            "imgUri": "http://example.com/images/pensive_bodhisattva.jpg",
            "museumName": "NATIONAL_MUSEUM_OF_KOREA",
            "fo": "높이 90.8cm",
            "designationInfo": "국보",
            "nationalityCountry": "한국",
            "nationalityEra": "삼국",
            "purposeType1": "종교신앙",
            "purposeType2": "불교",
            "purposeType3": "예배",
            "purposeType4": "불상",
            "materialCategory": "금속",
            "materialPrimary": "금동",
            "relicNoLocation": "덕수",
            "relicNoNumber": 3312,
            "desc": "왼쪽 무릎 위에 오른쪽 다리를 걸치고 고개 숙인 얼굴의 뺨에 오른쪽 손가락을 살짝 대어 깊은 명상에 잠긴 모습의 반가사유상입니다.",
        },
    )
    source: Optional[Dict[str, Any]] = Field(
        None,
        description="박물관/챕터 번들 입력. chapters 또는 artifacts 구조를 허용",
    )
    chapter_index: Optional[int] = Field(
        None,
        ge=0,
        description="source.chapters 사용 시 선택할 챕터 인덱스",
    )
    # 사용자가 선택하는 언어 (한글 레이블)
    language: Literal["한국어", "영어", "일본어", "스페인어", "프랑스어"]
    mode: Literal["story", "history"]
    voice: Literal["Adam", "Noah", "Chloe", "Sophie"]
    provider: TtsProvider = Field(
        "auto",
        description='TTS 제공자. "auto"=Gemini 우선, 실패 시 오픈소스, "gemini"=Gemini 고정, "opensource"=MeloTTS 고정',
    )
    level: AudienceLevel = Field("general", description="관람객 수준 (child/general/expert)")
    use_knowledge: bool = Field(
        False, description="전시 지식 저장소에서 관련 자료를 찾아 해설에 참고할지 여부"
    )
    top_k: int = Field(3, ge=1, le=8, description="참고할 관련 자료 개수")
    # 저장 위치 옵션:
    # - "local": EC2(로컬)에만 저장 (S3 업로드 안 함)
    # - "s3": S3에만 저장 (업로드 후 로컬 파일 삭제)  ← 기본값
    # - "both": 로컬 + S3 모두 저장
    save: Literal["local", "s3", "both"] = Field(
        "s3",
        description='음성 파일 저장 위치. "local"=로컬만, "s3"=S3만, "both"=로컬+S3',
        example="s3",
    )


class DocentResponse(BaseModel):
    mode: str
    voice: str
    provider: str
    # 사용자가 선택한 언어 레이블 (예: "한국어")
    language: str
    # 실제 저장 방식(local/s3/both)을 응답으로도 알려준다.
    save: Literal["local", "s3", "both"]
    text: str
    audio_path: str
    level: str = "general"
    references: List[Dict[str, Any]] = Field(default_factory=list)


# ── 새 분리 엔드포인트용 모델 ──────────────────────────────────────────
class TextRequest(BaseModel):
    artifact: Optional[Dict[str, Any]] = None
    source: Optional[Dict[str, Any]] = None
    chapter_index: Optional[int] = Field(default=None, ge=0)
    language: Literal["한국어", "영어", "일본어", "스페인어", "프랑스어"]
    level: AudienceLevel = "general"
    use_knowledge: bool = False
    top_k: int = Field(default=3, ge=1, le=8)

class TextResponse(BaseModel):
    story_text: str
    story_title: str
    history_text: str
    history_title: str
    level: str = "general"
    references: List[Dict[str, Any]] = Field(default_factory=list)

class AudioRequest(BaseModel):
    text: str
    voice: Literal["Adam", "Noah", "Chloe", "Sophie"]
    language: Literal["한국어", "영어", "일본어", "스페인어", "프랑스어"]
    provider: TtsProvider = "auto"

class AudioResponse(BaseModel):
    audio_url: str
    voice: str
    provider: str


app = FastAPI(title="Curiator Docent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TTS 출력 디렉토리 생성 및 정적 파일 서빙 마운트
_TTS_OUTPUT_DIR = BASE_DIR / "tts" / "outputs"
_TTS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(_TTS_OUTPUT_DIR)), name="audio")


def _normalize_output_name(raw_name: str) -> str:
    """
    S3/object key 및 파일명에 안전하게 쓸 수 있도록 이름을 정규화한다.
    - 공백은 '_'로, 한글/영문/숫자/_- 이외 문자는 제거
    - 전부 소문자로 변환
    """
    raw_name = (raw_name or "unknown_artifact").strip().lower().replace(" ", "_")
    # 한글, 영문, 숫자, 밑줄, 대시만 허용
    safe = re.sub(r"[^0-9a-z가-힣_\-]", "", raw_name)
    return safe or "unknown_artifact"


def _get_s3_client_and_bucket() -> tuple[boto3.client, str, str]:
    """
    .env에 설정된 자격 증명으로 S3 클라이언트와 버킷/리전을 생성한다.

    기대하는 환경 변수:
    - AWS_ACCESS_KEY_ID
    - AWS_SECRET_ACCESS_KEY
    - AWS_REGION_NAME        (예: ap-northeast-2)
    - S3_BUCKET_NAME         (예: my-docent-bucket)
    """
    load_dotenv(BASE_DIR / ".env")
    access_key = os.environ.get("AWS_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
    region_name = os.environ.get("AWS_REGION_NAME")
    bucket_name = os.environ.get("S3_BUCKET_NAME")

    if not access_key or not secret_key or not region_name or not bucket_name:
        raise HTTPException(
            status_code=500,
            detail=(
                "S3 연동 환경 변수가 설정되어 있지 않습니다. "
                "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION_NAME, S3_BUCKET_NAME 를 .env에 설정하세요."
            ),
        )

    s3_client = boto3.client(
        "s3",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region_name,
    )
    return s3_client, bucket_name, region_name


def _upload_file_to_s3(local_path: Path, object_key: str) -> str:
    """
    로컬 파일을 S3에 업로드하고, 접근 가능한 S3 URL을 반환한다.
    """
    if not local_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"S3 업로드 대상 파일이 존재하지 않습니다: {local_path}",
        )

    s3_client, bucket_name, region_name = _get_s3_client_and_bucket()

    try:
        s3_client.upload_file(str(local_path), bucket_name, object_key)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"S3 업로드 중 오류가 발생했습니다: {e}",
        )

    # 표준 S3 HTTPS URL 형식
    s3_url = f"https://{bucket_name}.s3.{region_name}.amazonaws.com/{object_key}"
    return s3_url


def _truncate_for_tts(text: str, mode: str) -> str:
    """
    TTS가 너무 길어지지 않도록 문장 수 기준으로 잘라주는 유틸.
    - story: 최대 12문장
    - history: 최대 14문장
    """
    max_sentences = 12 if mode == "story" else 14
    # 여러 언어 공통으로 쓸 수 있는 문장 구분용 정규식 (., ?, !, 。, ！, ？ 기준)
    parts = re.split(r"(?<=[\.!?。！？])\s+", text.strip())
    if len(parts) <= max_sentences:
        return text.strip()
    truncated = " ".join(parts[:max_sentences]).strip()
    return truncated


def _maybe_load_api_key() -> Optional[str]:
    load_dotenv(BASE_DIR / ".env")
    return os.environ.get("GEMINI_API_KEY")


def _load_api_key() -> str:
    api_key = _maybe_load_api_key()
    if api_key:
        return api_key
    raise HTTPException(
        status_code=500,
        detail="GEMINI_API_KEY가 설정되어 있지 않습니다. .env 파일을 확인하세요.",
    )


# ── 전시 지식 저장소 (RAG) ─────────────────────────────────────────────
_KNOWLEDGE_DIR = BASE_DIR / "data" / "knowledge"
_KNOWLEDGE_INDEX = BASE_DIR / "data" / "index" / "knowledge.json"
_knowledge_store: Optional[KnowledgeStore] = None


def get_knowledge_store() -> KnowledgeStore:
    """저장소를 처음 쓸 때 한 번 불러온다. 색인이 없으면 data/knowledge 의 JSON 을 읽는다."""
    global _knowledge_store
    if _knowledge_store is None:
        store = KnowledgeStore(_KNOWLEDGE_INDEX)
        if len(store) == 0 and _KNOWLEDGE_DIR.exists():
            store.add_directory(_KNOWLEDGE_DIR)
        _knowledge_store = store
    return _knowledge_store


def _maybe_embedder() -> Optional[GeminiEmbedder]:
    api_key = _maybe_load_api_key()
    return GeminiEmbedder(api_key) if api_key else None


def _target_query_and_ids(target: GenerationTarget) -> tuple[str, Set[str]]:
    """해설 대상에서 검색어와, 결과에서 뺄 자기 자신의 문서 id 를 만든다."""
    context = target.context
    if target.kind == "artifact":
        return artifact_text(context), {artifact_id(context)}

    artifacts = [a for a in context.get("artifacts", []) if isinstance(a, dict)]
    chapter = context.get("chapter") if isinstance(context.get("chapter"), dict) else {}
    parts = [str(chapter.get("title") or ""), str(chapter.get("description") or "")]
    parts.extend(artifact_text(a) for a in artifacts)
    return "\n".join(p for p in parts if p), {artifact_id(a) for a in artifacts}


def _find_references(target: GenerationTarget, top_k: int) -> List[Dict[str, Any]]:
    """대상과 관련된 다른 자료를 찾는다. 대상 자신과, 대상이 속한 챕터 문서는 뺀다."""
    store = get_knowledge_store()
    query, own_ids = _target_query_and_ids(target)
    hits = store.search(query, top_k=top_k + 2, exclude_ids=own_ids, embedder=_maybe_embedder())
    references: List[Dict[str, Any]] = []
    for hit in hits:
        if target.kind == "chapter" and hit.document.title == target.chapter_title:
            continue
        reference = hit.to_reference()
        reference["text"] = hit.document.text
        references.append(reference)
    return references[:top_k]


def _public_references(references: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{k: v for k, v in ref.items() if k != "text"} for ref in references]


def _resolve_target_or_400(
    artifact: Optional[Dict[str, Any]],
    source: Optional[Dict[str, Any]],
    chapter_index: Optional[int],
):
    try:
        return resolve_generation_target(
            artifact=artifact,
            source=source,
            chapter_index=chapter_index,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/generate", response_model=DocentResponse)
def generate_docent(req: DocentRequest) -> DocentResponse:
    """
    - 요청으로 들어온 작품 정보 JSON(artifact)을 기반으로
      이야기 중심 / 역사·정석 해설 중 하나를 생성하고,
      선택한 보이스로 TTS까지 생성한다.
    """
    start_ts = time.perf_counter()
    print("[DOCENT] ===== 요청 시작 =====")
    api_key = _load_api_key()
    target = _resolve_target_or_400(req.artifact, req.source, req.chapter_index)

    tts_output_dir = BASE_DIR / "tts" / "outputs"

    # 1) LLM으로 도슨트 텍스트 생성
    print("[DOCENT] 1) LLM 텍스트 생성 시작")
    template_path = BASE_DIR / "llm" / "prompt_template.txt"
    references = _find_references(target, req.top_k) if req.use_knowledge else []
    docent_data = generate_docent_from_source(
        api_key=api_key,
        source_payload=target.context,
        template_path=template_path,
        language_label=req.language,
        level=req.level,
        references=references,
    )
    print(f"[DOCENT] 1) LLM 텍스트 생성 완료 ({time.perf_counter() - start_ts:.2f}초 경과)")

    types_data = docent_data.get("types") or {}
    mode_obj = types_data.get(req.mode)
    if not mode_obj or not isinstance(mode_obj, dict):
        raise HTTPException(
            status_code=500,
            detail=f"LLM 응답에 '{req.mode}' 유형 해설이 없습니다.",
        )

    text = mode_obj.get("text") or ""
    if not text.strip():
        raise HTTPException(
            status_code=500,
            detail=f"'{req.mode}' 유형 해설 텍스트가 비어 있습니다.",
        )

    # 2) 선택한 모드 + 보이스로 TTS 생성
    # TTS 길이/시간을 제어하기 위해 문장 수 기준으로 텍스트를 잘라서 사용
    trimmed_text = _truncate_for_tts(text, req.mode)

    safe_name = _normalize_output_name(target.display_name)
    file_stem = f"docent_{safe_name}_{req.mode}_{req.voice}"
    out_path = tts_output_dir / file_stem

    print("[DOCENT] 2) TTS 생성 시작")
    try:
        generated_audio = generate_tts_for_text(
            api_key=api_key,
            text=trimmed_text,
            voice_name=req.voice,
            output_path=out_path,
            language_label=req.language,
            provider=req.provider,
        )
    except RuntimeError as e:
        # TTS 단계에서 발생한 오류 메시지를 그대로 클라이언트에게 전달
        raise HTTPException(status_code=502, detail=str(e))
    print(f"[DOCENT] 2) TTS 생성 완료 ({time.perf_counter() - start_ts:.2f}초 경과)")

    # 3) 저장 대상에 따라 S3 업로드/로컬 삭제를 분기
    #    - save="local" : 로컬에만 저장, S3 업로드 안 함
    #    - save="s3"    : S3에만 저장 (업로드 후 로컬 파일 삭제)
    #    - save="both"  : 로컬 + S3 모두 저장
    object_name = _normalize_output_name(target.display_name)
    audio_path_value: str

    if req.save in ("s3", "both"):
        s3_object_key = (
            f"audio/{object_name}/{req.mode}/{req.voice}/{generated_audio.path.name}"
        )
        print("[DOCENT] 3) S3 업로드 시작")
        s3_url = _upload_file_to_s3(generated_audio.path, s3_object_key)
        print(f"[DOCENT] 3) S3 업로드 완료 ({time.perf_counter() - start_ts:.2f}초 경과)")
        audio_path_value = s3_url
    else:
        # local 모드: 브라우저에서 직접 접근 가능한 URL로 반환
        load_dotenv(BASE_DIR / ".env")
        base_url = os.environ.get("BASE_URL", "http://localhost:8000")
        audio_path_value = f"{base_url}/audio/{generated_audio.path.name}"

    # save="s3" 인 경우에만 로컬 파일 삭제
    if req.save == "s3":
        try:
            generated_audio.path.unlink(missing_ok=True)
        except Exception:
            print(f"[WARN] 로컬 오디오 파일 삭제 실패: {generated_audio.path}")

    print(f"[DOCENT] ===== 전체 완료 ({time.perf_counter() - start_ts:.2f}초) =====")

    return DocentResponse(
        mode=req.mode,
        voice=req.voice,
        provider=generated_audio.provider,
        language=req.language,
        save=req.save,
        text=text,
        audio_path=audio_path_value,
        level=req.level,
        references=_public_references(references),
    )


@app.post("/generate-text", response_model=TextResponse)
def generate_text_only(req: TextRequest) -> TextResponse:
    """
    LLM으로 도슨트 텍스트(story + history)만 생성하고 반환한다.
    TTS는 호출하지 않는다.
    """
    api_key = _load_api_key()
    target = _resolve_target_or_400(req.artifact, req.source, req.chapter_index)
    template_path = BASE_DIR / "llm" / "prompt_template.txt"
    references = _find_references(target, req.top_k) if req.use_knowledge else []
    docent_data = generate_docent_from_source(
        api_key=api_key,
        source_payload=target.context,
        template_path=template_path,
        language_label=req.language,
        level=req.level,
        references=references,
    )
    types_data = docent_data.get("types") or {}
    story_obj  = types_data.get("story")  or {}
    history_obj = types_data.get("history") or {}

    return TextResponse(
        story_text    = story_obj.get("text", ""),
        story_title   = story_obj.get("title", "이야기 중심 해설"),
        history_text  = history_obj.get("text", ""),
        history_title = history_obj.get("title", "역사·정석 해설"),
        level         = req.level,
        references    = _public_references(references),
    )


@app.post("/generate-audio", response_model=AudioResponse)
def generate_audio_only(req: AudioRequest) -> AudioResponse:
    """
    주어진 텍스트와 보이스로 TTS 오디오를 생성하고 URL을 반환한다.
    음성 파일은 로컬에 저장된다.
    """
    api_key = _maybe_load_api_key()
    if req.provider == "gemini" and not api_key:
        raise HTTPException(
            status_code=500,
            detail="Gemini TTS를 사용하려면 GEMINI_API_KEY가 필요합니다.",
        )
    tts_output_dir = BASE_DIR / "tts" / "outputs"
    file_stem = f"docent_{req.voice}_{req.provider}_{int(time.time())}"
    out_path = tts_output_dir / file_stem

    try:
        generated_audio = generate_tts_for_text(
            api_key=api_key,
            text=req.text,
            voice_name=req.voice,
            output_path=out_path,
            language_label=req.language,
            provider=req.provider,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    load_dotenv(BASE_DIR / ".env")
    base_url = os.environ.get("BASE_URL", "http://localhost:8000")
    audio_url = f"{base_url}/audio/{generated_audio.path.name}"

    return AudioResponse(
        audio_url=audio_url,
        voice=req.voice,
        provider=generated_audio.provider,
    )


class VoiceCloneResponse(BaseModel):
    audio_url: str


@app.post("/generate-audio-clone", response_model=VoiceCloneResponse)
async def generate_audio_clone(
    text: str = Form(..., description="합성할 텍스트"),
    language: str = Form(
        "한국어",
        description="언어 레이블 (한국어/영어/일본어/스페인어/프랑스어)",
    ),
    speed: float = Form(1.0, description="말하기 속도 (1.0 = 기본)"),
    reference_audio: UploadFile = File(
        ..., description="복제할 목소리 레퍼런스 오디오 파일 (wav / mp3 등)"
    ),
) -> VoiceCloneResponse:
    """
    업로드한 레퍼런스 오디오의 목소리로 텍스트를 읽어 mp3 를 생성한다.
    OpenVoice V2 + MeloTTS 를 로컬에서 실행하므로 외부 API 키 없이도 동작한다.
    """
    tts_output_dir = BASE_DIR / "tts" / "outputs"
    tts_output_dir.mkdir(parents=True, exist_ok=True)

    # 레퍼런스 오디오를 임시 파일로 저장
    suffix = Path(reference_audio.filename or "ref.wav").suffix or ".wav"
    ref_tmp = tts_output_dir / f"_ref_tmp_{int(time.time())}{suffix}"
    try:
        ref_tmp.write_bytes(await reference_audio.read())

        out_stem = tts_output_dir / f"clone_{int(time.time())}"
        try:
            # torch, OpenVoice 는 선택 설치다. 이 기능을 쓸 때만 불러온다.
            from tts.generate_openvoice_tts import generate_openvoice_tts
        except ImportError as e:
            raise HTTPException(
                status_code=501,
                detail=f"음성 복제에 필요한 선택 패키지가 설치되어 있지 않습니다: {e}",
            ) from e
        try:
            final_path = generate_openvoice_tts(
                text=text,
                reference_audio_path=ref_tmp,
                output_path=out_stem,
                language_label=language,
                speed=speed,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=502, detail=str(e))
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"OpenVoice 음성 복제 처리 중 오류가 발생했습니다: {e}",
            ) from e
    finally:
        ref_tmp.unlink(missing_ok=True)

    load_dotenv(BASE_DIR / ".env")
    base_url = os.environ.get("BASE_URL", "http://localhost:8000")
    audio_url = f"{base_url}/audio/{final_path.name}"

    return VoiceCloneResponse(audio_url=audio_url)


# ── 전시 지식 저장소 API ───────────────────────────────────────────────
class KnowledgeIngestRequest(BaseModel):
    source: Dict[str, Any] = Field(
        ..., description="작품 하나, 챕터 하나, 또는 museum/chapters 묶음 JSON"
    )
    replace: bool = Field(False, description="True 면 기존 문서를 지우고 새로 넣는다")
    embed: bool = Field(
        True, description="GEMINI_API_KEY 가 있으면 임베딩도 만든다. 없으면 글자 검색만 쓴다"
    )


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(3, ge=1, le=10)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, description="관람객 질문")
    language: Language = "한국어"
    level: AudienceLevel = "general"
    top_k: int = Field(3, ge=1, le=8)


class AskResponse(BaseModel):
    answer: str
    grounded: bool = Field(description="관련 자료를 찾아 그 안에서 답했는지 여부")
    references: List[Dict[str, Any]] = Field(default_factory=list)


@app.get("/knowledge")
def knowledge_stats() -> Dict[str, Any]:
    """저장소에 들어 있는 문서 수와 현재 검색 방식을 알려 준다."""
    return get_knowledge_store().stats()


@app.post("/knowledge/ingest")
def knowledge_ingest(req: KnowledgeIngestRequest) -> Dict[str, Any]:
    """전시 자료를 문서로 쪼개 저장소에 넣는다."""
    store = get_knowledge_store()
    if req.replace:
        store.clear()
    try:
        added = store.add_payload(req.source, _maybe_embedder() if req.embed else None)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"임베딩 생성에 실패했습니다: {exc}") from exc
    store.save()
    return {"added": added, **store.stats()}


@app.post("/knowledge/search")
def knowledge_search(req: KnowledgeSearchRequest) -> Dict[str, Any]:
    """질문과 가까운 문서를 찾는다 (해설 생성 없이 검색 결과만 확인할 때)."""
    hits = get_knowledge_store().search(req.query, top_k=req.top_k, embedder=_maybe_embedder())
    return {
        "results": [
            {**hit.to_reference(), "text": hit.document.text, "meta": hit.document.meta}
            for hit in hits
        ]
    }


NO_KNOWLEDGE_ANSWER = {
    "한국어": "지금 가진 전시 자료에서는 그 질문과 관련된 내용을 찾지 못했어요.",
    "영어": "I could not find anything about that in the exhibition materials I have.",
    "일본어": "いま手元にある展示資料には、その内容が見つかりませんでした。",
    "스페인어": "No encontré información sobre eso en los materiales de la exposición que tengo.",
    "프랑스어": "Je n'ai rien trouvé à ce sujet dans les documents d'exposition dont je dispose.",
}


@app.post("/ask", response_model=AskResponse)
def ask_docent(req: AskRequest) -> AskResponse:
    """
    관람객 질문에 답한다. 저장소에서 관련 자료를 찾고, 그 자료 안에서만 답하게 한다.
    관련 자료가 없으면 LLM 을 부르지 않고 "자료에 없다"고 답한다.
    """
    hits = get_knowledge_store().search(
        req.question, top_k=req.top_k, embedder=_maybe_embedder()
    )
    if not hits:
        return AskResponse(answer=NO_KNOWLEDGE_ANSWER[req.language], grounded=False)

    api_key = _load_api_key()
    references = [{**hit.to_reference(), "text": hit.document.text} for hit in hits]
    try:
        answer = answer_question(
            api_key=api_key,
            question=req.question,
            references=references,
            template_path=BASE_DIR / "llm" / "prompt_qa.txt",
            language_label=req.language,
            level=req.level,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"답변 생성에 실패했습니다: {exc}") from exc
    if not answer:
        raise HTTPException(status_code=502, detail="LLM 이 빈 답변을 돌려주었습니다.")
    return AskResponse(answer=answer, grounded=True, references=_public_references(references))


def main() -> None:
    """
    (옵션) 이전처럼 desc.txt → JSON → TTS를 한 번에 돌리고 싶을 때 사용하는 오프라인 파이프라인.
    """
    load_dotenv(BASE_DIR / ".env")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY가 설정되어 있지 않습니다. .env 파일을 확인하세요.")

    desc_path = BASE_DIR / "llm" / "desc.txt"
    template_path = BASE_DIR / "llm" / "prompt_template.txt"
    docent_json_path = BASE_DIR / "llm" / "docent_result.json"
    tts_output_dir = BASE_DIR / "tts" / "outputs"

    generate_docent_json(
        api_key=api_key,
        desc_path=desc_path,
        template_path=template_path,
        output_path=docent_json_path,
    )

    tts_from_docent_json(
        api_key=api_key,
        docent_json_path=docent_json_path,
        output_dir=tts_output_dir,
    )

    print("[✓] 파이프라인 완료: desc.txt → LLM(JSON) → TTS")


if __name__ == "__main__":
    main()
