#!/bin/bash
# Creates the non-superuser app role (subject to RLS). Runs once on first boot
# of a fresh postgres volume. Password comes from KURSIM_APP_PASSWORD
# (falls back to the local-dev default).
set -e

APP_PW="${KURSIM_APP_PASSWORD:-kursim_app_pw}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE kursim_app LOGIN PASSWORD '${APP_PW}' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    GRANT CONNECT ON DATABASE kursim TO kursim_app;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname kursim <<-EOSQL
    GRANT USAGE ON SCHEMA public TO kursim_app;
EOSQL
