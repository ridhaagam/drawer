#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for dir in excalidraw-server excalidraw-room; do
  if [ ! -d "$dir/node_modules" ]; then
    echo "installing $dir dependencies"
    (cd "$dir" && npm install)
  fi
done

pids=()

cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

(cd excalidraw-server && npm run start:dev) &
pids+=($!)

(cd excalidraw-room && PORT=3005 npm run start:dev) &
pids+=($!)

# Vite proxies /api and /socket.io to the two above, so the browser only ever
# talks to one origin. Use http://localhost:3000, not the LAN or tailnet IP:
# only localhost is a secure context, and without one crypto.subtle is
# undefined and collaboration cannot encrypt.
yarn start
