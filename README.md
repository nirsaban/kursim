# Kursim — Multi-Tenant Course Platform

A secure, self-hosted course platform with built-in device session limiting and role-based access control.

## Quick Start

### Prerequisites

- Docker and Docker Compose

### Setup

1. Clone the repository and navigate to the project directory:
   ```bash
   cd kursim
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your configuration:
   - Set `AUTH_SECRET` to a strong random value (32+ bytes): `openssl rand -base64 32`
   - Add Cloudinary credentials: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - Set the initial administrator: `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD`

4. Start the stack:
   ```bash
   docker compose up --build
   ```

5. The app will be available at `http://localhost:3000`

## First Steps

The seed creates a single platform administrator (from `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`).

1. Sign in at `/superadmin/login`
2. Create a school (this also creates its owner account)
3. The owner signs in at `/t/{school-slug}/login`, changes the initial password, and builds courses through the onboarding wizard

## Local Development

For development without Docker (requires running PostgreSQL and Redis):

1. Start services:
   ```bash
   docker compose up -d postgres redis
   ```

2. Set up migrations and seed:
   ```bash
   npm install
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kursim npx prisma migrate deploy
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kursim npx prisma db seed
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

## Project Structure

- **`docker-compose.yml`** — PostgreSQL, Redis, and app services
- **`prisma/`** — Data schema, migrations, and seed script
- **`src/app/`** — Next.js App Router (student UI, owner panel, super-admin, API)
- **`src/lib/`** — Shared utilities (auth, session registry, tenant isolation, etc.)

## Key Features

- **Device Session Limiting** — Configurable limit (default 3) with block/evict-oldest policies
- **Multi-Tenancy** — Row-level security + application-layer tenant scoping
- **Role-Based Access** — Super Admin, Owner, Instructor, Student roles
- **Course Onboarding Wizard** — New courses start with a guided flow that collects marketing content (audience, outcomes, benefits, testimonials, FAQ, pricing, styling)
- **Public Landing Pages** — Every course can publish an interactive marketing landing page (`/t/{school}/c/{courseId}`) with a curriculum accordion, testimonials, FAQ, media gallery (photos, short clips, and draggable before/after comparisons), and a themed CTA — no login required, shareable anywhere
- **Payment Link CTA** — Set a checkout URL in the wizard/marketing tab and the landing page's enroll button leads straight to payment (opens in a new tab)
- **Verified Student Reviews** — Students are prompted to rate and review when they finish the last lesson of a course (including a private note to the instructor); the owner can edit the wording before approving it to the landing page with a "verified student" badge
- **Affiliate Program** — Every enrolled student gets a personal share link (`?ref=code`) for the course landing page; unique visitors are counted (deduplicated by IP + browser in Redis) and every N visitors (default 100, `AFFILIATE_VISITS_PER_COIN`) earns the student a coin. Students track visits/coins on their course page; owners see all affiliates per course in the marketing tab
- **Cloudinary Integration** — Direct browser upload of large video assets
- **Hebrew UI** — RTL-correct interface with Tailwind CSS logical properties

## Design System

One visual system across the product: warm-paper ground, petrol brand scale, copper reserved for marketing CTAs, and a Rubik (display) + Heebo (body) Hebrew type pairing loaded via `next/font`. Shared primitives live in `src/components/ui/` (Button, Card, Field, Badge, Modal, Table, StatCard, EmptyState, ProgressBar, PageHeader); navigation is a single sticky navbar component with student/admin/super-admin variants. Landing pages pick one of five accent themes (`src/lib/landing-themes.ts`) chosen in the wizard.

## Development Commands

- `npm run dev` — Start dev server (localhost:3000)
- `npm run build` — Build for production
- `npm start` — Run production server
- `npm test` — Run test suite (Vitest)
- `npm run db:migrate` — Apply pending migrations
- `npm run db:seed` — Run seed script

## Deploying to Production

1. Set `APP_URL` to your public `https://` URL — cookies switch to `Secure` automatically based on the URL scheme.
2. Set a strong `AUTH_SECRET` (`openssl rand -base64 32`) and change all `SEED_*_PASSWORD` values **before first boot**.
3. Add Cloudinary credentials (required for video upload/playback; the app runs without them, media features return 503).
4. Change the `kursim_app` / postgres passwords in `docker-compose.yml` and `docker/initdb/01-app-user.sql` for non-local deployments, and put the app behind a TLS-terminating reverse proxy (Caddy/nginx/Traefik).
5. `docker compose up --build -d` — migrations (including Postgres row-level security) and the seed run automatically on boot.

## Security Model (verified end-to-end)

- **Session limiter**: per-tenant device limit (default 3). `BLOCK` refuses the extra login and lists active devices; `EVICT_OLDEST` disconnects the least-recently-active device instantly.
- **Instant invalidation**: every request checks Redis session liveness, so an evicted/killed/suspended session gets 401 immediately even with a valid JWT; an SSE channel pushes the eviction to the open player in real time.
- **Refresh rotation with theft detection**: refresh tokens rotate on every use; reusing a rotated token kills the session.
- **Tenant isolation, twice**: a Prisma client extension injects `tenantId` into every query, and Postgres row-level security (the app connects as a non-superuser role) independently filters rows.
- **Media**: browser uploads go directly to Cloudinary with a server-pinned signature (tenant folder + `authenticated` type); playback uses signed, expiring URLs minted only for live, enrolled sessions.
- Rate limiting on login/refresh/invite, argon2id hashing, httpOnly/SameSite cookies, zod validation on every API input, hashed single-use invite tokens, non-root Docker user.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full system design, security model, and phased roadmap.
