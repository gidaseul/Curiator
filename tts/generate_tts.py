from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Dict, Literal, Optional

from google import genai
from google.genai import types
from pydub import AudioSegment


TtsProvider = Literal["auto", "gemini", "opensource"]
ResolvedTtsProvider = Literal["gemini", "opensource"]


@dataclass(frozen=True)
class GeneratedAudio:
    path: Path
    provider: ResolvedTtsProvider


STYLE_PRESETS: Dict[str, Dict[str, object]] = {
    "Adam": {
        "voice": "Enceladus",
        "style": (
            "Speak in a deep, gentle, and steady male voice with minimal emotional variation. "
            "Maintain a natural pace, slightly slower, calm, and composed, like a refined museum curator "
            "guiding visitors with confidence and clarity. "
            "Read the following text exactly as written, without translating or changing the language. "
            "Always use the same language as the input text."
        ),
        "temperature": 0.2,
    },
    "Noah": {
        "voice": "Sadachbia",
        "style": (
            "Speak in a slightly higher-pitched, lively male voice. "
            "Sound energetic and engaging, as if you are excited to share the story of the artwork, "
            "but avoid sounding exaggerated or cartoonish. "
            "Read the following text exactly as written, without translating or changing the language. "
            "Always use the same language as the input text."
        ),
        "temperature": 0.4,
    },
    "Chloe": {
        "voice": "Zephyr",
        "style": (
            "Speak in a bright, clear, and friendly female voice. "
            "Keep the tone steady and calm while still sounding cheerful and welcoming, "
            "like a warm museum guide explaining each piece with care. "
            "Read the following text exactly as written, without translating or changing the language. "
            "Always use the same language as the input text."
        ),
        "temperature": 0.6,
    },
    "Sophie": {
        "voice": "Laomedeia",
        "style": (
            "Speak in a soft, warm, and slightly higher-pitched female voice. "
            "Read as if you are gently telling a story to the listener, with a comforting and empathetic tone. "
            "Read the following text exactly as written, without translating or changing the language. "
            "Always use the same language as the input text."
        ),
        "temperature": 1.0,
    },
}


OPEN_SOURCE_LANG_MAP = {
    "한국어": "KR",
    "영어": "EN",
    "일본어": "JP",
    "스페인어": "ES",
    "프랑스어": "FR",
}


PERSONA_FAMILY = {
    "Adam": "male",
    "Noah": "male",
    "Chloe": "female",
    "Sophie": "female",
}


PERSONA_INDEX = {
    "Adam": 0,
    "Noah": 1,
    "Chloe": 2,
    "Sophie": 3,
}


def _parse_audio_mime_type(mime_type: str) -> Dict[str, Optional[int]]:
    bits_per_sample = 16
    rate = 24000

    for param in mime_type.split(";"):
        candidate = param.strip()
        if candidate.lower().startswith("rate="):
            try:
                rate = int(candidate.split("=", 1)[1])
            except ValueError:
                pass
        if candidate.startswith("audio/L"):
            try:
                bits_per_sample = int(candidate.split("L", 1)[1])
            except ValueError:
                pass

    return {"bits_per_sample": bits_per_sample, "rate": rate}


def _convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    params = _parse_audio_mime_type(mime_type)
    bits_per_sample = params["bits_per_sample"] or 16
    sample_rate = params["rate"] or 24000
    num_channels = 1
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + len(audio_data)

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        len(audio_data),
    )
    return header + audio_data


def _get_style_preset(persona_name: Optional[str]) -> tuple[Optional[str], Optional[str], float]:
    if not persona_name:
        return None, None, 1.0

    preset = STYLE_PRESETS.get(persona_name)
    if not preset:
        return None, None, 1.0

    voice = preset.get("voice")
    style = preset.get("style")
    temperature = float(preset.get("temperature", 1.0))  # type: ignore[arg-type]
    return (
        voice if isinstance(voice, str) else None,
        style if isinstance(style, str) else None,
        temperature,
    )


