# ============================================================
# BUILD
# ============================================================

FROM oven/bun:1-alpine AS build

WORKDIR /app

# Dependencies first for Docker layer caching
COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

# Application
COPY . .

# Build
RUN bun run build


# ============================================================
# RUNTIME
# ============================================================

FROM oven/bun:1-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# Production dependencies
COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production

# Built application
COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["bun", "dist/server.cjs"]