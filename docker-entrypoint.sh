#!/bin/sh
set -e

# Always use the LOCAL, pinned Prisma CLI — never bare `npx prisma`,
# which will download the latest major version if it can't resolve
# a local binary (this is what caused the v7 / P1012 error).
if [ -n "$DATABASE_URL" ]; then
  echo "Running Prisma migrations..."
  ./node_modules/.bin/prisma migrate deploy
else
  echo "DATABASE_URL not set, skipping migrations."
fi

echo "Starting Next.js server..."
exec node server.js