#!/bin/sh
set -e

ENV_FILE="/var/www/html/.env"

# The image ships with a minimal .env containing only APP_KEY= (see Dockerfile).
# All other config (DB, Redis, weather, mail) is injected by Docker as real process
# environment variables, which Laravel's env() reads directly — no .env entry needed.
#
# We only need to write APP_KEY to the file because php artisan key:generate and
# certain framework bootstrapping steps read it from the file, not the process env.

if [ -n "$APP_KEY" ]; then
    # Key was supplied by the orchestrator — write it into the .env file.
    sed -i "s|^APP_KEY=.*|APP_KEY=${APP_KEY}|" "$ENV_FILE"
else
    # No key supplied — generate one and write it into the .env file.
    echo "Generating APP_KEY..."
    php artisan key:generate --no-interaction --force
fi

echo "Running migrations..."
php artisan migrate --force --no-interaction

echo "Seeding database..."
php artisan db:seed --force --no-interaction 2>/dev/null || true

exec "$@"
