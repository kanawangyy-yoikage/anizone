// ─── SCRAPER SERVICE ─────────────────────────────────────
// Sumber: sankavollerei.web.id/anime/nimegami (Nimegami)
//
// Nimegami REAL response structure (confirmed via debug 2026-06):
//
// GET /detail/:animeSlug →
// {
//   status, creator, source,
//   detail: {
//     poster, title, synopsis,
//     info: { judul, judul_alternatif, durasi_per_episode, rating,
//             studio, kategori, musim_rilis, type, series, subtitle },
//     genres: [{ name, slug, url }]
//   },
//   streams_by_episode: { "Episode 1": [{name, resolution, url},...], "Episode 2": [...] },
//   download_groups:    { "Judul Anime": [{name, resolution, url},...] }
// }
//
// TIDAK ADA endpoint per-episode — stream diambil dari streams_by_episode[epLabel]
// TIDAK ADA /episode/:slug endpoint (404)

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

function normalizeItem(item) {
  const slug = item.slug || item.url || item.animeSlug || '';
  return {
    title   : item.title || '',
    url     : slug,
    image   : item.poster || item.image || item.thumbnail || item.cover || '',
    endpoint: slug,
    animeId : slug,
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

function extractList(raw) {
  const data = raw?.data || raw;
  const arr = data?.anime_list || data?.animeList || data?.list
    || data?.animes || data?.results
    || (Array.isArray(data) ? data : []);
  return Array.isArray(arr) ? arr : [];
}

function extractTotalPages(raw) {
  const data = raw?.data || raw;
  return data?.totalPages || data?.total_pages || data?.lastPage || raw?.totalPages || 1;
}

// ─── ADAPTER FUNCTIONS ───────────────────────────────────

async function getLatest(page = 1) {
  try {
    const raw  = await api.home();
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
//
// Nimegami REAL response (confirmed debug):
// { status, creator, source,
//   detail: { poster, title, synopsis, info: {...}, genres: [...] },
//   streams_by_episode: { "Episode 1": [{name,resolution,url},...], ... },
//   download_groups: { "Judul": [{name,resolution,url},...] }
// }
// Episode list di-build dari Object.keys(streams_by_episode)
// Endpoint episode: animeslug__ep__N  (decoded di getWatch)
async function getDetail(slugOrEndpoint) {
  // Decode jika endpoint adalah format watch __ep__
  const cleanInput = String(slugOrEndpoint).replace(/^\/?detail\//, '').replace(/^\/+|\/+$/g, '');
  // Kalau ini episode endpoint (slug__ep__N), strip bagian episode-nya
  const slug = cleanInput.includes('__ep__') ? cleanInput.split('__ep__')[0] : cleanInput;

  let raw;
  try {
    raw = await api.detail(slug);
  } catch (err) {
    console.error('[getDetail] fetch error:', err.message);
    throw err;
  }

  // Data anime ada di raw.detail
  const d = raw?.detail || raw?.data || raw;
  if (!d || (!d.title && !d.poster)) {
    throw new Error(`Anime tidak ditemukan: ${slug}`);
  }

  // ── Info nested object ────────────────────────────────
  const info = (d.info && typeof d.info === 'object') ? d.info : {};

  // ── Genre ─────────────────────────────────────────────
  const genreRaw = d.genres || d.genreList || d.genre_list || [];
  const genreArr = genreRaw.map(g => {
    if (typeof g === 'string') return g;
    return g.name || g.title || g.slug || '';
  }).filter(Boolean);

  // ── Episode list dari streams_by_episode ──────────────
  // streams_by_episode = { "Episode 1": [...], "Episode 2": [...] }
  const streamsByEp = raw?.streams_by_episode || {};
  const epKeys = Object.keys(streamsByEp);
  const episodes = epKeys.map(epLabel => {
    const numMatch = epLabel.match(/(\d+(?:\.\d+)?)$/);
    const epNum = numMatch ? numMatch[1] : epLabel;
    const endpoint = `${slug}__ep__${epNum}`;
    return {
      title   : epLabel,
      url     : endpoint,
      endpoint: endpoint,
      date    : '',
      number  : String(epNum),
    };
  });

  // ── Synopsis ──────────────────────────────────────────
  const synopsisRaw = d.synopsis || d.description || d.sinopsis || '';
  const description = typeof synopsisRaw === 'string' ? synopsisRaw
    : (Array.isArray(synopsisRaw?.paragraphs) ? synopsisRaw.paragraphs.join(' ') : '');

  // ── Studio ────────────────────────────────────────────
  const studioRaw = info.studio || d.studios || d.studio || '';
  const studio = Array.isArray(studioRaw)
    ? studioRaw.map(s => s.name || s.title || s).filter(Boolean).join(', ')
    : String(studioRaw);

  // ── Downloads dari download_groups ───────────────────
  // download_groups: { "Judul": [{name, resolution, url},...] }
  const downloadGroups = raw?.download_groups || {};
  const download = [];
  for (const [, links] of Object.entries(downloadGroups)) {
    if (!Array.isArray(links)) continue;
    const byRes = {};
    for (const l of links) {
      const res = l.resolution || '?';
      if (!byRes[res]) byRes[res] = [];
      byRes[res].push({ host: l.name || 'Download', url: l.url || '' });
    }
    for (const [res, hosts] of Object.entries(byRes)) {
      download.push({ format: 'MP4', resolution: res, links: hosts.filter(h => h.url) });
    }
  }

  return {
    title      : d.title || info.judul || '',
    image      : d.poster || d.image || d.thumbnail || d.cover || '',
    description,
    animeId    : slug,
    slug       : slug,
    info       : {
      judul              : info.judul            || d.title  || '',
      judul_alternatif   : info.judul_alternatif || '',
      japanese           : info.judul_alternatif || '',
      type               : info.type             || info.kategori || 'TV',
      kategori           : info.kategori         || info.type     || 'TV',
      status             : d.status              || info.status   || 'Ongoing',
      total_episode      : episodes.length       || '?',
      score              : info.rating           || 'N/A',
      rating             : info.rating           || 'N/A',
      duration           : info.durasi_per_episode || '?',
      durasi_per_episode : info.durasi_per_episode || '?',
      season             : info.musim_rilis      || '',
      musim_rilis        : info.musim_rilis      || '',
      released           : d.aired || d.releaseDate || '',
      producer           : d.producers || d.producer || '',
      studio,
      subtitle           : info.subtitle  || 'Indonesia',
      series             : info.series    || '',
      genre              : genreArr.join(', '),
    },
    genre    : genreArr,
    episodes,
    batchSlug: '',
    download,
  };
}

// getWatch → /api/watch?url=episodeEndpoint
//
// episodeEndpoint format: "animeslug__ep__N"  (dibuat oleh getDetail)
// Fetch ke /detail/animeslug, lalu ambil streams dari streams_by_episode["Episode N"]
async function getWatch(episodeEndpoint) {
  const input = String(episodeEndpoint).replace(/^\/+|\/+$/g, '');

  // Decode endpoint: animeslug__ep__N
  let animeSlug, epNum;
  if (input.includes('__ep__')) {
    [animeSlug, epNum] = input.split('__ep__');
  } else {
    // Legacy / fallback: coba parse dari slug episode lama (misal: naruto-sub-indo-episode-1)
    const match = input.match(/^(.+?)-episode-(\d+(?:\.\d+)?)$/i);
    if (match) {
      animeSlug = match[1];
      epNum     = match[2];
    } else {
      animeSlug = input;
      epNum     = '1';
    }
  }

  let raw;
  try {
    raw = await api.detail(animeSlug);
  } catch (err) {
    console.error('[getWatch] fetch error:', err.message);
    throw err;
  }

  const d = raw?.detail || raw?.data || raw || {};

  // ── Streams dari streams_by_episode["Episode N"] ──────
  const streamsByEp = raw?.streams_by_episode || {};
  const epLabel = `Episode ${epNum}`;
  // Coba exact match dulu, lalu fallback ke key pertama yang mengandung nomor tsb
  const epStreams = streamsByEp[epLabel]
    || streamsByEp[Object.keys(streamsByEp).find(k => k.match(new RegExp(`\\b${epNum}\\b`)))]
    || [];

  const streams = epStreams.map(s => ({
    server  : `${s.name || 'Server'} (${s.resolution || ''})`.replace(/\(\s*\)$/, '').trim(),
    url     : s.url || '',
    serverId: s.resolution || '',
  })).filter(s => s.url);

  // ── Downloads dari download_groups ───────────────────
  const downloadGroups = raw?.download_groups || {};
  const downloads = [];
  for (const [, links] of Object.entries(downloadGroups)) {
    if (!Array.isArray(links)) continue;
    const byRes = {};
    for (const l of links) {
      const res = l.resolution || '?';
      if (!byRes[res]) byRes[res] = [];
      byRes[res].push({ host: l.name || 'Download', url: l.url || '' });
    }
    for (const [res, hosts] of Object.entries(byRes)) {
      downloads.push({ format: 'MP4', resolution: res, links: hosts.filter(h => h.url) });
    }
  }

  // ── Prev/Next episode ────────────────────────────────
  const epNums = Object.keys(streamsByEp).map(k => {
    const m = k.match(/(\d+(?:\.\d+)?)$/);
    return m ? parseFloat(m[1]) : null;
  }).filter(n => n !== null).sort((a, b) => a - b);

  const curNum  = parseFloat(epNum);
  const prevNum = epNums.find(n => n < curNum && epNums.filter(x => x < curNum).includes(n) && n === Math.max(...epNums.filter(x => x < curNum)));
  const nextNum = epNums.find(n => n > curNum && n === Math.min(...epNums.filter(x => x > curNum)));

  const makeNav = (num) => num != null ? {
    title   : `Episode ${num}`,
    endpoint: `${animeSlug}__ep__${num}`,
  } : null;

  return {
    title    : d.title || '',
    animeId  : animeSlug,
    streams,
    downloads,
    prevEp   : makeNav(prevNum != null ? prevNum : null),
    nextEp   : makeNav(nextNum != null ? nextNum : null),
  };
}

async function getScrapedSchedule() {
  return [];
}

async function getScrapedTrending() {
  try {
    const raw  = await api.home();
    const data = raw?.data || raw;
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
  getLatest,
  searchAnime,
  getDetail,
  getWatch,
  getScrapedSchedule,
  getScrapedTrending,
  api,
  normalizeItem,
  extractList,
  extractTotalPages,
};
