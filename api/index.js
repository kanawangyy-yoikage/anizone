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

// Headers browser lengkap agar tidak kena 403/Cloudflare
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

// Helper: fetch HTML dengan retry
async function fetchPage(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(url, {
        headers,
        timeout: 20000,
        maxRedirects: 5
      });
      return cheerio.load(res.data);
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ─── SCRAPERS ─────────────────────────────────────────────

/**
 * Anime terbaru (update terkini)
 * URL: /quick/ongoing?order_by=update&page={page}
 * Struktur HTML (mode teks):
 *   <a href="/anime/{id}/{slug}/episode/{ep}">(Ep 8 / 12) Judul Anime</a>
 */
async function animeterbaru(page = 1) {
  const url = `${BASE}/quick/ongoing?order_by=update&page=${page}`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    // Hanya link episode
    if (!href.match(/\/anime\/\d+\/[^/]+\/episode\/\d+/)) return;
    if (seen.has(href)) return;
    seen.add(href);

    // Parse "(Ep 8 / 12) Judul Anime"
    const epMatch = text.match(/^\(Ep\s*(\d+)\s*\/\s*([^)]+)\)\s*(.+)$/);
    if (!epMatch) return;

    data.push({
      title: epMatch[3].trim(),
      url: href,
      image: '',
      episode: epMatch[1],
      totalEpisode: epMatch[2].trim()
    });
  });

  return data;
}

/**
 * Pencarian anime
 * URL: /anime?search={query}&order_by=latest
 * Struktur (mode teks): list link judul anime → /anime/{id}/{slug}
 */
async function search(query) {
  const url = `${BASE}/anime?search=${encodeURIComponent(query)}&order_by=latest`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    // Hanya link ke halaman anime (bukan episode, bukan navigasi)
    if (!href.match(/^https?:\/\/[^/]+\/anime\/\d+\/[^/]+$/) &&
        !href.match(/^\/anime\/\d+\/[^/]+$/)) return;
    if (href.includes('/episode/')) return;
    if (text.length < 2) return;
    if (seen.has(href)) return;
    seen.add(href);

    data.push({
      title: text,
      url: href,
      image: '',
      type: '',
      score: ''
    });
  });

  return data;
}

/**
 * Detail anime
 * URL: /anime/{id}/{slug}
 * Mengambil: judul, gambar (og:image), sinopsis, info metadata, daftar episode
 */
async function detail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const $ = await fetchPage(targetUrl);

  // Gambar poster dari Open Graph
  const image = $('meta[property="og:image"]').attr('content') || '';

  // Judul bersih (hapus " - Kuramanime")
  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Kuramanime\s*$/i, '').trim();

  // Sinopsis: cari paragraf pertama yang panjang (>80 karakter)
  let description = '';
  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 80 && !description) {
      description = txt;
    }
  });
  if (!description) {
    description = $('meta[property="og:description"]').attr('content') ||
                  $('meta[name="description"]').attr('content') || '';
  }

  // Info metadata: parse dari list item/span yang berformat "Label: Nilai"
  const info = {};
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx < 1 || colonIdx > 30) return;
    const key = text.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
    const val = text.substring(colonIdx + 1).trim().split('\n')[0].trim();
    if (key && val && val.length < 150) {
      info[key] = val;
    }
  });

  // Daftar episode: link ke /anime/{id}/{slug}/episode/{num}
  const episodes = [];
  const epSeen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    if (!href.match(/\/anime\/\d+\/[^/]+\/episode\/\d+$/)) return;
    if (epSeen.has(href)) return;
    epSeen.add(href);

    const epNum = href.match(/\/episode\/(\d+)$/)?.[1] || '';
    episodes.push({
      title: text || `Episode ${epNum}`,
      url: href,
      date: ''
    });
  });

  // Enrichment dari MAL jika tersedia
  if (MAL_CLIENT_ID) {
    try {
      const malDesc = await getMalDescription(title);
      if (malDesc) description = malDesc;
    } catch (e) {}
  }

  return { title, image, description, episodes, info };
}