def _load_docent_texts(docent_json_path: Path) -> Dict[str, str]:
    with open(docent_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    result: Dict[str, str] = {}

    if "generated_levels" in data:
        levels = data["generated_levels"]
        result["basic"] = levels.get("basic", {}).get("text", "")
        result["understanding"] = levels.get("understanding", {}).get("text", "")
        result["analysis"] = levels.get("analysis", {}).get("text", "")
        result["expert"] = levels.get("expert", {}).get("text", "")
        return result

    if "levels" in data:
        levels = data["levels"]
        result["basic"] = levels.get("basic", {}).get("text", "")
        result["understanding"] = levels.get("understanding", {}).get("text", "")
        result["analysis"] = levels.get("analysis", {}).get("text", "")
        result["expert"] = levels.get("expert", {}).get("text", "")
        return result

    if "types" in data:
        types_data = data["types"]
        result["story"] = types_data.get("story", {}).get("text", "")
        result["history"] = types_data.get("history", {}).get("text", "")
        return result

    raise ValueError("docent JSON 구조를 알 수 없습니다.")


def _export_audio_blob(raw_bytes: bytes, mime_type: str, out_path: Path) -> Path:
    if "mpeg" in mime_type or "mp3" in mime_type:
        input_format = "mp3"
    elif "wav" in mime_type:
        input_format = "wav"
    elif "ogg" in mime_type:
        input_format = "ogg"
    else:
        raw_bytes = _convert_to_wav(raw_bytes, mime_type)
        input_format = "wav"

    audio = AudioSegment.from_file(BytesIO(raw_bytes), format=input_format)
    final_path = out_path.with_suffix(".mp3")
    audio.export(str(final_path), format="mp3", bitrate="128k")
    print(f"[TTS] saved: {final_path}")
    return final_path


def _generate_gemini_tts(
    api_key: str,
    text: str,
    voice_name: str,
    output_path: Path,
) -> Path:
    client = genai.Client(api_key=api_key)
    model = "gemini-2.5-flash-preview-tts"
    preset_voice, style_instructions, temperature = _get_style_preset(voice_name)
    tts_input = f"{style_instructions}\n\n{text}" if style_instructions else text

    speech_config_kwargs: Dict[str, object] = {}
    if preset_voice:
        speech_config_kwargs["voice_config"] = types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=preset_voice)
        )

    config = types.GenerateContentConfig(
        temperature=temperature,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(**speech_config_kwargs),
    )

    error_messages: list[str] = []
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=tts_input)],
            )
        ],
        config=config,
    ):
        if (
            not chunk.candidates
            or not chunk.candidates[0].content
            or not chunk.candidates[0].content.parts
        ):
            continue

        part = chunk.candidates[0].content.parts[0]
        inline_data = getattr(part, "inline_data", None)
        if inline_data and inline_data.data:
            return _export_audio_blob(
                raw_bytes=inline_data.data,
                mime_type=inline_data.mime_type or "",
                out_path=output_path,
            )

        if getattr(chunk, "text", None):
            message = str(chunk.text).strip()
            if message:
                error_messages.append(message)
                print(message)

    detail = "\n".join(error_messages)
    if detail:
        raise RuntimeError(
            "Gemini TTS 생성에 실패했습니다. 응답에서 오디오 데이터를 찾지 못했습니다.\n"
            f"=== TTS TEXT RESPONSE ===\n{detail}"
        )
    raise RuntimeError("Gemini TTS 생성에 실패했습니다. 응답에서 오디오 데이터를 찾지 못했습니다.")


def _check_open_source_dependencies() -> None:
    missing = []
    try:
        import melo  # noqa: F401
    except ImportError:
        missing.append("melo (pip install git+https://github.com/myshell-ai/MeloTTS)")

    if missing:
        raise RuntimeError(
            "오픈소스 TTS에 필요한 패키지가 설치되어 있지 않습니다:\n  "
            + "\n  ".join(missing)
        )


