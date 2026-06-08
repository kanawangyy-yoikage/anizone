const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const PROXY = 'https://cors.caliph.my.id/';
const BASE  = 'https://otakudesu.blog';
const MAL_API = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// ─── HELPER ─────────────────────────────────────────────
async function fetchPage(url) {
  try {
    const res = await axios.get(`${PROXY}${url}`, { headers, timeout: 15000 });
    return cheerio.load(res.data);
  } catch (e) {
    console.error(`Fetch error ${url}:`, e.message);
    return null;
  }
}

// ─── ANIMETERBARU / LATEST ─────────────────────────────
async function animeterbaru(page = 1) {
  const $ = await fetchPage(`${BASE}/`);
  if (!$) return [];

  const data = [];
  // Selector utama Otakudesu
  $('.venz ul li, .chivsrc li, article, .listupd article').each((_, el) => {
    const $el = $(el);
    const a = $el.find('a').first();
    const title = $el.find('h2, .thumbz h3, .jdl').text().trim() || a.text().trim();
    let url = a.attr('href');
    const img = $el.find('img').attr('src') || $el.find('.thumb img').attr('src');

    if (title && url) {
      if (!url.startsWith('http')) url = BASE + url;
      data.push({
        title: title.replace(/Subtitle Indonesia|Sub Indo/gi, '').trim(),
        url,
        image: img ? (img.startsWith('http') ? img : PROXY + img) : '',
        episode: $el.find('.epz, .eps, .episode').text().trim() || 'Terbaru',
      });
    }
  });

  return data.slice(0, 24);
}

// ─── SEARCH ─────────────────────────────────────────────
async function search(query) {
  const $ = await fetchPage(`${BASE}/?s=${encodeURIComponent(query)}`);
  if (!$) return [];

  const data = [];
  $('article, .chivsrc, .listupd article').each((_, el) => {
    const $el = $(el);
    const a = $el.find('a').first();
    const title = $el.find('h2, .thumbz h3').text().trim();
    let url = a.attr('href');
    const img = $el.find('img').attr('src');

    if (title && url) {
      if (!url.startsWith('http')) url = BASE + url;
      data.push({
        title: title.replace(/Subtitle Indonesia|Sub Indo/gi, '').trim(),
        image: img ? (img.startsWith('http') ? img : PROXY + img) : '',
        type: $el.find('.type, .genre').text().trim() || 'TV',
        score: $el.find('.score, .rating').text().trim() || 'N/A',
        url
      });
    }
  });

  return data;
}

// ─── DETAIL ─────────────────────────────────────────────
async function detail(link) {
  const target = link.startsWith('http') ? link : BASE + link;
  const $ = await fetchPage(target);
  if (!$) return { title: 'Error', description: 'Gagal memuat', episodes: [], info: {} };

  const episodes = [];
  // Episode list
  $('.lstepsiode ul li, .eplister ul li, .episode-list li, .list-episode a').each((_, el) => {
    const $el = $(el);
    const a = $el.find('a');
    const title = a.text().trim();
    let url = a.attr('href');
    if (title && url) {
      if (!url.startsWith('http')) url = BASE + url;
      episodes.push({ title, url, date: $el.find('.date').text().trim() });
    }
  });

  const title = $('h1.entry-title, .entry-title, .judul').text().trim() || $('title').text().replace(/- Otaku Desu.*/i, '').trim();
  let description = $('.sinopsis, .entry-content p, .desc, .info-content').text().trim();

  const info = {};
  $('.spe span, .infoz span, .infox p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes(':')) {
      const [key, value] = text.split(':').map(s => s.trim());
      info[key.toLowerCase().replace(/\s+/g, '_')] = value;
    }
  });

  if (MAL_CLIENT_ID && description.length < 150) {
    try {
      const malDesc = await getMalDescription(title);
      if (malDesc) description = malDesc;
    } catch {}
  }

  return {
    title,
    image: $('meta[property="og:image"]').attr('content') || $('.thumb img, img').first().attr('src'),
    description: description || 'Deskripsi tidak tersedia.',
    episodes: episodes.slice(0, 50),
    info
  };
}

// ─── WATCH / DOWNLOAD ───────────────────────────────────
async function download(link) {
  const target = link.startsWith('http') ? link : BASE + link;
  const $ = await fetchPage(target);
  if (!$) return { title: 'Error', streams: [] };

  const streams = [];
  // Mirror links
  $('a[href*="gdrive"], a[href*="mediafire"], a[href*="mega"], .mirror a, .dowload a, .download a').each((_, el) => {
    const url = $(el).attr('href');
    const name = $(el).text().trim() || 'Mirror';
    if (url) streams.push({ server: name, url });
  });

  // Fallback iframe
  if (streams.length === 0) {
    const iframe = $('iframe').attr('src');
    if (iframe) streams.push({ server: 'Player', url: iframe });
  }

  return {
    title: $('h1').first().text().trim() || 'Episode',
    streams
  };
}

// MAL Functions (tetap sama seperti sebelumnya)
async function getMalDescription(title) { /* ... (copy dari kode lama) */ }
async function getMalAnime(title) { /* ... */ }
async function getMalSchedule() { /* ... */ }
async function getMalTrending() { /* ... */ }
async function getAnimeNews() { /* ... */ }

// ─── ROUTES ─────────────────────────────────────────────
app.get('/api/latest', async (req, res) => {
  try { res.json(await animeterbaru(req.query.page || 1)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  try { res.json(await search(req.query.q)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/detail', async (req, res) => {
  try { res.json(await detail(req.query.url)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/watch', async (req, res) => {
  try { res.json(await download(req.query.url)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// MAL routes + health (copy dari kode asli kamu)
app.get('/api/mal/description', async (req, res) => { /* ... */ });
app.get('/api/mal/anime', async (req, res) => { /* ... */ });
app.get('/api/schedule', async (req, res) => { /* ... */ });
app.get('/api/trending', async (req, res) => { /* ... */ });
app.get('/api/news', async (req, res) => { /* ... */ });
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.1.0-otakudesu', scraper: 'otakudesu.blog' }));

// Static & SPA
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get(['/masuk','/login'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get(['/admin','/panel'], (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ AniZone Otakudesu Scraper running on ${PORT}`));

module.exports = app;
