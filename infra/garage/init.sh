#!/usr/bin/env sh
# Idempotent Garage bootstrap: single-node layout, access key, private bucket.
# Usage: infra/garage/init.sh <compose file> <access key id> <secret key> <bucket>
#   e.g. infra/garage/init.sh docker-compose.prod.yml GK1a2b... a1b2... tiermaster-images
# With GARAGE_CLI set (e.g. /garage in a container sharing the node's network), the CLI is called directly
# and the compose file argument is ignored.
set -eu
COMPOSE_FILE="$1"
KEY_ID="$2"
SECRET="$3"
BUCKET="$4"
garage() {
  if [ -n "${GARAGE_CLI:-}" ]; then "$GARAGE_CLI" "$@"; else docker compose -f "$COMPOSE_FILE" exec -T garage /garage "$@"; fi
}

# Wait for the node to answer.
i=0
until garage status >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 30 ] && { echo "Garage did not start" >&2; exit 1; }
  sleep 1
done

if garage layout show 2>/dev/null | grep -q "No nodes currently have a role"; then
  NODE_ID=$(garage node id -q | cut -d@ -f1)
  garage layout assign -z dc1 -c 10G "$NODE_ID"
  garage layout apply --version 1
fi
garage key import --yes -n tiermaster "$KEY_ID" "$SECRET" >/dev/null 2>&1 || true
garage bucket create "$BUCKET" >/dev/null 2>&1 || true
garage bucket allow --read --write --owner "$BUCKET" --key "$KEY_ID" >/dev/null
echo "Garage ready: bucket $BUCKET, key $KEY_ID"
