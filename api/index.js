const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─── CONFIG ───────────────────────────────────────────────
const BASE = 'https://v18.kuramanime.ing';
const MAL_API = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
  'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'Referer': BASE + '/'
};

async function fetchPage(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(url, { headers, timeout: 20000, maxRedirects: 5 });
      return cheerio.load(res.data);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Ambil gambar og:image dari satu halaman anime
async function fetchAnimeImage(animeUrl) {
  try {
    const $ = await fetchPage(animeUrl);
    return $('meta[property="og:image"]').attr('content') || '';
  } catch { return ''; }
}

// ─── SCRAPERS ─────────────────────────────────────────────

/**
 * Anime terbaru/update
 * Scrape /quick/ongoing?order_by=update
 * Return: url = URL anime (untuk loadDetail), episodeUrl = URL episode terbaru (untuk langsung nonton)
 * Gambar diambil secara parallel dari halaman detail masing-masing anime
 */
async function animeterbaru(page = 1) {
  const url = `${BASE}/quick/ongoing?order_by=update&page=${page}`;
  const $ = await fetchPage(url);
  const raw = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    // Link ke episode: /anime/{id}/{slug}/episode/{num}
    if (!href.match(/\/anime\/\d+\/[^/]+\/episode\/\d+/)) return;

    // URL anime = potong /episode/{num}
    const animeUrl = href.replace(/\/episode\/\d+$/, '');
    if (seen.has(animeUrl)) return;
    seen.add(animeUrl);

    // Parse "(Ep 8 / 12) Judul Anime"
    const epMatch = text.match(/^\(Ep\s*(\d+)\s*\/\s*([^)]+)\)\s*(.+)$/);
    if (!epMatch) return;

    raw.push({
      title: epMatch[3].trim(),
      url: animeUrl,          // URL anime — dipakai loadDetail()
      episodeUrl: href,       // URL episode terbaru — dipakai nonton langsung
      image: '',
      episode: epMatch[1],
      totalEpisode: epMatch[2].trim(),
      score: 'N/A',
      type: 'Anime'
    });
  });

  // Ambil gambar secara parallel (max 10 concurrent)
  const BATCH = 10;
  for (let i = 0; i < raw.length; i += BATCH) {
    const batch = raw.slice(i, i + BATCH);
    const images = await Promise.all(batch.map(item => fetchAnimeImage(item.url)));
    images.forEach((img, j) => { raw[i + j].image = img; });
  }

  return raw;
}

/**
 * Pencarian anime
 * Scrape /anime?search={query}&order_by=latest
 */
async function search(query) {
  const url = `${BASE}/anime?search=${encodeURIComponent(query)}&order_by=latest`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    // Link ke halaman anime (bukan episode, bukan nav)
    const isAnimeLink = href.match(/\/anime\/\d+\/[^/]+$/) ||
                        href.match(/^https?:\/\/[^/]+\/anime\/\d+\/[^/]+$/);
    if (!isAnimeLink || href.includes('/episode/')) return;
    if (text.length < 2) return;

    // Normalisasi ke full URL
    const fullHref = href.startsWith('http') ? href : (BASE + href);
    if (seen.has(fullHref)) return;
    seen.add(fullHref);

    data.push({ title: text, url: fullHref, image: '', type: '', score: '' });
  });

  // Ambil gambar parallel
  const BATCH = 8;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const images = await Promise.all(batch.map(item => fetchAnimeImage(item.url)));
    images.forEach((img, j) => { data[i + j].image = img; });
  }

  return data;
}

/**
 * Detail anime
 * Scrape /anime/{id}/{slug}
 */
