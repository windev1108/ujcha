# Deploy UjCha API lên VPS Ubuntu 22.04

## Yêu cầu
- VPS: Ubuntu 22.04 LTS x64, tối thiểu 2 vCPU / 4GB RAM
- Domain trỏ A record về IP VPS
- Truy cập SSH với quyền sudo

---

## Bước 1 — Setup VPS (chạy 1 lần)

```bash
# SSH vào VPS
ssh root@YOUR_VPS_IP

# Tải script setup
curl -fsSL https://raw.githubusercontent.com/.../setup-vps.sh | bash
# Hoặc upload và chạy thủ công:
sudo bash /opt/ujcha-api/scripts/setup-vps.sh
```

Script tự động:
- Cài Docker Engine + Docker Compose plugin
- Cấu hình UFW firewall (chỉ mở 22, 80, 443)
- Tạo 2GB swap (nếu RAM ≤ 4GB)
- Cài Certbot

---

## Bước 2 — Upload source code

```bash
# Trên máy local — copy source lên VPS
scp -r apps/api/ root@YOUR_VPS_IP:/opt/ujcha-api/

# Hoặc dùng git clone trên VPS
ssh root@YOUR_VPS_IP
git clone https://github.com/YOUR_REPO /opt/ujcha-api
```

---

## Bước 3 — Tạo file .env.production

```bash
cd /opt/ujcha-api

# Copy template
cp .env.production .env.production.bak  # backup
nano .env.production
```

**Các giá trị BẮT BUỘC phải đổi:**
```
POSTGRES_PASSWORD=    # mật khẩu mạnh, tối thiểu 20 ký tự
JWT_ACCESS_SECRET=    # openssl rand -base64 48
JWT_REFRESH_SECRET=   # openssl rand -base64 48
ADMIN_JWT_ACCESS_SECRET=
ADMIN_JWT_REFRESH_SECRET=
SHIPPER_JWT_ACCESS_SECRET=
SHIPPER_JWT_REFRESH_SECRET=
CORS_ORIGINS=         # https://your-web.com,https://your-admin.com
```

Tạo secret ngẫu nhiên:
```bash
openssl rand -base64 48
```

---

## Bước 4 — Lấy SSL Certificate

```bash
# Domain phải đã trỏ A record về IP VPS trước bước này
sudo bash /opt/ujcha-api/scripts/init-ssl.sh api.yourdomain.com admin@yourdomain.com
```

---

## Bước 5 — Deploy lần đầu

```bash
cd /opt/ujcha-api
bash deploy.sh
```

Xem log realtime:
```bash
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Lệnh vận hành thường dùng

```bash
cd /opt/ujcha-api

# Xem status tất cả service
docker compose -f docker-compose.prod.yml ps

# Xem log API
docker compose -f docker-compose.prod.yml logs -f api

# Xem log Nginx
docker compose -f docker-compose.prod.yml logs -f nginx

# Restart API (không restart DB/Redis)
docker compose -f docker-compose.prod.yml restart api

# Dừng toàn bộ
docker compose -f docker-compose.prod.yml down

# Backup database
docker exec ujcha-postgres pg_dump -U ujcha ujcha > backup_$(date +%Y%m%d_%H%M%S).sql

# Khôi phục database
docker exec -i ujcha-postgres psql -U ujcha ujcha < backup_YYYYMMDD.sql

# Chạy Prisma Studio (tạm thời, port 5555)
docker exec -it ujcha-api npx prisma studio

# Kiểm tra dung lượng
df -h
docker system df
```

---

## Cấu trúc file trên VPS

```
/opt/ujcha-api/
├── Dockerfile
├── docker-compose.prod.yml
├── .env.production          ← KHÔNG commit vào git
├── nginx/
│   ├── nginx.conf
│   └── ssl/
│       ├── fullchain.pem    ← do Certbot tạo
│       └── privkey.pem      ← do Certbot tạo
├── scripts/
│   ├── start.sh
│   ├── setup-vps.sh
│   └── init-ssl.sh
├── prisma/
├── dist/
└── ...
```

---

## Kiến trúc mạng Docker

```
Internet
    │
    ▼ (port 80/443)
  Nginx ──────────────────────────────────┐
    │ proxy_pass http://api:5000           │
    ▼                                     │
  API (NestJS)           ujcha-internal network
    │                                     │
    ├──► Postgres (:5432)                 │
    └──► Redis    (:6379)                 │
                                          │
PostgreSQL và Redis KHÔNG expose ra ngoài ┘
```

---

## Troubleshooting

**API không start:**
```bash
docker compose -f docker-compose.prod.yml logs api
```

**Prisma migration lỗi:**
```bash
docker exec -it ujcha-api sh
npx prisma migrate status
npx prisma migrate deploy
```

**Nginx 502 Bad Gateway:**
- Kiểm tra API đã chạy chưa: `docker compose -f docker-compose.prod.yml ps`
- Kiểm tra health: `curl http://localhost:5000/health`

**Hết dung lượng:**
```bash
docker system prune -a -f  # xóa image/container không dùng
```
