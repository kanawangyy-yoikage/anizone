// ─── ANIZONE — USERS CRUD (Node.js) ─────────────────────
// Pengganti /php/api/users.php untuk Vercel deployment.
// Endpoint: /api/crud/users
//
//  GET    (tanpa param)    → list semua user
//  GET    ?uid=xxx         → detail satu user
//  POST                    → upsert user (sinkron dari Firebase)
//  PUT    ?uid=xxx         → update role / profil
//  DELETE ?uid=xxx         → hapus user + favoritnya

const { setCors, jsonResponse, clean, fsListAll, fsGet, fsSet, fsUpdate, fsDelete, fsQuery } = require('./firestore');

const COLLECTION = 'users';

async function handleUsers(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    switch (req.method) {

      // ─── READ ─────────────────────────────────────────
      case 'GET': {
        if (req.query.uid) {
          const doc = await fsGet(COLLECTION, clean(req.query.uid));
          return doc
            ? jsonResponse(res, true, 'OK', doc)
            : jsonResponse(res, false, 'Pengguna tidak ditemukan', [], 404);
        }

        let all = await fsListAll(COLLECTION);

        if (req.query.role) {
          const role = clean(req.query.role);
          all = all.filter(u => (u.role || 'user') === role);
        }

        if (req.query.search) {
          const q = req.query.search.toLowerCase();
          all = all.filter(u =>
            (u.displayName || '').toLowerCase().includes(q) ||
            (u.email       || '').toLowerCase().includes(q)
          );
        }

        all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        const page  = Math.max(1, parseInt(req.query.page  || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
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

      // ─── CREATE / UPSERT ──────────────────────────────
      case 'POST': {
        const b = req.body || {};
        if (!b.uid || !b.email) {
          return jsonResponse(res, false, 'Field wajib: uid, email', [], 422);
        }
        const uid     = clean(b.uid);
        const payload = {
          email:       clean(b.email),
          displayName: clean(b.display_name || ''),
          photoURL:    clean(b.photo_url    || ''),
          role:        clean(b.role         || 'user'),
        };
        const exist = await fsGet(COLLECTION, uid);
        if (exist) {
          const ok = await fsUpdate(COLLECTION, uid, payload);
          return ok
            ? jsonResponse(res, true, 'User diperbarui (upsert)', { uid })
            : jsonResponse(res, false, 'Gagal update Firestore', [], 500);
        } else {
          payload.createdAt = new Date().toISOString();
          // Set dengan UID sebagai doc ID
          const doc = await fsSet(COLLECTION, uid, payload);
          return doc
            ? jsonResponse(res, true, 'User berhasil ditambahkan', { uid }, 201)
            : jsonResponse(res, false, 'Gagal menyimpan ke Firestore', [], 500);
        }
      }

      // ─── UPDATE ───────────────────────────────────────
      case 'PUT': {
        const uid = clean(req.query.uid || '');
        if (!uid) return jsonResponse(res, false, 'Parameter uid wajib', [], 400);
        const exists = await fsGet(COLLECTION, uid);
        if (!exists) return jsonResponse(res, false, 'Pengguna tidak ditemukan', [], 404);

        const b = req.body || {};
        const ok = await fsUpdate(COLLECTION, uid, {
          displayName: clean(b.display_name || ''),
          photoURL:    clean(b.photo_url    || ''),
          role:        clean(b.role         || 'user'),
        });
        return ok
          ? jsonResponse(res, true, 'Pengguna berhasil diperbarui', { uid })
          : jsonResponse(res, false, 'Gagal update Firestore', [], 500);
      }

      // ─── DELETE ───────────────────────────────────────
      case 'DELETE': {
        const uid = clean(req.query.uid || '');
        if (!uid) return jsonResponse(res, false, 'Parameter uid wajib', [], 400);
        const doc = await fsGet(COLLECTION, uid);
        if (!doc) return jsonResponse(res, false, 'Pengguna tidak ditemukan', [], 404);

        // Hapus semua favorit user
        const favs = await fsQuery('favorites', 'userUid', 'EQUAL', uid);
        await Promise.all(favs.map(f => fsDelete('favorites', f.id)));

        const ok = await fsDelete(COLLECTION, uid);
        return ok
          ? jsonResponse(res, true, `Pengguna "${doc.displayName}" berhasil dihapus`)
          : jsonResponse(res, false, 'Gagal menghapus dari Firestore', [], 500);
      }

      default:
        return jsonResponse(res, false, 'Method tidak diizinkan', [], 405);
    }
  } catch (err) {
    console.error('[users]', err);
    return jsonResponse(res, false, err.message || 'Server error', [], 500);
  }
}

module.exports = handleUsers;
