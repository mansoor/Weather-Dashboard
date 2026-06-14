#!/bin/sh
set -e

ENV_FILE="/var/www/html/.env"

# Why we materialise a full .env at runtime:
# Config is injected by Docker as process environment variables. That works for
# CLI commands (artisan migrate/queue/schedule) which inherit the full env, but
# NOT for `php artisan serve` — it boots a child PHP server that re-reads config
# from the .env *file*, so any value present only in the process environment is
# lost and falls back to framework defaults (e.g. DB_HOST → 127.0.0.1, causing
# "Connection refused" on every DB-backed request). We therefore write the
# injected values into .env so both the CLI and the serve child agree.

: > "$ENV_FILE"

for var in \
    APP_NAME APP_ENV APP_KEY APP_DEBUG APP_URL \
    DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD \
    REDIS_HOST REDIS_PORT \
    CACHE_DRIVER CACHE_STORE QUEUE_CONNECTION SESSION_DRIVER \
    OPEN_METEO_BASE_URL OPEN_AQI_BASE_URL \
    WEATHER_LAT WEATHER_LON WEATHER_LOCATION_NAME WEATHER_FETCH_INTERVAL \
    ALERT_TEMP_HIGH ALERT_TEMP_LOW ALERT_WIND_HIGH ALERT_AQI_HIGH ALERT_EMAIL \
    FRONTEND_URL \
    MAIL_MAILER MAIL_HOST MAIL_PORT MAIL_USERNAME MAIL_PASSWORD MAIL_FROM_ADDRESS \
    APPRISE_URL APPRISE_KEY APPRISE_NOTIFICATION_URLS
do
    eval "val=\${$var:-}"
    if [ -n "$val" ]; then
        printf '%s=%s\n' "$var" "$val" >> "$ENV_FILE"
    fi
done

# Ensure an APP_KEY line always exists so key:generate can populate it.
grep -q '^APP_KEY=' "$ENV_FILE" || echo 'APP_KEY=' >> "$ENV_FILE"

if [ -z "$APP_KEY" ]; then
    echo "Generating APP_KEY..."
    php artisan key:generate --no-interaction --force
fi

echo "Running migrations..."
php artisan migrate --force --no-interaction

echo "Seeding database..."
php artisan db:seed --force --no-interaction 2>/dev/null || true

exec "$@"
