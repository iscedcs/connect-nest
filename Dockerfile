# connect-nest — NestJS backend
# -------------------------------------------------------
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

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/src/main.js"]
