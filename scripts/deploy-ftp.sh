#!/usr/bin/env bash
# Deploy AttesaZero su SiteGround via FTP (curl)
# Uso: ./scripts/deploy-ftp.sh
#
# Pre-requisito: file .env.deploy nella root del progetto con
#   FTP_HOST, FTP_USER, FTP_PASS, FTP_PORT, FTP_REMOTE_DIR, LOCAL_DIST_DIR
#
# Nota: curl FTP non cancella file vecchi sul server. Per pulizia totale
# accedi a File Manager SiteGround e svuota /public_html prima del primo
# deploy. Successivi deploy sovrascrivono solo file modificati.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.deploy"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Errore: $ENV_FILE non trovato. Crealo a partire da .env.example"
  exit 1
fi

# Carica variabili in modo sicuro (no eval)
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

LOCAL_DIR="$ROOT_DIR/$LOCAL_DIST_DIR"

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "Errore: $LOCAL_DIR non esiste. Esegui prima: npm run build"
  exit 1
fi

echo "→ Deploy da: $LOCAL_DIR"
echo "→ Verso:     ftp://$FTP_HOST:$FTP_PORT$FTP_REMOTE_DIR"
echo ""

UPLOAD_COUNT=0
FAIL_COUNT=0

# Trova tutti i file (inclusi .htaccess) e mantieni struttura directory
while IFS= read -r -d '' file; do
  rel_path="${file#$LOCAL_DIR/}"
  remote_path="$FTP_REMOTE_DIR/$rel_path"

  echo "  upload: $rel_path"

  # --ftp-create-dirs crea sottocartelle se mancano
  if curl --silent --show-error --fail \
       --ftp-create-dirs \
       --user "$FTP_USER:$FTP_PASS" \
       --upload-file "$file" \
       "ftp://$FTP_HOST:$FTP_PORT$remote_path"; then
    UPLOAD_COUNT=$((UPLOAD_COUNT + 1))
  else
    echo "    ✗ FALLITO: $rel_path"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done < <(find "$LOCAL_DIR" -type f -print0)

echo ""
echo "Deploy completato: $UPLOAD_COUNT file caricati, $FAIL_COUNT errori."

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
