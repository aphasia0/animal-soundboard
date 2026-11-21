# syntax=docker/dockerfile:1.7
#
# Worker per Raspberry Pi 3 (linux/arm/v7) e sistemi ARM64.
# Node 20 + ffmpeg + le dipendenze di scripts/upload-card.js.
#
# Build consigliata da un computer x86, non sul Pi:
#   docker buildx build --platform linux/arm/v7 \
#     -t soundpad-worker:armv7 -f worker/Dockerfile .

FROM node:20-bookworm-slim AS deps

WORKDIR /app
COPY scripts/package.json scripts/package-lock.json ./scripts/
RUN cd scripts && npm ci --omit=dev --ignore-scripts


FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PORT=8787 \
    APP_DIR=/app \
    DATA_DIR=/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/scripts/node_modules ./scripts/node_modules
COPY scripts/package.json ./scripts/package.json
COPY scripts/upload-card.js ./scripts/upload-card.js
COPY worker/server.js ./worker/server.js

# public/ serve solo alla modalità local del CLI; /data conserva lo stato dei job.
RUN mkdir -p /app/public/sounds /data/jobs \
    && chown -R node:node /app /data

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/app/worker/server.js"]
