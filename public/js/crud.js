/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — PHP CRUD API HELPER
   Base URL mengarah ke /php/api/ (PHP-FPM via Nginx)
   ═══════════════════════════════════════════════════════ */

const CRUD_BASE = '/php/api';

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
//  ANIME CRUD  →  /php/api/anime.php
// ══════════════════════════════════════════════════════

const AnimeAPI = {
  list:   (page = 1, limit = 15) => crudFetch('/anime.php', 'GET', null, { page, limit }),
  search: (query)                 => crudFetch('/anime.php', 'GET', null, { search: query }),
  get:    (id)                    => crudFetch('/anime.php', 'GET', null, { id }),
  create: (data)                  => crudFetch('/anime.php', 'POST', data),
  update: (id, data)              => crudFetch('/anime.php', 'PUT', data, { id }),
  delete: (id)                    => crudFetch('/anime.php', 'DELETE', null, { id }),
};

// ══════════════════════════════════════════════════════
//  USERS CRUD  →  /php/api/users.php
// ══════════════════════════════════════════════════════

const UsersAPI = {
  list:   (page = 1, limit = 20, role = '') => crudFetch('/users.php', 'GET', null, role ? { page, limit, role } : { page, limit }),
  get:    (uid)                              => crudFetch('/users.php', 'GET', null, { uid }),
  upsert: (data)                             => crudFetch('/users.php', 'POST', data),
  update: (uid, data)                        => crudFetch('/users.php', 'PUT', data, { uid }),
  delete: (uid)                              => crudFetch('/users.php', 'DELETE', null, { uid }),
};

// ══════════════════════════════════════════════════════
//  FAVORITES CRUD  →  /php/api/favorites.php
// ══════════════════════════════════════════════════════

const FavoritesAPI = {
  list:          (userUid)              => crudFetch('/favorites.php', 'GET', null, { user_uid: userUid }),
  add:           (userUid, animeId)     => crudFetch('/favorites.php', 'POST', { user_uid: userUid, anime_id: animeId }),
  remove:        (id)                   => crudFetch('/favorites.php', 'DELETE', null, { id }),
  removeByAnime: (userUid, animeId)     => crudFetch('/favorites.php', 'DELETE', null, { user_uid: userUid, anime_id: animeId }),
};
