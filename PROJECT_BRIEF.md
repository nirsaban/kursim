# Kursim — Project Brief

> Auto-generated investigation brief. Companion to `README.md` and `ARCHITECTURE.md`.
> Part of the GeniriFlow portfolio. Shared conventions: `../GeniriFlow-Brain/BRAIN.md`.

## What it is

**Kursim — a multi-tenant course platform.** A secure, self-hosted platform for selling and
delivering online courses, with built-in **device/session limiting (anti-sharing)** and
role-based access control. Hebrew RTL UI. Status per `ARCHITECTURE.md`: MVP built and
verified end-to-end.

## Stack

- **Framework**: Next.js 15 (App Router, TypeScript, standalone output) — one app serves the
  student player, owner panel, super-admin panel, **and** the API (route handlers).
- **DB / ORM**: PostgreSQL 16 + Prisma. Tenant isolation via Prisma **client extensions**
  (auto-inject `tenant_id`) **plus Postgres row-level security (RLS)** as a second layer.
- **Cache / sessions**: Redis 7 — per-user session sets with TTLs for O(1) "is this session
  alive?" checks and instant eviction (the anti-sharing feature).
- **Auth**: custom, deliberately **not NextAuth** — `jose` (JWT/jti) + `argon2id` password
  hashing. The session registry (jti validation, block-vs-evict, instant kill) is the product's
  key feature, so the auth code is owned directly.
- **Validation**: Zod at every API boundary. **Rate limiting**: Redis fixed-window on auth.
- **Media**: Cloudinary (only external service). **Styling**: Tailwind (logical properties, RTL).
- **Tests**: Vitest (auth/session suite). **Deploy**: Docker Compose.

## Layout

```
src/app/          Next.js App Router — student /t/[slug], owner /t/[slug]/admin, /superadmin
src/lib/          auth, session registry, prisma, tenant resolution
src/components/    UI
src/middleware.ts  JWT verify + tenant resolve on every request
prisma/           schema + migrations
tests/            Vitest
docker/, docker-compose.yml, docker-compose.prod.yml, Dockerfile
```

## Invariants

- **Two-layer tenant isolation**: Prisma client-extension `tenant_id` scoping **and** Postgres
  RLS. Never bypass either — RLS is the backstop if app code misses a filter.
- **Session registry is the product.** Every request validates the JWT `jti` against Redis;
  sessions can be blocked or evicted instantly. Don't route around it or cache past its TTL.
- Roles: super-admin → owner (tenant) → student. Tenant resolved from the URL slug in middleware.
- Validate every API input with Zod; hash passwords with argon2id; rate-limit auth endpoints.

## Commands

```bash
docker compose up --build     # full stack
npm run dev                   # local dev
npm run db:migrate && npm run db:seed
npm run test                  # Vitest (auth/session)
```

## Fit with the portfolio

Reinforces the shared patterns: multi-tenant isolation, JWT auth, Hebrew RTL, Prisma tenant
scoping, Docker. Distinctive additions: Postgres RLS as a second isolation layer, and a
Redis-backed session registry for device limiting. Local agents live under `.claude/agents/`.
