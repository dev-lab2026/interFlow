# ============================================================
# BUILD
# ============================================================

FROM node:20-alpine AS build

WORKDIR /app

ENV NODE_ENV=development

# Install dependencies first for Docker layer caching
COPY package.json package-lock.json ./

RUN npm ci \
    --no-audit \
    --no-fund \
    --loglevel verbose

# Copy application
COPY . .

# Build application
RUN npm run build


# ============================================================
# RUNTIME
# ============================================================

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# Install only production dependencies
COPY package.json package-lock.json ./

RUN npm ci \
    --omit=dev \
    --no-audit \
    --no-fund \
    --loglevel verbose \
    && npm cache clean --force

# Copy compiled application
COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["node", "dist/server.cjs"]