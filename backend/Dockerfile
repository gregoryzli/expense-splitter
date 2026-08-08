# --- builder: install deps, generate the Prisma client, compile TS ---
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# --- runner: only production deps + build output ---
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# .prisma holds the generated client + query engine binary built against
# this same image, which @prisma/client re-exports from at runtime.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

# Applies any pending migrations before starting -- safe to run on every
# boot since `prisma migrate deploy` is a no-op when the DB is already current.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