async function detail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const $ = await fetchPage(targetUrl);

  const image = $('meta[property="og:image"]').attr('content') || '';
  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Kuramanime\s*$/i, '').trim();

  // Sinopsis: paragraf pertama yang cukup panjang
  let description = '';
  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 80 && !description) description = txt;
  });
  if (!description) {
    description = $('meta[property="og:description"]').attr('content') ||
                  $('meta[name="description"]').attr('content') || '';
  }

  // Info metadata dari <li> format "Label: Nilai"
  const info = {};
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx < 1 || colonIdx > 30) return;
    const key = text.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
    const val = text.substring(colonIdx + 1).trim().split('\n')[0].trim();
    if (key && val && val.length < 150) info[key] = val;
  });

  // Daftar episode: link ke /episode/{num}
  const episodes = [];
  const epSeen = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!href.match(/\/anime\/\d+\/[^/]+\/episode\/\d+$/)) return;
    if (epSeen.has(href)) return;
    epSeen.add(href);
    const epNum = href.match(/\/episode\/(\d+)$/)?.[1] || '';
    const fullHref = href.startsWith('http') ? href : (BASE + href);
    episodes.push({ title: text || `Episode ${epNum}`, url: fullHref, date: '' });
  });

  // Enrichment MAL
  if (MAL_CLIENT_ID) {
    try {
      const malDesc = await getMalDescription(title);
      if (malDesc) description = malDesc;
    } catch (e) {}
  }

  return { title, image, description, episodes, info };
}

/**
 * Watch — scrape halaman episode untuk embed video
 */
async function download(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(targetUrl, { headers, timeout: 20000 });
  const $ = cheerio.load(res.data);

  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Kuramanime\s*$/i, '').trim();

  const streams = [];
  const streamSeen = new Set();

  // Iframe embed (player utama)
  $('iframe[src], iframe[data-src]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src || src === 'about:blank' || streamSeen.has(src)) return;
    streamSeen.add(src);
    const fullSrc = src.startsWith('//') ? 'https:' + src : src;
    let serverName = 'Stream';
    try {
      const hostname = new URL(fullSrc).hostname.replace(/^www\./, '');
      const part = hostname.split('.')[0];
      serverName = part.charAt(0).toUpperCase() + part.slice(1);
    } catch (e) {}
    streams.push({ server: serverName, url: fullSrc });
  });

  // Video HTML5 langsung
  $('video source[src], video[src]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src || streamSeen.has(src)) return;
    streamSeen.add(src);
    streams.push({ server: 'Direct', url: src });
  });

  // Link download eksplisit
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!href) return;
    if (href.match(/\.(mp4|mkv|avi)(\?|$)/i) || text.toLowerCase().includes('download')) {
      if (!streamSeen.has(href)) {
        streamSeen.add(href);
        streams.push({ server: text || 'Download', url: href });
      }
    }
  });

  return { title, streams };
}

// ─── MAL ──────────────────────────────────────────────────

async function getMalDescription(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { q: title, limit: 1, fields: 'synopsis' }
    });
    return res.data?.data?.[0]?.node?.synopsis || null;
  } catch { return null; }
}

async function getMalAnime(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { q: title, limit: 1, fields: 'synopsis,mean,genres,status,num_episodes,start_season,main_picture,rank,popularity' }
    });
    return res.data?.data?.[0]?.node || null;
  } catch { return null; }
}

// ─── SCHEDULE ─────────────────────────────────────────────

async function getMalSchedule() {
  if (!MAL_CLIENT_ID) return getScrapedSchedule();
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let season = 'winter';
    if (month >= 4 && month <= 6) season = 'spring';
    else if (month >= 7 && month <= 9) season = 'summer';
    else if (month >= 10) season = 'fall';

    const res = await axios.get(`${MAL_API}/anime/season/${year}/${season}`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { limit: 50, fields: 'start_date,mean,num_episodes,status,genres,main_picture,broadcast', sort: 'anime_num_list_users' }
    });
    return res.data?.data?.map(d => ({
      id: d.node.id,
      title: d.node.title,
      image: d.node.main_picture?.medium || d.node.main_picture?.large,
      score: d.node.mean || 'N/A',
      episodes: d.node.num_episodes || '?',
      status: d.node.status,
      genres: d.node.genres?.map(g => g.name).slice(0, 3) || [],
      broadcast: d.node.broadcast,
      startDate: d.node.start_date,
      season: `${season} ${year}`
    })) || [];
  } catch { return getScrapedSchedule(); }
}

