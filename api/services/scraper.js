// ─── SCRAPER SERVICE ─────────────────────────────────────
// Sumber: sankavollerei.web.id/anime/nimegami (Nimegami)
//
// Endpoint Nimegami:
//   GET /home                              → halaman utama / latest
//   GET /search/:query?page=              → pencarian
//   GET /detail/:slug                      → detail anime
//   GET /anime-list?page=                 → daftar anime A-Z
//   GET /genre/list                        → semua genre
//   GET /genre/:slug?page=               → anime per genre
//   GET /seasons/list                      → semua season
//   GET /seasons/:slug?page=             → anime per season
//   GET /type/list                         → semua tipe (TV, Movie, OVA, dll)
//   GET /type/:slug?page=                → konten per tipe
//   GET /j-drama                           → konten J-Drama
//   GET /live-action                       → daftar Live Action & J-Drama
//   GET /live-action/:slug                 → detail Live Action
//   GET /drama/:slug                       → detail J-Drama / Drama Movie

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
  home        : ()               => client.get('/home').then(r => r.data),
  search      : (query, page=1)  => client.get(`/search/${encodeURIComponent(query)}`, { params: { page } }).then(r => r.data),
  detail      : (slug)           => client.get(`/detail/${slug}`).then(r => r.data),
  animeList   : (page = 1)       => client.get('/anime-list', { params: { page } }).then(r => r.data),

  // Genre
  genreList   : ()               => client.get('/genre/list').then(r => r.data),
  genre       : (slug, page=1)   => client.get(`/genre/${slug}`, { params: { page } }).then(r => r.data),

  // Season
  seasonList  : ()               => client.get('/seasons/list').then(r => r.data),
  season      : (slug, page=1)   => client.get(`/seasons/${slug}`, { params: { page } }).then(r => r.data),

  // Type
  typeList    : ()               => client.get('/type/list').then(r => r.data),
  type        : (slug, page=1)   => client.get(`/type/${slug}`, { params: { page } }).then(r => r.data),

  // Live Action / J-Drama
  jDrama      : ()               => client.get('/j-drama').then(r => r.data),
  liveAction  : ()               => client.get('/live-action').then(r => r.data),
  liveDetail  : (slug)           => client.get(`/live-action/${slug}`).then(r => r.data),
  dramaDetail : (slug)           => client.get(`/drama/${slug}`).then(r => r.data),
};

// ─── HELPER ──────────────────────────────────────────────

// Normalisasi item list → format AniZone frontend
// Nimegami item: { title, slug, poster/image/thumbnail, type, status, score, episode/episodes, genres }
function normalizeItem(item) {
  const slug = item.slug || item.url || item.animeSlug || '';
  return {
    title   : item.title || '',
    url     : slug,
    image   : item.poster || item.image || item.thumbnail || item.cover || '',
    endpoint: slug,
    animeId : slug,   // Nimegami pakai slug sebagai identifier, bukan numeric id
    slug    : slug,
    genres  : item.genres || item.genreList || [],
    release : item.releaseDay || item.latestReleaseDate || item.aired || item.date || '',
    score   : item.score || item.rating || '',
    type    : item.type || 'TV',
    episode : item.episodes != null ? String(item.episodes)
              : (item.episode != null ? String(item.episode) : ''),
    status  : item.status || '',
  };
}

