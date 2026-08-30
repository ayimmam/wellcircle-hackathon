#!/bin/bash
# Deploy wellcircle-web dist files to cPanel via rsync / scp over SFTP/SSH

set -e

SERVER_HOST="${1:-wellcircle.et}"
SERVER_USER="${2:-ethiowzj}"
SERVER_PORT="${3:-22}"
REMOTE_PATH="/home/ethiowzj/app.wellcircle.et/"
LOCAL_DIST="/Users/anteneh/Documents/Repos/wellcircle/wellcircle-web/dist/"

echo "🚀 Building latest production bundle..."
cd /Users/anteneh/Documents/Repos/wellcircle/wellcircle-web
npm run build

echo "📦 Uploading files to ${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH} on port ${SERVER_PORT}..."

if command -v rsync >/dev/null 2>&1; then
    rsync -avzP -e "ssh -p ${SERVER_PORT}" "${LOCAL_DIST}" "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}"
else
    scp -P "${SERVER_PORT}" -r "${LOCAL_DIST}"* "${LOCAL_DIST}".htaccess "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}"
fi

echo "🎉 Deployment complete! Visit https://app.wellcircle.et"
