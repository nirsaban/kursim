#!/bin/sh
set -e

echo "Running migrations..."
DATABASE_URL="$MIGRATE_DATABASE_URL" npx prisma migrate deploy

echo "Seeding database..."
DATABASE_URL="$MIGRATE_DATABASE_URL" node prisma/seed.js

echo "Starting app..."
exec node server.js
