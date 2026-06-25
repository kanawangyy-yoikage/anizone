// ─── SCRAPER SERVICE ─────────────────────────────────────
// Sumber: sankavollerei.web.id/anime (Otakudesu)
//
// Endpoint lengkap:
//   GET /anime/home                        → halaman utama
//   GET /anime/schedule                    → jadwal rilis
//   GET /anime/anime/:slug                 → detail anime
//   GET /anime/complete-anime?page=1       → anime tamat
//   GET /anime/ongoing-anime?page=1        → anime sedang tayang
//   GET /anime/genre                       → semua genre
//   GET /anime/genre/:slug?page=1          → anime per genre
//   GET /anime/episode/:slug               → detail episode + streaming
//   GET /anime/search/:keyword             → pencarian
//   GET /anime/batch/:slug                 → download batch
//   GET /anime/server/:serverId            → URL embed stream server
//   GET /anime/unlimited                   → semua anime (A-Z)

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
  home      : ()                  => client.get('/home').then(r => r.data),
  schedule  : ()                  => client.get('/schedule').then(r => r.data),
  detail    : (slug)              => client.get(`/anime/${slug}`).then(r => r.data),
  completed : (page = 1)          => client.get(`/complete-anime?page=${page}`).then(r => r.data),
  ongoing   : (page = 1)          => client.get(`/ongoing-anime?page=${page}`).then(r => r.data),
  genres    : ()                  => client.get('/genre').then(r => r.data),
  genre     : (slug, page = 1)    => client.get(`/genre/${slug}?page=${page}`).then(r => r.data),
  episode   : (slug)              => client.get(`/episode/${slug}`).then(r => r.data),
  search    : (keyword)           => client.get(`/search/${encodeURIComponent(keyword)}`).then(r => r.data),
  batch     : (slug)              => client.get(`/batch/${slug}`).then(r => r.data),
  server    : (serverId)          => client.get(`/server/${serverId}`).then(r => r.data),
  unlimited : ()                  => client.get('/unlimited').then(r => r.data),
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
// Response Otakudesu: { title, poster, episodes, releaseDay, latestReleaseDate, animeId, href }
function normalizeItem(item) {
  const slug = item.animeId || cleanSlug(item.href || item.url || '');
  return {
    title   : item.title || '',
    url     : slug,
    image   : item.poster || item.image || '',
    endpoint: slug,
    genres  : [],
    release : item.releaseDay || item.latestReleaseDate || '',
    score   : item.score || '',
    type    : item.type || 'TV',
    episode : item.episodes != null ? String(item.episodes) : '',
  };
}

// ─── ADAPTER FUNCTIONS ───────────────────────────────────

// getLatest → /api/latest (dipakai beranda, ambil dari ongoing)
async function getLatest(page = 1) {
  try {
    const raw = await api.ongoing(page);
    const list = raw.data?.animeList || [];
    return list.map(normalizeItem);
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
    const list = raw.data?.animeList || [];
    return list.map(normalizeItem);
  } catch (err) {
    console.error('[searchAnime]', err.message);
    return [];
  }
}

// getDetail → /api/detail?url=...
// Response Otakudesu: { title, poster, japanese, score, type, status, episodes,
//   duration, aired, studios, batch, synopsis, genreList, episodeList }
async function getDetail(urlOrSlug) {
  const slug = cleanSlug(urlOrSlug);
  const raw  = await api.detail(slug);
  const d    = raw.data || {};

  const genreObjs = d.genreList || [];
  const genreArr  = genreObjs.map(g => g.title || '').filter(Boolean);

  // Episodes: [{name, slug}]
  const episodes = (d.episodeList || []).map(ep => {
    const epSlug = ep.episodeId || cleanSlug(ep.href || ep.url || '');
    return {
      title   : ep.title || ep.name || '',
      url     : epSlug,
      endpoint: epSlug,
      date    : ep.date || ep.latestReleaseDate || '',
    };
  });

  const batchSlug = d.batch ? cleanSlug(d.batch) : '';

  return {
    title      : d.title || '',
    image      : d.poster || '',
    description: d.synopsis?.paragraphs?.join(' ') || d.synopsis || '',
    info       : {
      japanese     : d.japanese || '',
      type         : d.type || 'TV',
      status       : d.status || 'Ongoing',
      total_episode: d.episodes || episodes.length || '?',
      score        : d.score || 'N/A',
      duration     : d.duration || '?',
      season       : d.season || '',
      released     : d.aired || '',
      producer     : d.producers || '',
      studio       : d.studios || '',
      genre        : genreArr.join(', '),
    },
    genre    : genreArr,
    episodes,
    batchSlug,
    download : [],
  };
}

// getWatch → /api/watch?url=...
// Response Otakudesu episode: { title, animeId, defaultStreamingUrl, server: { qualities:[{title, serverList:[{title,serverId,href}]}] } }
async function getWatch(urlOrSlug) {
  const slug = cleanSlug(urlOrSlug);
  const raw  = await api.episode(slug);
  const d    = raw.data || {};

  // Bangun streams dari server.qualities
  const streams = [];
  const qualities = d.server?.qualities || [];
  for (const quality of qualities) {
    for (const srv of (quality.serverList || [])) {
      const serverId = srv.serverId || '';
      streams.push({
        server  : `${srv.title || 'Server'} (${quality.title || ''})`,
        serverId: serverId,
        url     : srv.href ? `https://www.sankavollerei.web.id${srv.href}` : '',
        // URL embed bisa di-resolve via /api/server/:serverId
      });
    }
  }

  // Jika ada defaultStreamingUrl, tambahkan sebagai stream pertama
  if (d.defaultStreamingUrl) {
    streams.unshift({
      server: 'Default',
      url   : d.defaultStreamingUrl,
    });
  }

  // Navigasi episode
  const prevEp = d.prevEpisode ? {
    title   : d.prevEpisode.title || 'Prev',
    endpoint: d.prevEpisode.episodeId || cleanSlug(d.prevEpisode.href || ''),
  } : null;

  const nextEp = d.nextEpisode ? {
    title   : d.nextEpisode.title || 'Next',
    endpoint: d.nextEpisode.episodeId || cleanSlug(d.nextEpisode.href || ''),
  } : null;

  return {
    title    : d.title || raw.title || '',
    animeId  : d.animeId || '',
    streams,
    downloads: [],
    prevEp,
    nextEp,
  };
}

// getScrapedSchedule → fallback /api/schedule
// Response: [{ day, anime_list:[{ title, slug, url, poster }] }]
async function getScrapedSchedule() {
  try {
    const raw = await api.schedule();
    // Otakudesu schedule: data = [{ day, anime_list:[...] }]
    const days = raw.data || [];
    return days.map(d => ({
      day      : d.day || '',
      animeList: (d.anime_list || []).map(a => ({
        title   : a.title || '',
        url     : a.slug || cleanSlug(a.url || ''),
        image   : a.poster || '',
        endpoint: a.slug || cleanSlug(a.url || ''),
      })),
    }));
  } catch { return []; }
}

// getScrapedTrending → ambil dari home (ongoing list)
async function getScrapedTrending() {
  try {
    const raw  = await api.home();
    const list = raw.data?.ongoing?.animeList || [];
    return list.slice(0, 20).map(normalizeItem);
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
