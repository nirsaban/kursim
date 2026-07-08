# Build stage
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs ./
COPY src ./src
COPY public ./public
RUN npm ci
RUN npm run build
RUN npx esbuild prisma/seed.ts --bundle --platform=node --target=node22 --outfile=prisma/seed.js --packages=external

# Runtime stage
FROM node:22-alpine AS runtime
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# ffmpeg for the AI-media worker (frame extraction). Alpine's musl build runs
# reliably, unlike the glibc ffmpeg-static binary. Workers set FFMPEG_PATH.
RUN apk add --no-cache ffmpeg

# Copy built app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma/seed.js ./prisma/seed.js

# Copy node_modules needed for prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Worker sources (run via tsx) — not part of the Next standalone bundle.
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

USER nextjs
EXPOSE 3000
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000

ENTRYPOINT ["/app/entrypoint.sh"]
