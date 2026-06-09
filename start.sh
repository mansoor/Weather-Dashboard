#!/usr/bin/env bash
set -e

echo "🌤️  Weather Dashboard — starting up"

# Copy .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📋 Created .env from .env.example — edit it to set your location"
fi

# Generate APP_KEY if missing
if grep -q 'APP_KEY=$' .env; then
  KEY=$(docker run --rm php:8.3-cli php -r "echo 'base64:'.base64_encode(random_bytes(32));")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|APP_KEY=|APP_KEY=${KEY}|" .env
  else
    sed -i "s|APP_KEY=|APP_KEY=${KEY}|" .env
  fi
  echo "🔑 Generated APP_KEY"
fi

# Build and start
docker compose up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Trigger first weather fetch
echo "🌍 Fetching initial weather data..."
docker compose exec -T backend php artisan weather:fetch --sync || true

echo ""
echo "✅ Weather Dashboard is running!"
echo ""
echo "   Dashboard:  http://localhost       (nginx proxy)"
echo "   Frontend:   http://localhost:3000"
echo "   Backend:    http://localhost:8000"
echo ""
echo "📍 To change location, edit WEATHER_LAT / WEATHER_LON / WEATHER_LOCATION_NAME in .env"
echo "   then run: docker compose restart backend worker scheduler"
