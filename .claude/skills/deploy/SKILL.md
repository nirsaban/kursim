---
name: deploy
description: Deploy kursim to production (kursim.miltech.cloud on VPS 72.62.154.127) by rsyncing the working tree and rebuilding the Docker stack. Use when the user asks to deploy, ship, or push to the server.
---

# Deploy kursim to production

Production runs on VPS `root@72.62.154.127` (Debian 13) at `https://kursim.miltech.cloud`, behind the `yogev-nginx` container (config: `/root/miluim/nginx/nginx.conf`, shared docker network `miltech-association-net`). The app lives in `/root/kursim` and is deployed by **rsync** — the server copy is not a git checkout.

## Steps

1. **Pre-flight (local)**: run `npm test` and `npx tsc --noEmit`; abort on failure. Warn if the working tree has uncommitted changes (deploys ship the working tree, committed or not).

2. **Sync** the project to the server, excluding local/state files. The server's `.env` is the production config — NEVER overwrite or delete it:

   ```bash
   rsync -az --delete \
     --exclude .git --exclude node_modules --exclude .next \
     --exclude .env --exclude tsconfig.tsbuildinfo --exclude .claude \
     --exclude '*.jar' \
     ./ root@72.62.154.127:/root/kursim/
   ```

3. **Rebuild & restart** (migrations + seed run automatically on boot):

   ```bash
   ssh root@72.62.154.127 'cd /root/kursim && docker compose -f docker-compose.prod.yml up --build -d'
   ```

4. **Verify**:
   - `ssh root@72.62.154.127 'docker ps --filter name=kursim --format "{{.Names}} {{.Status}}"'` — all three containers up, postgres/redis healthy.
   - `ssh root@72.62.154.127 'docker logs kursim-app --tail 20'` — migrations applied, server listening, no crash loop.
   - `curl -s -o /dev/null -w "%{http_code}" https://kursim.miltech.cloud` — expect 200/3xx.

## Notes

- New env vars must be added to the server's `/root/kursim/.env` by hand (document them in `.env.example`).
- Postgres/Redis data live in named volumes (`pgdata`, `redisdata`) — `up --build` preserves them. Never run `docker compose down -v` on the server.
- TLS is terminated by yogev-nginx (certbot webroot at `/root/miluim/certbot/`); the app publishes no ports and is reachable only over the shared proxy network.
