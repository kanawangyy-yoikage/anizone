const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// ─── CORS — izinkan semua origin ───────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.options('*', cors());
app.use(express.json());

// ─── CONFIG ───────────────────────────────────────────────
// Daftar mirror, dicoba urut dari atas jika yang pertama gagal
const BASE_MIRRORS = [
  'https://v18.kuramanime.ing',
  'https://kuramanime.net',
  'https://kuramanime.pro',
];
let BASE = BASE_MIRRORS[0];
const MAL_API = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// Cookie kuramanime — set env var KURAMANIME_COOKIE di Railway
// Cara dapat: buka kuramanime di browser, login, DevTools > Application > Cookies > copy semua
const KURAMANIME_COOKIE = process.env.KURAMANIME_COOKIE || '';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
  'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',        // Diubah jadi same-origin
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'Referer': 'https://v18.kuramanime.ing/', // Referer spesifik
  ...(KURAMANIME_COOKIE ? { 'Cookie': KURAMANIME_COOKIE } : {}),
};

// ─── AUTO-DETECT MIRROR YANG AKTIF ────────────────────────
async function detectWorkingMirror() {
  for (const mirror of BASE_MIRRORS) {
    try {
      const res = await axios.get(mirror, {
        headers: { ...headers, Referer: mirror + '/' },
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: s => s < 500
      });
      if (res.status < 400) {
        BASE = mirror;
        console.log(`[Mirror] Aktif: ${BASE}`);
        return;
      }
    } catch (e) {
      console.log(`[Mirror] Gagal ${mirror}: ${e.message}`);
    }
  }
  console.warn('[Mirror] Semua mirror gagal, pakai default.');
}
detectWorkingMirror();
// Cek ulang setiap 10 menit
setInterval(detectWorkingMirror, 10 * 60 * 1000);

// ─── FETCH HELPER ─────────────────────────────────────────
async function fetchPage(url, retries = 2) {
  const fullHeaders = { ...headers, Referer: BASE + '/' };
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(url, {
        headers: fullHeaders,
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

// ─── IMAGE CACHE ──────────────────────────────────────────
const imageCache = new Map();

async function getAnimeImage(animeUrl) {
  if (imageCache.has(animeUrl)) return imageCache.get(animeUrl);
  try {
    const $ = await fetchPage(animeUrl);
    const img = $('meta[property="og:image"]').attr('content') || '';
    imageCache.set(animeUrl, img);
    return img;
  } catch { return ''; }
}

// ─── SCRAPERS ─────────────────────────────────────────────

async function animeterbaru(page = 1) {
  const url = `${BASE}/quick/ongoing?order_by=update&page=${page}`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!href.match(/\/anime\/\d+\/[^/]+\/episode\/\d+/)) return;
    const animeUrl = (href.startsWith('http') ? href : BASE + href).replace(/\/episode\/\d+$/, '');
    if (seen.has(animeUrl)) return;
    seen.add(animeUrl);
    const epMatch = text.match(/^\(Ep\s*(\d+)\s*\/\s*([^)]+)\)\s*(.+)$/);
    if (!epMatch) return;
    data.push({
      title: epMatch[3].trim(),
      url: animeUrl,
      episodeUrl: href.startsWith('http') ? href : BASE + href,
      image: '',
      episode: epMatch[1],
      totalEpisode: epMatch[2].trim(),
      score: 'N/A',
      type: 'Anime'
    });
  });

  return data;
}

async function getImage(animeUrl) {
  return getAnimeImage(animeUrl);
}

