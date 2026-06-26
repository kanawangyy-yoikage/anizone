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
  if (!d || (!d.title && !d.slug && !d.poster)) {
    throw new Error(`Anime tidak ditemukan: ${slug}`);
  }

  // ── Info nested object (Nimegami struktur real) ────────
  // Nimegami kirim: { poster, title, synopsis, info: { judul, judul_alternatif,
  //   durasi_per_episode, rating, studio, kategori, musim_rilis, type, series, subtitle },
  //   genres: [{ name, slug, url }], streams_by_episode: [...] }
  const info = (d.info && typeof d.info === 'object') ? d.info : {};

  // ── Genre ──────────────────────────────────────────────
  const genreRaw = d.genres || d.genreList || d.genre_list || [];
  const genreArr = genreRaw.map(g => {
    if (typeof g === 'string') return g;
    return g.name || g.title || g.slug || '';
  }).filter(Boolean);

  // ── Slug anime ─────────────────────────────────────────
  const animeSlug = d.slug || d.animeSlug || slug;

  // ── Episode list ───────────────────────────────────────
  const epRaw = d.episodeList || d.episodes || d.episode_list || [];
  const episodes = Array.isArray(epRaw) ? epRaw.map(ep => {
    const epSlug = ep.slug || ep.episodeSlug || ep.url || '';
    const epNum  = ep.number || ep.episode || ep.episodeNumber
      || (epSlug.match(/(?:episode-|ep-)(\d+(?:\.\d+)?)/i)?.[1]) || '';

    let endpoint;
    if (epSlug && epSlug.includes(animeSlug)) {
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
  }) : [];

  // ── Synopsis ───────────────────────────────────────────
  const synopsisRaw = d.synopsis || d.description || d.sinopsis || '';
  const description = Array.isArray(synopsisRaw?.paragraphs) && synopsisRaw.paragraphs.length
    ? synopsisRaw.paragraphs.join(' ')
    : (typeof synopsisRaw === 'string' ? synopsisRaw : '');

  // ── Studio ─────────────────────────────────────────────
  // Nimegami: info.studio (string) atau d.studios (array)
  const studioRaw = info.studio || d.studios || d.studio || '';
  const studio = Array.isArray(studioRaw)
    ? studioRaw.map(s => s.name || s.title || s).filter(Boolean).join(', ')
    : String(studioRaw);

  // ── Flatten fields dari nested info ───────────────────
  const infoJudul  = info.judul            || d.title         || '';
  const infoAlt    = info.judul_alternatif  || d.japanese     || '';
  const infoDurasi = info.durasi_per_episode || d.duration    || '?';
  const infoRating = info.rating            || d.score        || 'N/A';
  const infoType   = info.type              || d.type         || 'TV';
  const infoMusim  = info.musim_rilis       || d.season       || '';
  const infoKat    = info.kategori          || d.type         || 'TV';

  return {
    title      : d.title || infoJudul || '',
    image      : d.poster || d.image || d.thumbnail || d.cover || '',
    description,
    animeId    : animeSlug,
    slug       : animeSlug,
    info       : {
      judul              : infoJudul,
      judul_alternatif   : infoAlt,
      japanese           : infoAlt,
      type               : infoType,
      kategori           : infoKat,
      status             : d.status || info.status || 'Ongoing',
      total_episode      : d.totalEpisode || d.total_episode || d.episodes_count || episodes.length || '?',
      score              : infoRating,
      rating             : infoRating,
      duration           : infoDurasi,
      durasi_per_episode : infoDurasi,
      season             : infoMusim,
      musim_rilis        : infoMusim,
      released           : d.aired || d.releaseDate || d.release_date || '',
      producer           : d.producers || d.producer || '',
      studio,
      subtitle           : info.subtitle  || d.subtitle  || 'Indonesia',
      series             : info.series    || d.series    || '',
      genre              : genreArr.join(', '),
    },
    genre    : genreArr,
    episodes,
    batchSlug: '',
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

  // ── Streams ────────────────────────────────────────────
  // Nimegami actual: streams_by_episode: [{ name, resolution, url }]
  const streams = [];

  // streams_by_episode (confirmed from debug logs)
  const streamsByEp = d.streams_by_episode || d.streamsByEpisode || [];
  for (const s of streamsByEp) {
    const url = s.url || s.link || s.href || '';
    if (url) {
      streams.push({
        server  : `${s.name || 'Server'} (${s.resolution || ''})`.trim().replace(/\(\)$/, '').trim(),
        url,
        serverId: s.resolution || '',
      });
    }
  }

  // Default streaming URL fallback
  if (!streams.length) {
    const defUrl = d.defaultStreamingUrl || d.streamingLink || d.streamUrl;
    if (defUrl) streams.push({ server: 'Default', url: defUrl, serverId: '' });
  }

  // Server list fallback
  if (!streams.length) {
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
  }

  // Mirror list fallback
  if (!streams.length) {
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
  }

  // Iframe / embed fallback terakhir
  if (!streams.length && (d.iframeUrl || d.embed || d.embedUrl)) {
    streams.push({ server: 'Player', url: d.iframeUrl || d.embed || d.embedUrl, serverId: '' });
  }

  // ── Downloads ──────────────────────────────────────────
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

  // ── Navigasi episode ────────────────────────────────────
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
