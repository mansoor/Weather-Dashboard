# Architecture & Design Document

**Weather Dashboard** — v1.0  
**Stack:** Laravel 11 · Next.js 14 · MySQL 8 · Redis 7 · Nginx · Docker Compose

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Service Architecture](#2-service-architecture)
3. [Data Flow](#3-data-flow)
   - 3.1 [Scheduled Weather Fetch](#31-scheduled-weather-fetch)
   - 3.2 [HTTP Request Flow (Browser → API)](#32-http-request-flow-browser--api)
   - 3.3 [Alert Evaluation & Notification Flow](#33-alert-evaluation--notification-flow)
4. [Database Schema](#4-database-schema)
5. [Backend Internals (Laravel)](#5-backend-internals-laravel)
6. [Frontend Internals (Next.js)](#6-frontend-internals-nextjs)
7. [Build Process](#7-build-process)
   - 7.1 [Backend Dockerfile](#71-backend-dockerfile)
   - 7.2 [Frontend Dockerfile](#72-frontend-dockerfile)
   - 7.3 [Docker Compose Orchestration](#73-docker-compose-orchestration)
   - 7.4 [Startup Sequence & Health Checks](#74-startup-sequence--health-checks)
8. [Configuration Reference](#8-configuration-reference)
9. [External APIs](#9-external-apis)

---

## 1. System Overview

The Weather Dashboard is a self-hosted, locally accessible monitoring application. It periodically fetches weather and air quality data for a configured location, stores readings in MySQL, evaluates them against user-defined thresholds to generate alerts, and presents everything through a real-time web dashboard.

The key design choices are:

- **No paid API required.** Both data sources (Open-Meteo weather + Open-Meteo Air Quality) are free and require no API key.
- **Backend-owned scheduling.** Data collection happens entirely within Laravel's scheduler — the browser has no role in triggering fetches.
- **Decoupled worker model.** The fetch job is pushed onto a Redis queue and consumed by a dedicated worker container, so the web API stays responsive even if a fetch is slow or retried.
- **Configurable alerting.** Thresholds live in the database and can be changed at runtime via the Settings tab without restarting any service.

---

## 2. Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Docker Network                          │
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────────┐   │
│  │  Browser │───▶│  Nginx :80   │───▶│  Next.js :3000       │   │
│  └──────────┘    │  (reverse    │    │  (Dashboard UI)      │   │
│                  │   proxy)     │    └──────────────────────┘   │
│                  │              │                                │
│                  │              │───▶┌──────────────────────┐   │
│                  └──────────────┘    │  Laravel :8000       │   │
│                                      │  (REST API)          │   │
│                                      └──────────┬───────────┘   │
│                                                 │               │
│          ┌──────────────────────────────────────┤               │
│          │                                      │               │
│  ┌───────▼──────┐   ┌───────────────┐  ┌───────▼──────────┐    │
│  │  Redis :6379 │   │  Scheduler    │  │  MySQL :3306     │    │
│  │  (queue +    │◀──│  (every 15m   │  │  (persistent     │    │
│  │   cache)     │   │   dispatch)   │  │   storage)       │    │
│  └──────┬───────┘   └───────────────┘  └──────────────────┘    │
│         │                                       ▲               │
│  ┌──────▼───────┐                               │               │
│  │  Worker      │───────────────────────────────┘               │
│  │  (queue:work)│  reads+writes weather_readings,               │
│  └──────────────┘  weather_alerts, alert_thresholds             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Container | Image | Role |
|-----------|-------|------|
| `weather_nginx` | `nginx:alpine` | Reverse proxy — routes `/api/*` to Laravel, everything else to Next.js |
| `weather_frontend` | Custom (Node 20) | Next.js app server serving the dashboard UI |
| `weather_backend` | Custom (PHP 8.3) | Laravel HTTP server — handles all API requests |
| `weather_worker` | Custom (PHP 8.3) | Long-running `queue:work` process — executes `FetchWeatherJob` |
| `weather_scheduler` | Custom (PHP 8.3) | Long-running `schedule:work` process — dispatches jobs on cron |
| `weather_mysql` | `mysql:8.0` | Persistent relational storage |
| `weather_redis` | `redis:7-alpine` | Job queue and Laravel cache |

> **Why three PHP containers from the same image?**  
> `backend`, `worker`, and `scheduler` all use the identical Docker image (same `backend/Dockerfile`) but are started with different commands. This avoids shipping a separate image per role while keeping concerns separated — the web process never runs the scheduler, and the scheduler never handles HTTP traffic.

---

## 3. Data Flow

### 3.1 Scheduled Weather Fetch

This is the core data pipeline. It runs every 15 minutes automatically.

```
[Scheduler container]
  └─ schedule:work (polls every minute)
       └─ every 15 min → FetchWeatherJob::dispatch()
                                │
                                ▼
                        [Redis queue]
                                │
                                ▼
                        [Worker container]
                          queue:work dequeues job
                                │
                                ▼
                        FetchWeatherJob::handle()
                          ├─ WeatherService::fetchAndStore()
                          │     ├─ GET open-meteo.com/v1/forecast
                          │     │    params: lat, lon, 14 current fields
                          │     │    returns: temperature, humidity, wind, etc.
                          │     │
                          │     ├─ GET air-quality-api.open-meteo.com/v1/air-quality
                          │     │    params: lat, lon, 6 AQI fields
                          │     │    returns: european_aqi, pm2_5, pm10, co, no2, o3
                          │     │    (silently skipped if the AQI API fails)
                          │     │
                          │     └─ INSERT INTO weather_readings (all fields)
                          │          returns: WeatherReading model
                          │
                          └─ AlertService::evaluate(reading)
                                ├─ SELECT * FROM alert_thresholds WHERE enabled = true
                                ├─ For each threshold:
                                │    value = reading.{mapped_field}
                                │    if breaches(value, operator, threshold.value):
                                │      INSERT INTO weather_alerts
                                │      if threshold.notify_email AND ALERT_EMAIL set:
                                │        Notification::route('mail', email)
                                │                  ->notify(WeatherAlertNotification)
                                └─ returns [ WeatherAlert, ... ]
```

**Retry behaviour:** `FetchWeatherJob` has `$tries = 3` and `$backoff = 60` seconds. If Open-Meteo is temporarily unavailable, the job retries up to three times with a 60-second gap before being marked failed.

**Manual trigger:** The "Fetch Now" button on the dashboard calls `POST /api/weather/fetch`, which dispatches the same `FetchWeatherJob` to the queue immediately.

---

### 3.2 HTTP Request Flow (Browser → API)

```
Browser
  │
  │  All requests go to :80
  ▼
Nginx
  ├─ /api/*  ──────────────────────────────────▶ Laravel :8000
  │                                               ├─ WeatherController
  │                                               │    GET /api/weather/current
  │                                               │      → WeatherReading::latest('recorded_at')
  │                                               │    GET /api/weather/history?hours=N
  │                                               │      → WHERE recorded_at >= now()-Nh ORDER BY recorded_at
  │                                               │    GET /api/weather/stats?hours=N
  │                                               │      → aggregate MIN/MAX/AVG/SUM over window
  │                                               │    POST /api/weather/fetch
  │                                               │      → FetchWeatherJob::dispatch()
  │                                               │
  │                                               ├─ AlertController
  │                                               │    GET /api/alerts
  │                                               │      → WHERE acknowledged=false LIMIT 50
  │                                               │    POST /api/alerts/{id}/acknowledge
  │                                               │      → UPDATE acknowledged=true
  │                                               │    POST /api/alerts/acknowledge-all
  │                                               │      → UPDATE WHERE acknowledged=false
  │                                               │
  │                                               └─ ThresholdController
  │                                                    GET /api/thresholds
  │                                                      → SELECT * ORDER BY metric
  │                                                    PUT /api/thresholds/{id}
  │                                                      → UPDATE value/enabled/notify_email/severity
  │
  └─ /*  ──────────────────────────────────────▶ Next.js :3000
                                                  serves the dashboard SPA
```

**Next.js API proxy:** `next.config.ts` contains a rewrite rule that forwards `/api/*` from the browser to the Laravel backend. Inside Docker, this uses `http://backend:8000/api` (the internal service name). Outside Docker (local `npm run dev`), it falls back to `NEXT_PUBLIC_API_URL` which defaults to `http://localhost:8000/api`. This means the frontend never hard-codes a host.

**Auto-refresh:** The dashboard page polls `current`, `alerts`, and `stats` every 60 seconds via `setInterval`. There is no WebSocket — the polling interval is short enough for a local monitoring tool and avoids the complexity of a persistent connection.

---

### 3.3 Alert Evaluation & Notification Flow

```
AlertService::evaluate(WeatherReading)
  │
  ├─ Load all enabled AlertThreshold records
  │
  ├─ Map each threshold.metric → WeatherReading field:
  │    'temperature_high'       → reading.temperature
  │    'temperature_low'        → reading.temperature
  │    'wind_speed'             → reading.wind_speed
  │    'wind_gusts'             → reading.wind_gusts
  │    'aqi'                    → reading.aqi
  │    'precipitation_probability' → reading.precipitation_probability
  │    'uv_index'               → reading.uv_index
  │    'humidity'               → reading.humidity
  │
  ├─ Evaluate: does value {operator} threshold.value ?
  │    e.g. temperature=37, operator='>', threshold.value=35  → TRUE
  │    e.g. temperature=-2, operator='<', threshold.value=0   → TRUE
  │
  ├─ On breach: INSERT weather_alerts row
  │    Sets: type, severity, title, message (human-readable string),
  │          value (actual reading), threshold (limit), unit, reading_id
  │
  └─ If threshold.notify_email = true AND config('weather.alert_email') is set:
       Laravel Notification dispatched to ALERT_EMAIL via mail channel
       WeatherAlertNotification::toMail() builds MailMessage with:
         Subject: "[Weather Alert] {title}"
         Body: message, severity, timestamp, link to dashboard
       On success: UPDATE weather_alerts SET notified_at = NOW()
       On failure: logged to Laravel error log, alert still saved in DB
```

**Important:** every threshold breach on every fetch creates a new alert row. There is intentionally no deduplication — if temperature stays above 35°C for two consecutive fetches, two alert rows are created. This gives a complete audit history. Alerts are displayed in the dashboard until acknowledged.

---

## 4. Database Schema

Three tables are created by Laravel migrations on first startup.

### `weather_readings`

Stores one row per fetch cycle (~15 min cadence).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGINT UNSIGNED PK` | Auto-increment |
| `location_name` | `VARCHAR` | From `WEATHER_LOCATION_NAME` env var |
| `latitude` | `DECIMAL(10,6)` | From `WEATHER_LAT` |
| `longitude` | `DECIMAL(10,6)` | From `WEATHER_LON` |
| `temperature` | `DECIMAL(6,2)` | °C, 2m above ground |
| `feels_like` | `DECIMAL(6,2)` | °C apparent temperature |
| `humidity` | `DECIMAL(5,2)` | % relative humidity |
| `pressure` | `DECIMAL(8,2)` | hPa surface pressure |
| `wind_speed` | `DECIMAL(6,2)` | km/h at 10m |
| `wind_direction` | `DECIMAL(5,1)` | Degrees 0–360 |
| `wind_gusts` | `DECIMAL(6,2)` | km/h |
| `precipitation` | `DECIMAL(6,2)` | mm in last hour |
| `precipitation_probability` | `DECIMAL(5,2)` | % |
| `cloud_cover` | `DECIMAL(5,2)` | % |
| `visibility` | `DECIMAL(10,2)` | Metres |
| `uv_index` | `DECIMAL(4,1)` | 0–11+ |
| `weather_code` | `INT` | WMO code (0=clear, 95=thunderstorm, etc.) |
| `weather_description` | `VARCHAR` | Decoded from weather_code |
| `is_day` | `BOOLEAN` | 1 = daytime, 0 = night |
| `aqi` | `INT` | European AQI (1–100+) |
| `aqi_label` | `VARCHAR` | Good / Fair / Moderate / Poor / Very Poor |
| `pm25` | `DECIMAL(8,2)` | μg/m³ |
| `pm10` | `DECIMAL(8,2)` | μg/m³ |
| `co` | `DECIMAL(10,2)` | μg/m³ carbon monoxide |
| `no2` | `DECIMAL(8,2)` | μg/m³ nitrogen dioxide |
| `o3` | `DECIMAL(8,2)` | μg/m³ ozone |
| `recorded_at` | `TIMESTAMP` | Time of the reading (indexed) |

**Indexes:** `recorded_at`, composite `(location_name, recorded_at)` — both support the history queries which always filter by time window.

---

### `weather_alerts`

One row per threshold breach. Never deleted; acknowledged via flag.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGINT UNSIGNED PK` | |
| `type` | `VARCHAR` | Matches `alert_thresholds.metric` |
| `severity` | `ENUM(info,warning,critical)` | Copied from threshold at time of breach |
| `title` | `VARCHAR` | Human label, e.g. "High Temperature" |
| `message` | `TEXT` | Full formatted string, e.g. "High Temperature: 37.0°C (threshold: >35.0°C)" |
| `value` | `DECIMAL(10,2)` | Actual measured value at time of breach |
| `threshold` | `DECIMAL(10,2)` | Threshold value that was exceeded |
| `unit` | `VARCHAR` | e.g. °C, km/h, % |
| `acknowledged` | `BOOLEAN` | False until user dismisses in UI |
| `notified_at` | `TIMESTAMP NULL` | Set when email is sent successfully |
| `reading_id` | `FK → weather_readings.id` | `NULL ON DELETE` — alert survives if reading is pruned |

**Indexes:** `acknowledged` (filters active alerts), `created_at` (sort order).

---

### `alert_thresholds`

Configuration table. Pre-populated by the database seeder on first run.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGINT UNSIGNED PK` | |
| `metric` | `VARCHAR UNIQUE` | Internal key, e.g. `temperature_high` |
| `operator` | `ENUM(>,<,>=,<=,=)` | Comparison direction |
| `value` | `DECIMAL(10,2)` | The limit |
| `unit` | `VARCHAR NULL` | Display unit |
| `severity` | `ENUM(info,warning,critical)` | |
| `label` | `VARCHAR` | Display name, e.g. "High Temperature" |
| `enabled` | `BOOLEAN` | Skipped during evaluation if false |
| `notify_email` | `BOOLEAN` | Whether to send email when breached |

**Default thresholds seeded:**

| Metric | Condition | Default | Severity |
|--------|-----------|---------|----------|
| `temperature_high` | temperature > | 35°C | warning |
| `temperature_low` | temperature < | 0°C | warning |
| `wind_speed` | wind_speed > | 50 km/h | warning |
| `wind_gusts` | wind_gusts > | 80 km/h | critical |
| `aqi` | aqi > | 3 (index) | warning |
| `precipitation_probability` | precip_prob > | 80% | info |
| `uv_index` | uv_index > | 8 | warning |
| `humidity` | humidity > | 90% | info |

---

## 5. Backend Internals (Laravel)

### Directory Structure

```
backend/
├── app/
│   ├── Console/Commands/
│   │   └── FetchWeather.php          # php artisan weather:fetch [--sync]
│   ├── Http/Controllers/
│   │   ├── WeatherController.php     # /api/weather/*
│   │   ├── AlertController.php       # /api/alerts/*
│   │   └── ThresholdController.php   # /api/thresholds/*
│   ├── Jobs/
│   │   └── FetchWeatherJob.php       # Queueable, tries=3, backoff=60s
│   ├── Models/
│   │   ├── WeatherReading.php
│   │   ├── WeatherAlert.php
│   │   └── AlertThreshold.php
│   ├── Notifications/
│   │   └── WeatherAlertNotification.php  # Mail notification
│   └── Services/
│       ├── WeatherService.php        # Fetch + store + query logic
│       └── AlertService.php          # Threshold evaluation + notification dispatch
├── config/
│   └── weather.php                   # All weather-specific config values
├── database/
│   ├── migrations/                   # 3 migration files
│   └── seeders/DatabaseSeeder.php    # Seeds default thresholds
└── routes/
    ├── api.php                       # All REST routes (no auth)
    └── console.php                   # Schedule::job() definition
```

### Request Lifecycle

1. Nginx proxies `POST /api/weather/fetch` to Laravel on port 8000.
2. `bootstrap/app.php` boots the framework, loads `.env`.
3. `routes/api.php` matches the route to `WeatherController@fetch`.
4. Controller calls `FetchWeatherJob::dispatch()` — pushes a serialised job onto the `weather` Redis queue.
5. Returns `{"message": "Fetch job dispatched"}` immediately.
6. Separately, the worker container dequeues and executes the job (see §3.1).

### CORS

`config/cors.php` is set to `allowed_origins: ['*']` for local development. For production use, restrict this to your actual frontend origin.

---

## 6. Frontend Internals (Next.js)

### Directory Structure

```
frontend/src/
├── app/
│   ├── layout.tsx        # Root layout, sets dark background
│   ├── page.tsx          # Main dashboard page — state management, tab routing
│   └── globals.css       # Tailwind directives + .glass utility class
├── components/
│   ├── CurrentConditions.tsx  # Large weather card with temp, feels-like, wind, stats
│   ├── MetricCards.tsx        # 6 metric tiles (wind, rain, clouds, UV, pressure, humidity)
│   ├── AirQuality.tsx         # AQI badge + pollutant breakdown (PM2.5, PM10, NO₂, O₃, CO)
│   ├── HistoryChart.tsx       # Recharts area/line charts, 4 modes, dynamic time range
│   ├── AlertPanel.tsx         # Active/all toggle, severity badges, acknowledge buttons
│   └── ThresholdsPanel.tsx    # Editable threshold table with inline save
├── lib/
│   ├── api.ts            # Typed fetch wrappers for all backend endpoints
│   └── utils.ts          # windDirection(), weatherEmoji(), aqiColor(), fmt()
└── types/
    └── weather.ts        # TypeScript interfaces matching the API response shapes
```

### State Management

No external state library is used. `page.tsx` holds all top-level state and passes data down as props:

- `current: WeatherReading | null` — latest reading from `/api/weather/current`
- `alerts: WeatherAlert[]` — unacknowledged from `/api/alerts`
- `stats: WeatherStats | null` — aggregated from `/api/weather/stats`
- `historyHours: number` — controls which time window is displayed

All three are fetched in parallel via `Promise.all` on mount and every 60 seconds thereafter.

### Fastify Role

Fastify is listed as a dependency to demonstrate that the project architecture supports adding a Node.js BFF (Backend-for-Frontend) tier — for example, to aggregate multiple APIs, add auth middleware, or transform responses before they reach the browser. In the current build, `next.config.ts` rewrites handle the proxy directly without Fastify in the request path, keeping the stack simple. The dependency is ready to be wired in as the project grows.

---

## 7. Build Process

### 7.1 Backend Dockerfile

**Location:** `backend/Dockerfile`  
**Base image:** `php:8.3-cli`  
**Used by containers:** `backend`, `worker`, `scheduler`

```dockerfile
FROM php:8.3-cli

WORKDIR /var/www/html

# System deps + PHP extensions
RUN apt-get update && apt-get install -y \
    git curl zip unzip libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo pdo_mysql mbstring zip exif bcmath \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Composer binary from its official image (no separate install step)
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install dependencies first (layer cached unless composer.json changes)
COPY composer.json composer.lock* ./
RUN composer install --no-scripts --no-autoloader --prefer-dist

# Copy application code
COPY . .
RUN composer dump-autoload --optimize

# Ensure writable directories exist
RUN mkdir -p storage/framework/{sessions,views,cache} storage/logs bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8000

# On start: generate key if needed, run migrations, seed, then serve
CMD ["sh", "-c", "php artisan key:generate --no-interaction 2>/dev/null || true \
  && php artisan migrate --force --no-interaction \
  && php artisan db:seed --force --no-interaction 2>/dev/null || true \
  && php artisan serve --host=0.0.0.0 --port=8000"]
```

**Layer caching note:** `composer.json` and `composer.lock` are copied before the application source. This means `composer install` is only re-run when dependencies change — not on every source file edit — which significantly speeds up iterative builds.

**Why `php:8.3-cli` and not `php:8.3-fpm` or an Apache image?**  
`php artisan serve` is a development-grade built-in server that is simple to reason about and sufficient for a local dashboard. For production, swap the CMD for PHP-FPM and add an Nginx fastcgi configuration.

**CMD vs ENTRYPOINT:** The CMD uses a shell string so that `worker` and `scheduler` containers can override the entire command in `docker-compose.yml`:

```yaml
worker:
  command: php artisan queue:work --sleep=3 --tries=3 --max-time=3600

scheduler:
  command: php artisan schedule:work
```

The `backend` container uses the default CMD (key generation + migration + seed + HTTP server). All three containers share identical layers — Docker's image cache is used only once.

---

### 7.2 Frontend Dockerfile

**Location:** `frontend/Dockerfile`  
**Build strategy:** Multi-stage  
**Base image:** `node:20-alpine`

```
Stage 1 — deps
  node:20-alpine
  COPY package.json, package-lock.json
  RUN npm ci
  → produces: node_modules/

Stage 2 — builder
  node:20-alpine
  COPY node_modules from deps
  COPY source
  RUN npm run build   (next build)
  → produces: .next/standalone/, .next/static/, public/

Stage 3 — runner  (final image)
  node:20-alpine
  Creates non-root user 'nextjs'
  COPY .next/standalone  (includes a minimal server.js + bundled node_modules)
  COPY .next/static
  COPY public
  CMD node server.js
```

**Why multi-stage?**  
The final `runner` image contains only the compiled output and a minimal Node runtime. It does not include `node_modules` (25,000+ files), TypeScript source, or build tools. This keeps the production image small (~200 MB vs ~1.5 GB) and reduces the attack surface.

**`output: 'standalone'` in `next.config.ts`:** This Next.js build option emits a self-contained `server.js` with only the node modules actually imported by the application. It is required for the multi-stage Dockerfile to work correctly.

---

### 7.3 Docker Compose Orchestration

```
docker-compose.yml
│
├── mysql          — image: mysql:8.0, healthcheck: mysqladmin ping
├── redis          — image: redis:7-alpine, healthcheck: redis-cli ping
│
├── backend        — build: ./backend, CMD: artisan serve
│   depends_on: mysql (healthy), redis (healthy)
│
├── worker         — same image as backend
│   command: php artisan queue:work --sleep=3 --tries=3 --max-time=3600
│   depends_on: mysql (healthy), redis (healthy)
│
├── scheduler      — same image as backend
│   command: php artisan schedule:work
│   depends_on: mysql (healthy), redis (healthy)
│
├── frontend       — build: ./frontend
│   depends_on: backend
│
└── nginx          — image: nginx:alpine, mounts nginx/nginx.conf
    depends_on: backend, frontend
```

**Named volume:** `mysql_data` persists the database across `docker compose down` / `up` cycles. `backend_storage` persists Laravel's log and cache files. Both are declared at the bottom of the Compose file.

**Environment propagation:** Environment variables are defined once in the root `.env` file and passed into each container via the `environment:` block. PHP reads them via Laravel's `config()` helper, which in turn reads `env()` calls in `config/weather.php`, `config/database.php`, etc.

---

### 7.4 Startup Sequence & Health Checks

Docker Compose starts services in dependency order. The critical path is:

```
1. mysql starts
   └─ healthcheck: mysqladmin ping (retries up to 10 times, 10s timeout each)

2. redis starts
   └─ healthcheck: redis-cli ping (retries 5 times)

3. backend, worker, scheduler start (only after mysql AND redis are healthy)
   └─ backend CMD runs:
        a. php artisan key:generate   — idempotent, skipped if key exists
        b. php artisan migrate --force — creates/updates tables
        c. php artisan db:seed --force — inserts default thresholds (updateOrCreate, idempotent)
        d. php artisan serve           — starts HTTP server on :8000

4. frontend starts (after backend is up)
   └─ node server.js on :3000

5. nginx starts (after backend and frontend)
   └─ begins accepting :80
```

**Why `--force` on migrate and seed?**  
Without `--force`, Laravel refuses to run migrations in non-interactive (non-TTY) mode in production environments. The flag confirms intent. The seeder uses `updateOrCreate` keyed on `metric`, so re-running it on every restart is safe — it only inserts rows that don't yet exist.

**`start.sh`** automates this entire sequence:

```bash
./start.sh
```

It also handles `.env` creation from `.env.example` and generates `APP_KEY` if blank (using a temporary `php:8.3-cli` container to avoid needing PHP installed on the host).

---

## 8. Configuration Reference

All configuration is driven by environment variables in the root `.env` file.

| Variable | Default | Description |
|----------|---------|-------------|
| `WEATHER_LAT` | `51.5074` | Latitude of monitored location |
| `WEATHER_LON` | `-0.1278` | Longitude of monitored location |
| `WEATHER_LOCATION_NAME` | `London` | Display name shown on dashboard |
| `ALERT_TEMP_HIGH` | `35` | Seeds the `temperature_high` threshold (°C) |
| `ALERT_TEMP_LOW` | `0` | Seeds the `temperature_low` threshold (°C) |
| `ALERT_WIND_HIGH` | `50` | Seeds the `wind_speed` threshold (km/h) |
| `ALERT_AQI_HIGH` | `3` | Seeds the `aqi` threshold (EU AQI index) |
| `MAIL_MAILER` | `log` | `log` = print to Laravel log, `smtp` = real email |
| `ALERT_EMAIL` | *(empty)* | Recipient address for alert emails |
| `MYSQL_DATABASE` | `weather_dashboard` | Database name |
| `MYSQL_USER` | `weather` | Database user |
| `MYSQL_PASSWORD` | `weatherpass` | Database password |
| `APP_KEY` | *(empty)* | Generated by `start.sh` on first run |
| `APP_ENV` | `local` | `local` or `production` |

> **Note on threshold seeding:** The `ALERT_*` environment variables only affect the values inserted by the database seeder on **first run**. After that, thresholds are managed in the database and can be changed through the Settings tab. Changing these env vars after initial setup has no effect unless you run `php artisan migrate:fresh --seed`.

---

## 9. External APIs

Both APIs are free and require no registration or API key.

### Open-Meteo Forecast API

**Endpoint:** `https://api.open-meteo.com/v1/forecast`  
**Docs:** https://open-meteo.com/en/docs

Fields fetched (all under `current`):

| Parameter | Returned as |
|-----------|------------|
| `temperature_2m` | `temperature` |
| `apparent_temperature` | `feels_like` |
| `relative_humidity_2m` | `humidity` |
| `surface_pressure` | `pressure` |
| `wind_speed_10m` | `wind_speed` |
| `wind_direction_10m` | `wind_direction` |
| `wind_gusts_10m` | `wind_gusts` |
| `precipitation` | `precipitation` |
| `precipitation_probability` | `precipitation_probability` |
| `cloud_cover` | `cloud_cover` |
| `visibility` | `visibility` |
| `uv_index` | `uv_index` |
| `weather_code` | `weather_code` (WMO code) |
| `is_day` | `is_day` |

Wind speed is requested in `kmh` units (`&wind_speed_unit=kmh`).

### Open-Meteo Air Quality API

**Endpoint:** `https://air-quality-api.open-meteo.com/v1/air-quality`  
**Docs:** https://open-meteo.com/en/docs/air-quality-api

Fields fetched (all under `current`):

| Parameter | Returned as | Notes |
|-----------|------------|-------|
| `european_aqi` | `aqi` | Scale 0–100+; decoded to Good/Fair/Moderate/Poor/Very Poor |
| `pm2_5` | `pm25` | μg/m³ |
| `pm10` | `pm10` | μg/m³ |
| `carbon_monoxide` | `co` | μg/m³ |
| `nitrogen_dioxide` | `no2` | μg/m³ |
| `ozone` | `o3` | μg/m³ |

AQI fetch failures are caught and logged as warnings — the weather reading is still saved without AQI data rather than failing the entire job.
