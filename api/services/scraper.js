// ─── SCRAPER SERVICE ─────────────────────────────────────
// Semua fungsi scraping dari kusonime.com dikumpulkan di sini.
// Jika URL sumber berubah, cukup update file config.js.

const axios   = require('axios');
const cheerio = require('cheerio');
const { BASE, SCRAPE_HEADERS: headers } = require('../config');

// Helper: buat URL absolut jika perlu
function absUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

// ── Latest anime list ─────────────────────────────────────
// GET /api/latest?page=1
async function getLatest(page = 1) {
  const path = page && page > 1 ? `page/${page}` : '';
  const res  = await axios.get(`${BASE}/${path}`, { headers });
  const $    = cheerio.load(res.data);
  const data = [];

  // Kusonime home: .vezone > .venz > .kover
  $('.vezone').find('.venz').find('.kover').each((_, el) => {
    const thumbnail = $(el).find('img').attr('src') || '';
    const title     = $(el).find('.thumb').find('a').attr('title') || $(el).find('.thumb a').text().trim();
    const url       = $(el).find('.thumb').find('a').attr('href') || '';
    const episode   = $(el).find('.content').find('p:nth-child(2)').text().replace(/Episode/i, '').trim();

    const genres = [];
    $(el).find('.content').find('p:nth-child(4)').find('a').each((_, g) => {
      genres.push($(g).text().trim());
    });

    if (title && url) {
      data.push({ title, image: thumbnail, url, episode, genres });
    }
  });

  return data;
}

// ── Search ────────────────────────────────────────────────
// GET /api/search?q=...
async function searchAnime(query) {
  const res = await axios.get(`${BASE}/page/1/?s=${encodeURIComponent(query)}&post_type=post`, { headers });
  const $   = cheerio.load(res.data);
  const data = [];

  $('.vezone').find('.venz').find('.kover').each((_, el) => {
    const thumbnail = $(el).find('img').attr('src') || '';
    const title     = $(el).find('.thumb').find('a').attr('title') || $(el).find('.thumb a').text().trim();
    const url       = $(el).find('.thumb').find('a').attr('href') || '';

    const genres = [];
    $(el).find('.content').find('p:nth-child(4)').find('a').each((_, g) => {
      genres.push($(g).text().trim());
    });

    if (title && url) {
      data.push({ title, image: thumbnail, url, genres });
    }
  });

  return data;
}

// ── Detail (info + episode list) ─────────────────────────
// GET /api/detail?url=https://kusonime.com/...
async function getDetail(link) {
  const targetUrl = absUrl(link);
  const res       = await axios.get(targetUrl, { headers });
  const $         = cheerio.load(res.data);

  // Metadata: ambil dari .info > p (format "Key: Value")
  const info = {};
  $('.info').find('p').each((_, el) => {
    const bText = $(el).find('b').text().toLowerCase().trim().replace(/\s+/g, '_');
    $(el).find('b').remove();
    const val = $(el).text().split(':').pop().trim();
    if (bText) info[bText] = val || null;
  });

  // Episode list: kusonime — .episodelist > ul > li
  const episodes = [];
  $('.episodelist').find('ul li').each((_, el) => {
    const a    = $(el).find('a');
    const epTitle = a.text().trim();
    const epUrl   = a.attr('href') || '';
    const date    = $(el).find('.episodedate').text().trim();
    if (epTitle && epUrl) episodes.push({ title: epTitle, url: epUrl, date });
  });

  // Jika selector di atas kosong, coba selector alternatif kusonime
  if (!episodes.length) {
    $('.episodelistfull').find('li').each((_, el) => {
      const a = $(el).find('a');
      const epTitle = a.text().trim();
      const epUrl   = a.attr('href') || '';
      if (epTitle && epUrl) episodes.push({ title: epTitle, url: epUrl, date: '' });
    });
  }

  const title       = $('.jdlz').text().trim() || $('title').text().replace(/\s*[-–|].*/, '').trim();
  const image       = $('.post-thumb').find('img').attr('src')
                   || $('meta[property="og:image"]').attr('content')
                   || '';
  const description = $('.lexot > p').text().trim()
                   || $('meta[name="description"]').attr('content')
                   || '';

  return { title, image, description, episodes, info };
}

// ── Watch (stream + download links) ──────────────────────
// GET /api/watch?url=https://kusonime.com/...
// Kusonime episode page: download links ada di #dl > .smokeddlrh
async function getWatch(link) {
  const targetUrl = absUrl(link);
  const res       = await axios.get(targetUrl, { headers });
  const $         = cheerio.load(res.data);

  // Stream: cari iframe embed (kusonime biasanya embed di .playxo atau iframe langsung)
  const streams = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) {
      const server = $(el).attr('title') || $(el).attr('id') || 'Server';
      streams.push({ server, url: src });
    }
  });

  // Jika ada div server list (mirip struktur samehadaku yang ada di kusonime juga)
  if (!streams.length) {
    $('div#server ul li').each((_, li) => {
      const a   = $(li).find('a');
      const url = a.attr('href') || a.attr('data-src') || '';
      const srv = a.text().trim() || 'Server';
      if (url) streams.push({ server: srv, url });
    });
  }

  // Download links: struktur kusonime = #dl > .smokeddlrh > .smokettlrh (judul) + .smokeurlrh (link)
  const downloads = [];
  $('#dl').find('.smokeddlrh').each((_, el) => {
    const dlTitle = $(el).find('.smokettlrh').text().trim();

    $(el).find('.smokeurlrh').each((_, row) => {
      const resolution = $(row).find('strong').text().trim();
      const links      = [];

      $(row).find('a').each((_, a) => {
        const host = $(a).text().trim();
        const url  = $(a).attr('href') || '';
        if (host && url) links.push({ host, url });
      });

      if (links.length) downloads.push({ resolution, format: dlTitle, links });
    });
  });

  // Fallback download: selector lebih luas
  if (!downloads.length) {
    $('[class*="download"], [id*="download"]').find('li').each((_, li) => {
      const resolution = $(li).find('strong, b').first().text().trim();
      const links      = [];
      $(li).find('a').each((_, a) => {
        const host = $(a).text().trim();
        const url  = $(a).attr('href') || '';
        if (host && url) links.push({ host, url });
      });
      if (links.length) downloads.push({ resolution, format: 'Download', links });
    });
  }

  const title = $('.jdlz').text().trim()
             || $('h1[itemprop="name"]').text().trim()
             || $('h1').first().text().trim();

  return { title, streams, downloads };
}

// ── Scraped schedule (fallback) ───────────────────────────
async function getScrapedSchedule() {
  try {
    const res = await axios.get(`${BASE}/jadwal-tayang/`, { headers });
    const $   = cheerio.load(res.data);
    const items = [];

    $('table tr, .schedule-item, .vezone .kover').each((_, el) => {
      const a     = $(el).find('a').first();
      const title = a.attr('title') || a.text().trim();
      const url   = a.attr('href') || '';
      const image = $(el).find('img').attr('src') || '';
      if (title && url) items.push({ title, url, image });
    });

    return items.slice(0, 40);
  } catch { return []; }
}

// ── Scraped trending (fallback) ───────────────────────────
async function getScrapedTrending() {
  return [];
}

module.exports = { getLatest, searchAnime, getDetail, getWatch, getScrapedSchedule, getScrapedTrending };
