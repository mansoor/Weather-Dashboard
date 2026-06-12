FROM php:8.3-cli

WORKDIR /var/www/html

# System deps + PHP extensions
RUN apt-get update && apt-get install -y \
    git curl zip unzip libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo pdo_mysql mbstring zip exif bcmath \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Composer binary from its official image
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install dependencies first (layer cached unless composer.json changes)
COPY composer.json composer.lock* ./
RUN composer install --no-scripts --no-autoloader --prefer-dist --no-security-blocking

# Copy application source
COPY . .

# Create required runtime directories
RUN mkdir -p storage/framework/{sessions,views,cache} \
        storage/logs \
        bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# Bake a minimal .env into the image — just enough for dotenv not to crash on boot.
# All real config (DB, Redis, keys, etc.) is injected by Docker at runtime via
# environment variables, which Laravel's env() reads directly without needing .env.
RUN echo 'APP_KEY=' > .env

# Optimise autoloader — triggers package:discover which needs bootstrap/cache + public/
RUN composer dump-autoload --optimize

# Entrypoint handles .env creation, key generation, migrations, and seeding at runtime
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
