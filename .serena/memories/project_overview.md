# Project Overview: UjCha

## Purpose
UjCha is a full-stack monorepo for a Vietnamese café marketplace — loyalty points, referral programs, HRM, e-commerce (orders, products, cart, vouchers, blogs), real-time POS, and shipper delivery tracking.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces (pnpm@10.33.0, Node>=20)
- **Frontend (web)**: Next.js 16 + React 19, Tailwind CSS v4, HeroUI, TanStack Query, Zustand, next-intl (i18n), Lucide icons, Motion, react-leaflet
- **Admin (web-admin)**: Next.js 16 + React 19, Tailwind CSS v4, HeroUI, Tiptap editor, Recharts, Socket.io-client, face-api.js, react-qr-code
- **Backend (api)**: NestJS 11, Prisma 5 (PostgreSQL/Supabase), JWT/Passport, Socket.io (WebSockets), Swagger, bcrypt, class-validator, ioredis
- **Mobile (mobile-delivery)**: Expo SDK 56 (React Native 0.85.3), expo-router, expo-location, expo-task-manager, zustand, socket.io-client, axios, expo-secure-store
- **Database**: PostgreSQL via Prisma ORM; schema at `apps/api/prisma/schema.prisma`
- **Cache / Realtime**: Redis (ioredis) — location cache, online-status TTL, pub/sub
- **i18n**: i18nexus CLI for web app (en/vi locales)
- **Image**: Cloudinary

## Codebase Structure
```
ujcha/
├── apps/
│   ├── web/              # Customer Next.js app (port 3000)
│   │   └── src/{app,components,hooks,services,store,lib,config,i18n,assets}
│   │   └── src/app/[locale]/track/[orderId]/  ← customer shipper-tracking UI
│   ├── web-admin/        # Admin Next.js app (port 3001)
│   │   └── src/{app,components,hooks,services,store,lib,config}
│   ├── api/              # NestJS API (port 5000)
│   │   └── src/modules/
│   │       ├── shipper-auth/   ← JWT auth for shipper mobile app
│   │       ├── shipper/        ← order management endpoints for shippers
│   │       ├── tracking/       ← real-time location + WebSocket gateway
│   │       └── {auth,user,product,order,cart,blog,point,referral,...}
│   ├── mobile-delivery/  # Shipper mobile app (Expo SDK 56) — package: ujcha-delivery
│   │   └── src/
│   │       ├── app/(auth)/login.tsx
│   │       ├── app/(shipper)/index.tsx        ← assigned orders list
│   │       ├── app/(shipper)/delivery/[id].tsx ← live map + tracking controls
│   │       ├── app/(shipper)/profile.tsx
│   │       ├── services/{api,socket,location,queue}.service.ts
│   │       ├── store/{auth,orders,tracking}.store.ts
│   │       ├── hooks/{use-auth,use-orders,use-tracking}.ts
│   │       └── utils/{distance,anti-cheat}.ts
│   └── pos/              # Electron POS desktop app
└── packages/             # Shared packages (currently empty)
```

## Key API Modules
address, admin, auth, blog, cart, events, fraud, google-auth, health, order, otp, point, prisma, product, profile, referral, session, **shipper-auth**, **shipper**, shipping, sms, table, **tracking**, user, voucher, webhook

## Web-Admin Routes
landing, attendance, categories, hrm, login, orders, payment-config, points, posts, products, referrals, shippers, tables, taxes, toppings, users, vouchers

## Web (Customer) Routes
landing, menu, product-detail, cart, checkout, orders, order-detail, **track/[orderId]**, profile, loyalty, rewards, vouchers, referral, blog, group-order, quick-order, table, login, register

## Shipper Tracking System (built May 2026)

### Flow
```
Shipper App (React Native)
  → POST /shipper-auth/login  (email + admin password)
  → WS /tracking  (emit location:update every ≥10m / ≥3s)
  → Redis  shipper:{id}:location  TTL 60s
            shipper:{id}:status   TTL 90s
  → WS broadcast → order:{orderId} room
  → Customer web /track/[orderId]  (react-leaflet map)
```

### Auth Model
- Shippers are `Admin` records with a linked `Shipper` record (`adminId` FK)
- Login: `POST /shipper-auth/login` → `{ email, password }` → returns `{ accessToken, refreshToken, shipper }`
- JWT payload: `{ sub: adminId, shipperId, typ: 'shipper' }`
- Separate env secrets: `SHIPPER_JWT_ACCESS_SECRET`, `SHIPPER_JWT_REFRESH_SECRET`

### Key Design Decisions
- **No continuous DB writes** — location stored in Redis only (TTL 60s)
- **Smart throttle on mobile**: distance filter ≥10m AND time ≥3s; high-speed (>30 km/h) → 1.5s interval
- **Anti-cheat**: server rejects location implying speed >150 km/h
- **Background tracking**: `expo-task-manager` task `ujcha-background-location` continues when app minimised
- **Offline queue**: `@react-native-async-storage/async-storage` buffers when socket disconnected; flushed on reconnect
- **WebSocket namespace**: `/tracking` (separate from default `/` used by orders)
- **Customer watch**: emit `order:watch` → join `order:{orderId}` room → receive `shipper:location` + `shipper:offline` + `order:status`

## Monorepo Scripts
| Script | What it runs |
|---|---|
| `pnpm dev` | All apps in parallel |
| `pnpm dev:web` | Customer web only |
| `pnpm dev:api` | API only |
| `pnpm dev:admin` | Admin panel only |
| `pnpm dev:delivery` | Expo mobile-delivery dev server |
| `pnpm dev:delivery:android` | Expo → Android device/emulator |
| `pnpm dev:delivery:ios` | Expo → iOS device/simulator |
| `pnpm dev:backend` | API + Admin together |

## Required ENV (api/.env additions)
```
SHIPPER_JWT_ACCESS_SECRET=<random-256bit>
SHIPPER_JWT_ACCESS_EXPIRES=8h
SHIPPER_JWT_REFRESH_SECRET=<random-256bit>
SHIPPER_JWT_REFRESH_EXPIRES=30d
```

## Required ENV (mobile-delivery / .env.local)
```
EXPO_PUBLIC_API_URL=http://<server-ip>:5000
EXPO_PUBLIC_SOCKET_URL=http://<server-ip>:5000
```
