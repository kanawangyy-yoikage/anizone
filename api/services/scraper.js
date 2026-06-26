// ─── SCRAPER SERVICE ─────────────────────────────────────
// Sumber: sankavollerei.web.id/anime/kura (Kuramanime)
//
// Endpoint lengkap:
//   GET /home                              → halaman utama
//   GET /search/:keyword                   → pencarian
//   GET /anime/:id/:slug                   → detail anime
//   GET /watch/:id/:slug/:episode          → streaming + download per episode
//   GET /batch/:id/:slug/:batchId          → download batch
//   GET /anime-list?page=&order_by=        → daftar anime A-Z
//   GET /schedule?scheduled_day=senin      → jadwal rilis
//   GET /quick/popular?page=&order_by=     → list populer
//   GET /quick/ongoing?page=&order_by=     → list ongoing
//   GET /quick/finished?page=&order_by=    → list selesai
//   GET /quick/movie?page=&order_by=       → list movie
//   GET /quick/donghua?page=&order_by=     → list donghua
//   GET /properties/genre                  → semua genre
//   GET /properties/genre/:slug            → anime per genre
//   GET /properties/season                 → semua season
//   GET /properties/season/:slug           → anime per season
//   GET /properties/studio                 → semua studio
//   GET /properties/studio/:slug           → anime per studio
//   GET /properties/type                   → semua type
//   GET /properties/type/:slug             → anime per type
//   GET /properties/quality                → semua quality
//   GET /properties/quality/:slug          → anime per quality
//   GET /properties/source                 → semua source
//   GET /properties/source/:slug           → anime per source
//   GET /properties/country                → semua country
//   GET /properties/country/:slug          → anime per country

const axios = require('axios');
const { ANIME_API } = require('../config');

const client = axios.create({
  baseURL: ANIME_API,
  headers: {
    'Accept'         : 'application/json',
    'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  },
  timeout: 30000,
});

// ─── RAW API CALLS ───────────────────────────────────────

const api = {
  // Core
  home        : ()                        => client.get('/home').then(r => r.data),
  search      : (keyword)                 => client.get(`/search/${encodeURIComponent(keyword)}`).then(r => r.data),
  detail      : (id, slug)               => client.get(`/anime/${id}/${slug}`).then(r => r.data),
  watch       : (id, slug, episode)      => client.get(`/watch/${id}/${slug}/${episode}`).then(r => r.data),
  batch       : (id, slug, batchId)      => client.get(`/batch/${id}/${slug}/${batchId}`).then(r => r.data),
  animeList   : (page = 1, orderBy = '') => client.get(`/anime-list?page=${page}${orderBy ? `&order_by=${orderBy}` : ''}`).then(r => r.data),
  schedule    : (day = '')               => client.get(`/schedule${day ? `?scheduled_day=${day}` : ''}`).then(r => r.data),

  // Quick lists
  popular     : (page = 1, orderBy = '') => client.get(`/quick/popular?page=${page}${orderBy ? `&order_by=${orderBy}` : ''}`).then(r => r.data),
  ongoing     : (page = 1, orderBy = '') => client.get(`/quick/ongoing?page=${page}${orderBy ? `&order_by=${orderBy}` : ''}`).then(r => r.data),
  finished    : (page = 1, orderBy = '') => client.get(`/quick/finished?page=${page}${orderBy ? `&order_by=${orderBy}` : ''}`).then(r => r.data),
  movie       : (page = 1, orderBy = '') => client.get(`/quick/movie?page=${page}${orderBy ? `&order_by=${orderBy}` : ''}`).then(r => r.data),
  donghua     : (page = 1, orderBy = '') => client.get(`/quick/donghua?page=${page}${orderBy ? `&order_by=${orderBy}` : ''}`).then(r => r.data),

  // Properties
  genres      : ()         => client.get('/properties/genre').then(r => r.data),
  genre       : (slug)     => client.get(`/properties/genre/${slug}`).then(r => r.data),
  seasons     : ()         => client.get('/properties/season').then(r => r.data),
  season      : (slug)     => client.get(`/properties/season/${slug}`).then(r => r.data),
  studios     : ()         => client.get('/properties/studio').then(r => r.data),
  studio      : (slug)     => client.get(`/properties/studio/${slug}`).then(r => r.data),
  types       : ()         => client.get('/properties/type').then(r => r.data),
  type        : (slug)     => client.get(`/properties/type/${slug}`).then(r => r.data),
  qualities   : ()         => client.get('/properties/quality').then(r => r.data),
  quality     : (slug)     => client.get(`/properties/quality/${slug}`).then(r => r.data),
  sources     : ()         => client.get('/properties/source').then(r => r.data),
  source      : (slug)     => client.get(`/properties/source/${slug}`).then(r => r.data),
  countries   : ()         => client.get('/properties/country').then(r => r.data),
  country     : (slug)     => client.get(`/properties/country/${slug}`).then(r => r.data),
};

// ─── HELPER ──────────────────────────────────────────────

// Normalisasi item list → format AniZone frontend
// Response Kuramanime: { title, poster/image, type, status, animeId, slug/url, score, episode/episodes }
function normalizeItem(item) {
  const id   = item.animeId || item.id || '';
  const slug = item.slug || item.animeSlug || item.url || '';
  // Endpoint untuk detail: "id/slug"
  const endpoint = (id && slug) ? `${id}/${slug}` : (slug || id || '');
  return {
    title   : item.title || '',
    url     : endpoint,
    image   : item.poster || item.image || item.thumbnail || '',
    endpoint: endpoint,
    animeId : String(id),
    slug    : slug,
    genres  : item.genres || item.genreList || [],
    release : item.releaseDay || item.latestReleaseDate || item.aired || '',
    score   : item.score || item.rating || '',
    type    : item.type || 'TV',
    episode : item.episodes != null ? String(item.episodes) : (item.episode != null ? String(item.episode) : ''),
    status  : item.status || '',
  };
}

// Parse "id/slug" composite endpoint
function parseEndpoint(raw = '') {
  const parts = String(raw).replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length >= 2) {
    return { id: parts[0], slug: parts.slice(1).join('/') };
  }
  return { id: parts[0], slug: parts[0] };
}

