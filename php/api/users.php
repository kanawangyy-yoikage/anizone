<?php
// ═══════════════════════════════════════════════════════
//  ANIZONE — CRUD USERS (Firestore via REST)
//  Collection: "users" (sama dengan yang dipakai Firebase Auth)
//
//  GET    (tanpa param)    → list semua user
//  GET    ?uid=xxx         → detail satu user
//  POST                    → upsert user (sinkron dari Firebase)
//  PUT    ?uid=xxx         → update role / profil
//  DELETE ?uid=xxx         → hapus user + favoritnya
// ═══════════════════════════════════════════════════════

require_once __DIR__ . '/firebase.php';

setCorsHeaders();

// FIX: Pakai variabel biasa, bukan const — agar tidak konflik
$collection = 'users';
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ─────────────── READ ───────────────────────────────
    case 'GET':
        if (!empty($_GET['uid'])) {
            $doc = fsGet($collection, clean($_GET['uid']));
            $doc ? jsonResponse(true, 'OK', $doc)
                 : jsonResponse(false, 'Pengguna tidak ditemukan', [], 404);
        }

        $all = fsListAll($collection);

        // Filter by role (opsional)
        if (!empty($_GET['role'])) {
            $role = clean($_GET['role']);
            $all  = array_values(array_filter($all, fn($u) => ($u['role'] ?? 'user') === $role));
        }

        // Search by name / email
        if (!empty($_GET['search'])) {
            $q   = strtolower(clean($_GET['search']));
            $all = array_values(array_filter($all, fn($u) =>
                str_contains(strtolower($u['displayName'] ?? ''), $q) ||
                str_contains(strtolower($u['email'] ?? ''), $q)
            ));
        }

        usort($all, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

        $page   = max(1, (int)($_GET['page']  ?? 1));
        $limit  = min(100, max(1, (int)($_GET['limit'] ?? 20)));
        $total  = count($all);
        $items  = array_slice($all, ($page - 1) * $limit, $limit);

        jsonResponse(true, 'OK', [
            'items'      => array_values($items),
            'total'      => $total,
            'page'       => $page,
            'limit'      => $limit,
            'totalPages' => (int)ceil($total / $limit),
        ]);
        break;

    // ─────────────── CREATE / UPSERT ────────────────────
    case 'POST':
        $b = getJsonBody();
        if (empty($b['uid']) || empty($b['email'])) {
            jsonResponse(false, 'Field wajib: uid, email', [], 422);
        }

        $uid     = clean($b['uid']);
        $payload = [
            'email'       => clean($b['email']),
            'displayName' => clean($b['display_name'] ?? ''),
            'photoURL'    => clean($b['photo_url']    ?? ''),
            'role'        => clean($b['role']          ?? 'user'),
        ];

        // Cek sudah ada
        $exist = fsGet($collection, $uid);
        if ($exist) {
            $ok = fsUpdate($collection, $uid, $payload);
            $ok ? jsonResponse(true, 'User diperbarui (upsert)', ['uid' => $uid])
                : jsonResponse(false, 'Gagal update Firestore', [], 500);
        } else {
            $payload['createdAt'] = date('c');
            // Pakai uid sebagai doc ID — set via PATCH dengan document name
            $url = FB_BASE_URL . '/' . $collection . '/' . $uid . '?key=' . FB_API_KEY;
            $res = firestoreRequest('PATCH', $url, buildFirestoreBody($payload));
            ($res['code'] === 200)
                ? jsonResponse(true, 'User berhasil ditambahkan', ['uid' => $uid], 201)
                : jsonResponse(false, 'Gagal menyimpan ke Firestore', [], 500);
        }
        break;

    // ─────────────── UPDATE ─────────────────────────────
    case 'PUT':
        $uid = clean($_GET['uid'] ?? '');
        if (!$uid) jsonResponse(false, 'Parameter uid wajib', [], 400);
        if (!fsGet($collection, $uid)) jsonResponse(false, 'Pengguna tidak ditemukan', [], 404);

        $b = getJsonBody();
        $ok = fsUpdate($collection, $uid, [
            'displayName' => clean($b['display_name'] ?? ''),
            'photoURL'    => clean($b['photo_url']    ?? ''),
            'role'        => clean($b['role']          ?? 'user'),
        ]);

        $ok ? jsonResponse(true, 'Pengguna berhasil diperbarui', ['uid' => $uid])
            : jsonResponse(false, 'Gagal update Firestore', [], 500);
        break;

    // ─────────────── DELETE ─────────────────────────────
    case 'DELETE':
        $uid = clean($_GET['uid'] ?? '');
        if (!$uid) jsonResponse(false, 'Parameter uid wajib', [], 400);

        $doc = fsGet($collection, $uid);
        if (!$doc) jsonResponse(false, 'Pengguna tidak ditemukan', [], 404);

        // FIX: Pakai fsQuery bukan fsListAll — lebih efisien
        $favs = fsQuery('favorites', 'userUid', 'EQUAL', $uid);
        foreach ($favs as $fav) {
            fsDelete('favorites', $fav['id']);
        }

        $ok = fsDelete($collection, $uid);
        $ok ? jsonResponse(true, "Pengguna \"{$doc['displayName']}\" berhasil dihapus")
            : jsonResponse(false, 'Gagal menghapus dari Firestore', [], 500);
        break;

    default:
        jsonResponse(false, 'Method tidak diizinkan', [], 405);
}
