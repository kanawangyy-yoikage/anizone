// ─── ANIZONE — FAVORITES CRUD (Node.js) ─────────────────
// Pengganti /php/api/favorites.php untuk Vercel deployment.
// Endpoint: /api/crud/favorites
//
//  GET    ?user_uid=xxx              → list favorit user
//  POST                              → tambah favorit
//  DELETE ?id=xxx                    → hapus by doc id
//  DELETE ?user_uid=x&anime_id=y     → hapus by uid+anime

const { setCors, jsonResponse, clean, fsGet, fsCreate, fsDelete, fsQuery } = require('./firestore');

const COLLECTION = 'favorites';

async function handleFavorites(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    switch (req.method) {

      // ─── READ ─────────────────────────────────────────
      case 'GET': {
        const uid = clean(req.query.user_uid || '');
        if (!uid) return jsonResponse(res, false, 'Parameter user_uid wajib', [], 400);

        const favs = await fsQuery(COLLECTION, 'userUid', 'EQUAL', uid);

        // Enrich dengan data anime
        const result = await Promise.all(favs.map(async fav => {
          const animeId = fav.animeId || '';
          if (animeId) {
            fav.anime = await fsGet('anime_list', animeId) || {};
          }
          return fav;
        }));

        result.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
        return jsonResponse(res, true, 'OK', result);
      }

      // ─── CREATE ───────────────────────────────────────
      case 'POST': {
        const b = req.body || {};
        if (!b.user_uid || !b.anime_id) {
          return jsonResponse(res, false, 'Field wajib: user_uid, anime_id', [], 422);
        }
        const uid     = clean(b.user_uid);
        const animeId = clean(b.anime_id);

        // Cek duplikat
        const existing = await fsQuery(COLLECTION, 'userUid', 'EQUAL', uid);
        const isDuplicate = existing.some(e => e.animeId === animeId);
        if (isDuplicate) return jsonResponse(res, false, 'Anime sudah ada di favorit', [], 409);

        // Cek anime ada
        const anime = await fsGet('anime_list', animeId);
        if (!anime) return jsonResponse(res, false, 'Anime tidak ditemukan', [], 404);

        const doc = await fsCreate(COLLECTION, {
          userUid: uid,
          animeId,
          addedAt: new Date().toISOString(),
        });
        return doc
          ? jsonResponse(res, true, 'Ditambahkan ke favorit', doc, 201)
          : jsonResponse(res, false, 'Gagal menyimpan ke Firestore', [], 500);
      }

      // ─── DELETE ───────────────────────────────────────
      case 'DELETE': {
        if (req.query.id) {
          const ok = await fsDelete(COLLECTION, clean(req.query.id));
          return ok
            ? jsonResponse(res, true, 'Favorit dihapus')
            : jsonResponse(res, false, 'Gagal menghapus', [], 500);
        }

        if (req.query.user_uid && req.query.anime_id) {
          const uid     = clean(req.query.user_uid);
          const animeId = clean(req.query.anime_id);
          const favs    = await fsQuery(COLLECTION, 'userUid', 'EQUAL', uid);
          const toDelete = favs.filter(f => f.animeId === animeId);

          if (toDelete.length === 0) {
            return jsonResponse(res, false, 'Favorit tidak ditemukan', [], 404);
          }
          await Promise.all(toDelete.map(f => fsDelete(COLLECTION, f.id)));
          return jsonResponse(res, true, 'Favorit dihapus');
        }

        return jsonResponse(res, false, 'Parameter id atau (user_uid + anime_id) wajib', [], 400);
      }

      default:
        return jsonResponse(res, false, 'Method tidak diizinkan', [], 405);
    }
  } catch (err) {
    console.error('[favorites]', err);
    return jsonResponse(res, false, err.message || 'Server error', [], 500);
  }
}

module.exports = handleFavorites;
