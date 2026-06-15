// ─── SCRAPER SERVICE ─────────────────────────────────────
// Menggunakan REST API dari sankavollerei.web.id/anime/
// Endpoint reference: https://sankavollerei.web.id/anime/

const axios = require('axios');
const { ANIME_API } = require('../config');

const SANKAV_URL = 'https://sankavollerei.web.id/';

// Axios instance untuk sankavollerei API
const client = axios.create({
  baseURL: ANIME_API,
  headers: {
    'Accept'          : 'application/json',
    'User-Agent'      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language' : 'en-US,en;q=0.9,id;q=0.8',
  },
  timeout: 15000,
});

// ─── HELPER ───────────────────────────────────────────────

// Ekstrak slug dari URL (misal: https://sankavollerei.web.id/anime/naruto → naruto)
function toEndpoint(url = '') {
  return url.replace(SANKAV_URL, '').replace(/\/$/, '');
}

// ── HOME ─────────────────────────────────────────────────
// GET /anime/home
async function getHome() {
  const res = await client.get('/home');
  return res.data;
}

// ── SCHEDULE ─────────────────────────────────────────────
// GET /anime/schedule
async function getSchedule() {
  const res = await client.get('/schedule');
  return res.data;
}

// ── DETAIL ANIME ─────────────────────────────────────────
// GET /anime/anime/:slug
async function getAnimeDetail(slug) {
  const res = await client.get(`/anime/${slug}`);
  return res.data;
}

// ── COMPLETE ANIME (Tamat) ────────────────────────────────
// GET /anime/complete-anime?page=1
async function getCompleteAnime(page = 1) {
  const res = await client.get(`/complete-anime?page=${page}`);
  return res.data;
}

// ── ONGOING ANIME ─────────────────────────────────────────
// GET /anime/ongoing-anime?page=1
async function getOngoingAnime(page = 1) {
  const res = await client.get(`/ongoing-anime?page=${page}`);
  return res.data;
}

// ── GENRE LIST ────────────────────────────────────────────
// GET /anime/genre
async function getGenreList() {
  const res = await client.get('/genre');
  return res.data;
}

// ── ANIME BY GENRE ────────────────────────────────────────
// GET /anime/genre/:slug?page=1
async function getAnimeByGenre(slug, page = 1) {
  const res = await client.get(`/genre/${slug}?page=${page}`);
  return res.data;
}

// ── EPISODE DETAIL ────────────────────────────────────────
// GET /anime/episode/:slug
async function getEpisode(slug) {
  const res = await client.get(`/episode/${slug}`);
  return res.data;
}

// ── SEARCH ────────────────────────────────────────────────
// GET /anime/search/:keyword
async function searchAnime(keyword) {
  const res = await client.get(`/search/${encodeURIComponent(keyword)}`);
  return res.data;
}

// ── BATCH DOWNLOAD ────────────────────────────────────────
// GET /anime/batch/:slug
async function getBatch(slug) {
  const res = await client.get(`/batch/${slug}`);
  return res.data;
}

// ── SERVER / STREAM URL ───────────────────────────────────
// GET /anime/server/:serverId
async function getServer(serverId) {
  const res = await client.get(`/server/${serverId}`);
  return res.data;
}

// ── ALL ANIME ─────────────────────────────────────────────
// GET /anime/unlimited
async function getAllAnime() {
  const res = await client.get('/unlimited');
  return res.data;
}

// ─── ADAPTER FUNCTIONS ───────────────────────────────────
// Fungsi-fungsi berikut memetakan data API baru ke format
// yang diharapkan oleh frontend AniZone yang sudah ada.

// getLatest → dipakai untuk /api/latest (halaman beranda)
// Gunakan home endpoint untuk data terbaru
async function getLatest(page = 1) {
  try {
    // Coba pakai ongoing dulu untuk "latest/terbaru"
    const res = await getOngoingAnime(page);
    const items = res.animeList || res.data || res || [];
    return normalizeAnimeList(items);
  } catch {
    // Fallback ke home
    const res = await getHome();
    const items = res.recentRelease || res.ongoingAnime || res.data || [];
    return normalizeAnimeList(items);
  }
}

// Normalisasi daftar anime ke format {title, url, image, endpoint, genres, release}
function normalizeAnimeList(items = []) {
  return items.map(item => {
    const url = item.animeUrl || item.url || item.href || '';
    const slug = item.slug || url.replace(SANKAV_URL, '').replace(/\/$/, '');
    return {
      title   : item.title || item.animeTitle || '',
      url     : url || `${SANKAV_URL}${slug}`,
      image   : item.poster || item.image || item.thumbnail || item.img || '',
      endpoint: slug,
      genres  : Array.isArray(item.genres) ? item.genres : (item.genre ? [item.genre] : []),
      release : item.releaseDate || item.release || item.date || '',
      score   : item.score || item.rating || '',
    };
  }).filter(a => a.title);
}

