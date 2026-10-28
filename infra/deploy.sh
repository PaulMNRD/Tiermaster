#!/usr/bin/env sh
# Runs on the VPS (called by the CI deploy job): pulls the images of the given tag and restarts the stack.
# Usage: ./deploy.sh <image tag>   (from the deployment folder, which holds .env)
set -eu
cd "$(dirname "$0")"
TAG="$1"
export TAG
set -a
. ./.env
set +a

docker compose -f docker-compose.prod.yml pull
# The API applies pending migrations at start-up, then serves.
docker compose -f docker-compose.prod.yml up -d --remove-orphans
infra/garage/init.sh docker-compose.prod.yml "$S3_ACCESS_KEY" "$S3_SECRET_KEY" tiermaster-images
docker image prune -f >/dev/null
echo "Deployed $TAG"
