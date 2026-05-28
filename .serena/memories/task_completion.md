# What To Do When a Task Is Completed

## API (NestJS)
1. Run `pnpm --filter api run lint` to lint and auto-fix
2. Run `pnpm --filter api run format` to format with Prettier
3. If schema changed: `pnpm --filter api run prisma:generate` then `pnpm --filter api run prisma:migrate`
4. Run `pnpm --filter api run test` to verify unit tests pass

## Web (Next.js customer app)
1. Run `pnpm --filter web run lint` to lint
2. If i18n strings changed: run `pnpm --filter web run i18n:pull` to sync translations
3. Test locally with `pnpm dev:web`

## Web-Admin (Next.js admin app)
1. Run `pnpm --filter web-admin run lint` to lint
2. Test locally with `pnpm dev:admin`

## General
- Run `pnpm lint` from root to lint all apps at once
- Run `pnpm build` from root to verify build succeeds across all apps
- Commit with conventional commit messages (e.g., `fix:`, `feat:`, `chore:`)
