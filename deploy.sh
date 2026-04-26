#!/bin/bash
# ── Deploy: nela-zahradnice-portal ──────────────────────────
# Spustit z Zenbooku: bash deploy.sh
# Prodáva kód na GitHub → pull na Hetzner → rebuild Docker

set -euo pipefail

PROJECT="nelazahradnice-portal"
SERVER="root@91.99.76.194"
SSH_PORT="2200"
REMOTE_DIR="/opt/projects/$PROJECT"

# ── 1. Commit & push na GitHub ────────────────────────────
echo "📦 Připravuji commit..."
if ! git diff --cached --quiet 2>/dev/null || ! git diff --quiet 2>/dev/null; then
  git add -A
  git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" --allow-empty
fi

echo "🚀 Pushuji na GitHub..."
git push origin main

# ── 2. Pull & rebuild na Hetzneru ─────────────────────────
echo "🔄 Syncing na $SERVER:$REMOTE_DIR..."
ssh -p $SSH_PORT $SERVER << EOF
  set -e
  cd $REMOTE_DIR

  echo "⬇️  Git pull..."
  git pull origin main

  echo "🏗️  Rebuilding container..."
  docker compose -f docker-compose.prod.yml up -d --build --force-recreate

  echo "🧹 Cleanup starých imagí..."
  docker image prune -f 2>/dev/null || true

  echo "✅ Deploy hotov!"
EOF

echo "🎉 Vše nasazeno na portal.nelazahradnice.cz"