async function getScrapedSchedule() {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const allItems = [];
  const seen = new Set();

  for (const day of days) {
    try {
      const $ = await fetchPage(`${BASE}/schedule?scheduled_day=${day}`);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        if (!href.match(/\/anime\/\d+\/[^/]+$/) || href.includes('/episode/')) return;
        if (text.length < 2) return;
        const fullHref = href.startsWith('http') ? href : (BASE + href);
        if (seen.has(fullHref)) return;
        seen.add(fullHref);
        allItems.push({ title: text, url: fullHref, day, image: '', score: 'N/A' });
      });
    } catch (e) { console.error(`Schedule [${day}]:`, e.message); }
  }

  return allItems.slice(0, 60);
}

// ─── TRENDING ─────────────────────────────────────────────

async function getMalTrending() {
  if (!MAL_CLIENT_ID) return getScrapedTrending();
  try {
    const res = await axios.get(`${MAL_API}/anime/ranking`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { ranking_type: 'airing', limit: 20, fields: 'mean,genres,num_episodes,status,main_picture,rank' }
    });
    return res.data?.data?.map(d => ({
      rank: d.ranking?.rank,
      title: d.node.title,
      image: d.node.main_picture?.medium || d.node.main_picture?.large,
      score: d.node.mean || 'N/A',
      episodes: d.node.num_episodes || '?',
      genres: d.node.genres?.map(g => g.name).slice(0, 2) || [],
      malId: d.node.id
    })) || [];
  } catch { return getScrapedTrending(); }
}

async function getScrapedTrending() {
  try {
    const $ = await fetchPage(`${BASE}/quick/ongoing?order_by=popular`);
    const data = [];
    const seen = new Set();
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (!href.match(/\/anime\/\d+\/[^/]+$/) || href.includes('/episode/')) return;
      if (text.length < 2) return;
      const fullHref = href.startsWith('http') ? href : (BASE + href);
      if (seen.has(fullHref)) return;
      seen.add(fullHref);
      data.push({ title: text, url: fullHref, image: '', score: 'N/A' });
    });
    return data.slice(0, 20);
  } catch { return []; }
}

// ─── NEWS ─────────────────────────────────────────────────

async function getAnimeNews() {
  try {
    const res = await axios.get('https://animenewsnetwork.com/newsroom/', { headers, timeout: 12000 });
    const $ = cheerio.load(res.data);
    const news = [];
    $('div.herald.box.news, .news-item, article').each((_, el) => {
      const a = $(el).find('a').first();
      const title = a.text().trim() || $(el).find('h2, h3').text().trim();
      const href = a.attr('href');
      const img = $(el).find('img').first().attr('src');
      const desc = $(el).find('p, .preview').first().text().trim();
      const date = $(el).find('time, .date').first().text().trim();
      if (title && title.length > 5) {
        news.push({
          title,
          url: href ? (href.startsWith('http') ? href : 'https://animenewsnetwork.com' + href) : '#',
          image: img || '',
          description: desc.substring(0, 200),
          date: date || new Date().toLocaleDateString('id-ID')
        });
      }
    });
    if (news.length > 0) return news.slice(0, 12);
    const latest = await animeterbaru(1);
    return latest.slice(0, 8).map(a => ({
      title: `Update: ${a.title} Episode ${a.episode} Tersedia`,
      url: a.episodeUrl || a.url,
      image: a.image,
      description: `Episode terbaru dari ${a.title} sudah dapat ditonton di AniZone.`,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    }));
  } catch {
    return [{ title: 'AniZone 2026', url: '#', image: '', description: 'Selamat datang di AniZone.', date: new Date().toLocaleDateString('id-ID') }];
  }
}

// ─── ROUTES ────────────────────────────────────────────────

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

app.get('/api/mal/description', async (req, res) => {
  try { res.json({ description: await getMalDescription(req.query.title) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mal/anime', async (req, res) => {
  try { res.json(await getMalAnime(req.query.title)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/schedule', async (req, res) => {
  try { res.json(await getMalSchedule()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trending', async (req, res) => {
  try { res.json(await getMalTrending()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/news', async (req, res) => {
  try { res.json(await getAnimeNews()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', source: 'kuramanime', version: '3.1.0' }));

// ─── STATIC ────────────────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/masuk',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ─── START ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`AniZone API (Kuramanime) berjalan di port ${PORT}`));

module.exports = app;
