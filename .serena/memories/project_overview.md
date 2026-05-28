# Project Overview: kun

## Purpose
UjCha is a full-stack monorepo for a food/retail business platform with loyalty points, referral programs, HRM, and e-commerce features (orders, products, cart, vouchers, blogs, etc.).

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces (pnpm@10.33.0, Node>=20)
- **Frontend (web)**: Next.js 16 + React 19, Tailwind CSS v4, HeroUI, TanStack Query, Zustand, next-intl (i18n), Lucide icons, Motion
- **Admin (web-admin)**: Next.js 16 + React 19, Tailwind CSS v4, HeroUI, Tiptap editor, Recharts, Socket.io-client, face-api.js, react-qr-code
- **Backend (api)**: NestJS 11, Prisma 5 (PostgreSQL/Supabase), JWT/Passport, Socket.io (WebSockets), Swagger, bcrypt, class-validator
- **Database**: PostgreSQL via Prisma ORM; schema at `apps/api/prisma/schema.prisma`
- **i18n**: i18nexus CLI for web app (en/vi locales)
- **Image**: Cloudinary

## Codebase Structure
```
kun/
├── apps/
│   ├── web/          # Customer-facing Next.js app (port 3000)
│   │   └── src/{app,components,hooks,services,store,lib,config,i18n,assets}
│   ├── web-admin/    # Admin Next.js app (port 3001)
│   │   └── src/{app,components,hooks,services,store,lib,config}
│   └── api/          # NestJS API (port 5000)
│       └── src/{modules/{auth,user,product,order,cart,blog,point,referral,...},helper}
└── packages/         # Shared packages (currently empty)
```

## Key API Modules
address, admin, auth, blog, cart, events, fraud, google-auth, health, order, otp, point, prisma, product, profile, referral, session, user, webhook

## Web-Admin Routes
landing, attendance, categories, hrm, login, orders, payment-config, points, posts, products, referrals, shippers, tables, taxes, toppings, users, vouchers
