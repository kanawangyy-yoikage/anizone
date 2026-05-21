#!/bin/sh
# ═══════════════════════════════════════════════════════
#  ANIZONE — Startup Script
#  Urutan: PHP-FPM → Node.js → Nginx (foreground)
# ═══════════════════════════════════════════════════════

set -e

echo "🚀 Starting AniZone services..."

# 1. Jalankan PHP-FPM di background
echo "⚙️  Starting PHP-FPM..."
php-fpm -D

# 2. Jalankan Node.js Express di background
echo "⚙️  Starting Node.js (Express)..."
node /app/api/index.js &

# Tunggu sebentar agar Node.js siap
sleep 2

# 3. Jalankan Nginx di foreground (biar container tidak exit)
echo "⚙️  Starting Nginx..."
nginx -g "daemon off;"
