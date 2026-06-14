// ─── SCRAPER SERVICE ─────────────────────────────────────
// Scraping dari kusonime.com
// Selector 100% ikut repo: github.com/KatowProject/Kusonime-API

const axios   = require('axios');
const cheerio = require('cheerio');
const { BASE, SCRAPE_HEADERS: headers } = require('../config');

// Helper axios get
async function get(path) {
  const url = path.startsWith('http') ? path : `${BASE}/${path}`;
  return axios.get(url, { headers, timeout: 15000 });
}

// ── Latest anime list ─────────────────────────────────────
async function getLatest(page = 1) {
  const path = page > 1 ? `page/${page}` : '';
  const res  = await get(path);
  const $    = cheerio.load(res.data);
  const data = [];

  $('.vezone').find('.venz').find('.kover').each((_, el) => {
    const thumbnail = $(el).find('img').attr('src');
    const title     = $(el).find('.thumb').find('a').attr('title');
    const url       = $(el).find('.thumb').find('a').attr('href');

    const genres = [];
    $(el).find('.content').find('p:nth-child(4)').find('a').each((_, ele) => {
      genres.push({ name: $(ele).text(), url: $(ele).attr('href') });
    });

    data.push({ title, thumbnail, url, genres });
  });

  return data;
}

// ── Search ────────────────────────────────────────────────
async function searchAnime(query) {
  const res = await get(`page/1/?s=${encodeURIComponent(query)}&post_type=post`);
  const $   = cheerio.load(res.data);
  const data = [];

  $('.vezone').find('.venz').find('.kover').each((_, el) => {
    const thumbnail = $(el).find('img').attr('src');
    const title     = $(el).find('.thumb').find('a').attr('title');
    const url       = $(el).find('.thumb').find('a').attr('href');

    const genres = [];
    $(el).find('.content').find('p:nth-child(4)').find('a').each((_, ele) => {
      genres.push({ name: $(ele).text(), url: $(ele).attr('href') });
    });

    data.push({ title, thumbnail, url, genres });
  });

  return data;
}

// ── Detail anime (info + download list) ──────────────────
async function getDetail(link) {
  const res = await get(link);
  const $   = cheerio.load(res.data);

  const title     = $('.jdlz').text().trim();
  const image     = $('.post-thumb').find('img').attr('src');
  const sinopsis  = $('.lexot > p').text().trim();

  // Metadata dari .info p (key: value)
  const info = {};
  $('.info').find('p').each((_, el) => {
    const $el = $(el);
    const key = $el.find('b').text().toLowerCase().trim().replace(' ', '_');
    $el.find('b').remove();
    const value = $el.text().split(':').pop().trim();
    if (key) info[key] = value === '' ? null : value;
  });

  // Download list — struktur kusonime: #dl > .smokeddlrh > .smokettlrh + .smokeurlrh
  const list_download = [];
  $('#dl').find('.smokeddlrh').each((_, el) => {
    const dlTitle     = $(el).find('.smokettlrh').text().trim();
    const download_link = [];

    // PENTING: di repo asli pakai $('.smokeurlrh') bukan $(el).find('.smokeurlrh')
    // tapi itu bug di repo asli — kita perbaiki agar scope ke dalam el
    $(el).find('.smokeurlrh').each((_, ele) => {
      const type  = $(ele).find('strong').text().trim();
      const links = [];

      $(ele).find('a').each((_, elem) => {
        links.push({ name: $(elem).text().trim(), url: $(elem).attr('href') });
      });

      download_link.push({ type, links });
    });

    list_download.push({ title: dlTitle, download_link });
  });

  // Episodes = ambil dari list_download titles sebagai daftar episode
  const episodes = list_download.map(dl => ({
    title : dl.title,
    url   : link,
  }));

  return { title, image, description: sinopsis, info, list_download, episodes };
}

// ── Watch (stream + download links) ──────────────────────
async function getWatch(link) {
  const res = await get(link);
  const $   = cheerio.load(res.data);

  const title = $('.jdlz').text().trim() || $('h1.entry-title').text().trim();

  // Stream: kusonime embed iframe
  const streams = [];
  $('iframe').each((_, el) => {
    const src  = $(el).attr('src') || $(el).attr('data-src') || '';
    const name = $(el).attr('title') || `Server ${streams.length + 1}`;
    if (src.startsWith('http')) streams.push({ server: name, url: src });
  });

  // Download links — sama seperti getDetail
  const downloads = [];
  $('#dl').find('.smokeddlrh').each((_, el) => {
    const resolution = $(el).find('.smokettlrh').text().trim();

    $(el).find('.smokeurlrh').each((_, ele) => {
      const type  = $(ele).find('strong').text().trim();
      const links = [];

      $(ele).find('a').each((_, elem) => {
        const host = $(elem).text().trim();
        const url  = $(elem).attr('href');
        if (host && url) links.push({ host, url });
      });

      if (links.length) downloads.push({ resolution, format: type, links });
    });
  });

  return { title, streams, downloads };
}

// ── Scraped schedule ──────────────────────────────────────
async function getScrapedSchedule() {
  try {
    const res = await get('jadwal-rilis/');
    const $   = cheerio.load(res.data);
    const items = [];

    // Coba tabel jadwal, fallback ke .kover cards
    $('table tr').each((_, el) => {
      const title = $(el).find('a').first().text().trim();
      const url   = $(el).find('a').first().attr('href');
      if (title && url) items.push({ title, url, image: '' });
    });

    if (!items.length) {
      $('.vezone .venz .kover').each((_, el) => {
        const title = $(el).find('.thumb a').attr('title') || '';
        const url   = $(el).find('.thumb a').attr('href')  || '';
        const image = $(el).find('img').attr('src')        || '';
        if (title && url) items.push({ title, url, image });
      });
    }

    return items.slice(0, 40);
  } catch { return []; }
}

// ── Scraped trending ──────────────────────────────────────
async function getScrapedTrending() {
  try {
    const res = await get('');
    const $   = cheerio.load(res.data);
    const items = [];

    // Sidebar rekomendasi: .recomx li
    $('.recomx').find('li').each((_, el) => {
      const title     = $(el).find('img').attr('title') || $(el).find('a').text().trim();
      const thumbnail = $(el).find('img').attr('src')   || '';
      const url       = $(el).find('a').attr('href')    || '';
      if (title && url) items.push({ title, thumbnail, url });
    });

    return items;
  } catch { return []; }
}

module.exports = { getLatest, searchAnime, getDetail, getWatch, getScrapedSchedule, getScrapedTrending };