// ─── ADAPTER FUNCTIONS ───────────────────────────────────

// getLatest → /api/latest (beranda, ambil dari ongoing)
async function getLatest(page = 1) {
  try {
    const raw  = await api.ongoing(page);
    const list = raw.data?.animeList || raw.data || [];
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
    const raw  = await api.search(keyword);
    const list = raw.data?.animeList || raw.data || [];
    return list.map(normalizeItem);
  } catch (err) {
    console.error('[searchAnime]', err.message);
    return [];
  }
}

// getDetail → /api/detail?url=id/slug
// Response Kuramanime: { title, poster, type, status, score, synopsis,
//   genreList, episodeList, batch, japanese, aired, studios, ... }
async function getDetail(urlOrEndpoint) {
  const { id, slug } = parseEndpoint(urlOrEndpoint);
  let raw;
  try {
    raw = await api.detail(id, slug);
  } catch (err) {
    console.error('[getDetail] fetch error:', err.message);
    throw err;
  }
  if (!raw || raw.ok === false || !raw.data) {
    throw new Error(`Anime tidak ditemukan: ${urlOrEndpoint}`);
  }
  const d = raw.data || {};

  // Genre list
  const genreObjs = d.genreList || d.genres || [];
  const genreArr  = genreObjs.map(g => g.title || g.name || g.slug || '').filter(Boolean);

  // Episode list → [{title, url (id/slug/epNum), endpoint, date}]
  const animeId  = d.animeId || id || '';
  const animeSlug = d.slug || d.animeSlug || slug || '';
  const episodes = (d.episodeList || d.episodes || []).map(ep => {
    const epNum  = ep.episodeNumber || ep.episode || ep.number || '';
    // Endpoint watch: animeId/animeSlug/episodeNumber
    const epEndpoint = `${animeId}/${animeSlug}/${epNum}`;
    return {
      title   : ep.title || ep.name || `Episode ${epNum}`,
      url     : epEndpoint,
      endpoint: epEndpoint,
      date    : ep.date || ep.releaseDate || '',
      number  : String(epNum),
    };
  });

  // Batch info
  const batchData = d.batch || null;
  let batchSlug = '';
  if (batchData && batchData.batchId) {
    batchSlug = `${animeId}/${animeSlug}/${batchData.batchId}`;
  }

  const synopsis = d.synopsis || d.description || '';
  const description = Array.isArray(synopsis?.paragraphs) && synopsis.paragraphs.length
    ? synopsis.paragraphs.join(' ')
    : (typeof synopsis === 'string' ? synopsis : '');

  return {
    title      : d.title || '',
    image      : d.poster || d.image || '',
    description,
    animeId    : animeId,
    slug       : animeSlug,
    info       : {
      japanese     : d.japanese || d.japaneseTitle || '',
      type         : d.type || 'TV',
      status       : d.status || 'Ongoing',
      total_episode: d.totalEpisode || d.episodes || episodes.length || '?',
      score        : d.score || 'N/A',
      duration     : d.duration || '?',
      season       : d.season || '',
      released     : d.aired || d.releaseDate || '',
      producer     : d.producers || '',
      studio       : Array.isArray(d.studios) ? d.studios.map(s => s.title || s.name || s).join(', ') : (d.studios || d.studio || ''),
      genre        : genreArr.join(', '),
    },
    genre    : genreArr,
    episodes,
    batchSlug,
    download : [],
  };
}

