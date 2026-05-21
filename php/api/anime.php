<?php
// ═══════════════════════════════════════════════════════
//  ANIZONE — CRUD ANIME (Firestore via REST)
//  Collection: "anime_list"
//
//  GET    ?id=xxx          → detail satu anime
//  GET    ?search=xyz      → cari berdasarkan judul
//  GET    (tanpa param)    → list semua (max 200)
//  POST                    → tambah anime baru
//  PUT    ?id=xxx          → update anime
//  DELETE ?id=xxx          → hapus anime
// ═══════════════════════════════════════════════════════

require_once __DIR__ . '/firebase.php';

setCorsHeaders();

const COLLECTION = 'anime_list';
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    // ─────────────── READ ───────────────────────────────
    case 'GET':
        if (!empty($_GET['id'])) {
            $doc = fsGet(COLLECTION, clean($_GET['id']));
            $doc ? jsonResponse(true, 'OK', $doc)
                 : jsonResponse(false, 'Anime tidak ditemukan', [], 404);
        }

        $all = fsListAll(COLLECTION);

        if (!empty($_GET['search'])) {
            $q   = strtolower(clean($_GET['search']));
            $all = array_values(array_filter($all, fn($a) =>
                str_contains(strtolower($a['title'] ?? ''), $q) ||
                str_contains(strtolower($a['genre'] ?? ''), $q)
            ));
        }

        // Sorting terbaru
        usort($all, fn($a, $b) => strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''));

        // Pagination sederhana
        $page    = max(1, (int)($_GET['page']  ?? 1));
        $limit   = min(50,  max(1, (int)($_GET['limit'] ?? 15)));
        $total   = count($all);
        $items   = array_slice($all, ($page - 1) * $limit, $limit);

        jsonResponse(true, 'OK', [
            'items'      => array_values($items),
            'total'      => $total,
            'page'       => $page,
            'limit'      => $limit,
            'totalPages' => (int)ceil($total / $limit),
        ]);
        break;

    // ─────────────── CREATE ─────────────────────────────
    case 'POST':
        $b = getJsonBody();
        if (empty($b['title']) || empty($b['type']) || empty($b['status'])) {
            jsonResponse(false, 'Field wajib: title, type, status', [], 422);
        }

        $payload = [
            'title'       => clean($b['title']),
            'imageUrl'    => clean($b['image_url']   ?? ''),
            'type'        => clean($b['type']),
            'genre'       => clean($b['genre']        ?? ''),
            'episodes'    => (int)($b['episodes']     ?? 0),
            'score'       => round((float)($b['score'] ?? 0), 2),
            'status'      => clean($b['status']),
            'description' => clean($b['description']  ?? ''),
            'sumberUrl'   => clean($b['sumber_url']   ?? ''),
        ];

        $doc = fsCreate(COLLECTION, $payload);
        $doc ? jsonResponse(true, 'Anime berhasil ditambahkan', $doc, 201)
             : jsonResponse(false, 'Gagal menyimpan ke Firestore', [], 500);
        break;

    // ─────────────── UPDATE ─────────────────────────────
    case 'PUT':
        $id = clean($_GET['id'] ?? '');
        if (!$id) jsonResponse(false, 'Parameter id wajib', [], 400);
        if (!fsGet(COLLECTION, $id)) jsonResponse(false, 'Anime tidak ditemukan', [], 404);

        $b = getJsonBody();
        if (empty($b['title']) || empty($b['type']) || empty($b['status'])) {
            jsonResponse(false, 'Field wajib: title, type, status', [], 422);
        }

        $payload = [
            'title'       => clean($b['title']),
            'imageUrl'    => clean($b['image_url']   ?? ''),
            'type'        => clean($b['type']),
            'genre'       => clean($b['genre']        ?? ''),
            'episodes'    => (int)($b['episodes']     ?? 0),
            'score'       => round((float)($b['score'] ?? 0), 2),
            'status'      => clean($b['status']),
            'description' => clean($b['description']  ?? ''),
            'sumberUrl'   => clean($b['sumber_url']   ?? ''),
        ];

        $ok = fsUpdate(COLLECTION, $id, $payload);
        $ok ? jsonResponse(true, 'Anime berhasil diperbarui', array_merge(['id' => $id], $payload))
            : jsonResponse(false, 'Gagal update ke Firestore', [], 500);
        break;

    // ─────────────── DELETE ─────────────────────────────
    case 'DELETE':
        $id = clean($_GET['id'] ?? '');
        if (!$id) jsonResponse(false, 'Parameter id wajib', [], 400);

        $doc = fsGet(COLLECTION, $id);
        if (!$doc) jsonResponse(false, 'Anime tidak ditemukan', [], 404);

        $ok = fsDelete(COLLECTION, $id);
        $ok ? jsonResponse(true, "Anime \"{$doc['title']}\" berhasil dihapus")
            : jsonResponse(false, 'Gagal menghapus dari Firestore', [], 500);
        break;

    default:
        jsonResponse(false, 'Method tidak diizinkan', [], 405);
}
