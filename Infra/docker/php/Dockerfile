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

# ---- Nginx: serves public/ and proxies PHP to app, WebSocket to reverb ----
FROM nginx:1.27-alpine AS web

COPY Infra/docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY Backend/public /var/www/html/public
