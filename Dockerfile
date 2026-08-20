# ==========================================================
# BUILD
# ==========================================================

FROM node:20-alpine AS build

WORKDIR /app

ENV NODE_ENV=development

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build


# ==========================================================
# RUNTIME
# ==========================================================

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

COPY package.json package-lock.json ./

RUN npm ci \
    --omit=dev \
    --no-audit \
    --no-fund \
    && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["node", "dist/server.cjs"]