# syntax=docker/dockerfile:1.7
# Minerval production image for the VPS (Coolify). Build on the Mac, not the VPS:
#   docker buildx build --platform linux/amd64 \
#     --secret id=buildenv,src=$HOME/.local/share/minerval-migration/build.env \
#     -t 127.0.0.1:5000/minerval:<tag> .
# build.env holds only the NEXT_PUBLIC_* values; they are baked into the client
# bundle at build time. Runtime secrets are set in Coolify, never in the image.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Loaded as environment variables for this step only. Not written as a .env
# file: Next's standalone output copies .env files into the runtime image.
RUN --mount=type=secret,id=buildenv \
    sh -c 'set -a && . /run/secrets/buildenv && set +a && npm run build'

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# curl: Coolify's health check runs curl (or wget) inside the container.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