/**
 * Watch/streaming — scrape halaman episode untuk embed video
 * URL: /anime/{id}/{slug}/episode/{num}
 * Kuramanime menggunakan iframe embed untuk video player
 */
async function download(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(targetUrl, { headers, timeout: 20000 });
  const $ = cheerio.load(res.data);

  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Kuramanime\s*$/i, '').trim();

  const streams = [];
  const streamSeen = new Set();

  // Ambil semua iframe embed (video player utama)
  $('iframe[src], iframe[data-src]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src || src === 'about:blank' || streamSeen.has(src)) return;
    streamSeen.add(src);

    let serverName = 'Stream';
    try {
      const hostname = new URL(src.startsWith('//') ? 'https:' + src : src).hostname;
      const parts = hostname.replace(/^www\./, '').split('.');
      serverName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    } catch (e) {}

    streams.push({ server: serverName, url: src.startsWith('//') ? 'https:' + src : src });
  });

  // Video langsung (HTML5 video tag)
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
    if (href.match(/\.(mp4|mkv|avi)(\?|$)/i) ||
        text.toLowerCase().includes('download')) {
      if (!streamSeen.has(href)) {
        streamSeen.add(href);
        streams.push({ server: text || 'Download', url: href });
      }
    }
  });

  return { title, streams };
}

// ─── MAL INTEGRATION ──────────────────────────────────────

async function getMalDescription(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { q: title, limit: 1, fields: 'synopsis,mean,genres,status,num_episodes,start_season' }
    });
    return res.data?.data?.[0]?.node?.synopsis || null;
  } catch (e) { return null; }
}

async function getMalAnime(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { q: title, limit: 1, fields: 'synopsis,mean,genres,status,num_episodes,start_season,main_picture,rank,popularity' }
    });
    return res.data?.data?.[0]?.node || null;
  } catch (e) { return null; }
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
  } catch (e) {
    return getScrapedSchedule();
  }
}

/**
 * Scrape jadwal dari /schedule?scheduled_day={day}
 * Kuramanime: setiap link ke /anime/{id}/{slug} adalah satu entry jadwal
 */
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
        if (text.length < 2 || seen.has(href)) return;
        seen.add(href);

        allItems.push({ title: text, url: href, day, image: '', score: 'N/A' });
      });
    } catch (e) {
      console.error(`Schedule fetch error [${day}]:`, e.message);
    }
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
  } catch (e) { return getScrapedTrending(); }
}

/**
 * Trending dari Kuramanime
 * URL: /quick/ongoing?order_by=popular
 */
async function getScrapedTrending() {
  try {
    const $ = await fetchPage(`${BASE}/quick/ongoing?order_by=popular`);
    const data = [];
    const seen = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      if (!href.match(/\/anime\/\d+\/[^/]+$/) || href.includes('/episode/')) return;
      if (text.length < 2 || seen.has(href)) return;
      seen.add(href);

      data.push({ title: text, url: href, image: '', score: 'N/A' });
    });

    return data.slice(0, 20);
  } catch (e) { return []; }
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

    // Fallback: gunakan update terbaru sebagai berita
    const latest = await animeterbaru(1);
    return latest.slice(0, 8).map(a => ({
      title: `Update: ${a.title} Episode ${a.episode} Tersedia`,
      url: a.url,
      image: a.image,
      description: `Episode terbaru dari ${a.title} sudah dapat ditonton di AniZone.`,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    }));
  } catch (e) {
    return [{
      title: 'AniZone 2026 - Fitur Baru Telah Hadir!',
      url: '#',
      image: '',
      description: 'Nikmati fitur jadwal rilis, berita terbaru, dan anime trending di AniZone 2026.',
      date: new Date().toLocaleDateString('id-ID')
    }];
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
  try {
    const desc = await getMalDescription(req.query.title);
    res.json({ description: desc });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', source: 'kuramanime', version: '3.0.0' }));

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
