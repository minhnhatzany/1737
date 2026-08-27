#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=1737
URL="http://127.0.0.1:${PORT}/index.html"

echo "Dang khoi dong server game tai: $URL"
echo "Nhan Ctrl+C trong cua so nay de dung server."

python3 -m http.server "$PORT" >/tmp/1737-game-server.log 2>&1 &
SERVER_PID=$!

sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Khong the khoi dong server. Kiem tra /tmp/1737-game-server.log"
  exit 1
fi

open "$URL"
echo "Game da mo tren trinh duyet."

wait "$SERVER_PID"
#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT=1737
URL="http://127.0.0.1:${PORT}/index.html"

echo "Dang khoi dong server game tai: $URL"
echo "Nhan Ctrl+C trong cua so nay de dung server."

python3 -m http.server "$PORT" >/tmp/1737-game-server.log 2>&1 &
SERVER_PID=$!

sleep 1
if ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "Khong the khoi dong server. Kiem tra /tmp/1737-game-server.log"
  exit 1
fi

open "$URL"
echo "Game da mo tren trinh duyet."

wait "$SERVER_PID"
