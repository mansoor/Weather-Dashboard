#!/bin/sh
set -e

ENV_FILE="/var/www/html/.env"

# Build a .env file from injected environment variables if one does not exist.
# Every value is wrapped in double-quotes so dotenv never chokes on spaces
# (e.g. APP_NAME="Weather Dashboard", WEATHER_LOCATION_NAME="New York").
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env from environment..."
    cat > "$ENV_FILE" <<EOF
APP_NAME="${APP_NAME:-Weather Dashboard}"
APP_ENV="${APP_ENV:-local}"
APP_KEY="${APP_KEY:-}"
APP_DEBUG="${APP_DEBUG:-true}"
APP_URL="${APP_URL:-http://localhost}"

DB_CONNECTION="mysql"
DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${DB_DATABASE:-weather_dashboard}"
DB_USERNAME="${DB_USERNAME:-weather}"
DB_PASSWORD="${DB_PASSWORD:-weatherpass}"

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="null"
REDIS_DB="0"

CACHE_DRIVER="${CACHE_DRIVER:-redis}"
QUEUE_CONNECTION="${QUEUE_CONNECTION:-redis}"

OPEN_METEO_BASE_URL="${OPEN_METEO_BASE_URL:-https://api.open-meteo.com/v1}"
OPEN_AQI_BASE_URL="${OPEN_AQI_BASE_URL:-https://air-quality-api.open-meteo.com/v1}"

WEATHER_LAT="${WEATHER_LAT:-51.5074}"
WEATHER_LON="${WEATHER_LON:--0.1278}"
WEATHER_LOCATION_NAME="${WEATHER_LOCATION_NAME:-London}"

ALERT_TEMP_HIGH="${ALERT_TEMP_HIGH:-35}"
ALERT_TEMP_LOW="${ALERT_TEMP_LOW:-0}"
ALERT_WIND_HIGH="${ALERT_WIND_HIGH:-50}"
ALERT_AQI_HIGH="${ALERT_AQI_HIGH:-3}"

MAIL_MAILER="${MAIL_MAILER:-log}"
MAIL_HOST="${MAIL_HOST:-}"
MAIL_PORT="${MAIL_PORT:-587}"
MAIL_USERNAME="${MAIL_USERNAME:-}"
MAIL_PASSWORD="${MAIL_PASSWORD:-}"
MAIL_FROM_ADDRESS="${MAIL_FROM_ADDRESS:-noreply@weather.local}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
EOF
fi

# Generate APP_KEY into the .env file only when the value is blank.
if grep -qE '^APP_KEY=""?$' "$ENV_FILE"; then
    echo "Generating APP_KEY..."
    php artisan key:generate --no-interaction --force
fi

# Run migrations (idempotent — safe on every restart).
echo "Running migrations..."
php artisan migrate --force --no-interaction

# Seed default thresholds (uses updateOrCreate — safe to re-run).
echo "Seeding database..."
php artisan db:seed --force --no-interaction 2>/dev/null || true

# Hand off to whatever command was passed (serve / queue:work / schedule:work).
exec "$@"
