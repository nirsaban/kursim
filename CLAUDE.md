# CLAUDE.md

Kursim — a self-hosted, multi-tenant course platform (Hebrew, RTL-only) with device session limiting as its key feature. Full system design: [ARCHITECTURE.md](./ARCHITECTURE.md). Setup/run instructions: [README.md](./README.md).

## Stack

Next.js 15 (App Router, TypeScript, standalone output) · PostgreSQL 16 + Prisma 6 · Redis 7 (ioredis) · Cloudinary · Docker Compose · Tailwind CSS · Vitest.

Auth is hand-rolled by design (`jose` JWT + `@node-rs/argon2`) — **do not introduce NextAuth** or another auth abstraction; owning the session lifecycle *is* the product.

## Commands

- `npm run dev` — dev server on localhost:3000 (needs Postgres + Redis: `docker compose up -d postgres redis`)
- `npm test` — Vitest suite (uses `ioredis-mock`)
- `npm run build` — `prisma generate && next build`
- `npm run db:migrate` / `npm run db:seed` — migrations / seed (both need `DATABASE_URL`)
- `docker compose up --build` — full stack; migrations + seed run automatically on boot

## Non-negotiable conventions

1. **Tenant isolation, always through the scoped client.** Never query tenant-owned models with the raw Prisma client. Every request must use the tenant-scoped client from `src/lib/tenant/scoped-prisma.ts` (injects `tenantId` into every read/create and runs `SET LOCAL app.tenant_id` for Postgres RLS). New tenant-owned tables need: a denormalized `tenantId` column, `ENABLE ROW LEVEL SECURITY` + policy in a migration, and registration in the client extension.
2. **Session liveness lives in Redis, not the JWT.** A valid JWT is not enough — every authenticated path must verify `EXISTS sess:{sid}` (middleware does this). Never add an endpoint that trusts the JWT alone. Live sessions exist only in Redis; there is no sessions table.
3. **All user-facing strings go in `src/lib/he.ts`.** No hardcoded Hebrew (or English) strings in components. One dictionary file, keyed access.
4. **RTL via Tailwind logical properties.** Use `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`, `text-start`/`text-end` — never `ml-*`/`mr-*`/`left-*`/`right-*`.
5. **zod on every API boundary.** Every route handler validates its input with a zod schema (see `src/lib/validation/`).
6. **Media is never public.** Cloudinary assets are `type: authenticated` under `tenants/{tenantId}/...`; playback/download URLs are signed and expiring, minted only after session + enrollment + tenant checks. Uploads go browser→Cloudinary with a server-pinned signature; verify returned `public_id` is inside the tenant's folder prefix before persisting.
7. **No secrets in the repo.** New env vars get documented in `.env.example`.

## Layout

- `src/middleware.ts` — JWT verify + Redis session liveness + tenant resolve (403 on JWT-tenant vs URL-slug mismatch)
- `src/app/t/[slug]/` — student UI (player has SSE eviction listener + 30s heartbeat); `t/[slug]/admin/` — owner panel; `superadmin/` — platform admin; `api/` — route handlers
- `src/app/t/[slug]/c/[courseId]` — public course landing pages (no login; affiliate `?ref=` tracking)
- `src/lib/auth/` — jwt, password, guards · `src/lib/session-registry/` — create/validate/evict/list, BLOCK/EVICT_OLDEST policy · `src/lib/tenant/` — scoped prisma + resolve · `src/lib/cloudinary/` — upload/delivery signing
- `src/components/ui/` — shared primitives (Button, Card, Field, Badge, Modal, Table, StatCard, EmptyState, ProgressBar, PageHeader); `src/lib/landing-themes.ts` — the five landing accent themes
- `tests/` — auth, session-limiter, tenant-isolation suites; security-critical changes need matching tests

## Roles

SUPER_ADMIN (platform, no tenant content access) · OWNER (everything in-tenant) · INSTRUCTOR (content CRUD only) · STUDENT (enrolled courses only). Email is unique **per tenant**, not globally.
