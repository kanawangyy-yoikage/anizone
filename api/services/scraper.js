// ─── SCRAPER SERVICE ─────────────────────────────────────
// Scraping dari kusonime.com
// Selector berdasarkan kusonime-api v2 (Deo Sbrn, 2024)

const axios   = require('axios');
const cheerio = require('cheerio');
const { BASE, SCRAPE_HEADERS } = require('../config');

const KUSONIME_URL = 'https://kusonime.com/';

// Axios instance persis seperti kusonime-api v2
const client = axios.create({
  baseURL: BASE,
  withCredentials: true,
  headers: {
    'Content-Type'    : 'application/x-www-form-urlencoded',
    'Accept'          : 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent'      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer'         : 'https://kusonime.com/',
    'Accept-Encoding' : 'gzip, deflate, br',
    'Accept-Language' : 'en-US,en;q=0.9,id;q=0.8',
    'Connection'      : 'keep-alive',
    'Host'            : 'kusonime.com',
    'Origin'          : 'https://kusonime.com',
    'Sec-Fetch-Dest'  : 'document',
    'Sec-Fetch-Mode'  : 'navigate',
    'Sec-Fetch-User'  : '?1',
    'Sec-Fetch-Site'  : 'none',
  },
});

// Helper: parse daftar anime dari halaman list (.venutama)
function formatAnimeData($) {
  const anime = [];
  const element = $('.venutama');

  $(element).find('.venz ul .kover').each((_, el) => {
    const title   = $(el).find('.content > h2 > a').text().trim();
    const release = $(el).find('.content > p').text().trim().split('Genre')[0].trim().split('Admin')[1]?.trim() || '';
    const genreRaw = $(el).find('.content > p').text().trim().split('Genre')[1];
    const genres  = genreRaw ? genreRaw.trim().split(', ') : [];
    const url     = $(el).find('.thumb a').attr('href') || '';
    const image   = $(el).find('.thumb a .thumbz img').attr('src') || '';
    const endpoint = url.replace(KUSONIME_URL, '');

    if (title && url) anime.push({ title, release, genres, url, image, endpoint });
  });

  return anime;
}

// Helper: parse download links dari halaman detail/episode
function getDownloadLinks($, wrapperClass, urlClass, titleClass) {
  const download = [];
  const element  = $('.venser');

  $(element).find(wrapperClass).each((_, el) => {
    const resolutions = [];

    $(el).find(urlClass).each((_, row) => {
      const links = [];
      $(row).find('a').each((_, a) => {
        links.push({ host: $(a).text().trim(), url: $(a).attr('href') || '' });
      });
      resolutions.push({ resolusi: $(row).find('strong').text().trim(), link: links });
    });

    download.push({ title: $(el).find(titleClass).text().trim(), link_download: resolutions });
  });

  return download;
}

// ── Latest anime list ─────────────────────────────────────
// GET /api/latest?page=1
async function getLatest(page = 1) {
  const res = await client.get(`/page/${page}`);
  const $   = cheerio.load(res.data);
  return formatAnimeData($);
}

// ── Search ────────────────────────────────────────────────
// GET /api/search?q=...
async function searchAnime(query) {
  const res = await client.get(`/?s=${encodeURIComponent(query)}&post_type=post`);
  const $   = cheerio.load(res.data);
  return formatAnimeData($);
}

