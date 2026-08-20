# ==========================================================
# BUILD
# ==========================================================

FROM oven/bun:1-alpine AS build

WORKDIR /app

ENV NODE_ENV=development

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build


# ==========================================================
# RUNTIME
# ==========================================================

FROM oven/bun:1-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile --production

COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["bun", "dist/server.cjs"]