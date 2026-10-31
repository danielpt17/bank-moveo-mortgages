# Build context is the repository root (pnpm workspace).
FROM node:22-alpine AS base
RUN npm install -g pnpm@11
WORKDIR /app

# ---- deps: install only what the api workspace needs ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @moveo/api...

# ---- build ----
FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @moveo/api build \
 && pnpm --filter @moveo/api --prod deploy --legacy /out

# ---- runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /out/node_modules ./node_modules
COPY --from=build --chown=app:app /out/package.json ./package.json
COPY --from=build --chown=app:app /app/apps/api/dist ./dist
COPY --from=build --chown=app:app /app/apps/api/migrations ./migrations
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/v1/health || exit 1
# Run pending migrations and the idempotent seed, then start the API.
CMD ["sh", "-c", "node dist/scripts/migrate.js && node dist/scripts/seed.js && node dist/src/main.js"]
