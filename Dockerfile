# ============================================
# Stage 1: Base - System dependencies + Chromium
# ============================================
FROM node:20-bookworm-slim AS base

# Install Chromium and all required system dependencies for Playwright/CloakBrowser
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libgbm1 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libxshmfence1 \
    libglu1-mesa \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for browser runtimes
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# ============================================
# Stage 2: Dependencies
# ============================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ============================================
# Stage 3: Builder
# ============================================
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client using the LOCAL pinned binary
# (never use npx here — npx falls back to downloading "latest" if the
# local binary can't be resolved, which is what caused the v7 mismatch)
RUN ./node_modules/.bin/prisma generate

# Build Next.js (standalone mode)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ============================================
# Stage 4: Runner (Production)
# ============================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV HOSTNAME=0.0.0.0

# Create nextjs user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
# (Commented out because public folder does not exist in this project)
# COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema + migrations for runtime/deployment migrations
COPY --from=builder /app/prisma ./prisma

# Copy node_modules + package.json so the pinned Prisma CLI is available
# at runtime. Without this, any `npx prisma ...` call at container start
# has no local binary to resolve, so npx silently downloads the latest
# major version (7.x), which is incompatible with the pre-7 schema syntax
# (datasource { url = env(...) }) and fails with P1012.
#
# IMPORTANT: copy from `builder`, not `deps`. The `builder` stage already
# ran `prisma generate`, so its node_modules contains the generated
# @prisma/client. The `deps` stage never runs generate, so copying from
# it overwrites the standalone output's node_modules with an
# un-generated client, causing "did not initialize yet" errors.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Entrypoint script: run migrations with the LOCAL pinned prisma binary,
# then hand off to the Next.js standalone server.
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 10000

# Use dumb-init to handle PID 1 properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]