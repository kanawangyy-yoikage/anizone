// ─── SCRAPER SERVICE ─────────────────────────────────────
// Semua fungsi scraping dari samehadaku dikumpulkan di sini.
// Jika URL sumber berubah, cukup update file config.js.

const axios   = require('axios');
const cheerio = require('cheerio');
const { PROXY, BASE, SCRAPE_HEADERS: headers } = require('../config');

// ── Latest anime list ─────────────────────────────────────
async function getLatest(page = 1) {
  const res = await axios.get(`${PROXY}${BASE}/anime-terbaru/page/${page}/`, { headers });
  const $   = cheerio.load(res.data);
  const data = [];

  $('.post-show ul li').each((_, el) => {
    const a = $(el).find('.dtla h2 a');
    data.push({
      title  : a.text().trim(),
      url    : a.attr('href'),
      image  : $(el).find('.thumb img').attr('src'),
      episode: $(el).find('.dtla span:contains("Episode")').text().replace('Episode', '').trim(),
    });
  });

  return data;
}

// ── Search ────────────────────────────────────────────────
async function searchAnime(query) {
  const res = await axios.get(`${PROXY}${BASE}/?s=${encodeURIComponent(query)}`, { headers });
  const $   = cheerio.load(res.data);
  const data = [];

  $('.animpost').each((_, el) => {
    data.push({
      title: $(el).find('.data .title h2').text().trim(),
      image: $(el).find('.content-thumb img').attr('src'),
      type : $(el).find('.type').text().trim(),
      score: $(el).find('.score').text().trim(),
      url  : $(el).find('a').attr('href'),
    });
  });

  return data;
}

// ── Detail (info + episode list) ─────────────────────────
async function getDetail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res       = await axios.get(`${PROXY}${targetUrl}`, { headers });
  const $         = cheerio.load(res.data);

  // Episode list
  const episodes = [];
  $('.lstepsiode ul li').each((_, el) => {
    episodes.push({
      title: $(el).find('.epsleft .lchx a').text().trim(),
      url  : $(el).find('.epsleft .lchx a').attr('href'),
      date : $(el).find('.epsleft .date').text().trim(),
    });
  });

  // Metadata key-value pairs
  const info = {};
  $('.anim-senct .right-senc .spe span').each((_, el) => {
    const text = $(el).text();
    if (text.includes(':')) {
      const [key, val] = text.split(':');
      info[key.trim().toLowerCase().replace(/\s+/g, '_')] = val.trim();
    }
  });

  const title       = $('title').text().replace(' - Samehadaku', '').trim();
  const description = $('.entry-content').text().trim()
    || $('meta[name="description"]').attr('content')
    || '';

  return {
    title,
    image: $('meta[property="og:image"]').attr('content'),
    description,
    episodes,
    info,
  };
}

// ── Watch (stream + download links) ──────────────────────
async function getWatch(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res       = await axios.get(`${PROXY}${targetUrl}`, { headers });
  const cookies   = res.headers['set-cookie']?.map(v => v.split(';')[0]).join('; ') || '';
  const $         = cheerio.load(res.data);

  // Collect server list — samehadaku: div#server > ul > li, div[data-post] di dalam li
  const streams = [];
  for (const li of $('div#server > ul > li').toArray()) {
    const div  = $(li).find('div');
    const post = div.attr('data-post');
    const nume = div.attr('data-nume');
    const type = div.attr('data-type') || 'iframe';
    const name = $(li).find('span').text().trim() || 'Server';
    if (!post || !nume) continue;

    try {
      const body = new URLSearchParams({ action: 'player_ajax', post, nume, type }).toString();
      const r    = await axios.post(`${PROXY}${BASE}/wp-admin/admin-ajax.php`, body, {
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie'      : cookies,
          'Referer'     : targetUrl,
        },
      });
      const $$     = cheerio.load(r.data);
      const iframe = $$('iframe').attr('src');
      if (iframe) streams.push({ server: name, url: iframe });
    } catch (e) {
      console.log('[getWatch] error fetching server:', name, e.message);
    }
  }

  // Download links — grouped by format (MKV, MP4, dll.)
  const downloads = [];

  // Selector berlapis untuk download section samehadaku
  const dlContainer = $(
    '#downloaddb, .download-eps, .episodedl, #episodedl, ' +
    '[id*="download"], [class*="download"]'
  ).first();

  let currentFormat = 'Download';

  // Parse struktur: <p>MKV</p> <ul><li><strong>720p</strong><a>host</a></li></ul>
  dlContainer.children().each((_, el) => {
    const tag  = $(el).prop('tagName')?.toLowerCase();
    const text = $(el).text().trim();

    if ((tag === 'p' || tag === 'h3' || tag === 'h4') && !$(el).find('a').length && text) {
      currentFormat = text;
    } else if (tag === 'ul' || tag === 'div') {
      $(el).find('li').each((_, li) => {
        const resolution = $(li).find('strong, b').first().text().trim();
        const links      = [];
        $(li).find('a').each((_, a) => {
          const href = $(a).attr('href');
          const host = $(a).text().trim();
          if (href && host) links.push({ host, url: href });
        });
        if (links.length) downloads.push({ resolution, format: currentFormat, links });
      });
    }
  });

  // Fallback 1: coba .episodedl (struktur samehadaku alternatif)
  if (!downloads.length) {
    let fmt = 'Download';
    $('div.episodedl').children().each((_, el) => {
      const tag  = $(el).prop('tagName')?.toLowerCase();
      const text = $(el).text().trim();
      if ((tag === 'p' || tag === 'h3') && !$(el).find('a').length && text) {
        fmt = text;
      } else if (tag === 'ul') {
        $(el).find('li').each((_, li) => {
          const resolution = $(li).find('strong, b').first().text().trim();
          const links      = [];
          $(li).find('a').each((_, a) => {
            const href = $(a).attr('href');
            const host = $(a).text().trim();
            if (href && host) links.push({ host, url: href });
          });
          if (links.length) downloads.push({ resolution, format: fmt, links });
        });
      }
    });
  }

  // Fallback 2: ambil semua li berisi link download, tanpa grouping format
  if (!downloads.length) {
    dlContainer.find('li').each((_, li) => {
      const resolution = $(li).find('strong, b').first().text().trim();
      const links      = [];
      $(li).find('a').each((_, a) => {
        const href = $(a).attr('href');
        const host = $(a).text().trim();
        if (href && host) links.push({ host, url: href });
      });
      if (links.length) downloads.push({ resolution, format: 'Download', links });
    });
  }

  return {
    title    : $('h1[itemprop="name"]').text().trim(),
    streams,
    downloads,
  };
}

// ── Scraped schedule (fallback, no MAL key) ──────────────
async function getScrapedSchedule() {
  try {
    const res   = await axios.get(`${PROXY}${BASE}/jadwal-rilis/`, { headers });
    const $     = cheerio.load(res.data);
    const items = [];

    $('table tr, .schedule-item, .post-show ul li').each((_, el) => {
      const title = $(el).find('a').first().text().trim();
      const url   = $(el).find('a').first().attr('href');
      const image = $(el).find('img').attr('src');
      if (title && url) items.push({ title, url, image });
    });

    return items.slice(0, 40);
  } catch { return []; }
}

// ── Scraped trending (fallback, no MAL key) ──────────────
async function getScrapedTrending() {
  // Minimal fallback — returns empty because axios won't behave
  // like browser fetch; primary path is MAL API.
  return [];
}

module.exports = { getLatest, searchAnime, getDetail, getWatch, getScrapedSchedule, getScrapedTrending };
