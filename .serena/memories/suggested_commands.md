# Suggested Commands for ujcha

## Root-level (Turborepo)
```powershell
pnpm dev              # Run all apps in parallel
pnpm dev:web          # Run web only (port 3000)
pnpm dev:api          # Run API only (port 5000)
pnpm dev:admin        # Run web-admin only (port 3001)
pnpm build            # Build all apps
pnpm build:web        # Build web only
pnpm build:api        # Build API only
pnpm build:admin      # Build web-admin only
pnpm lint             # Lint all apps
pnpm install:all      # Install all dependencies
```

## API-specific (run from apps/api)
```powershell
pnpm --filter api run dev          # Start NestJS in watch mode
pnpm --filter api run build        # Build NestJS
pnpm --filter api run test         # Run Jest unit tests
pnpm --filter api run test:e2e     # Run e2e tests
pnpm --filter api run lint         # Lint + fix
pnpm --filter api run format       # Prettier format
pnpm --filter api run prisma:generate   # Generate Prisma client
pnpm --filter api run prisma:migrate    # Run migrations (dev)
pnpm --filter api run prisma:studio     # Open Prisma Studio UI
```

## Web-specific (run from apps/web)
```powershell
pnpm --filter web run dev          # next dev --turbo + i18nexus listen
pnpm --filter web run build        # i18nexus pull + next build
pnpm --filter web run i18n:pull    # Pull translations from i18nexus
pnpm --filter web run lint         # ESLint
```

## Web-admin-specific
```powershell
pnpm --filter web-admin run dev    # next dev -p 3001
pnpm --filter web-admin run build  # next build
pnpm --filter web-admin run lint   # ESLint
```

## Windows utility commands
```powershell
Get-ChildItem                      # list directory (equivalent to ls)
Get-Content <file>                 # read file (equivalent to cat)
Set-Location <dir>                 # change directory
```
