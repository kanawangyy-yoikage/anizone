<?php
// ═══════════════════════════════════════════════════════
//  ANIZONE — PHP CONFIG (Firebase)
//  Nilai diambil dari environment variable Railway.
//  Set di Railway → Service → Variables:
//    FIREBASE_PROJECT_ID   = anizone-b48ce
//    FIREBASE_API_KEY      = (api key kamu)
//    FIREBASE_ADMIN_TOKEN  = (opsional, untuk operasi admin)
// ═══════════════════════════════════════════════════════

// FIX: Hapus hardcoded API key — wajib set via env variable
$fbProjectId = getenv('FIREBASE_PROJECT_ID');
$fbApiKey    = getenv('FIREBASE_API_KEY');

if (!$fbProjectId || !$fbApiKey) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Konfigurasi Firebase tidak ditemukan. Set env FIREBASE_PROJECT_ID dan FIREBASE_API_KEY.']);
    exit;
}

define('FB_PROJECT_ID', $fbProjectId);
define('FB_API_KEY',    $fbApiKey);
define('FB_BASE_URL',   'https://firestore.googleapis.com/v1/projects/' . FB_PROJECT_ID . '/databases/(default)/documents');

// CORS
define('ALLOWED_ORIGIN', getenv('ALLOWED_ORIGIN') ?: '*');

// Timezone
date_default_timezone_set('Asia/Jakarta');
