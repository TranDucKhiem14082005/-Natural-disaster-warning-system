#!/bin/sh
set -e

# Config comes from container env vars (no .env in the image); cache it once per container start.
php artisan config:cache >/dev/null
php artisan route:cache >/dev/null
php artisan event:cache >/dev/null

exec "$@"
