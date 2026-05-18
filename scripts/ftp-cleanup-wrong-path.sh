#!/usr/bin/env bash
# Cancella la cartella /public_html/ errata creata fuori da lucam223.sg-host.com
# Uso one-shot: ./scripts/ftp-cleanup-wrong-path.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

set -a
# shellcheck disable=SC1091
source "$ROOT_DIR/.env.deploy"
set +a

WRONG_DIR="/public_html"

# Elenco file caricati per errore (allineato a dist/attesazero/browser)
FILES=(
  ".htaccess"
  "chunk-26LIBHE3.js"
  "chunk-47IFD3SF.js"
  "chunk-BKWOO7KR.js"
  "chunk-EI5TINX7.js"
  "chunk-JP3DGGRI.js"
  "chunk-MBQZKPQJ.js"
  "chunk-MR2DXBMH.js"
  "chunk-T3PHR7RB.js"
  "chunk-VPWOKBHW.js"
  "chunk-WBULXWBK.js"
  "favicon.ico"
  "index.html"
  "main-7WJILVQP.js"
  "styles-DM42QATF.css"
)

echo "→ Cancellazione file da ftp://$FTP_HOST$WRONG_DIR/"

for f in "${FILES[@]}"; do
  echo "  delete: $f"
  curl --silent --show-error \
    --user "$FTP_USER:$FTP_PASS" \
    -Q "DELE $WRONG_DIR/$f" \
    "ftp://$FTP_HOST:$FTP_PORT/" || echo "    (forse già assente)"
done

echo "→ Rimozione cartella $WRONG_DIR"
curl --silent --show-error \
  --user "$FTP_USER:$FTP_PASS" \
  -Q "RMD $WRONG_DIR" \
  "ftp://$FTP_HOST:$FTP_PORT/" && echo "OK" || echo "RMD fallito (cartella forse non vuota)"

echo "Cleanup completato."
