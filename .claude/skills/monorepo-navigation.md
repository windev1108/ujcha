# Skill: monorepo-navigation

Project structure:

apps/api → NestJS backend
apps/web → Next.js frontend
apps/web-admin → Next.js frontend admin panel

packages → shared libraries

Rules:
- Backend work only in apps/api
- Frontend work only in apps/web & apps/web-admin
- Shared logic in packages
- Never analyze the whole repository