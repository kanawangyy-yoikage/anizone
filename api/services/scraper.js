// ─── SCRAPER SERVICE ─────────────────────────────────────
// Sumber: sankavollerei.web.id/anime/animasu
//
// Endpoint lengkap:
//   GET /home                        → halaman utama (?page=1)
//   GET /popular?page=1              → anime populer
//   GET /movies?page=1               → anime movie
//   GET /ongoing?page=1              → anime sedang tayang
//   GET /completed?page=1            → anime selesai
//   GET /latest?page=1               → anime terbaru/baru diupdate
//   GET /search/:keyword?page=1      → pencarian
//   GET /animelist?letter=A&page=1   → daftar A-Z
//   GET /advanced-search?genres=aksi&status=ongoing&page=1
//   GET /genres                      → semua genre
//   GET /genre/:slug?page=1          → anime per genre
//   GET /characters                  → semua tipe karakter
//   GET /character/:slug?page=1      → anime per karakter
//   GET /schedule                    → jadwal rilis
//   GET /detail/:slug                → detail anime
//   GET /episode/:slug               → detail episode + streaming

const axios = require('axios');
const { ANIME_API } = require('../config');

const client = axios.create({
  baseURL: ANIME_API,
  headers: {
    'Accept'         : 'application/json',
    'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  },
  timeout: 15000,
});

// ─── RAW API CALLS ───────────────────────────────────────

const api = {
  home        : (page = 1)          => client.get(`/home?page=${page}`).then(r => r.data),
  popular     : (page = 1)          => client.get(`/popular?page=${page}`).then(r => r.data),
  movies      : (page = 1)          => client.get(`/movies?page=${page}`).then(r => r.data),
  ongoing     : (page = 1)          => client.get(`/ongoing?page=${page}`).then(r => r.data),
  completed   : (page = 1)          => client.get(`/completed?page=${page}`).then(r => r.data),
  latest      : (page = 1)          => client.get(`/latest?page=${page}`).then(r => r.data),
  search      : (keyword, page = 1) => client.get(`/search/${encodeURIComponent(keyword)}?page=${page}`).then(r => r.data),
  animelist   : (letter, page = 1)  => client.get(`/animelist?letter=${letter}&page=${page}`).then(r => r.data),
  advSearch   : (params)            => client.get(`/advanced-search`, { params }).then(r => r.data),
  genres      : ()                  => client.get('/genres').then(r => r.data),
  genre       : (slug, page = 1)    => client.get(`/genre/${slug}?page=${page}`).then(r => r.data),
  characters  : ()                  => client.get('/characters').then(r => r.data),
  character   : (slug, page = 1)    => client.get(`/character/${slug}?page=${page}`).then(r => r.data),
  schedule    : ()                  => client.get('/schedule').then(r => r.data),
  detail      : (slug)              => client.get(`/detail/${slug}`).then(r => r.data),
  episode     : (slug)              => client.get(`/episode/${slug}`).then(r => r.data),
};

// ─── HELPER ──────────────────────────────────────────────

function cleanSlug(raw = '') {
  return String(raw)
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/\/$/, '')
    .split('/')
    .filter(Boolean)
    .pop() || String(raw);
}

// Normalisasi item list → format AniZone frontend
// Dari juju-otaku: { title, poster, slug, type, episode, release_day }
function normalizeItem(item) {
  const slug = item.slug || cleanSlug(item.href || item.url || '');
  return {
    title   : item.title || '',
    url     : slug,
    image   : item.poster || item.image || '',
    endpoint: slug,
    genres  : [],
    release : item.release_day || item.releaseDay || '',
    score   : item.score || '',
    type    : item.type || '',
    episode : item.episode != null ? String(item.episode) : '',
  };
}

// Ambil array anime dari berbagai bentuk response
function extractAnimes(raw) {
  return raw.animes
      || raw.data?.animes
      || raw.animeList
      || raw.data?.animeList
      || raw.data
      || [];
}

// ─── ADAPTER FUNCTIONS ───────────────────────────────────