async function search(query) {
  const url = `${BASE}/anime?search=${encodeURIComponent(query)}&order_by=latest`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();

  // Kata-kata yang jelas bukan judul anime (navigasi, UI, dll)
  const BLACKLIST = /^(beranda|home|trending|jadwal|login|daftar|masuk|keluar|profil|profile|kategori|genre|search|cari|lainnya|selengkapnya|more|next|prev|previous|episode|batch|subtitle|sub indo|nonton|download|stream|server|kualitas|resolusi|bagikan|share|lapor|report|komentar|comment)$/i;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const isAnime = href.match(/\/anime\/\d+\/[^/]+$/) || href.match(/^https?:\/\/[^/]+\/anime\/\d+\/[^/]+$/);
    if (!isAnime || href.includes('/episode/')) return;
    // Filter: judul terlalu pendek, terlalu panjang, atau kata navigasi
    if (text.length < 3 || text.length > 120) return;
    if (BLACKLIST.test(text)) return;
    // Filter: judul yang isinya cuma angka/simbol
    if (/^[\d\s\-_.]+$/.test(text)) return;
    const fullHref = href.startsWith('http') ? href : BASE + href;
    if (seen.has(fullHref)) return;
    seen.add(fullHref);
    data.push({ title: text, url: fullHref, image: '', type: '', score: '' });
  });

  return data;
}

