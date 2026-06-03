## Design System
@.claude/output-styles/design.md

Every UI component, page, and style change MUST follow the UjCha design system above.

## MCP & Context Optimization
* **Priority Tooling**: Always prioritize using the `serena` MCP server for context gathering, project indexing, and code search.
* **Token Efficiency**: Before reading multiple files manually with `ls` or `cat`, use `serena`'s search/indexing tools to identify and fetch only the relevant code snippets.
* **Workflow**:
1. Use `serena` to get a high-level overview of the project structure.
2. Use `serena` to locate specific logic or variable definitions instead of broad file reads.
3. Only request full file content if summaries are insufficient.


## Subagents

Spawn subagents to isolate context, parallelize independent work, or offload bulk mechanical tasks. Don't spawn when the parent needs the reasoning, when synthesis requires holding things together, or when spawn overhead dominates.

Pick the cheapest model that can do the subtask well:
- Haiku: bulk mechanical work, no judgment
- Sonnet: scoped research, code exploration, in-scope synthesis
- Opus: subtasks needing real planning or tradeoffs

If a subagent realizes it needs a higher tier than itself, return to the parent.

Parent owns final output and cross-spawn synthesis. User instructions override.

## Preferred Tools

### Data Fetching

1. **WebFetch**: free, text-only, works on public pages that don't block bots.
2. **agent-browser CLI**: free, local Rust CLI + Chrome via CDP. For dynamic pages or auth walls that WebFetch can't handle. Returns the accessibility tree with element refs (@e1, @e2). ~82% fewer tokens than screenshot-based tools. Install: `npm i -g agent-browser && agent-browser install`. Use `snapshot` for AI-friendly DOM state, element refs for interaction.
3. **Notice recurring fetch patterns and propose wrapping them as dedicated tools.** When the same fetch/parse logic comes up more than once, suggest wrapping it as a named tool (e.g. a skill file or a .py script that calls `agent-browser` with the snapshot and extraction steps baked in for that source). Add the entry to `## Dedicated Tools` below and reference it by name on future calls.

### PDF Files

Use 'pdftotext', not the 'Read' tool. Use 'Read' only when the user directly asks to analyze images or charts inside the document. Read loads PDFs as images.

## App Roster

| App | Folder | Package | Port / Target |
|---|---|---|---|
| Customer web | `apps/web` | `web` | :3000 |
| Admin panel | `apps/web-admin` | `web-admin` | :3001 |
| NestJS API | `apps/api` | `api` | :5000 |
| Shipper mobile | `apps/mobile-delivery` | `ujcha-delivery` | Expo / RN |
| POS desktop | `apps/pos` | `ujcha-pos` | Electron |

### Shipper Mobile (apps/mobile-delivery)

Expo SDK 56, expo-router file-based routing. Package name: **`ujcha-delivery`**.

- **Run**: `pnpm dev:delivery` (Expo dev server), `pnpm dev:delivery:android`, `pnpm dev:delivery:ios`
- **Auth**: Shippers log in via their Admin email+password. JWT separate from user/admin tokens. Secrets: `SHIPPER_JWT_ACCESS_SECRET`, `SHIPPER_JWT_REFRESH_SECRET`.
- **Location tracking**: Background via `expo-task-manager` task `ujcha-background-location`. Smart throttle: ≥10m OR ≥3s, high-speed mode at 1.5s. Anti-cheat on server: >150 km/h rejected.
- **Socket**: Connects to `/tracking` namespace (not the default `/`). Shipper authenticates via `shipper:auth` event with JWT.
- **Offline queue**: `@react-native-async-storage/async-storage` — queued updates flushed on reconnect.
- **Key files**:
  - `src/services/location.service.ts` — GPS + background task
  - `src/services/socket.service.ts` — socket.io with reconnect + auth buffering
  - `src/store/auth.store.ts` — Zustand + SecureStore JWT persistence
  - `src/app/(shipper)/delivery/[id].tsx` — active delivery screen (Leaflet WebView map)

### Tracking Backend (apps/api/src/modules/)

- `shipper-auth/` — `POST /shipper-auth/login`, `POST /shipper-auth/refresh`, `GET /shipper-auth/me`
- `shipper/` — `GET /shipper/orders`, `PATCH /shipper/orders/:id/start`, `PATCH /shipper/orders/:id/complete`
- `tracking/` — `POST /tracking/location` (HTTP fallback), `TrackingGateway` at WS `/tracking`

Redis keys: `shipper:{id}:location` (TTL 60s), `shipper:{id}:status` (TTL 90s). **No location writes to PostgreSQL.**

### Customer Tracking UI (apps/web)

Route: `/[locale]/track/[orderId]` — react-leaflet map, subscribes to `order:{orderId}` room via `order:watch` socket event. Smooth `panTo` animation on each location update.

## Dedicated Tools

<!-- List project-specific tools here. For each, link to its skill or script file (e.g. `tools/reddit_fetch.py`). The orchestration logic lives in those files, not here. -->

---------------

Plus, for Claude Code only, add this to settings.json:

"env": {
    "CLAUDE_CODE_DISABLE_1M_CONTEXT": "1",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "80"
}

---------------