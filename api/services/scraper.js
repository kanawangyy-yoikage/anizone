// ─── SCRAPER SERVICE ─────────────────────────────────────
// Semua fungsi scraping dari kusonime.com dikumpulkan di sini.
// Selector berdasarkan struktur HTML kusonime.com.

const axios   = require('axios');
const cheerio = require('cheerio');
const { BASE, SCRAPE_HEADERS: headers } = require('../config');

// Helper: build absolute URL
function absUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return BASE + (href.startsWith('/') ? '' : '/') + href;
}

// Helper: axios get dengan retry sekali jika gagal
async function get(url, opts = {}) {
  try {
    return await axios.get(url, { headers, timeout: 15000, ...opts });
  } catch (e) {
    // Retry sekali
    return await axios.get(url, { headers, timeout: 20000, ...opts });
  }
}

// ── Latest anime list ─────────────────────────────────────
// Kusonime homepage: .vezone .venz .kover
async function getLatest(page = 1) {
  const url = page > 1 ? `${BASE}/page/${page}/` : `${BASE}/`;
  const res = await get(url);
  const $   = cheerio.load(res.data);
  const data = [];

  $('.vezone').find('.venz').find('.kover').each((_, el) => {
    const thumbA = $(el).find('.thumb a');
    const title  = thumbA.attr('title') || $(el).find('img').attr('alt') || '';
    const href   = thumbA.attr('href')  || '';

    // Episode / type info dari .content p
    const epText = $(el).find('.content p').first().text().trim();

    // Genres
    const genres = [];
    $(el).find('.content p:nth-child(4) a, .content p a').each((_, a) => {
      const g = $(a).text().trim();
      if (g) genres.push(g);
    });

    data.push({
      title  : title.trim(),
      url    : absUrl(href),
      image  : $(el).find('img').attr('src') || '',
      episode: epText,
      genres,
    });
  });

  return data;
}

// ── Search ────────────────────────────────────────────────
// Kusonime search: /page/1/?s=query&post_type=post
async function searchAnime(query) {
  const url = `${BASE}/page/1/?s=${encodeURIComponent(query)}&post_type=post`;
  const res = await get(url);
  const $   = cheerio.load(res.data);
  const data = [];

  $('.vezone').find('.venz').find('.kover').each((_, el) => {
    const thumbA = $(el).find('.thumb a');
    const title  = thumbA.attr('title') || $(el).find('img').attr('alt') || '';
    const href   = thumbA.attr('href')  || '';

    const genres = [];
    $(el).find('.content p:nth-child(4) a, .content p a').each((_, a) => {
      const g = $(a).text().trim();
      if (g) genres.push(g);
    });

    data.push({
      title : title.trim(),
      url   : absUrl(href),
      image : $(el).find('img').attr('src') || '',
      genres,
    });
  });

  return data;
}

// ── Detail (info + episode list) ─────────────────────────
// Kusonime anime page: .jdlz, .post-thumb, .info, .lexot, #dl
async function getDetail(link) {
  const targetUrl = absUrl(link);
  const res       = await get(targetUrl);
  const $         = cheerio.load(res.data);

  const title       = $('.jdlz').text().trim() || $('h1.entry-title').text().trim();
  const image       = $('.post-thumb img').attr('src')
                   || $('meta[property="og:image"]').attr('content')
                   || '';
  const description = $('.lexot > p').text().trim()
                   || $('meta[name="description"]').attr('content')
                   || '';

  // Metadata dari .info p (key: value)
  const info = {};
  $('.info').find('p').each((_, el) => {
    const $el = $(el);
    const key = $el.find('b').text().toLowerCase().trim().replace(/\s+/g, '_').replace(':', '');
    $el.find('b').remove();
    const val = $el.text().replace(/^[\s:]+/, '').trim();
    if (key && val) info[key] = val;
  });

  // Genres
  const genres = [];
  $('.info').find('p a, .genre a').each((_, a) => {
    const g = $(a).text().trim();
    if (g) genres.push(g);
  });

  // Episode list dari #dl .smokeddlrh (kusonime = download per episode)
  // Kusonime memakai batch, bukan list episode per judul streaming.
  // Kita parse download list sebagai "episodes".
  const episodes = [];
  $('#dl').find('.smokeddlrh').each((_, el) => {
    const epTitle = $(el).find('.smokettlrh').text().trim();
    if (epTitle) {
      episodes.push({
        title: epTitle,
        url  : targetUrl, // episode berasal dari halaman ini
      });
    }
  });

  // Jika tidak ada episode dari #dl, coba link episode di bawah .episodelist
  if (!episodes.length) {
    $('a[href*="episode"], a[href*="-ep-"], .episodelist a').each((_, a) => {
      const epTitle = $(a).text().trim();
      const epUrl   = absUrl($(a).attr('href'));
      if (epTitle && epUrl) episodes.push({ title: epTitle, url: epUrl });
    });
  }

  return { title, image, description, genres, info, episodes };
}

