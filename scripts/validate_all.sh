#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[validate] backend"
python3 "$ROOT_DIR/scripts/validate_project.py"
python3 -m pytest -q "$ROOT_DIR/tests"

echo "[validate] frontend"
(cd "$ROOT_DIR/frontend" && npm run build)

if command -v conda >/dev/null 2>&1; then
  echo "[validate] openvoice env"
  if conda run -n openvoice python "$ROOT_DIR/scripts/validate_openvoice_env.py"; then
    echo "[validate] openvoice runtime ready"
  else
    echo "[validate] openvoice runtime pending: dependency 또는 checkpoint 문제입니다. 위 로그를 확인하세요"
  fi
else
  echo "[validate] conda not found, skipping openvoice env check"
fi

echo "[validate] all checks complete"