// getLatest → /api/latest (dipakai beranda)
async function getLatest(page = 1) {
  try {
    const raw = await api.latest(page);
    return extractAnimes(raw).map(normalizeItem);
  } catch (err) {
    console.error('[getLatest]', err.message);
    return [];
  }
}

// searchAnime → /api/search
async function searchAnime(keyword) {
  if (!keyword) return [];
  try {
    const raw = await api.search(keyword);
    return extractAnimes(raw).map(normalizeItem);
  } catch (err) {
    console.error('[searchAnime]', err.message);
    return [];
  }
}

// getDetail → /api/detail?url=...
// Sesuai juju-otaku: result.detail → { title, poster, synopsis, status, duration,
//   aired, season, studio, author, synonym, genres:[{name,slug}],
//   episodes:[{name,slug}], batch:{slug} }
async function getDetail(urlOrSlug) {
  const slug = cleanSlug(urlOrSlug);
  const raw  = await api.detail(slug);
  const d    = raw.detail || raw.data || raw;

  const genreObjs = d.genres || [];
  const genreArr  = genreObjs.map(g => (typeof g === 'object' ? g.name || '' : g)).filter(Boolean);

  // Episodes: [{name, slug}]
  const episodes = (d.episodes || []).map(ep => {
    const epSlug = ep.slug || cleanSlug(ep.href || ep.url || '');
    return {
      title   : ep.name || ep.title || '',
      url     : epSlug,
      endpoint: epSlug,
      date    : ep.date || '',
    };
  });

  const batchSlug = d.batch?.slug || cleanSlug(d.batch?.href || '');

  return {
    title      : d.title || '',
    image      : d.poster || d.image || '',
    description: d.synopsis || d.description || '',
    info       : {
      japanese     : d.synonym   || d.japanese || '',
      type         : d.type      || 'TV',
      status       : d.status    || 'Ongoing',
      total_episode: d.totalEpisode || episodes.length || '?',
      score        : d.score     || 'N/A',
      duration     : d.duration  || '?',
      season       : d.season    || '',
      released     : d.aired     || d.releaseDate || '',
      producer     : d.author    || d.producer || '',
      studio       : d.studio    || '',
      genre        : genreArr.join(', '),
    },
    genre    : genreArr,
    episodes,
    batchSlug,
    download : [],
  };
}

// getWatch → /api/watch?url=...
// Sesuai juju-otaku: { title, streams:[{name, url}] }
async function getWatch(urlOrSlug) {
  const slug = cleanSlug(urlOrSlug);
  const raw  = await api.episode(slug);
  const d    = raw.data || raw;

  const streams = (d.streams || []).map(s => ({
    server: s.name   || s.server || 'Server',
    url   : s.url    || s.embedUrl || '',
  })).filter(s => s.url);

  // Download links
  const downloads = [];
  const dlRaw = d.downloadUrl || d.downloads || [];
  (Array.isArray(dlRaw) ? dlRaw : []).forEach(group => {
    (group.qualities || []).forEach(q => {
      downloads.push({
        resolution: q.title || q.resolution || '',
        format    : group.title || '',
        links     : (q.urls || []).map(l => ({ host: l.title || '', url: l.url || '' })),
      });
    });
  });

  return {
    title    : d.title || raw.title || '',
    streams,
    downloads,
  };
}

// getScrapedSchedule → fallback /api/schedule
async function getScrapedSchedule() {
  try {
    const raw = await api.schedule();
    return raw.data || raw.schedule || raw || [];
  } catch { return []; }
}

// getScrapedTrending → fallback /api/trending
async function getScrapedTrending() {
  try {
    const raw   = await api.popular();
    return extractAnimes(raw).slice(0, 20).map(normalizeItem);
  } catch { return []; }
}

module.exports = {
  // Adapter (dipakai route lama / frontend)
  getLatest,
  searchAnime,
  getDetail,
  getWatch,
  getScrapedSchedule,
  getScrapedTrending,

  // Raw API (dipakai route baru di index.js)
  api,
};