// getDetail → dipakai untuk /api/detail?url=...
async function getDetail(urlOrSlug) {
  // Ekstrak slug dari URL jika perlu
  let slug = urlOrSlug
    .replace(`${SANKAV_URL}anime/`, '')
    .replace(SANKAV_URL, '')
    .replace(/\/$/, '');

  // Jika masih ada path prefix, ambil bagian terakhir
  if (slug.includes('/')) {
    slug = slug.split('/').pop();
  }

  const raw = await getAnimeDetail(slug);
  const data = raw.data || raw;

  // Normalize episodes
  const episodes = (data.episodeList || data.episodes || []).map(ep => ({
    title   : ep.title || ep.episodeTitle || ep.name || '',
    url     : ep.episodeUrl || ep.url || ep.href || '',
    date    : ep.date || ep.releaseDate || '',
    endpoint: (ep.episodeUrl || ep.url || '').replace(SANKAV_URL, '').replace(/\/$/, ''),
  })).filter(ep => ep.title || ep.url);

  // Normalize genres
  const genreRaw = data.genres || data.genre || data.info?.genres || data.info?.genre || [];
  const genre = Array.isArray(genreRaw)
    ? genreRaw.map(g => (typeof g === 'object' ? g.name || g.title || '' : g)).filter(Boolean)
    : (typeof genreRaw === 'string' ? genreRaw.split(',').map(g => g.trim()) : []);

  return {
    title      : data.title || data.animeTitle || '',
    image      : data.poster || data.image || data.thumbnail || '',
    description: data.synopsis || data.description || data.sinopsis || '',
    info       : {
      japanese     : data.japanese || data.titleJapanese || data.info?.japanese || '',
      type         : data.type || data.tipe || data.info?.type || 'TV',
      status       : data.status || data.info?.status || 'Ongoing',
      total_episode: data.totalEpisode || data.total_episode || data.episodes?.length || '?',
      score        : data.score || data.rating || data.info?.score || 'N/A',
      duration     : data.duration || data.durasi || data.info?.duration || '?',
      season       : data.season || data.musim || data.info?.season || '',
      released     : data.released || data.dirilis || data.info?.released || '',
      producer     : data.producer || data.studio || data.info?.producer || '',
      genre        : genre.join(', '),
    },
    genre,
    episodes,
    download: data.downloadList || data.batch || data.download || [],
  };
}

// getWatch → dipakai untuk /api/watch?url=...
async function getWatch(urlOrSlug) {
  // Ekstrak slug episode dari URL
  let slug = urlOrSlug
    .replace(`${SANKAV_URL}episode/`, '')
    .replace(SANKAV_URL, '')
    .replace(/\/$/, '');

  if (slug.includes('/')) slug = slug.split('/').pop();

  const raw = await getEpisode(slug);
  const data = raw.data || raw;

  // Normalize streaming servers
  const streams = [];

  // Format server dari API: {serverId, serverName, ...}
  const serverList = data.streamingLink || data.servers || data.streaming || [];
  serverList.forEach(s => {
    const sid = s.serverId || s.id || '';
    if (sid) {
      streams.push({
        server   : s.serverName || s.name || s.title || 'Server',
        serverId : sid,
        url      : s.url || s.embedUrl || '', // mungkin kosong, perlu /server/:id
      });
    } else if (s.url || s.embedUrl) {
      streams.push({
        server: s.serverName || s.name || 'Server',
        url   : s.url || s.embedUrl,
      });
    }
  });

  // Normalize download links
  const downloadRaw = data.downloadUrl || data.downloads || data.download || [];
  const downloads = [];
  if (Array.isArray(downloadRaw)) {
    downloadRaw.forEach(group => {
      if (group.resolution && group.links) {
        downloads.push({
          resolution: group.resolution,
          format    : group.format || '',
          links     : group.links,
        });
      } else if (group.title && group.link_download) {
        group.link_download.forEach(res => {
          downloads.push({
            resolution: res.resolusi || res.resolution || '',
            format    : group.title,
            links     : res.link || [],
          });
        });
      }
    });
  }

  return {
    title    : data.title || data.episodeTitle || '',
    streams,
    downloads,
  };
}

// getServer → ambil embed URL dari server ID (digunakan saat stream URL belum ada)
async function getStreamUrl(serverId) {
  const raw = await getServer(serverId);
  const data = raw.data || raw;
  return data.embedUrl || data.url || data.src || '';
}

// getScrapedSchedule → dipakai untuk /api/schedule fallback
async function getScrapedSchedule() {
  try {
    const raw = await getSchedule();
    const data = raw.data || raw;
    // Format jadwal: array of { day, animeList }
    if (Array.isArray(data)) return data;
    // Jika object per hari
    return Object.entries(data).map(([day, list]) => ({
      day,
      items: normalizeAnimeList(Array.isArray(list) ? list : []),
    }));
  } catch { return []; }
}

// getScrapedTrending → dipakai untuk /api/trending fallback
async function getScrapedTrending() {
  try {
    const raw = await getHome();
    const data = raw.data || raw;
    const items = data.trending || data.popular || data.recentRelease || [];
    return normalizeAnimeList(items).slice(0, 20);
  } catch { return []; }
}

module.exports = {
  // Adapter (dipakai index.js)
  getLatest,
  searchAnime: async (query) => {
    const raw = await searchAnime(query);
    const items = raw.data || raw || [];
    return normalizeAnimeList(Array.isArray(items) ? items : []);
  },
  getDetail,
  getWatch,
  getStreamUrl,
  getScrapedSchedule,
  getScrapedTrending,

  // Raw API (opsional, untuk route baru)
  api: {
    getHome,
    getSchedule,
    getAnimeDetail,
    getCompleteAnime,
    getOngoingAnime,
    getGenreList,
    getAnimeByGenre,
    getEpisode,
    searchAnime,
    getBatch,
    getServer,
    getAllAnime,
  },
};
