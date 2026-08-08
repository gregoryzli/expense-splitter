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

# Lambda Web Adapter: an AWS-maintained extension that lets this exact
# image run on Lambda (behind a Function URL) with zero app code changes --
# it's a sidecar that translates Lambda invocations into normal HTTP
# requests against the server this image already runs. A no-op outside
# Lambda (docker run / docker-compose / any other host never loads it),
# so the same image serves both without a build-arg branch.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

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
