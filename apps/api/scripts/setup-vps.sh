#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# UjCha — Setup VPS Ubuntu 22.04 LTS từ đầu
# Chạy 1 lần với: sudo bash setup-vps.sh
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[setup]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $1"; }

# ── Kiểm tra chạy với root ───────────────────────────────────────────
[ "$EUID" -eq 0 ] || { echo "Chạy với: sudo bash setup-vps.sh"; exit 1; }

APP_DIR="/opt/ujcha-api"

# ════════════════════════════════════════════════════════════════════
# 1. Cập nhật hệ thống
# ════════════════════════════════════════════════════════════════════
info "Cập nhật Ubuntu..."
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git ufw \
  ca-certificates gnupg lsb-release \
  htop unzip

# ════════════════════════════════════════════════════════════════════
# 2. Cài Docker Engine (official repo)
# ════════════════════════════════════════════════════════════════════
info "Cài Docker Engine..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

info "Docker version: $(docker --version)"
info "Docker Compose version: $(docker compose version)"

# ════════════════════════════════════════════════════════════════════
# 3. Cấu hình Firewall (UFW)
# ════════════════════════════════════════════════════════════════════
info "Cấu hình Firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh        # port 22
ufw allow http       # port 80
ufw allow https      # port 443
# KHÔNG mở port 5000, 5432, 6379 — chỉ nginx public
ufw --force enable

info "UFW status:"
ufw status verbose

# ════════════════════════════════════════════════════════════════════
# 4. Swap (nếu RAM ≤ 4GB)
# ════════════════════════════════════════════════════════════════════
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM_MB" -le 4096 ] && [ ! -f /swapfile ]; then
  info "RAM ${TOTAL_RAM_MB}MB — tạo 2GB swap..."
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  info "RAM đủ (${TOTAL_RAM_MB}MB) hoặc swap đã có, bỏ qua"
fi

# ════════════════════════════════════════════════════════════════════
# 5. Tạo thư mục app
# ════════════════════════════════════════════════════════════════════
info "Tạo thư mục $APP_DIR..."
mkdir -p "$APP_DIR/nginx/ssl"
mkdir -p "$APP_DIR/scripts"

# ════════════════════════════════════════════════════════════════════
# 6. Cài Certbot (SSL Let's Encrypt)
# ════════════════════════════════════════════════════════════════════
info "Cài Certbot..."
apt-get install -y certbot

info "✅ Setup VPS hoàn tất!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Bước tiếp theo:"
echo "  1. Upload source code vào $APP_DIR"
echo "  2. Tạo file .env.production (copy từ .env.production mẫu)"
echo "  3. Chạy: bash $APP_DIR/scripts/init-ssl.sh  (lấy SSL)"
echo "  4. Chạy: bash $APP_DIR/deploy.sh             (deploy)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
