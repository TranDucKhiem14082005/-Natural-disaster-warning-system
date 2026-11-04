# syntax=docker/dockerfile:1.7
# Build context: repo root (see Infra/docker-compose.yml).

FROM composer:2.8 AS composer

# ---- Laravel API: PHP-FPM, also used for queue / scheduler / reverb / migrate ----
FROM php:8.2-fpm-bookworm AS app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libicu-dev libzip-dev unzip git \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql bcmath intl zip pcntl opcache \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/bin/composer
COPY Infra/docker/php/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY Infra/docker/php/entrypoint.sh /usr/local/bin/entrypoint
# Windows checkouts may add CRLF, which breaks the shebang.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint && chmod +x /usr/local/bin/entrypoint

WORKDIR /var/www/html

COPY Backend/composer.json Backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress

COPY Backend/ ./
RUN composer dump-autoload --optimize --no-dev \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

# ---- React SPA build ----
FROM node:22-alpine AS frontend

WORKDIR /src
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY Frontend/ ./
# Reverb public key is baked into the bundle; empty = realtime off.
ARG VITE_REVERB_APP_KEY=
ARG VITE_MAP_TILE_URL=
ENV VITE_REVERB_APP_KEY=$VITE_REVERB_APP_KEY VITE_MAP_TILE_URL=$VITE_MAP_TILE_URL
RUN npm run build

# ---- Nginx: serves the SPA, proxies /api to app (PHP), WebSocket to reverb ----
FROM nginx:1.27-alpine AS web

COPY Infra/docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY Backend/public /var/www/html/public
COPY --from=frontend /src/dist /var/www/html/spa
