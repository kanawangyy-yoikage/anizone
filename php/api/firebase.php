<?php
// ═══════════════════════════════════════════════════════
//  ANIZONE — FIREBASE FIRESTORE REST WRAPPER
//  Semua operasi ke Firestore dilakukan via REST API.
//  Tidak perlu library eksternal, cukup cURL bawaan PHP.
// ═══════════════════════════════════════════════════════

require_once __DIR__ . '/config.php';

// ── RESPONSE HELPERS ──────────────────────────────────

function jsonResponse(bool $success, string $message, $data = [], int $code = 200): void {
    http_response_code($code);
    echo json_encode(['success' => $success, 'message' => $message, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getJsonBody(): array {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function clean(?string $v): string {
    return strip_tags(trim((string)$v));
}

function setCorsHeaders(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

// ── FIRESTORE FIELD CONVERTERS ────────────────────────

/**
 * Konversi nilai PHP ke format Firestore field value.
 */
function toFirestoreValue($val): array {
    if (is_bool($val))   return ['booleanValue'  => $val];
    if (is_int($val))    return ['integerValue'   => (string)$val];
    if (is_float($val))  return ['doubleValue'    => $val];
    if (is_null($val))   return ['nullValue'      => null];
    if (is_array($val))  return ['arrayValue'     => ['values' => array_map('toFirestoreValue', $val)]];
    return ['stringValue' => (string)$val];
}

/**
 * Konversi dokumen Firestore ke array PHP sederhana.
 */
function fromFirestoreDoc(array $doc, string $collectionPath = ''): array {
    $name   = $doc['name'] ?? '';
    $id     = $name ? basename($name) : '';
    $fields = $doc['fields'] ?? [];
    $result = ['id' => $id];
    foreach ($fields as $key => $fval) {
        $result[$key] = fromFirestoreValue($fval);
    }
    return $result;
}

function fromFirestoreValue(array $fval) {
    if (isset($fval['stringValue']))    return $fval['stringValue'];
    if (isset($fval['integerValue']))   return (int)$fval['integerValue'];
    if (isset($fval['doubleValue']))    return (float)$fval['doubleValue'];
    if (isset($fval['booleanValue']))   return (bool)$fval['booleanValue'];
    if (isset($fval['nullValue']))      return null;
    if (isset($fval['timestampValue'])) return $fval['timestampValue'];
    if (isset($fval['arrayValue']))     return array_map('fromFirestoreValue', $fval['arrayValue']['values'] ?? []);
    if (isset($fval['mapValue']))       return array_map('fromFirestoreValue', $fval['mapValue']['fields'] ?? []);
    return null;
}

/**
 * Bangun body Firestore dari array PHP.
 */
function buildFirestoreBody(array $data): array {
    $fields = [];
    foreach ($data as $k => $v) {
        $fields[$k] = toFirestoreValue($v);
    }
    return ['fields' => $fields];
}

// ── CURL HELPER ───────────────────────────────────────

function firestoreRequest(string $method, string $url, array $body = null): array {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 15,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    }
    $raw  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($raw, true) ?? [];
    return ['code' => $code, 'body' => $json];
}

// ── FIRESTORE CRUD OPERATIONS ─────────────────────────

/**
 * List semua dokumen dalam sebuah collection.
 */
function fsListAll(string $collection): array {
    $url = FB_BASE_URL . '/' . $collection . '?key=' . FB_API_KEY . '&pageSize=200';
    $res = firestoreRequest('GET', $url);
    if ($res['code'] !== 200) return [];
    $docs = $res['body']['documents'] ?? [];
    return array_map('fromFirestoreDoc', $docs);
}

/**
 * Ambil satu dokumen.
 */
function fsGet(string $collection, string $docId): ?array {
    $url = FB_BASE_URL . '/' . $collection . '/' . $docId . '?key=' . FB_API_KEY;
    $res = firestoreRequest('GET', $url);
    if ($res['code'] !== 200 || isset($res['body']['error'])) return null;
    return fromFirestoreDoc($res['body']);
}

/**
 * Tambah dokumen baru (auto-ID).
 */
function fsCreate(string $collection, array $data): ?array {
    $data['createdAt'] = date('c');
    $url = FB_BASE_URL . '/' . $collection . '?key=' . FB_API_KEY;
    $res = firestoreRequest('POST', $url, buildFirestoreBody($data));
    if ($res['code'] !== 200 && $res['code'] !== 201) return null;
    return fromFirestoreDoc($res['body']);
}

/**
 * Update dokumen (PATCH — hanya field yang dikirim).
 * FIX: gunakan '&' bukan ',' sebagai pemisah updateMask.
 */
function fsUpdate(string $collection, string $docId, array $data): bool {
    $data['updatedAt'] = date('c');
    $mask = implode('&', array_map(fn($k) => 'updateMask.fieldPaths=' . urlencode($k), array_keys($data)));
    $url  = FB_BASE_URL . '/' . $collection . '/' . $docId . '?key=' . FB_API_KEY . '&' . $mask;
    $res  = firestoreRequest('PATCH', $url, buildFirestoreBody($data));
    return $res['code'] === 200;
}

/**
 * Hapus dokumen.
 */
function fsDelete(string $collection, string $docId): bool {
    $url = FB_BASE_URL . '/' . $collection . '/' . $docId . '?key=' . FB_API_KEY;
    $res = firestoreRequest('DELETE', $url);
    return $res['code'] === 200 || $res['code'] === 204;
}

/**
 * Query sederhana: filter satu field.
 */
function fsQuery(string $collection, string $field, string $op, $value): array {
    $url  = 'https://firestore.googleapis.com/v1/projects/' . FB_PROJECT_ID . '/databases/(default)/documents:runQuery?key=' . FB_API_KEY;
    $body = [
        'structuredQuery' => [
            'from'  => [['collectionId' => $collection]],
            'where' => [
                'fieldFilter' => [
                    'field'  => ['fieldPath' => $field],
                    'op'     => $op,
                    'value'  => toFirestoreValue($value),
                ]
            ],
            'limit' => 200,
        ]
    ];
    $res  = firestoreRequest('POST', $url, $body);
    if ($res['code'] !== 200) return [];
    $results = [];
    foreach (($res['body'] ?? []) as $item) {
        if (isset($item['document'])) {
            $results[] = fromFirestoreDoc($item['document']);
        }
    }
    return $results;
}