async function detail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const $ = await fetchPage(targetUrl);
  const image = $('meta[property="og:image"]').attr('content') || '';
  if (image) imageCache.set(targetUrl, image);
  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Kuramanime\s*$/i, '').trim();
  let description = '';
  $('p').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length > 80 && !description) description = txt;
  });
  if (!description) {
    description = $('meta[property="og:description"]').attr('content') ||
                  $('meta[name="description"]').attr('content') || '';
  }
  const info = {};
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx < 1 || colonIdx > 30) return;
    const key = text.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
    const val = text.substring(colonIdx + 1).trim().split('\n')[0].trim();
    if (key && val && val.length < 150) info[key] = val;
  });
  const episodes = [];
  const epSeen = new Set();

  function addEpisode(href, text) {
    if (!href || href === '#') return;
    const fullHref = href.startsWith('http') ? href : BASE + href;
    if (epSeen.has(fullHref)) return;
    epSeen.add(fullHref);
    const epNum = href.match(/\/episode\/([\d.]+)/)?.[1]
                || href.match(/[\d]+$/)?.[0]
                || '';
    episodes.push({ title: text || `Episode ${epNum}`, url: fullHref, date: '' });
  }

  // 1. <a href="...episode/N...">
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.match(/\/episode\/[\d]/)) return;
    addEpisode(href, $(el).text().trim());
  });

  // 2. Elemen apapun dengan data-href / data-url / data-episode-url
  $('[data-href],[data-url],[data-episode-url],[data-src]').each((_, el) => {
    const href = $(el).attr('data-href') || $(el).attr('data-url')
              || $(el).attr('data-episode-url') || $(el).attr('data-src') || '';
    if (!href.match(/\/episode\/[\d]/)) return;
    addEpisode(href, $(el).text().trim());
  });

  // 3. onclick="..." yang mengandung URL episode
  $('[onclick]').each((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    const m = onclick.match(/['"\`]((?:[^\'"\`]*)?\/episode\/[\d][^\'"\`]*?)['"\`]/);
    if (!m) return;
    addEpisode(m[1], $(el).text().trim());
  });

  // 4. Scan raw HTML untuk URL episode di dalam script/JSON inline
  if (episodes.length === 0) {
    const rawHtml = $.html();
    const urlRegex = /["'\`]((?:https?:\/\/[^"'\`\s]*)?(?:\/anime\/\d+\/[^"'\`\s]*)?\/episode\/[\d][^"'\`\s<>]*?)["'\`]/g;
    let m;
    while ((m = urlRegex.exec(rawHtml)) !== null) {
      addEpisode(m[1], '');
    }
  }
  // Fallback: kalau masih kosong, coba fetch khusus episode list
  if (episodes.length === 0) {
    try {
      const epList = await fetchEpisodeList(targetUrl);
      episodes.push(...epList);
    } catch {}
  }

  if (MAL_CLIENT_ID) {
    try {
      const malDesc = await getMalDescription(title);
      if (malDesc) description = malDesc;
    } catch {}
  }
  return { title, image, description, episodes, info };
}

// Coba fetch daftar episode dari endpoint khusus kuramanime (/eps atau ?page=episode)
async function fetchEpisodeList(animeUrl) {
  const variants = [
    animeUrl + '?eps=1',
    animeUrl.replace(/\/anime\//, '/eps/'),
    animeUrl + '/episode',
  ];
  for (const url of variants) {
    try {
      const $ = await fetchPage(url);
      const eps = [];
      const seen = new Set();
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!href.match(/\/episode\/[\d]/)) return;
        const fullHref = href.startsWith('http') ? href : BASE + href;
        if (seen.has(fullHref)) return;
        seen.add(fullHref);
        const epNum = href.match(/\/episode\/([\d.]+)/)?.[1] || '';
        eps.push({ title: $(el).text().trim() || `Episode ${epNum}`, url: fullHref, date: '' });
      });
      if (eps.length > 0) return eps;
    } catch {}
  }
  return [];
}

async function download(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(targetUrl, { headers: { ...headers, Referer: BASE + '/' }, timeout: 20000 });
  const html = res.data;
  const $ = cheerio.load(html);
  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Kuramanime\s*$/i, '').trim();
  const streams = [];
  const seen = new Set();

  function serverLabel(url, fallback) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      const name = host.split('.')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch { return fallback || 'Stream'; }
  }

  function addStream(url, label) {
    if (!url || url === 'about:blank' || url === '#') return;
    const full = url.startsWith('//') ? 'https:' + url
               : url.startsWith('http') ? url
               : BASE + url;
    if (seen.has(full)) return;
    seen.add(full);
    streams.push({ server: label || serverLabel(full), url: full });
  }

  // 1. <iframe src / data-src>
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) addStream(src, serverLabel(src));
  });

  // 2. <video> / <source> — termasuk data-hls-src yang dipakai kuramanime
  $('video, video source, source').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src')
              || $(el).attr('data-hls-src') || $(el).attr('data-hls')
              || $(el).attr('data-video') || '';
    if (src) addStream(src, $(el).attr('id') === 'player' ? 'Kuramadrive' : 'Direct');
  });

  // 3. Server list — kuramanime pakai form#serverForm + ul.nice-select > li.option
  // Setiap li.option punya data-value = URL embed, teks = nama server
  $('li.option, li[data-value], select option, [data-provider], [data-server], [data-stream], [data-mirror]').each((_, el) => {
    const url = $(el).attr('data-value') || $(el).attr('data-src') || $(el).attr('data-stream')
              || $(el).attr('data-provider') || $(el).attr('data-server')
              || $(el).attr('data-mirror') || $(el).attr('value') || '';
    const label = $(el).text().trim().replace(/\(.*?\)/g, '').trim() || $(el).attr('data-name') || '';
    if (url && (url.startsWith('http') || url.startsWith('//'))) addStream(url, label || serverLabel(url));
  });

  // 3b. Form serverForm: hidden input / select dengan value URL
  $('form#serverForm input, form#serverForm select option, #serverSection input, #serverSection option').each((_, el) => {
    const url = $(el).attr('value') || $(el).attr('data-src') || '';
    const label = $(el).attr('name') || $(el).text().trim() || '';
    if (url && (url.startsWith('http') || url.startsWith('//'))) addStream(url, label || serverLabel(url));
  });

  // 4. Semua elemen dengan data-src / data-hls-src yang berupa URL
  $('[data-src],[data-hls-src],[data-hls]').each((_, el) => {
    const src = $(el).attr('data-hls-src') || $(el).attr('data-hls') || $(el).attr('data-src') || '';
    const label = $(el).attr('data-name') || $(el).attr('title') || $(el).text().trim() || '';
    if (src.startsWith('http') || src.startsWith('//')) addStream(src, label || serverLabel(src));
  });

  // 5. Parse <script> tags untuk pola URL streaming kuramanime
  $('script').each((_, el) => {
    const code = $(el).html() || '';

    // Pola: "url":"https://..." atau "src":"https://..."
    for (const m of code.matchAll(/"(?:url|src|stream|embed|iframe)"\s*:\s*"(https?:\/\/[^"]+)"/gi))
      addStream(m[1], serverLabel(m[1]));

    // Pola: var streamUrl = "..."
    for (const m of code.matchAll(/(?:streamUrl|embedUrl|iframeUrl|playerUrl|videoUrl|mirrorUrl)\s*=\s*["'`](https?:\/\/[^"'`\n]+)["'`]/gi))
      addStream(m[1], serverLabel(m[1]));

    // Pola object: {server:"Name", url:"..."}
    for (const m of code.matchAll(/\{[^{}]{0,200}"?server"?\s*:\s*"([^"]+)"[^{}]{0,200}"?(?:url|src)"?\s*:\s*"(https?:\/\/[^"]+)"[^{}]{0,200}\}/gi))
      addStream(m[2], m[1]);
    for (const m of code.matchAll(/\{[^{}]{0,200}"?(?:url|src)"?\s*:\s*"(https?:\/\/[^"]+)"[^{}]{0,200}"?server"?\s*:\s*"([^"]+)"[^{}]{0,200}\}/gi))
      addStream(m[1], m[2]);
  });

  // 6. Fallback: scan raw HTML untuk domain streaming umum
  if (streams.length === 0) {
    const pat = /https?:\/\/(?:[a-z0-9-]+\.)?(?:kuramadrive|streamtape|doodstream|dood\.|filemoon|mega\.nz|ok\.ru|mp4upload|streamlare|upstream|mixdrop|fembed|vidstream)[^\s"'<>]+/gi;
    for (const m of html.matchAll(pat)) addStream(m[0], serverLabel(m[0]));
  }

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
        const fullHref = href.startsWith('http') ? href : BASE + href;
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
      const fullHref = href.startsWith('http') ? href : BASE + href;
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

app.get('/api/mirror', (req, res) => res.json({ base: BASE }));

app.get('/api/latest', async (req, res) => {
  try { res.json(await animeterbaru(req.query.page || 1)); }
  catch (e) { res.status(500).json({ error: e.message, base: BASE }); }
});

app.get('/api/image', async (req, res) => {
  try {
    const img = await getImage(req.query.url);
    res.json({ image: img });
  } catch (e) { res.json({ image: '' }); }
});

app.get('/api/search', async (req, res) => {
  try { res.json(await search(req.query.q)); }
  catch (e) { res.status(500).json({ error: e.message, base: BASE }); }
});

app.get('/api/detail', async (req, res) => {
  try { res.json(await detail(req.query.url)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/watch', async (req, res) => {
  try { res.json(await download(req.query.url)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// DEBUG: lihat raw HTML + semua atribut video/iframe yang berhasil di-scrape
app.get('/api/debug-watch', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const response = await axios.get(targetUrl, { headers: { ...headers, Referer: BASE + '/' }, timeout: 20000 });
    const html = response.data;
    const $ = cheerio.load(html);

    const elements = [];
    $('video').each((_, el) => {
      elements.push({
        tag: 'video', id: $(el).attr('id'),
        src: $(el).attr('src'),
        'data-hls-src': $(el).attr('data-hls-src'),
        'data-src': $(el).attr('data-src'),
      });
    });
    $('iframe').each((_, el) => {
      elements.push({ tag: 'iframe', src: $(el).attr('src'), 'data-src': $(el).attr('data-src') });
    });
    $('source').each((_, el) => {
      elements.push({ tag: 'source', src: $(el).attr('src') });
    });
    $('li.option, li[data-value]').each((_, el) => {
      elements.push({ tag: 'li.option', text: $(el).text().trim().substring(0,60), 'data-value': $(el).attr('data-value') });
    });
    $('select option').each((_, el) => {
      elements.push({ tag: 'option', text: $(el).text().trim(), value: $(el).attr('value') });
    });

    const playerSnippet = $('video#player, #serverSection, .plyr').first().toString().substring(0, 2000);

    res.json({ status: response.status, url: targetUrl, elements, playerSnippet, htmlLength: html.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', source: 'kuramanime', version: '3.3.0', base: BASE }));

// ─── STATIC ────────────────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/masuk', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`AniZone API berjalan di port ${PORT} | Mirror: ${BASE}`));

module.exports = app;
