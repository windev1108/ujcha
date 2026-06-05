# Notification System

Implemented June 2026. Full in-app notification system.

## Backend (apps/api/src/modules/notification/)
- **NotificationGateway**: WebSocket at `/notifications` namespace. Auth via JWT token in handshake query (`?token=<accessToken>`). Maps userId → Set<socketId> in-memory.
- **NotificationService**: `createAndEmit()`, `getForUser()`, `markRead()`, `markAllRead()`, `countUnread()`
- **NotificationController**: `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` (all behind JwtAuthGuard)
- **NotificationModule**: imports PrismaModule + AuthModule (for JwtService + JwtAuthGuard)

## Integrations
- **SepayWebhookService**: fires `type=payment` notification on payment success (if order has userId)
- **OrderService.createOrder**: fires `type=order` notification after order creation (if userId)
- **OrderService.fireOrderCompletionSideEffects**: fires `type=order` notification on order completion

## Prisma
- Model: `Notification` — id, userId, type, title, content, data(Json?), isRead, createdAt
- Migration: `20260605053456_add_notifications`

## Frontend (apps/web)
- `src/services/notification/api.ts` — REST helpers
- `src/services/notification/hooks.ts` — React Query hooks (useNotificationsQuery, useUnreadCountQuery, etc.)
- `src/store/notification-store.ts` — Zustand store (unreadCount, latest for toast)
- `src/hooks/useNotificationSocket.ts` — socket.io connection to `/notifications` namespace
- `src/components/common/NotificationDropdown.tsx` — exports NotificationBell + NotificationToast
- Header.tsx — NotificationBell replaces static bell link; NotificationToast added at root

## Scale note
For multi-instance deployments, swap the in-memory `userSockets` map in `NotificationGateway` for socket.io's Redis adapter (`@socket.io/redis-adapter`) — the service layer (`createAndEmit`) stays unchanged.