// ── Watch (stream + download links) ──────────────────────
// Kusonime episode page: #dl .smokeddlrh > .smokeurlrh
async function getWatch(link) {
  const targetUrl = absUrl(link);
  const res       = await get(targetUrl);
  const $         = cheerio.load(res.data);

  const title = $('.jdlz').text().trim()
             || $('h1.entry-title').text().trim()
             || $('title').text().trim();

  // Kusonime tidak menyediakan embed stream langsung di halaman biasa;
  // stream tersedia via iframe yang di-embed. Coba ambil semua iframe src.
  const streams = [];
  $('iframe').each((_, el) => {
    const src  = $(el).attr('src') || $(el).attr('data-src');
    const name = $(el).attr('title') || $(el).attr('name') || `Server ${streams.length + 1}`;
    if (src && src.startsWith('http')) streams.push({ server: name, url: src });
  });

  // Download links dari #dl
  // Struktur: #dl > .smokeddlrh > .smokettlrh (judul resolusi) + .smokeurlrh (per host)
  const downloads = [];

  $('#dl').find('.smokeddlrh').each((_, dlEl) => {
    const resolution = $(dlEl).find('.smokettlrh').text().trim();

    $(dlEl).find('.smokeurlrh').each((_, urlEl) => {
      const type  = $(urlEl).find('strong').text().trim();
      const links = [];

      $(urlEl).find('a').each((_, a) => {
        const host = $(a).text().trim();
        const url  = $(a).attr('href');
        if (host && url) links.push({ host, url });
      });

      if (links.length) {
        downloads.push({ resolution, format: type, links });
      }
    });
  });

  // Fallback: kalau #dl kosong, coba selector lebih luas
  if (!downloads.length) {
    $('[class*="download"], [id*="download"]').find('li').each((_, li) => {
      const resolution = $(li).find('strong, b').first().text().trim();
      const links      = [];
      $(li).find('a').each((_, a) => {
        const host = $(a).text().trim();
        const url  = $(a).attr('href');
        if (host && url) links.push({ host, url });
      });
      if (links.length) downloads.push({ resolution, format: 'Download', links });
    });
  }

  return { title, streams, downloads };
}

// ── Scraped schedule ──────────────────────────────────────
// Kusonime punya /jadwal-rilis/ tapi strukturnya beda; fallback ringan.
async function getScrapedSchedule() {
  try {
    const res = await get(`${BASE}/jadwal-rilis/`);
    const $   = cheerio.load(res.data);
    const items = [];

    // Coba struktur tabel jadwal
    $('table tr').each((_, el) => {
      const title = $(el).find('a').first().text().trim();
      const url   = $(el).find('a').first().attr('href');
      if (title && url) items.push({ title, url: absUrl(url), image: '' });
    });

    // Fallback: .kover cards
    if (!items.length) {
      $('.vezone .venz .kover').each((_, el) => {
        const thumbA = $(el).find('.thumb a');
        const title  = thumbA.attr('title') || '';
        const url    = thumbA.attr('href')  || '';
        const image  = $(el).find('img').attr('src') || '';
        if (title && url) items.push({ title, url: absUrl(url), image });
      });
    }

    return items.slice(0, 40);
  } catch { return []; }
}

// ── Scraped trending ──────────────────────────────────────
// Kusonime sidebar / popular section
async function getScrapedTrending() {
  try {
    const res = await get(`${BASE}/`);
    const $   = cheerio.load(res.data);
    const items = [];

    // Rekomendasi sidebar: .recomx li
    $('.recomx').find('li').each((_, el) => {
      const title     = $(el).find('img').attr('title') || $(el).find('a').text().trim();
      const thumbnail = $(el).find('img').attr('src') || '';
      const url       = $(el).find('a').attr('href')  || '';
      if (title && url) items.push({ title, thumbnail, url: absUrl(url) });
    });

    return items;
  } catch { return []; }
}

module.exports = { getLatest, searchAnime, getDetail, getWatch, getScrapedSchedule, getScrapedTrending };
