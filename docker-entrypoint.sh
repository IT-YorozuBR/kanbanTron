#!/bin/sh
set -e

mkdir -p /app/data/uploads

npx prisma migrate deploy

exec "$@"