// ── Detail anime (info + episode list) ───────────────────
// GET /api/detail?url=https://kusonime.com/slug/
async function getDetail(link) {
  // Ambil slug dari URL
  const slug = link.replace(KUSONIME_URL, '').replace(/\/$/, '');
  const res  = await client.get(`/${slug}`);
  const $    = cheerio.load(res.data);
  const element = $('.venser');

  // Genre
  const genre = [];
  $(element).find('.info > p:nth-of-type(2) > a').each((_, el) => {
    genre.push({
      name    : $(el).text().trim(),
      url     : $(el).attr('href') || '',
      endpoint: $(el).attr('href')?.replace(KUSONIME_URL, '') || '',
    });
  });

  // Download links (coba 3 variasi selector)
  let download = getDownloadLinks($, '.smokeddlrh', '.smokeurlrh', '.smokettlrh');
  if (!download.length || download.every(d => !d.link_download.length)) {
    download = getDownloadLinks($, '.smokeddlrhrh', '.smokeurlrhrh', '.smokettlrhrh');
  }
  if (!download.length || download.every(d => !d.link_download.length)) {
    download = getDownloadLinks($, '.smokeddl', '.smokeurl', '.smokettl');
  }
  download = download.filter(d => d.link_download.length > 0 && d.title !== '');

  // Episode list — kusonime: .episodelist ul li
  const episodes = [];
  $('.episodelist ul li').each((_, el) => {
    const a   = $(el).find('a');
    const url = a.attr('href') || '';
    const title = a.text().trim();
    const date  = $(el).find('.episodedate').text().trim();
    if (title && url) episodes.push({ title, url, date });
  });

  const season = {
    name    : $(element).find('.lexot .info > p:nth-of-type(3) > a').text().trim(),
    url     : $(element).find('.lexot .info > p:nth-of-type(3) > a').attr('href') || '',
    endpoint: $(element).find('.lexot .info > p:nth-of-type(3) > a').attr('href')?.replace(KUSONIME_URL, '') || '',
  };

  return {
    title        : $(element).find('.post-thumb img').attr('title') || '',
    japanese     : $(element).find('.lexot .info > p:nth-of-type(1)').text().split(':')[1]?.trim() || '',
    image        : $(element).find('.post-thumb img').attr('src') || $('meta[property="og:image"]').attr('content') || '',
    producer     : $(element).find('.lexot .info > p:nth-of-type(4)').text().split(':')[1]?.trim() || '',
    type         : $(element).find('.lexot .info > p:nth-of-type(5)').text().split(':')[1]?.trim() || '',
    status       : $(element).find('.lexot .info > p:nth-of-type(6)').text().split(':')[1]?.trim() || '',
    total_episode: $(element).find('.lexot .info > p:nth-of-type(7)').text().split(':')[1]?.trim() || '',
    score        : $(element).find('.lexot .info > p:nth-of-type(8)').text().split(':')[1]?.trim() || '',
    duration     : $(element).find('.lexot .info > p:nth-of-type(9)').text().split(':')[1]?.trim() || '',
    release_on   : $(element).find('.lexot .info > p:nth-of-type(10)').text().split(':')[1]?.trim() || '',
    description  : $(element).find('.lexot > p:nth-of-type(1)').text().trim(),
    genre,
    season,
    episodes,
    download,
  };
}

// ── Watch (stream links dari halaman episode) ─────────────
// GET /api/watch?url=https://kusonime.com/...
async function getWatch(link) {
  const slug = link.replace(KUSONIME_URL, '').replace(/\/$/, '');
  const res  = await client.get(`/${slug}`);
  const $    = cheerio.load(res.data);

  // Stream: cari semua iframe
  const streams = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) streams.push({ server: $(el).attr('title') || 'Server', url: src });
  });

  // Download links
  let download = getDownloadLinks($, '.smokeddlrh', '.smokeurlrh', '.smokettlrh');
  if (!download.length || download.every(d => !d.link_download.length)) {
    download = getDownloadLinks($, '.smokeddlrhrh', '.smokeurlrhrh', '.smokettlrhrh');
  }
  if (!download.length || download.every(d => !d.link_download.length)) {
    download = getDownloadLinks($, '.smokeddl', '.smokeurl', '.smokettl');
  }
  download = download.filter(d => d.link_download.length > 0 && d.title !== '');

  // Format downloads agar cocok dengan format lama anizone
  const downloads = [];
  download.forEach(group => {
    group.link_download.forEach(res => {
      downloads.push({
        resolution: res.resolusi,
        format    : group.title,
        links     : res.link,
      });
    });
  });

  const title = $('.venser .post-thumb img').attr('title')
             || $('h1').first().text().trim();

  return { title, streams, downloads };
}

// ── Scraped schedule (fallback) ───────────────────────────
async function getScrapedSchedule() {
  try {
    const res = await client.get('/jadwal-tayang/');
    const $   = cheerio.load(res.data);
    const items = [];

    $('.venutama .venz ul .kover').each((_, el) => {
      const title = $(el).find('.content > h2 > a').text().trim();
      const url   = $(el).find('.thumb a').attr('href') || '';
      const image = $(el).find('.thumb a .thumbz img').attr('src') || '';
      if (title && url) items.push({ title, url, image });
    });

    return items.slice(0, 40);
  } catch { return []; }
}

// ── Scraped trending (fallback) ───────────────────────────
async function getScrapedTrending() {
  try {
    const res = await client.get('/');
    const $   = cheerio.load(res.data);
    const items = [];

    $('.rekomf .recomx > ul > li').each((_, el) => {
      const title = $(el).find('.zeeb > a > img').attr('title') || '';
      const url   = $(el).find('.zeeb > a').attr('href') || '';
      const image = $(el).find('.zeeb > a > img').attr('src') || '';
      if (title && url) items.push({ title, url, image });
    });

    return items;
  } catch { return []; }
}

module.exports = { getLatest, searchAnime, getDetail, getWatch, getScrapedSchedule, getScrapedTrending };
