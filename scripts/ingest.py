"""전시 자료(JSON)를 지식 저장소에 넣는다.

    python scripts/ingest.py                      # data/knowledge/*.json 전부
    python scripts/ingest.py path/to/museum.json  # 파일 하나
    python scripts/ingest.py --no-embed           # 임베딩 없이 글자 검색만

GEMINI_API_KEY 가 있으면 임베딩을 함께 만들고, 없으면 글자 검색용으로만 저장한다.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv  # noqa: E402

from rag import KnowledgeStore  # noqa: E402
from rag.embedder import GeminiEmbedder  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("paths", nargs="*", type=Path, help="넣을 JSON 파일 (없으면 data/knowledge 전체)")
    parser.add_argument("--no-embed", action="store_true", help="임베딩을 만들지 않는다")
    parser.add_argument("--keep", action="store_true", help="기존 문서를 지우지 않고 더한다")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    api_key = os.environ.get("GEMINI_API_KEY")
    embedder = GeminiEmbedder(api_key) if api_key and not args.no_embed else None

    store = KnowledgeStore(ROOT / "data" / "index" / "knowledge.json")
    if not args.keep:
        store.clear()

    paths = args.paths or sorted((ROOT / "data" / "knowledge").glob("*.json"))
    for path in paths:
        store.add_payload(json.loads(path.read_text(encoding="utf-8")))
    if embedder is not None:
        store.add_documents([], embedder)
    store.save()
    print(json.dumps(store.stats(), ensure_ascii=False))


if __name__ == "__main__":
    main()
