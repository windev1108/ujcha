# Code Style & Conventions

## TypeScript (all apps)
- TypeScript strict mode; `@types/*` packages used throughout
- NestJS uses decorators (class-based, `@Module`, `@Controller`, `@Injectable`, etc.)
- DTOs with `class-validator` decorators for validation
- Interfaces/types in separate files where applicable

## Formatting (API)
- Prettier: `singleQuote: true`, `trailingComma: "all"`
- ESLint with `eslint-config-prettier` and `eslint-plugin-prettier`

## Naming Conventions
- Files: kebab-case (`app.module.ts`, `product.service.ts`)
- Classes: PascalCase (`ProductService`, `CreateProductDto`)
- Variables/functions: camelCase
- Database fields: camelCase in Prisma schema (maps to snake_case in DB via Prisma)
- Enums: PascalCase names, camelCase values (e.g., `PointTransactionType { earn, spend, expire }`)

## Frontend (web & web-admin)
- Next.js App Router with `[locale]` dynamic segment for i18n (web)
- TailwindCSS v4 utility classes
- HeroUI component library
- Zustand for global state management
- TanStack Query for server state / data fetching
- Axios for HTTP requests in `services/` layer
- lucide-react for icons

## Comments
- Vietnamese-language comments in Prisma schema (domain context)
- Minimal inline comments elsewhere

## Git
- Conventional commits style: `fix:`, `feat:`, etc.
