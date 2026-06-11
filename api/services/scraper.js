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

  // Collect server list
  const serverEls = [];
  $('.server.active ul li').each((_, el) => serverEls.push(el));
  if (!serverEls.length) {
    $('.server ul li, .mirrorstream li, .player-embed li').each((_, el) => serverEls.push(el));
  }

  // Fetch stream URLs in parallel
  const streams = (
    await Promise.all(
      serverEls.map(async (el) => {
        const post  = $(el).find('a').attr('data-post')  || $(el).attr('data-post');
        const nume  = $(el).find('a').attr('data-nume')  || $(el).attr('data-id');
        const type  = $(el).find('a').attr('data-type')  || 'iframe';
        const name  = $(el).find('a').text().trim()      || $(el).text().trim() || 'Server';
        if (!post || !nume) return null;

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
          const $$    = cheerio.load(r.data);
          const iframe = $$('iframe').attr('src');
          return iframe ? { server: name, url: iframe } : null;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean);

  // Download links — grouped by format (MKV, MP4, etc.)
  const downloads = [];
  const dlContainer = $('#downloaddb, .download-eps, [id*="download"]').first();
  let currentFormat  = 'Download';

  dlContainer.children().each((_, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase();
    if (tag === 'p' && !$(el).find('a').length) {
      currentFormat = $(el).text().trim() || currentFormat;
    } else if (tag === 'ul') {
      $(el).find('li').each((_, li) => {
        const resolution = $(li).find('strong').first().text().trim();
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

  // Fallback if grouped parsing found nothing
  if (!downloads.length) {
    dlContainer.find('li').each((_, li) => {
      const resolution = $(li).find('strong').first().text().trim();
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
