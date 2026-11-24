"""
OpenVoice V2 기반 목소리 복제 TTS 모듈.

사용 전 준비:
  1) 패키지 설치
     pip install git+https://github.com/myshell-ai/OpenVoice
     pip install git+https://github.com/myshell-ai/MeloTTS

  2) 체크포인트 다운로드
     https://huggingface.co/myshell-ai/OpenVoiceV2
     → 프로젝트 루트 아래 checkpoints_v2/converter/ 에 위치시킬 것
       checkpoints_v2/converter/config.json
       checkpoints_v2/converter/checkpoint.pth
"""

import os
import tempfile
import importlib.util
import sys
import types
from pathlib import Path

import torch


# 언어 레이블 → MeloTTS language 코드
_LANG_MAP = {
    "한국어": "KR",
    "영어": "EN",
    "일본어": "JP",
    "스페인어": "ES",
    "프랑스어": "FR",
}

# 체크포인트 기본 경로 (프로젝트 루트/checkpoints_v2/converter)
_DEFAULT_CKPT_DIR = Path(__file__).resolve().parent.parent / "checkpoints_v2" / "converter"


def _resolve_ckpt_dir(ckpt_dir: Path | None = None) -> Path:
    if ckpt_dir is not None:
        return Path(ckpt_dir)

    env_dir = os.environ.get("OPENVOICE_CKPT_DIR")
    if env_dir:
        return Path(env_dir).expanduser().resolve()

    return _DEFAULT_CKPT_DIR


def _ensure_mecab_alias() -> None:
    try:
        import mecab  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    site_packages = next((Path(p) for p in sys.path if p.endswith("site-packages")), None)
    if site_packages is None:
        return

    mecab_package = site_packages / "MeCab"
    init_file = mecab_package / "__init__.py"
    if not init_file.exists():
        return

    spec = importlib.util.spec_from_file_location(
        "mecab",
        init_file,
        submodule_search_locations=[str(mecab_package)],
    )
    if spec is None or spec.loader is None:
        return

    module = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("mecab", module)
    spec.loader.exec_module(module)


def _ensure_melo_language_stubs() -> None:
    module_name = "melo.text.japanese"
    if module_name in sys.modules:
        return

    stub = types.ModuleType(module_name)

    def _unsupported(*_args, **_kwargs):
        raise RuntimeError(
            "Japanese MeloTTS runtime is disabled in this local environment."
        )

    def _distribute_phone(n_phone: int, n_word: int) -> list[int]:
        phones_per_word = [0] * n_word
        for _ in range(n_phone):
            min_tasks = min(phones_per_word)
            min_index = phones_per_word.index(min_tasks)
            phones_per_word[min_index] += 1
        return phones_per_word

    stub.text_normalize = lambda text: text
    stub.g2p = _unsupported
    stub.get_bert_feature = _unsupported
    stub.distribute_phone = _distribute_phone
    sys.modules[module_name] = stub


def _check_dependencies() -> None:
    """OpenVoice / MeloTTS 설치 여부를 미리 확인한다."""
    missing = []
    dependency_checks = [
        ("openvoice", "openvoice (pip install git+https://github.com/myshell-ai/OpenVoice)"),
        ("melo", "melo (pip install git+https://github.com/myshell-ai/MeloTTS)"),
        ("faster_whisper", "faster-whisper (pip install faster-whisper)"),
        ("whisper_timestamped", "whisper-timestamped (pip install whisper-timestamped)"),
        ("wavmark", "wavmark (pip install wavmark)"),
    ]

    for module_name, install_hint in dependency_checks:
        try:
            __import__(module_name)
        except ImportError:
            missing.append(install_hint)

    if missing:
        raise RuntimeError(
            "다음 패키지가 설치되어 있지 않습니다:\n  " + "\n  ".join(missing)
        )


