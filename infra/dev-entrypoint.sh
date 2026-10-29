#!/bin/sh
# Runs the command as the owner of the bind-mounted repository, so that generated files (dist, Prisma client,
# Angular cache) belong to the host user: root under rootless Docker, the host UID under rootful Docker.
set -eu
uid=$(stat -c %u /repo)
gid=$(stat -c %g /repo)
[ "$uid" = 0 ] && exec "$@"
chown "$uid:$gid" /repo/node_modules /repo/services/*/node_modules "$HOME"
exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$@"
