// ─── ANIZONE — ANIME CRUD (Node.js) ─────────────────────
// Pengganti /php/api/anime.php untuk Vercel deployment.
// Endpoint: /api/crud/anime
//
//  GET    ?id=xxx          → detail satu anime
//  GET    ?search=xyz      → cari berdasarkan judul
//  GET    (tanpa param)    → list semua (paginasi)
//  POST                    → tambah anime baru
//  PUT    ?id=xxx          → update anime
//  DELETE ?id=xxx          → hapus anime

const { setCors, jsonResponse, clean, fsListAll, fsGet, fsCreate, fsUpdate, fsDelete } = require('./firestore');

const COLLECTION = 'anime_list';

async function handleAnime(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    switch (req.method) {

      // ─── READ ─────────────────────────────────────────
      case 'GET': {
        if (req.query.id) {
          const doc = await fsGet(COLLECTION, clean(req.query.id));
          return doc
            ? jsonResponse(res, true, 'OK', doc)
            : jsonResponse(res, false, 'Anime tidak ditemukan', [], 404);
        }

        let all = await fsListAll(COLLECTION);

        if (req.query.search) {
          const q = req.query.search.toLowerCase();
          all = all.filter(a =>
            (a.title  || '').toLowerCase().includes(q) ||
            (a.genre  || '').toLowerCase().includes(q)
          );
        }

        // Sort terbaru
        all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '15', 10)));
        const total = all.length;
        const items = all.slice((page - 1) * limit, page * limit);

        return jsonResponse(res, true, 'OK', {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        });
      }

      // ─── CREATE ───────────────────────────────────────
      case 'POST': {
        const b = req.body || {};
        if (!b.title || !b.type || !b.status) {
          return jsonResponse(res, false, 'Field wajib: title, type, status', [], 422);
        }
        const payload = {
          title:       clean(b.title),
          imageUrl:    clean(b.image_url   || ''),
          type:        clean(b.type),
          genre:       clean(b.genre       || ''),
          episodes:    parseInt(b.episodes || 0, 10),
          score:       Math.round(parseFloat(b.score || 0) * 100) / 100,
          status:      clean(b.status),
          description: clean(b.description || ''),
          sumberUrl:   clean(b.sumber_url  || ''),
          createdAt:   new Date().toISOString(),
        };
        const doc = await fsCreate(COLLECTION, payload);
        return doc
          ? jsonResponse(res, true, 'Anime berhasil ditambahkan', doc, 201)
          : jsonResponse(res, false, 'Gagal menyimpan ke Firestore', [], 500);
      }

      // ─── UPDATE ───────────────────────────────────────
      case 'PUT': {
        const id = clean(req.query.id || '');
        if (!id) return jsonResponse(res, false, 'Parameter id wajib', [], 400);
        const exists = await fsGet(COLLECTION, id);
        if (!exists) return jsonResponse(res, false, 'Anime tidak ditemukan', [], 404);

        const b = req.body || {};
        if (!b.title || !b.type || !b.status) {
          return jsonResponse(res, false, 'Field wajib: title, type, status', [], 422);
        }
        const payload = {
          title:       clean(b.title),
          imageUrl:    clean(b.image_url   || ''),
          type:        clean(b.type),
          genre:       clean(b.genre       || ''),
          episodes:    parseInt(b.episodes || 0, 10),
          score:       Math.round(parseFloat(b.score || 0) * 100) / 100,
          status:      clean(b.status),
          description: clean(b.description || ''),
          sumberUrl:   clean(b.sumber_url  || ''),
        };
        const ok = await fsUpdate(COLLECTION, id, payload);
        return ok
          ? jsonResponse(res, true, 'Anime berhasil diperbarui', { id, ...payload })
          : jsonResponse(res, false, 'Gagal update ke Firestore', [], 500);
      }

      // ─── DELETE ───────────────────────────────────────
      case 'DELETE': {
        const id = clean(req.query.id || '');
        if (!id) return jsonResponse(res, false, 'Parameter id wajib', [], 400);
        const doc = await fsGet(COLLECTION, id);
        if (!doc) return jsonResponse(res, false, 'Anime tidak ditemukan', [], 404);
        const ok = await fsDelete(COLLECTION, id);
        return ok
          ? jsonResponse(res, true, `Anime "${doc.title}" berhasil dihapus`)
          : jsonResponse(res, false, 'Gagal menghapus dari Firestore', [], 500);
      }

      default:
        return jsonResponse(res, false, 'Method tidak diizinkan', [], 405);
    }
  } catch (err) {
    console.error('[anime]', err);
    return jsonResponse(res, false, err.message || 'Server error', [], 500);
  }
}

module.exports = handleAnime;