def generate_openvoice_tts(
    text: str,
    reference_audio_path: Path,
    output_path: Path,
    language_label: str = "한국어",
    speed: float = 1.0,
    ckpt_dir: Path | None = None,
) -> Path:
    """
    reference_audio_path 에 담긴 목소리로 text 를 읽어 mp3 파일을 생성한다.

    Parameters
    ----------
    text              : 합성할 텍스트
    reference_audio_path : 복제할 목소리 레퍼런스 오디오 파일 (wav/mp3 등)
    output_path       : 출력 파일 경로 (확장자는 .mp3 로 자동 변환)
    language_label    : 한국어 / 영어 / 일본어 / 스페인어 / 프랑스어
    speed             : 말하기 속도 (1.0 = 기본)
    ckpt_dir          : OpenVoice V2 converter 체크포인트 디렉토리

    Returns
    -------
    생성된 mp3 파일의 Path
    """
    _check_dependencies()
    _ensure_mecab_alias()
    _ensure_melo_language_stubs()

    try:
        from openvoice import se_extractor
        from openvoice.api import ToneColorConverter
        from melo.api import TTS
        from pydub import AudioSegment
    except Exception as exc:  # pragma: no cover - environment dependent
        message = f"OpenVoice / MeloTTS 런타임 초기화에 실패했습니다: {exc}"
        if "mecabrc" in str(exc) or "MeCab" in str(exc):
            message += (
                "\nMeloTTS 일본어 사전(unidic)이 준비되지 않았을 수 있습니다. "
                "`conda run -n openvoice python -m unidic download` 를 실행하세요."
            )
        raise RuntimeError(message) from exc

    device = "cuda" if torch.cuda.is_available() else "cpu"
    ckpt_dir = _resolve_ckpt_dir(ckpt_dir)

    # OpenVoice upstream defaults to CUDA+FP16 for the embedded Whisper segmenter.
    # On CPU-only environments (for example Apple Silicon without CUDA), preloading
    # a CPU-compatible model avoids the upstream fallback path from crashing.
    if getattr(se_extractor, "model", None) is None:
        whisper_device = "cuda" if torch.cuda.is_available() else "cpu"
        whisper_compute_type = "float16" if whisper_device == "cuda" else "int8"
        se_extractor.model = se_extractor.WhisperModel(
            se_extractor.model_size,
            device=whisper_device,
            compute_type=whisper_compute_type,
        )

    # ── 체크포인트 존재 확인 ──────────────────────────────────────────────
    config_path = ckpt_dir / "config.json"
    ckpt_path = ckpt_dir / "checkpoint.pth"
    if not config_path.exists() or not ckpt_path.exists():
        raise RuntimeError(
            f"OpenVoice V2 체크포인트를 찾을 수 없습니다: {ckpt_dir}\n"
            "https://huggingface.co/myshell-ai/OpenVoiceV2 에서 다운로드 후\n"
            "프로젝트 루트의 checkpoints_v2/converter/ 에 위치시키거나\n"
            "OPENVOICE_CKPT_DIR 환경변수로 체크포인트 경로를 지정하세요."
        )

    # ── Converter 로드 ────────────────────────────────────────────────────
    converter = ToneColorConverter(str(config_path), device=device)
    converter.load_ckpt(str(ckpt_path))

    # ── 레퍼런스 목소리 임베딩 추출 ─────────────────────────────────────
    target_se, _ = se_extractor.get_se(
        str(reference_audio_path), converter, vad=False
    )

    # ── MeloTTS 로 기본 음성 생성 ────────────────────────────────────────
    melo_lang = _LANG_MAP.get(language_label, "EN")
    model = TTS(language=melo_lang, device=device)
    speaker_ids = model.hps.data.spk2id
    speaker_id = next(iter(speaker_ids.values()))

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        src_path = Path(tmp.name)

    try:
        model.tts_to_file(text, speaker_id, str(src_path), speed=speed)
    except Exception as exc:  # pragma: no cover - environment dependent
        message = f"MeloTTS 음성 생성에 실패했습니다: {exc}"
        if "NoneType' object has no attribute 'pos" in str(exc) or "NoneType object has no attribute 'pos" in str(exc):
            message += (
                "\n한국어 G2P 형태소 분석기가 준비되지 않았을 수 있습니다. "
                "`conda run -n openvoice pip install python-mecab-ko python-mecab-ko-dic` "
                "후 서버를 다시 시작하세요."
            )
        raise RuntimeError(message) from exc
    try:

        # ── 소스 목소리 임베딩 추출 ──────────────────────────────────────
        source_se, _ = se_extractor.get_se(str(src_path), converter, vad=False)

        # ── 목소리 변환 ──────────────────────────────────────────────────
        output_path.parent.mkdir(parents=True, exist_ok=True)
        wav_output = output_path.with_suffix(".wav")
        converter.convert(
            audio_src_path=str(src_path),
            src_se=source_se,
            tgt_se=target_se,
            output_path=str(wav_output),
            message="@MyShell",
        )
    finally:
        src_path.unlink(missing_ok=True)

    # ── WAV → MP3 변환 ────────────────────────────────────────────────────
    mp3_output = output_path.with_suffix(".mp3")
    audio = AudioSegment.from_wav(str(wav_output))
    audio.export(str(mp3_output), format="mp3", bitrate="128k")
    wav_output.unlink(missing_ok=True)

    print(f"[OpenVoice] saved: {mp3_output}")
    return mp3_output
