# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# python3/make/g++ let npm fall back to compiling native addons (sharp,
# better-sqlite3) if a prebuilt binary isn't published for this platform.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Drop devDependencies (typescript, eslint, tailwind, @types/*) now that the
# build output exists; keeps the runtime image smaller without needing
# Next.js "standalone" output mode.
RUN npm prune --omit=dev


FROM node:22-bookworm-slim AS runner
WORKDIR /app

# Prisma's query engine links against libssl at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV PORT=3000

# node_modules/.next/public/prisma only need to be *readable* by the runtime
# user, so they're left root-owned (fast: no ownership walk over the tree).
# --chown here applies ownership as part of the copy itself instead of a
# separate recursive chown pass afterwards, which is what made this step slow.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh

# Only /app/data needs to be writable by the runtime user (it's the volume
# mount point for the sqlite db + uploaded media); it's small/empty here so
# chown on it is instant.
RUN chmod +x ./docker-entrypoint.sh \
    && mkdir -p /app/data/uploads \
    && chown -R nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