def _resolve_open_source_speaker_id(speaker_map: Dict[str, int], persona_name: str) -> int:
    if not speaker_map:
        raise RuntimeError("MeloTTS speaker 구성을 찾지 못했습니다.")

    family = PERSONA_FAMILY.get(persona_name)
    lowered_items = [(name.lower(), speaker_id) for name, speaker_id in speaker_map.items()]

    if family:
        family_candidates = [
            speaker_id
            for name, speaker_id in lowered_items
            if family in name
        ]
        if family_candidates:
            index = PERSONA_INDEX.get(persona_name, 0)
            return family_candidates[index % len(family_candidates)]

    ordered_items = sorted(speaker_map.items(), key=lambda item: item[1])
    if len(ordered_items) == 1:
        return ordered_items[0][1]

    if len(ordered_items) == 2 and family:
        return ordered_items[0][1] if family == "male" else ordered_items[1][1]

    index = PERSONA_INDEX.get(persona_name, 0)
    return ordered_items[min(index, len(ordered_items) - 1)][1]


def _generate_open_source_tts(
    text: str,
    voice_name: str,
    output_path: Path,
    language_label: str,
    speed: float = 1.0,
) -> Path:
    _check_open_source_dependencies()

    import torch
    from melo.api import TTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    melo_lang = OPEN_SOURCE_LANG_MAP.get(language_label, "EN")
    model = TTS(language=melo_lang, device=device)
    speaker_id = _resolve_open_source_speaker_id(model.hps.data.spk2id, voice_name)

    wav_output = output_path.with_suffix(".wav")
    mp3_output = output_path.with_suffix(".mp3")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.tts_to_file(text, speaker_id, str(wav_output), speed=speed)

    audio = AudioSegment.from_file(str(wav_output))
    audio.export(str(mp3_output), format="mp3", bitrate="128k")
    wav_output.unlink(missing_ok=True)
    print(f"[TTS] saved: {mp3_output}")
    return mp3_output


def tts_from_docent_json(api_key: str, docent_json_path: Path, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    texts = _load_docent_texts(docent_json_path)

    for level_name, text in texts.items():
        if not text:
            print(f"[TTS] {level_name} 비어 있음. 건너뜀.")
            continue

        out_path = output_dir / f"docent_{level_name}"
        _generate_gemini_tts(
            api_key=api_key,
            text=text,
            voice_name="Adam",
            output_path=out_path,
        )


def generate_tts_for_text(
    api_key: Optional[str],
    text: str,
    voice_name: str,
    output_path: Path,
    language_label: str,
    provider: TtsProvider = "auto",
) -> GeneratedAudio:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if provider == "gemini":
        if not api_key:
            raise RuntimeError("Gemini TTS를 사용하려면 GEMINI_API_KEY가 필요합니다.")
        path = _generate_gemini_tts(
            api_key=api_key,
            text=text,
            voice_name=voice_name,
            output_path=output_path,
        )
        return GeneratedAudio(path=path, provider="gemini")

    if provider == "opensource":
        path = _generate_open_source_tts(
            text=text,
            voice_name=voice_name,
            output_path=output_path,
            language_label=language_label,
        )
        return GeneratedAudio(path=path, provider="opensource")

    errors: list[str] = []
    if api_key:
        try:
            path = _generate_gemini_tts(
                api_key=api_key,
                text=text,
                voice_name=voice_name,
                output_path=output_path,
            )
            return GeneratedAudio(path=path, provider="gemini")
        except Exception as exc:
            errors.append(f"[gemini] {exc}")

    try:
        path = _generate_open_source_tts(
            text=text,
            voice_name=voice_name,
            output_path=output_path,
            language_label=language_label,
        )
        return GeneratedAudio(path=path, provider="opensource")
    except Exception as exc:
        errors.append(f"[opensource] {exc}")

    raise RuntimeError("자동 TTS 생성에 실패했습니다.\n" + "\n".join(errors))
