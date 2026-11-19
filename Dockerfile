# connect-nest — NestJS backend
# -------------------------------------------------------
# Last deploy test: 2026-02-15
FROM node:22-alpine AS base
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# --- build ---
FROM base AS build
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=prisma/schema.prisma
RUN yarn build

# --- prod ---
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.mts ./prisma.config.mts
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts/check-schema-drift.mjs ./scripts/check-schema-drift.mjs

EXPOSE 3000

# migrate deploy only runs unrecorded migration files; the drift check then
# checks the live DB has everything schema.prisma needs and refuses to start
# if anything is missing (see scripts/check-schema-drift.mjs).
CMD ["sh", "-c", "npx prisma migrate deploy && yarn prisma:check-drift && node dist/src/main.js"]