// Ekstrak list dari berbagai format response Nimegami
function extractList(raw) {
  // Nimegami pakai snake_case: anime_list
  const data = raw?.data || raw;
  const arr = data?.anime_list || data?.animeList || data?.list
    || data?.animes || data?.results
    || (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

// Ekstrak totalPages dari response Nimegami
function extractTotalPages(raw) {
  const data = raw?.data || raw;
  return data?.totalPages || data?.total_pages || data?.lastPage || raw?.totalPages || 1;
}

// ─── ADAPTER FUNCTIONS ───────────────────────────────────

// getLatest → /api/latest (beranda)
async function getLatest(page = 1) {
  try {
    const raw  = await api.home();
    // Nimegami home: field anime_list (snake_case)
    const data = raw?.data || raw;
    const list = data?.anime_list || data?.animeList || data?.latestList
      || data?.ongoingList || data?.ongoing || data?.latest
      || extractList(raw);
    return Array.isArray(list) ? list.map(normalizeItem) : [];
  } catch (err) {
    console.error('[getLatest]', err.message);
    return [];
  }
}

// searchAnime → /api/search
async function searchAnime(keyword, page = 1) {
  if (!keyword) return [];
  try {
    const raw  = await api.search(keyword, page);
    const list = extractList(raw);
    return list.map(normalizeItem);
  } catch (err) {
    console.error('[searchAnime]', err.message);
    return [];
  }
}

// getDetail → /api/detail?url=slug
// Nimegami detail response: { title, slug, poster/image, type, status, score, synopsis/description,
//   genres, episodeList/episodes, japanese, aired, studio/studios, totalEpisode, duration, ... }
async function getDetail(slugOrEndpoint) {
  // Bersihkan slug: hapus prefix path jika ada
  const slug = String(slugOrEndpoint).replace(/^\/?detail\//, '').replace(/^\/+|\/+$/g, '');
  let raw;
  try {
    raw = await api.detail(slug);
  } catch (err) {
    console.error('[getDetail] fetch error:', err.message);
    throw err;
  }
  if (!raw || raw.ok === false) {
    throw new Error(`Anime tidak ditemukan: ${slug}`);
  }
  const d = raw?.data || raw;
  if (!d || (!d.title && !d.slug)) {
    throw new Error(`Anime tidak ditemukan: ${slug}`);
  }

  // Genre list — Nimegami bisa kirim array of string atau array of object
  const genreRaw = d.genres || d.genreList || d.genre_list || [];
  const genreArr = genreRaw.map(g => {
    if (typeof g === 'string') return g;
    return g.name || g.title || g.slug || '';
  }).filter(Boolean);

  // Slug anime (untuk build endpoint episode)
  const animeSlug = d.slug || d.animeSlug || slug;

  // Episode list
  // Nimegami episodeList item: { title, slug/episodeSlug, number/episode, date }
  const epRaw = d.episodeList || d.episodes || d.episode_list || [];
  const episodes = epRaw.map(ep => {
    // Episode slug bisa berupa full slug atau hanya number
    const epSlug  = ep.slug || ep.episodeSlug || ep.url || '';
    const epNum   = ep.number || ep.episode || ep.episodeNumber
      || (epSlug.match(/(?:episode-|ep-)(\d+(?:\.\d+)?)/i)?.[1]) || '';

    // Endpoint watch: gunakan episode slug jika tersedia (sudah full),
    // atau build dari animeSlug + episode number
    let endpoint;
    if (epSlug && epSlug.includes(animeSlug)) {
      // Slug sudah full (misal: naruto-sub-indo-episode-1)
      endpoint = epSlug;
    } else if (epSlug) {
      endpoint = epSlug;
    } else {
      endpoint = `${animeSlug}-episode-${epNum}`;
    }

    return {
      title   : ep.title || ep.name || `Episode ${epNum}`,
      url     : endpoint,
      endpoint: endpoint,
      date    : ep.date || ep.releaseDate || ep.aired || '',
      number  : String(epNum),
    };
  });

  // Synopsis
  const synopsis = d.synopsis || d.description || d.sinopsis || '';
  const description = Array.isArray(synopsis?.paragraphs) && synopsis.paragraphs.length
    ? synopsis.paragraphs.join(' ')
    : (typeof synopsis === 'string' ? synopsis : '');

  // Studio
  const studioRaw = d.studios || d.studio || '';
  const studio = Array.isArray(studioRaw)
    ? studioRaw.map(s => s.name || s.title || s).filter(Boolean).join(', ')
    : String(studioRaw);

  return {
    title      : d.title || '',
    image      : d.poster || d.image || d.thumbnail || d.cover || '',
    description,
    animeId    : animeSlug,
    slug       : animeSlug,
    info       : {
      japanese     : d.japanese || d.japaneseTitle || d.title_japanese || '',
      type         : d.type || 'TV',
      status       : d.status || 'Ongoing',
      total_episode: d.totalEpisode || d.total_episode || d.episodes_count || episodes.length || '?',
      score        : d.score || d.rating || 'N/A',
      duration     : d.duration || '?',
      season       : d.season || '',
      released     : d.aired || d.releaseDate || d.release_date || '',
      producer     : d.producers || d.producer || '',
      studio,
      genre        : genreArr.join(', '),
    },
    genre    : genreArr,
    episodes,
    batchSlug: '',  // Nimegami tidak punya batch, kosongkan
    download : [],
  };
}

// getWatch → /api/watch?url=episodeSlug
// Nimegami watch endpoint: GET /detail/:episodeSlug
// Endpoint episode Nimegami adalah slug lengkap, misal: naruto-sub-indo-episode-1
async function getWatch(episodeSlug) {
  const slug = String(episodeSlug).replace(/^\/?detail\//, '').replace(/^\/+|\/+$/g, '');
  let raw;
  try {
    raw = await api.detail(slug);
  } catch (err) {
    console.error('[getWatch] fetch error:', err.message);
    throw err;
  }
  const d = raw?.data || raw || {};

  // Streams — Nimegami: servers/streamingServers/mirrorList/streamingLink
  const streams = [];

  // Default streaming URL
  if (d.defaultStreamingUrl || d.streamingLink || d.streamUrl) {
    const defUrl = d.defaultStreamingUrl || d.streamingLink || d.streamUrl;
    if (defUrl) streams.push({ server: 'Default', url: defUrl, serverId: '' });
  }

  // Server list
  const serverList = d.servers || d.streamingServers || d.server_list || [];
  for (const srv of serverList) {
    const url = srv.url || srv.link || srv.href || srv.streamUrl || '';
    if (url) {
      streams.push({
        server  : srv.serverName || srv.name || srv.title || 'Server',
        url,
        serverId: srv.serverId || srv.id || '',
      });
    }
  }

  // Mirror list
  const mirrorList = d.mirrorList || d.mirrors || d.mirror_list || [];
  for (const q of mirrorList) {
    const mirrors = q.mirrors || q.links || q.servers || [];
    for (const m of mirrors) {
      const url = m.url || m.link || m.href || '';
      if (url) {
        streams.push({
          server  : `${m.name || m.title || 'Mirror'} (${q.quality || q.resolution || ''})`,
          url,
          serverId: '',
        });
      }
    }
  }

  // Streaming iframe / embed fallback
  if (!streams.length && (d.iframeUrl || d.embed || d.embedUrl)) {
    streams.push({ server: 'Player', url: d.iframeUrl || d.embed || d.embedUrl, serverId: '' });
  }

  // Downloads — Nimegami: downloads / downloadList
  const downloads = [];
  const dlList = d.downloads || d.downloadList || d.download_list || [];
  for (const dl of dlList) {
    const format = dl.format || dl.quality || 'MP4';
    const res    = dl.resolution || dl.quality || '';
    const links  = (dl.links || dl.hosts || dl.mirrors || []).map(l => ({
      host: l.host || l.name || l.title || 'Download',
      url : l.url  || l.link || l.href  || '',
    })).filter(l => l.url);
    if (links.length) downloads.push({ format, resolution: res, links });
  }

  // Navigasi episode (prev/next)
  const buildEpNav = (ep) => {
    if (!ep) return null;
    const epSlug = ep.slug || ep.url || ep.episodeSlug || '';
    return {
      title   : ep.title || `Episode ${ep.episode || ep.number || ''}`,
      endpoint: epSlug,
    };
  };

  return {
    title    : d.title || d.animeTitle || '',
    animeId  : d.animeSlug || d.slug || slug,
    streams,
    downloads,
    prevEp   : buildEpNav(d.prevEpisode || d.prev_episode || d.prevEp),
    nextEp   : buildEpNav(d.nextEpisode || d.next_episode || d.nextEp),
  };
}

// getScrapedSchedule → tidak ada di Nimegami, return empty
async function getScrapedSchedule() {
  return [];
}

// getScrapedTrending → ambil dari home
async function getScrapedTrending() {
  try {
    const raw  = await api.home();
    const data = raw?.data || raw;
    // Nimegami home: bisa punya popularList, trendingList, ongoingList, dll
    const list = data?.anime_list || data?.popularList || data?.trendingList
      || data?.popular || data?.trending || data?.animeList
      || data?.latestList || data?.ongoingList || data?.ongoing || [];
    const arr = Array.isArray(list) ? list : (list?.animeList || []);
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
  normalizeItem,
  extractList,
  extractTotalPages,
};
