# ═══════════════════════════════════════════════════════
#  ANIZONE — Dockerfile
#  Stack: Node.js 20 + PHP 8.2-FPM + Nginx
#  Satu container, dua service: Express (port 3000) &
#  PHP-FPM (via Nginx yang forward ke /php/api/).
#  Railway expose satu port — Nginx jadi reverse proxy
#  dan meneruskan semua request ke Express atau PHP.
# ═══════════════════════════════════════════════════════

FROM php:8.2-fpm

# ── 1. Install sistem dependency ──────────────────────
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── 2. Install PHP extension yang dibutuhkan ──────────
RUN docker-php-ext-install \
    curl

# ── 3. Install Node.js 20 ─────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── 4. Salin project ──────────────────────────────────
WORKDIR /app
COPY . .

# ── 5. Install Node dependencies ──────────────────────
RUN npm ci --omit=dev

# ── 6. Konfigurasi Nginx ──────────────────────────────
# Nginx listen di port 80 (Railway akan forward ke sini).
# /php/api/*  → PHP-FPM
# /*          → Express di localhost:3000
RUN rm -f /etc/nginx/sites-enabled/default
COPY docker/nginx.conf /etc/nginx/sites-enabled/anizone.conf

# ── 7. Script startup ─────────────────────────────────
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

# Railway inject PORT env — Nginx listen di 80, tapi
# Railway akan detect PORT=80 dari Dockerfile.
ENV PORT=80

EXPOSE 80

CMD ["/start.sh"]
