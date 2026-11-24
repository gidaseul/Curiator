from __future__ import annotations

import importlib
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT_DIR = ROOT / "checkpoints_v2" / "converter"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from tts.generate_openvoice_tts import _ensure_mecab_alias, _ensure_melo_language_stubs


def ensure_module(name: str) -> None:
    importlib.import_module(name)
    print(f"[validate-openvoice] import ok: {name}")


def ensure_runtime_imports() -> None:
    _ensure_mecab_alias()
    _ensure_melo_language_stubs()

    from openvoice import se_extractor  # noqa: F401
    from openvoice.api import ToneColorConverter  # noqa: F401
    from melo.api import TTS  # noqa: F401

    print("[validate-openvoice] runtime import ok: openvoice.se_extractor")
    print("[validate-openvoice] runtime import ok: openvoice.api.ToneColorConverter")
    print("[validate-openvoice] runtime import ok: melo.api.TTS")


def ensure_korean_g2p_runtime() -> None:
    from g2pkk import G2p

    result = G2p()("테스트 문장입니다.")
    if not result:
        raise RuntimeError("g2pkk returned an empty result for Korean text.")
    print("[validate-openvoice] runtime ok: korean g2p")


def ensure_checkpoint(path: Path) -> None:
    config = path / "config.json"
    ckpt = path / "checkpoint.pth"
    if not config.exists() or not ckpt.exists():
        raise RuntimeError(
            "OpenVoice checkpoint가 준비되지 않았습니다. "
            f"기대 경로: {path}"
        )
    print(f"[validate-openvoice] checkpoint ok: {path}")


if __name__ == "__main__":
    ensure_module("torch")
    ensure_module("melo")
    ensure_module("openvoice")
    ensure_module("faster_whisper")
    ensure_module("whisper_timestamped")
    ensure_module("wavmark")
    ensure_runtime_imports()
    ensure_korean_g2p_runtime()
    ensure_checkpoint(CHECKPOINT_DIR)
    print("[validate-openvoice] environment validation complete")
