/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — CRUD API HELPER
   Base URL sekarang mengarah ke /api/crud/ (Node.js)
   — Migrasi dari /php/api/ (Railway/PHP) ke Vercel.
   ═══════════════════════════════════════════════════════ */

const CRUD_BASE = '/api/crud';

// ── GENERIC FETCH HELPER ──────────────────────────────
async function crudFetch(endpoint, method = 'GET', body = null, params = {}) {
  const url = new URL(CRUD_BASE + endpoint, location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method !== 'GET') options.body = JSON.stringify(body);

  const res  = await fetch(url.toString(), options);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Request gagal');
  return json;
}

// ══════════════════════════════════════════════════════
//  ANIME CRUD  →  /api/crud/anime
// ══════════════════════════════════════════════════════

const AnimeAPI = {
  list:   (page = 1, limit = 15) => crudFetch('/anime', 'GET', null, { page, limit }),
  search: (query)                 => crudFetch('/anime', 'GET', null, { search: query }),
  get:    (id)                    => crudFetch('/anime', 'GET', null, { id }),
  create: (data)                  => crudFetch('/anime', 'POST', data),
  update: (id, data)              => crudFetch('/anime', 'PUT', data, { id }),
  delete: (id)                    => crudFetch('/anime', 'DELETE', null, { id }),
};

// ══════════════════════════════════════════════════════
//  USERS CRUD  →  /api/crud/users
// ══════════════════════════════════════════════════════

const UsersAPI = {
  list:   (page = 1, limit = 20, role = '') => crudFetch('/users', 'GET', null, role ? { page, limit, role } : { page, limit }),
  get:    (uid)                              => crudFetch('/users', 'GET', null, { uid }),
  upsert: (data)                             => crudFetch('/users', 'POST', data),
  update: (uid, data)                        => crudFetch('/users', 'PUT', data, { uid }),
  delete: (uid)                              => crudFetch('/users', 'DELETE', null, { uid }),
};

// ══════════════════════════════════════════════════════
//  FAVORITES CRUD  →  /api/crud/favorites
// ══════════════════════════════════════════════════════

const FavoritesAPI = {
  list:          (userUid)              => crudFetch('/favorites', 'GET', null, { user_uid: userUid }),
  add:           (userUid, animeId)     => crudFetch('/favorites', 'POST', { user_uid: userUid, anime_id: animeId }),
  remove:        (id)                   => crudFetch('/favorites', 'DELETE', null, { id }),
  removeByAnime: (userUid, animeId)     => crudFetch('/favorites', 'DELETE', null, { user_uid: userUid, anime_id: animeId }),
};
