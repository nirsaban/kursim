#!/usr/bin/env bash
# Full stack locally without dockerizing the app: postgres + redis run in
# docker (published on 15432/16379 via docker-compose.dev.yml), the Next.js
# app runs natively with `next dev`.
#
# Exported vars win over .env, so a stale DATABASE_URL there can't point the
# dev server at another project's postgres (5432 is a shared, contested port).
set -euo pipefail
cd "$(dirname "$0")/.."

export DATABASE_URL="postgresql://kursim_app:kursim_app_pw@localhost:15432/kursim"
export MIGRATE_DATABASE_URL="postgresql://postgres:postgres@localhost:15432/kursim"
export REDIS_URL="redis://localhost:16379"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml"

# Free port 3000 and avoid two app builds sharing one database.
$COMPOSE stop app >/dev/null 2>&1 || true

echo "▸ Starting postgres + redis (host ports 15432 / 16379)..."
$COMPOSE up -d --wait postgres redis

echo "▸ Applying migrations..."
DATABASE_URL="$MIGRATE_DATABASE_URL" npx prisma migrate deploy

echo "▸ Seeding (idempotent)..."
DATABASE_URL="$MIGRATE_DATABASE_URL" npm run --silent db:seed || true

echo "▸ Starting next dev on http://localhost:3000"
npm run dev
