#!/bin/zsh
cd "$(dirname "$0")"
if curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1; then
  open http://127.0.0.1:8787/
  exit 0
fi
(for i in {1..30}; do
  if curl -fsS http://127.0.0.1:8787/health >/dev/null 2>&1; then
    open http://127.0.0.1:8787/
    break
  fi
  sleep 1
done) &
CODEAF_MODEL=codex/gpt-5.6-luna node server/server.mjs
