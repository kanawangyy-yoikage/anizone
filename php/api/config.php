<?php
// ═══════════════════════════════════════════════════════
//  ANIZONE — PHP CONFIG (Firebase)
//  Nilai diambil dari environment variable Railway.
//  Set di Railway → Service → Variables:
//    FIREBASE_PROJECT_ID   = anizone-b48ce
//    FIREBASE_API_KEY      = AIzaSyATmomNycKIQXHuwnLxkfQVUu77KkHdE4g
//    FIREBASE_ADMIN_TOKEN  = (opsional, untuk operasi admin)
// ═══════════════════════════════════════════════════════

define('FB_PROJECT_ID', getenv('FIREBASE_PROJECT_ID') ?: 'anizone-b48ce');
define('FB_API_KEY',    getenv('FIREBASE_API_KEY')    ?: 'AIzaSyATmomNycKIQXHuwnLxkfQVUu77KkHdE4g');
define('FB_BASE_URL',   'https://firestore.googleapis.com/v1/projects/' . FB_PROJECT_ID . '/databases/(default)/documents');

// CORS
define('ALLOWED_ORIGIN', getenv('ALLOWED_ORIGIN') ?: '*');

// Timezone
date_default_timezone_set('Asia/Jakarta');
