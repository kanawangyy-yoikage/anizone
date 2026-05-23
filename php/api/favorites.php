<?php
// ═══════════════════════════════════════════════════════
//  ANIZONE — CRUD FAVORITES (Firestore via REST)
//  Collection: "favorites"
//
//  GET    ?user_uid=xxx              → list favorit user
//  POST                              → tambah favorit
//  DELETE ?id=xxx                    → hapus by doc id
//  DELETE ?user_uid=x&anime_id=y     → hapus by uid+anime
// ═══════════════════════════════════════════════════════

require_once __DIR__ . '/firebase.php';

setCorsHeaders();

// FIX: Pakai variabel biasa, bukan const — agar tidak konflik
$collection = 'favorites';
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ─────────────── READ ───────────────────────────────
    case 'GET':
        $uid = clean($_GET['user_uid'] ?? '');
        if (!$uid) jsonResponse(false, 'Parameter user_uid wajib', [], 400);

        // Query favorites milik user tertentu
        $favs = fsQuery($collection, 'userUid', 'EQUAL', $uid);

        // Enrich dengan data anime
        $result = [];
        foreach ($favs as $fav) {
            $animeId = $fav['animeId'] ?? '';
            if ($animeId) {
                $anime = fsGet('anime_list', $animeId);
                $fav['anime'] = $anime ?? [];
            }
            $result[] = $fav;
        }

        usort($result, fn($a, $b) => strcmp($b['addedAt'] ?? '', $a['addedAt'] ?? ''));
        jsonResponse(true, 'OK', array_values($result));
        break;

    // ─────────────── CREATE ─────────────────────────────
    case 'POST':
        $b = getJsonBody();
        if (empty($b['user_uid']) || empty($b['anime_id'])) {
            jsonResponse(false, 'Field wajib: user_uid, anime_id', [], 422);
        }

        $uid     = clean($b['user_uid']);
        $animeId = clean($b['anime_id']);

        // Cek duplikat
        $existing = fsQuery($collection, 'userUid', 'EQUAL', $uid);
        foreach ($existing as $e) {
            if (($e['animeId'] ?? '') === $animeId) {
                jsonResponse(false, 'Anime sudah ada di favorit', [], 409);
            }
        }

        // Cek anime ada
        $anime = fsGet('anime_list', $animeId);
        if (!$anime) jsonResponse(false, 'Anime tidak ditemukan', [], 404);

        $doc = fsCreate($collection, [
            'userUid' => $uid,
            'animeId' => $animeId,
            'addedAt' => date('c'),
        ]);

        $doc ? jsonResponse(true, 'Ditambahkan ke favorit', $doc, 201)
             : jsonResponse(false, 'Gagal menyimpan ke Firestore', [], 500);
        break;

    // ─────────────── DELETE ─────────────────────────────
    case 'DELETE':
        if (!empty($_GET['id'])) {
            $ok = fsDelete($collection, clean($_GET['id']));
            $ok ? jsonResponse(true, 'Favorit dihapus')
                : jsonResponse(false, 'Gagal menghapus', [], 500);
        } elseif (!empty($_GET['user_uid']) && !empty($_GET['anime_id'])) {
            $uid     = clean($_GET['user_uid']);
            $animeId = clean($_GET['anime_id']);
            $favs    = fsQuery($collection, 'userUid', 'EQUAL', $uid);
            $deleted = 0;
            foreach ($favs as $f) {
                if (($f['animeId'] ?? '') === $animeId) {
                    fsDelete($collection, $f['id']);
                    $deleted++;
                }
            }
            $deleted > 0
                ? jsonResponse(true, 'Favorit dihapus')
                : jsonResponse(false, 'Favorit tidak ditemukan', [], 404);
        } else {
            jsonResponse(false, 'Parameter id atau (user_uid + anime_id) wajib', [], 400);
        }
        break;

    default:
        jsonResponse(false, 'Method tidak diizinkan', [], 405);
}
