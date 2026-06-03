#!/bin/bash
# ══════════════════════════════════════════════════════════════════════
# Lấy SSL certificate từ Let's Encrypt qua Certbot
# Chạy 1 lần sau khi domain đã trỏ về IP VPS
# Usage: sudo bash init-ssl.sh your-domain.com admin@your-domain.com
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
APP_DIR="/opt/ujcha-api"
SSL_DIR="$APP_DIR/nginx/ssl"

[ -z "$DOMAIN" ] && { echo "Usage: bash init-ssl.sh DOMAIN EMAIL"; exit 1; }
[ -z "$EMAIL"  ] && { echo "Usage: bash init-ssl.sh DOMAIN EMAIL"; exit 1; }
[ "$EUID" -eq 0 ] || { echo "Chạy với sudo"; exit 1; }

echo "[ssl] Lấy certificate cho $DOMAIN..."

# Dừng nginx nếu đang chạy để certbot dùng port 80
docker compose -f "$APP_DIR/docker-compose.prod.yml" stop nginx 2>/dev/null || true

# Lấy certificate
certbot certonly \
  --standalone \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN"

# Copy cert vào thư mục nginx
cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$SSL_DIR/fullchain.pem"
cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem   "$SSL_DIR/privkey.pem"
chmod 644 "$SSL_DIR/fullchain.pem"
chmod 600 "$SSL_DIR/privkey.pem"

# Cập nhật domain trong nginx.conf
sed -i "s/YOUR_DOMAIN.COM/$DOMAIN/g" "$APP_DIR/nginx/nginx.conf"

# Cron tự gia hạn cert mỗi ngày 3h sáng
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/fullchain.pem && cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/privkey.pem && docker exec ujcha-nginx nginx -s reload") | crontab -

echo "[ssl] ✅ Certificate đã sẵn sàng tại $SSL_DIR"
echo "[ssl] Cron tự gia hạn đã được cài đặt"