// getWatch → /api/watch?url=id/slug/episode
// Response Kuramanime: { title, animeId, slug, streams/servers, downloads, prevEpisode, nextEpisode }
async function getWatch(urlOrEndpoint) {
  const parts = String(urlOrEndpoint).replace(/^\/+|\/+$/g, '').split('/');
  // Format: animeId/animeSlug/episodeNumber
  let id, slug, episode;
  if (parts.length >= 3) {
    id      = parts[0];
    episode = parts[parts.length - 1];
    slug    = parts.slice(1, -1).join('/');
  } else if (parts.length === 2) {
    id      = parts[0];
    slug    = parts[0];
    episode = parts[1];
  } else {
    id = parts[0]; slug = parts[0]; episode = '1';
  }

  const raw = await api.watch(id, slug, episode);
  const d   = raw.data || {};

  // Streams
  const streams = [];

  // Format Kuramanime: { servers: [{serverName, url}] } atau { streamingLink, mirrorList }
  const serverList = d.servers || d.streamingServers || [];
  for (const srv of serverList) {
    streams.push({
      server  : srv.serverName || srv.name || srv.title || 'Server',
      url     : srv.url || srv.link || srv.href || '',
      serverId: srv.serverId || '',
    });
  }

  // Default streaming URL
  if (d.defaultStreamingUrl || d.streamingLink) {
    const defUrl = d.defaultStreamingUrl || d.streamingLink;
    if (!streams.find(s => s.url === defUrl)) {
      streams.unshift({ server: 'Default', url: defUrl, serverId: '' });
    }
  }

  // Mirror list (array of {quality, mirrors:[{name,url}]})
  const mirrorList = d.mirrorList || d.mirrors || [];
  for (const q of mirrorList) {
    for (const m of (q.mirrors || q.links || [])) {
      streams.push({
        server  : `${m.name || 'Mirror'} (${q.quality || ''})`,
        url     : m.url || m.link || '',
        serverId: '',
      });
    }
  }

  // Downloads
  const downloads = [];
  const dlList = d.downloads || d.downloadList || [];
  for (const dl of dlList) {
    const format = dl.format || dl.quality || 'MP4';
    const res    = dl.resolution || dl.quality || '';
    const links  = (dl.links || dl.hosts || []).map(l => ({
      host: l.host || l.name || l.title || 'Download',
      url : l.url  || l.link || l.href  || '',
    }));
    if (links.length) downloads.push({ format, resolution: res, links });
  }

  // Navigasi episode
  const animeEndpoint = `${d.animeId || id}/${d.animeSlug || slug}`;
  const prevEp = d.prevEpisode ? {
    title   : d.prevEpisode.title || `Episode ${d.prevEpisode.episode || ''}`,
    endpoint: `${animeEndpoint}/${d.prevEpisode.episode || d.prevEpisode.episodeNumber || ''}`,
  } : null;
  const nextEp = d.nextEpisode ? {
    title   : d.nextEpisode.title || `Episode ${d.nextEpisode.episode || ''}`,
    endpoint: `${animeEndpoint}/${d.nextEpisode.episode || d.nextEpisode.episodeNumber || ''}`,
  } : null;

  return {
    title    : d.title || raw.title || '',
    animeId  : d.animeId || id || '',
    streams,
    downloads,
    prevEp,
    nextEp,
  };
}

// getScrapedSchedule → /api/schedule
async function getScrapedSchedule() {
  try {
    const raw  = await api.schedule();
    const days = raw.data || [];
    // Kuramanime schedule: [{ scheduledDay, animeList:[{title, slug, poster, animeId}] }]
    return days.map(d => ({
      day      : d.scheduledDay || d.day || '',
      animeList: (d.animeList || d.anime_list || []).map(a => ({
        title   : a.title || '',
        url     : a.animeId && a.slug ? `${a.animeId}/${a.slug}` : (a.slug || a.animeId || ''),
        image   : a.poster || a.image || '',
        endpoint: a.animeId && a.slug ? `${a.animeId}/${a.slug}` : (a.slug || ''),
      })),
    }));
  } catch (err) {
    console.error('[getScrapedSchedule]', err.message);
    return [];
  }
}

// getScrapedTrending → dari home (popular list)
async function getScrapedTrending() {
  try {
    const raw  = await api.home();
    // Kuramanime home: data.popular atau data.trending atau data.ongoingList
    const list = raw.data?.popular || raw.data?.trending || raw.data?.ongoingList
      || raw.data?.animeList || raw.data?.ongoing || [];
    const arr  = Array.isArray(list) ? list : (list.animeList || []);
    return arr.slice(0, 20).map(normalizeItem);
  } catch (err) {
    console.error('[getScrapedTrending]', err.message);
    return [];
  }
}

module.exports = {
  // Adapter (dipakai route frontend)
  getLatest,
  searchAnime,
  getDetail,
  getWatch,
  getScrapedSchedule,
  getScrapedTrending,

  // Raw API (dipakai route langsung di index.js)
  api,

  // Helper
  parseEndpoint,
  normalizeItem,
};
