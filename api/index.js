const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

const PROXY = 'https://cors.caliph.my.id/';
const BASE  = 'https://otakudesu.blog';
const MAL_API = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// ─── SCRAPERS OTakuDESU ─────────────────────────────────────────────

async function animeterbaru(page = 1) {
  const res = await axios.get(`${PROXY}${BASE}/`, { headers });
  const $ = cheerio.load(res.data);
  const data = [];

  // Sesuaikan selector Otakudesu (biasanya .venz, .chivsrc, dll)
  $('.venz ul li, .latest ul li, article').each((_, e) => {
    const a = $(e).find('a').first();
    const title = a.find('h2, .thumbz h3, .jdl').text().trim() || a.text().trim();
    const url = a.attr('href');
    const img = $(e).find('img').attr('src') || $(e).find('.thumbz img').attr('src');

    if (title && url) {
      data.push({
        title: title,
        url: url.startsWith('http') ? url : `${BASE}${url}`,
        image: img ? (img.startsWith('http') ? img : `${PROXY}${img}`) : '',
        episode: $(e).find('.epz, .eps').text().trim() || 'Terbaru',
      });
    }
  });

  return data.slice(0, 20);
}

async function search(query) {
  const res = await axios.get(`${PROXY}${BASE}/?s=${encodeURIComponent(query)}`, { headers });
  const $ = cheerio.load(res.data);
  const data = [];

  // Selector search Otakudesu
  $('article, .chivsrc, .listupd article').each((_, e) => {
    const a = $(e).find('a').first();
    const title = $(e).find('h2, .thumbz h3').text().trim();
    const image = $(e).find('img').attr('src');
    const type = $(e).find('.type, .genre').text().trim();
    const score = $(e).find('.score, .rating').text().trim();
    const url = a.attr('href');

    if (title && url) {
      data.push({
        title,
        image: image ? (image.startsWith('http') ? image : `${PROXY}${image}`) : '',
        type: type || 'Anime',
        score: score || 'N/A',
        url: url.startsWith('http') ? url : `${BASE}${url}`
      });
    }
  });

  return data;
}

async function detail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(`${PROXY}${targetUrl}`, { headers });
  const $ = cheerio.load(res.data);

  const episodes = [];
  // Episode list Otakudesu biasanya di .lstepsiode atau .eplister
  $('.lstepsiode ul li, .eplister ul li, .episode-list li').each((_, e) => {
    const a = $(e).find('a');
    episodes.push({
      title: a.text().trim(),
      url: a.attr('href'),
      date: $(e).find('.date').text().trim()
    });
  });

  const info = {};
  // Info spec Otakudesu
  $('.infoz, .spe, .infox').find('span, p').each((_, e) => {
    const t = $(e).text();
    if (t.includes(':')) {
      const [k, v] = t.split(':');
      info[k.trim().toLowerCase().replace(/\s+/g, '_')] = v.trim();
    }
  });

  const title = $('h1.entry-title, .entry-title').text().trim() || $('title').text().replace(' - Otaku Desu', '').trim();
  let description = $('.entry-content p, .sinopsis, .desc').text().trim() || '';

  if (MAL_CLIENT_ID) {
    try {
      const malDesc = await getMalDescription(title);
      if (malDesc) description = malDesc;
    } catch (e) {}
  }

  return { 
    title, 
    image: $('meta[property="og:image"], .thumb img').attr('content') || $('img').first().attr('src'), 
    description, 
    episodes: episodes.slice(0, 30), 
    info 
  };
}

async function download(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(`${PROXY}${targetUrl}`, { headers });
  const $ = cheerio.load(res.data);
  const data = [];

  // Server download/stream Otakudesu biasanya di .mirror, .download, atau player
  $('a[href*="gdrive"], a[href*="mediafire"], .mirror a, .dowload a').each((_, el) => {
    const serverName = $(el).text().trim() || 'Server';
    const url = $(el).attr('href');
    if (url) data.push({ server: serverName, url });
  });

  // Fallback iframe/player jika ada
  if (data.length === 0) {
    const iframe = $('iframe').attr('src');
    if (iframe) data.push({ server: 'Default', url: iframe });
  }

  return { 
    title: $('h1').text().trim() || 'Episode', 
    streams: data 
  };
}

// MAL functions tetap sama (getMalDescription, getMalAnime, getMalSchedule, dll)
async function getMalDescription(title) { /* ... sama seperti sebelumnya ... */ }
async function getMalAnime(title) { /* ... sama ... */ }
async function getMalSchedule() { /* ... sama ... */ }
async function getMalTrending() { /* ... sama ... */ }
async function getAnimeNews() { /* ... sama ... */ }

// ROUTES tetap sama, hanya BASE diganti
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

// MAL routes & health tetap sama
// ... (copy sisanya dari file asli)

const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/masuk', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`AniZone (Otakudesu) running on port ${PORT}`));

module.exports = app;
