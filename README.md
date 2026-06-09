# Weather Dashboard

A local weather monitoring dashboard with adverse-condition alerting.

**Stack:** Laravel 11 (API + scheduler) · Next.js 14 (dashboard) · MySQL 8 · Redis · Nginx

**Data sources:** [Open-Meteo](https://open-meteo.com/) (weather) · [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) (AQI) — both **free, no API key required**.

---

## Quick Start

```bash
# 1. Clone / enter the project
cd weather-dashboard

# 2. Launch everything
./start.sh
```

Open **http://localhost** in your browser.

---

## Configuration

Edit `.env` before or after first run:

```env
# Your location
WEATHER_LAT=51.5074
WEATHER_LON=-0.1278
WEATHER_LOCATION_NAME=London

# Alert thresholds (can also be changed in the Settings tab)
ALERT_TEMP_HIGH=35     # °C
ALERT_TEMP_LOW=0       # °C
ALERT_WIND_HIGH=50     # km/h
ALERT_AQI_HIGH=3       # European AQI index (1-5)

# Optional: email alerts
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=you@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM_ADDRESS=noreply@weather.local
ALERT_EMAIL=you@gmail.com
```

After changing location or email settings:
```bash
docker compose restart backend worker scheduler
```

---

## Services

| Service | Port | Description |
|---------|------|-------------|
| nginx | 80 | Reverse proxy (main entry point) |
| frontend | 3000 | Next.js dashboard |
| backend | 8000 | Laravel REST API |
| mysql | 3306 | Database |
| redis | 6379 | Queue + cache |
| worker | — | Queue worker |
| scheduler | — | Runs `weather:fetch` every 15 min |

---

## API Endpoints

```
GET  /api/weather/current         Latest reading
GET  /api/weather/history?hours=24  Historical readings
GET  /api/weather/stats?hours=24  Aggregated stats
POST /api/weather/fetch           Trigger immediate fetch

GET  /api/alerts                  Unacknowledged alerts
POST /api/alerts/{id}/acknowledge Acknowledge one alert
POST /api/alerts/acknowledge-all  Acknowledge all

GET  /api/thresholds              List thresholds
PUT  /api/thresholds/{id}         Update threshold
```

---

## Alert Types

| Metric | Default Threshold |
|--------|-------------------|
| High temperature | > 35°C |
| Low temperature | < 0°C |
| High wind speed | > 50 km/h |
| Dangerous gusts | > 80 km/h |
| Poor air quality | AQI > 3 |
| High rain probability | > 80% |
| Very high UV index | > 8 |
| Very high humidity | > 90% |

All thresholds are editable in the **Settings** tab or via `PUT /api/thresholds/{id}`.

---

## Development

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Force a weather fetch
docker compose exec backend php artisan weather:fetch --sync

# Open Laravel Tinker
docker compose exec backend php artisan tinker

# Run migrations fresh
docker compose exec backend php artisan migrate:fresh --seed
```

---

## Architecture

```
Browser
  └─ Nginx :80
       ├─ /api/*  →  Laravel :8000
       └─ /*      →  Next.js :3000
                         └─ /api/* proxy → Laravel :8000

Laravel scheduler (every 15 min)
  └─ FetchWeatherJob → Open-Meteo APIs
       └─ WeatherReading saved to MySQL
            └─ AlertService evaluates thresholds
                 └─ WeatherAlert created (+ email if enabled)
```
