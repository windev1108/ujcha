#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# UjCha API — VPS Deploy Script
# Chạy trên VPS: bash deploy.sh
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/ujcha-api"
COMPOSE_FILE="docker-compose.prod.yml"
IMAGE_NAME="ujcha-api"

# ── Màu sắc output ──────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC}  $1"; }
error() { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ── Kiểm tra prerequisites ──────────────────────────────────────────
command -v docker   >/dev/null || error "Docker chưa được cài đặt"
command -v docker   compose >/dev/null 2>&1 || \
  docker compose version >/dev/null 2>&1    || error "Docker Compose chưa được cài đặt"

# ── Kiểm tra file .env.production ───────────────────────────────────
[ -f "$APP_DIR/.env.production" ] || error "Thiếu file $APP_DIR/.env.production"

# ── Kiểm tra POSTGRES_PASSWORD không phải default ───────────────────
source "$APP_DIR/.env.production"
[ "$POSTGRES_PASSWORD" = "CHANGE_ME_STRONG_PASSWORD_HERE" ] && \
  error "Hãy đổi POSTGRES_PASSWORD trong .env.production trước khi deploy!"

info "Bắt đầu deploy UjCha API..."

# ── Pull code mới nhất (nếu có git) ─────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
  info "Pull code mới..."
  cd "$APP_DIR"
  git pull origin main
else
  info "Không phải git repo, bỏ qua bước pull"
  cd "$APP_DIR"
fi

# ── Build image mới ──────────────────────────────────────────────────
info "Building Docker image..."
docker compose -f "$COMPOSE_FILE" build --no-cache api

# ── Rolling restart: giảm downtime ──────────────────────────────────
info "Khởi động Postgres + Redis trước..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis

info "Chờ DB sẵn sàng..."
timeout 60 bash -c 'until docker compose -f '"$COMPOSE_FILE"' exec -T postgres pg_isready -U ujcha; do sleep 2; done'

info "Khởi động API..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps api

info "Khởi động Nginx..."
docker compose -f "$COMPOSE_FILE" up -d nginx

# ── Dọn dẹp image cũ ────────────────────────────────────────────────
info "Dọn image cũ..."
docker image prune -f

# ── Kiểm tra health ──────────────────────────────────────────────────
info "Chờ API health check..."
sleep 10
if docker compose -f "$COMPOSE_FILE" ps api | grep -q "healthy\|Up"; then
  info "✅ Deploy thành công!"
  docker compose -f "$COMPOSE_FILE" ps
else
  warn "API chưa healthy. Xem log:"
  docker compose -f "$COMPOSE_FILE" logs --tail=50 api
fi
