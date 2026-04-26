# ── Stage 1: Frontend build ──────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: Backend deps ───────────────────────────
FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

# ── Stage 3: Runtime ────────────────────────────────
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/ ./
COPY --from=frontend /app/dist ./dist/
RUN mkdir -p data/projekty

EXPOSE 3000
CMD ["node", "server.js"]
