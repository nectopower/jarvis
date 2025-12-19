# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Desativa telemetria do Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Copia apenas os manifests para aproveitar cache
COPY package.json package-lock.json ./

# Instala dependências de forma rápida e determinística
RUN npm ci

# Copia o restante do código
COPY . .

# Build do Next.js
RUN npm run build

# --- Stage 2: Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copia apenas o necessário para produção
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
