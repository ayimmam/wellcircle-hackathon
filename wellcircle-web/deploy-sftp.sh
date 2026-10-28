#!/usr/bin/env bash
# Publish through the SFTP subsystem; no remote shell commands are required.
set -euo pipefail
umask 077
WEB_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVER_HOST="${1:-wellcircle.et}"
SERVER_USER="${2:-ethiowzj}"
SERVER_PORT="${3:-22}"
REMOTE_PATH="${CPANEL_REMOTE_PATH:-/home/ethiowzj/app.wellcircle.et}"
# Conservative pipelining avoids stalled transfers on the cPanel SFTP server.
SFTP_ARGS=(-R 1 -B 4096 -P "$SERVER_PORT" -o IPQoS=none -o BatchMode=yes -o ConnectTimeout=20 -o ConnectionAttempts=1 -o StrictHostKeyChecking=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=6)
SFTP_ARGS+=(-o "HostKeyAlias=${CPANEL_HOST_KEY_ALIAS:-wellcircle.et}")
if [[ -n "${CPANEL_SSH_KEY:-}" ]]; then
  SFTP_ARGS+=(-i "$CPANEL_SSH_KEY")
fi
quote_sftp() {
  local path="$1"
  [[ "$path" != *$'\n'* && "$path" != *$'\r'* ]] || { printf '%s\n' 'SFTP paths cannot contain line breaks.' >&2; return 1; }
  path="${path//\\/\\\\}"
  path="${path//\"/\\\"}"
  printf '"%s"' "$path"
}
DEPLOY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wellcircle-cpanel-deploy.XXXXXX")"
INSPECT_BATCH="$DEPLOY_DIR/inspect.sftp"
UPLOAD_BATCH="$DEPLOY_DIR/upload.sftp"
PREVIOUS_ENTRY="$DEPLOY_DIR/index.previous.html"
# Authenticate and require the intended document root before building or uploading.
{
  printf 'cd %s\n' "$(quote_sftp "$REMOTE_PATH")"
  printf 'pwd\n'
  printf -- '-get "index.html" %s\n' "$(quote_sftp "$PREVIOUS_ENTRY")"
} > "$INSPECT_BATCH"
sftp "${SFTP_ARGS[@]}" -b "$INSPECT_BATCH" "$SERVER_USER@$SERVER_HOST"
cd "$WEB_DIR"
npm run build
{
  printf 'cd %s\n' "$(quote_sftp "$REMOTE_PATH")"
  if [[ -s "$PREVIOUS_ENTRY" ]]; then
    printf 'put %s "index.previous.html"\n' "$(quote_sftp "$PREVIOUS_ENTRY")"
  fi
  # Add all assets and public files, retaining old hashes for existing browser tabs.
  shopt -s dotglob nullglob
  for asset in "$WEB_DIR"/dist/*; do
    [[ "${asset##*/}" != index.html ]] || continue
    if [[ -d "$asset" ]]; then
      printf 'put -r %s "."\n' "$(quote_sftp "$asset")"
    else
      printf 'put %s %s\n' "$(quote_sftp "$asset")" "$(quote_sftp "${asset##*/}")"
    fi
  done
  printf 'put %s "index.next.html"\n' "$(quote_sftp "$WEB_DIR/dist/index.html")"
  printf 'rename "index.next.html" "index.html"\n'
} > "$UPLOAD_BATCH"
sftp "${SFTP_ARGS[@]}" -b "$UPLOAD_BATCH" "$SERVER_USER@$SERVER_HOST"
printf '%s\n' 'SFTP deployment complete: https://app.wellcircle.et'
printf 'Local deployment record and previous entry point: %s\n' "$DEPLOY_DIR"
