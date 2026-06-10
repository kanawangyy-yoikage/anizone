const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// ─── CORS ──────────────────────────────────────────────────
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: false }));
app.options('*', cors());
app.use(express.json());

// ─── CONFIG ───────────────────────────────────────────────
const BASE_MIRRORS = [
  'https://v18.kuramanime.ing',
  'https://kuramanime.net',
  'https://kuramanime.pro',
];
let BASE = BASE_MIRRORS[0];
const MAL_API = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// Cookie kuramanime — set env var KURAMANIME_COOKIE di Railway
// Cara dapat: login di browser → DevTools > Application > Cookies → copy semua
// Pastikan include: cf_clearance, laravel_session, XSRF-TOKEN
const KURAMANIME_COOKIE = process.env.KURAMANIME_COOKIE || '';

// Proxy HTTP opsional — set PROXY_URL di Railway jika IP Railway diblokir
// Format: http://user:pass@host:port  atau  http://host:port
const PROXY_URL = process.env.PROXY_URL || '';

// ─── ROTATING USER AGENTS ─────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
];
let uaIdx = 0;
function nextUA() {
  const ua = USER_AGENTS[uaIdx % USER_AGENTS.length];
  uaIdx++;
  return ua;
}

function makeHeaders(referer) {
  const ua = nextUA();
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': referer || BASE + '/',
    ...(KURAMANIME_COOKIE ? { 'Cookie': KURAMANIME_COOKIE } : {}),
  };
}

// ─── AXIOS PROXY CONFIG ───────────────────────────────────
function proxyConfig() {
  if (!PROXY_URL) return {};
  try {
    const p = new URL(PROXY_URL);
    return {
      proxy: {
        protocol: p.protocol.replace(':', ''),
        host: p.hostname,
        port: parseInt(p.port) || 8080,
        ...(p.username ? { auth: { username: decodeURIComponent(p.username), password: decodeURIComponent(p.password) } } : {}),
      }
    };
  } catch { return {}; }
}

// ─── HELPER: delay ────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── CLOUDFLARE DETECT ────────────────────────────────────
function isCloudflareBlock($) {
  const title = $('title').text().toLowerCase();
  const body = $('body').text().toLowerCase();
  return (
    title.includes('just a moment') ||
    title.includes('cloudflare') ||
    body.includes('checking your browser') ||
    body.includes('enable javascript and cookies') ||
    body.includes('verify you are human')
  );
}

// ─── AUTO-DETECT MIRROR AKTIF ─────────────────────────────
async function detectWorkingMirror() {
  for (const mirror of BASE_MIRRORS) {
    try {
      const res = await axios.get(mirror, {
        headers: makeHeaders(mirror + '/'),
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: s => s < 500,
        ...proxyConfig(),
      });
      const $ = cheerio.load(res.data);
      if (!isCloudflareBlock($) && res.status < 400) {
        BASE = mirror;
        console.log(`[Mirror] Aktif: ${BASE}`);
        return;
      }
      if (isCloudflareBlock($)) {
        console.log(`[Mirror] Cloudflare block di ${mirror} — set KURAMANIME_COOKIE`);
      }
    } catch (e) {
      console.log(`[Mirror] Gagal ${mirror}: ${e.message}`);
    }
  }
  console.warn('[Mirror] Semua mirror gagal. Pakai default. Pastikan KURAMANIME_COOKIE sudah di-set.');
}
detectWorkingMirror();
setInterval(detectWorkingMirror, 10 * 60 * 1000);

// ─── FETCH HELPER ─────────────────────────────────────────
async function fetchPage(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await axios.get(url, {
        headers: makeHeaders(BASE + '/'),
        timeout: 20000,
        maxRedirects: 5,
        ...proxyConfig(),
      });
      const $ = cheerio.load(res.data);
      if (isCloudflareBlock($)) {
        throw new Error('Cloudflare block — set env var KURAMANIME_COOKIE (include cf_clearance)');
      }
      return $;
    } catch (e) {
      if (i === retries) throw e;
      await delay(1500 * (i + 1) + Math.random() * 500);
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
      type: 'Anime',
    });
  });

  return data;
}

async function search(query) {
  const url = `${BASE}/anime?search=${encodeURIComponent(query)}&order_by=latest`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();
  const BLACKLIST = /^(beranda|home|trending|jadwal|login|daftar|masuk|keluar|profil|profile|kategori|genre|search|cari|lainnya|selengkapnya|more|next|prev|previous|episode|batch|subtitle|sub indo|nonton|download|stream|server|kualitas|resolusi|bagikan|share|lapor|report|komentar|comment)$/i;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const isAnime = href.match(/\/anime\/\d+\/[^/]+$/) || href.match(/^https?:\/\/[^/]+\/anime\/\d+\/[^/]+$/);
    if (!isAnime || href.includes('/episode/')) return;
    if (text.length < 3 || text.length > 120 || BLACKLIST.test(text)) return;
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
    const epNum = href.match(/\/episode\/([\d.]+)/)?.[1] || href.match(/[\d]+$/)?.[0] || '';
    episodes.push({ title: text || `Episode ${epNum}`, url: fullHref, date: '' });
  }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.match(/\/episode\/[\d]/)) return;
    addEpisode(href, $(el).text().trim());
  });
  $('[data-href],[data-url],[data-episode-url],[data-src]').each((_, el) => {
    const href = $(el).attr('data-href') || $(el).attr('data-url') || $(el).attr('data-episode-url') || $(el).attr('data-src') || '';
    if (!href.match(/\/episode\/[\d]/)) return;
    addEpisode(href, $(el).text().trim());
  });
  $('[onclick]').each((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    const m = onclick.match(/['"` ]((?:[^'"` ]*)?\/episode\/[\d][^'"` ]*?)['"` ]/);
    if (!m) return;
    addEpisode(m[1], $(el).text().trim());
  });
  if (episodes.length === 0) {
    const rawHtml = $.html();
    const urlRegex = /["'` ]((?:https?:\/\/[^"'` \s]*)?(?:\/anime\/\d+\/[^"'` \s]*)?\/ episode\/[\d][^"'` \s<>]*?)['"` ]/g;
    let m;
    while ((m = urlRegex.exec(rawHtml)) !== null) addEpisode(m[1], '');
  }
  if (episodes.length === 0) {
    try { episodes.push(...(await fetchEpisodeList(targetUrl))); } catch {}
  }
  if (MAL_CLIENT_ID) {
    try { const d = await getMalDescription(title); if (d) description = d; } catch {}
  }
  return { title, image, description, episodes, info };
}

async function fetchEpisodeList(animeUrl) {
  const variants = [animeUrl + '?eps=1', animeUrl.replace(/\/anime\//, '/eps/'), animeUrl + '/episode'];
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

// ─── DOWNLOAD / STREAM SCRAPER ────────────────────────────
// Mengklasifikasi tiap stream sebagai 'hls', 'direct', atau 'embed'
// dan menambahkan proxyUrl yg siap dipakai frontend

function classifyStream(url) {
  if (!url) return 'embed';
  if (url.includes('.m3u8')) return 'hls';
  if (url.match(/\.(mp4|webm|mkv)(\?|$)/i)) return 'direct';
  return 'embed';
}

function buildProxyUrl(streamUrl, referer, req) {
  const type = classifyStream(streamUrl);
  const base = req ? `${req.protocol}://${req.get('host')}` : '';
  if (type === 'hls') {
    return `${base}/api/hls?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(referer)}`;
  }
  if (type === 'direct') {
    return `${base}/api/proxy?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(referer)}`;
  }
  // embed — tidak di-proxy, langsung digunakan sebagai iframe src
  return streamUrl;
}

async function download(link, req) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(targetUrl, {
    headers: makeHeaders(BASE + '/'),
    timeout: 20000,
    ...proxyConfig(),
  });
  const html = res.data;
  const $ = cheerio.load(html);

  if (isCloudflareBlock($)) throw new Error('Cloudflare block — set KURAMANIME_COOKIE');

  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Kuramanime\s*$/i, '').trim();
  const streams = [];
  const seen = new Set();

  function serverLabel(url, fallback) {
    try {
      const host = new URL(url.startsWith('//') ? 'https:' + url : url).hostname.replace(/^www\./, '');
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
    const type = classifyStream(full);
    const proxyUrl = buildProxyUrl(full, targetUrl, req);
    streams.push({ server: label || serverLabel(full), url: full, proxyUrl, type });
  }

  // 1. iframe
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) addStream(src, serverLabel(src));
  });

  // 2. video / source dengan berbagai atribut HLS kuramanime
  $('video, video source, source').each((_, el) => {
    ['src','data-src','data-hls-src','data-hls','data-video','data-file'].forEach(attr => {
      const v = $(el).attr(attr);
      if (v) addStream(v, attr.includes('hls') ? 'Kuramadrive' : 'Direct');
    });
  });

  // 3. Server-list kuramanime (li.option, select option)
  $('li.option, li[data-value], select option, [data-provider], [data-server], [data-stream], [data-mirror]').each((_, el) => {
    const url = $(el).attr('data-value') || $(el).attr('data-src') || $(el).attr('data-stream')
              || $(el).attr('data-provider') || $(el).attr('data-server')
              || $(el).attr('data-mirror') || $(el).attr('value') || '';
    const label = $(el).text().trim().replace(/\(.*?\)/g, '').trim() || $(el).attr('data-name') || '';
    if (url && (url.startsWith('http') || url.startsWith('//'))) addStream(url, label || serverLabel(url));
  });

  // 3b. form#serverForm
  $('form#serverForm input, form#serverForm select option, #serverSection input, #serverSection option').each((_, el) => {
    const url = $(el).attr('value') || $(el).attr('data-src') || '';
    const label = $(el).attr('name') || $(el).text().trim() || '';
    if (url && (url.startsWith('http') || url.startsWith('//'))) addStream(url, label || serverLabel(url));
  });

  // 4. data-src / data-hls-src global
  $('[data-src],[data-hls-src],[data-hls],[data-file]').each((_, el) => {
    ['data-hls-src','data-hls','data-src','data-file'].forEach(attr => {
      const v = $(el).attr(attr);
      if (v && (v.startsWith('http') || v.startsWith('//'))) {
        addStream(v, $(el).attr('data-name') || $(el).attr('title') || serverLabel(v));
      }
    });
  });

  // 5. Script inline
  $('script').each((_, el) => {
    const code = $(el).html() || '';
    for (const m of code.matchAll(/"(?:url|src|stream|embed|iframe|file|hls)"\s*:\s*"(https?:\/\/[^"]+)"/gi))
      addStream(m[1], serverLabel(m[1]));
    for (const m of code.matchAll(/(?:streamUrl|embedUrl|iframeUrl|playerUrl|videoUrl|mirrorUrl|hlsUrl|fileUrl)\s*=\s*["'`](https?:\/\/[^"'`\n]+)["'`]/gi))
      addStream(m[1], serverLabel(m[1]));
    for (const m of code.matchAll(/\{[^{}]{0,200}"?server"?\s*:\s*"([^"]+)"[^{}]{0,200}"?(?:url|src|file)"?\s*:\s*"(https?:\/\/[^"]+)"[^{}]{0,200}\}/gi))
      addStream(m[2], m[1]);
    for (const m of code.matchAll(/\{[^{}]{0,200}"?(?:url|src|file)"?\s*:\s*"(https?:\/\/[^"]+)"[^{}]{0,200}"?server"?\s*:\s*"([^"]+)"[^{}]{0,200}\}/gi))
      addStream(m[1], m[2]);
  });

  // 6. Fallback: scan raw HTML untuk domain streaming
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
      params: { q: title, limit: 1, fields: 'synopsis' },
    });
    return res.data?.data?.[0]?.node?.synopsis || null;
  } catch { return null; }
}

async function getMalAnime(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { q: title, limit: 1, fields: 'synopsis,mean,genres,status,num_episodes,start_season,main_picture,rank,popularity' },
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
      params: { limit: 50, fields: 'start_date,mean,num_episodes,status,genres,main_picture,broadcast', sort: 'anime_num_list_users' },
    });
    return res.data?.data?.map(d => ({
      id: d.node.id, title: d.node.title,
      image: d.node.main_picture?.medium || d.node.main_picture?.large,
      score: d.node.mean || 'N/A', episodes: d.node.num_episodes || '?',
      status: d.node.status, genres: d.node.genres?.map(g => g.name).slice(0, 3) || [],
      broadcast: d.node.broadcast, startDate: d.node.start_date, season: `${season} ${year}`,
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
      params: { ranking_type: 'airing', limit: 20, fields: 'mean,genres,num_episodes,status,main_picture,rank' },
    });
    return res.data?.data?.map(d => ({
      rank: d.ranking?.rank, title: d.node.title,
      image: d.node.main_picture?.medium || d.node.main_picture?.large,
      score: d.node.mean || 'N/A', episodes: d.node.num_episodes || '?',
      genres: d.node.genres?.map(g => g.name).slice(0, 2) || [], malId: d.node.id,
    })) || [];
  } catch { return getScrapedTrending(); }
}

async function getScrapedTrending() {
  try {
    const $ = await fetchPage(`${BASE}/quick/ongoing?order_by=popular`);
    const data = []; const seen = new Set();
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
    const res = await axios.get('https://animenewsnetwork.com/newsroom/', {
      headers: makeHeaders('https://animenewsnetwork.com/'),
      timeout: 12000,
    });
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
          title, url: href ? (href.startsWith('http') ? href : 'https://animenewsnetwork.com' + href) : '#',
          image: img || '', description: desc.substring(0, 200),
          date: date || new Date().toLocaleDateString('id-ID'),
        });
      }
    });
    if (news.length > 0) return news.slice(0, 12);
    const latest = await animeterbaru(1);
    return latest.slice(0, 8).map(a => ({
      title: `Update: ${a.title} Episode ${a.episode} Tersedia`,
      url: a.episodeUrl || a.url, image: a.image,
      description: `Episode terbaru dari ${a.title} sudah dapat ditonton di AniZone.`,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
    }));
  } catch {
    return [{ title: 'AniZone 2026', url: '#', image: '', description: 'Selamat datang di AniZone.', date: new Date().toLocaleDateString('id-ID') }];
  }
}

// ═══════════════════════════════════════════════════════════
// ─── PROXY ROUTES ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

// Domain yang diizinkan di proxy (cegah penyalahgunaan sebagai open proxy)
const PROXY_ALLOWED_HOSTS = [
  'kuramadrive', 'kuramanime', 'streamtape', 'doodstream', 'dood.',
  'filemoon', 'mega.nz', 'ok.ru', 'mp4upload', 'streamlare',
  'upstream', 'mixdrop', 'fembed', 'vidstream', 'animenewsnetwork',
];

function isAllowedProxyHost(urlStr) {
  try {
    const host = new URL(urlStr).hostname;
    return PROXY_ALLOWED_HOSTS.some(d => host.includes(d));
  } catch { return false; }
}

// ─── /api/proxy — pipe konten HTTP ke client ──────────────
// Digunakan untuk video .mp4, segmen .ts HLS, dll.
// Mendukung Range request (seek video)
app.get('/api/proxy', async (req, res) => {
  const targetUrl = decodeURIComponent(req.query.url || '');
  const referer = req.query.referer ? decodeURIComponent(req.query.referer) : BASE + '/';

  if (!targetUrl) return res.status(400).json({ error: 'url wajib diisi' });
  if (!isAllowedProxyHost(targetUrl)) return res.status(403).json({ error: 'Domain tidak diizinkan' });

  try {
    const reqHeaders = {
      ...makeHeaders(referer),
      'Origin': new URL(referer).origin,
    };
    if (req.headers.range) reqHeaders['Range'] = req.headers.range;

    const response = await axios.get(targetUrl, {
      headers: reqHeaders,
      responseType: 'stream',
      timeout: 60000,
      maxRedirects: 5,
      ...proxyConfig(),
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
    if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);
    res.setHeader('Accept-Ranges', response.headers['accept-ranges'] || 'bytes');

    res.status(response.status);
    response.data.pipe(res);
    req.on('close', () => { try { response.data.destroy(); } catch {} });
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: e.message });
  }
});

// ─── /api/hls — proxy + rewrite m3u8 manifest ────────────
// Rewrite semua URL segmen/sub-manifest supaya lewat /api/proxy atau /api/hls
app.get('/api/hls', async (req, res) => {
  const targetUrl = decodeURIComponent(req.query.url || '');
  const referer = req.query.referer ? decodeURIComponent(req.query.referer) : BASE + '/';

  if (!targetUrl) return res.status(400).json({ error: 'url wajib diisi' });

  try {
    const response = await axios.get(targetUrl, {
      headers: makeHeaders(referer),
      timeout: 15000,
      ...proxyConfig(),
    });

    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

    const rewritten = text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const segUrl = trimmed.startsWith('http') ? trimmed
                   : trimmed.startsWith('//') ? 'https:' + trimmed
                   : baseUrl + trimmed;

      // Sub-manifest → lewat /api/hls lagi (rekursif)
      if (trimmed.includes('.m3u8')) {
        return `/api/hls?url=${encodeURIComponent(segUrl)}&referer=${encodeURIComponent(targetUrl)}`;
      }
      // Segmen video/audio → lewat /api/proxy
      return `/api/proxy?url=${encodeURIComponent(segUrl)}&referer=${encodeURIComponent(targetUrl)}`;
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewritten);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ─── /api/player — embedded video player (dimuat di iframe) ─
// Halaman HTML ringan dengan hls.js untuk memutar HLS atau MP4
app.get('/api/player', (req, res) => {
  const streamUrl = decodeURIComponent(req.query.url || '');
  const streamType = req.query.type || 'hls'; // 'hls' | 'direct'
  const title = decodeURIComponent(req.query.title || '');

  if (!streamUrl) return res.status(400).send('url wajib');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/</g,'&lt;')}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#000; display:flex; align-items:center; justify-content:center; height:100vh; overflow:hidden; }
  video { width:100%; height:100vh; outline:none; }
  #err { color:#fff; font-family:sans-serif; text-align:center; padding:20px; display:none; }
  #err a { color:#7c6af9; }
</style>
</head>
<body>
<video id="v" controls autoplay playsinline preload="auto"></video>
<div id="err"></div>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>
<script>
const video = document.getElementById('v');
const err   = document.getElementById('err');
const src   = ${JSON.stringify(streamUrl)};
const type  = ${JSON.stringify(streamType)};

function showError(msg) {
  video.style.display = 'none';
  err.style.display = 'block';
  err.innerHTML = '<p style="margin-bottom:12px">Gagal memuat video:<br>' + msg + '</p>';
}

if (type === 'hls' || src.includes('.m3u8')) {
  if (Hls.isSupported()) {
    const hls = new Hls({ enableWorker: false, lowLatencyMode: false });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(()=>{}));
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (d.fatal) showError(d.details);
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    video.play().catch(()=>{});
  } else {
    showError('Browser tidak mendukung HLS.');
  }
} else {
  video.src = src;
  video.play().catch(()=>{});
  video.onerror = () => showError(video.error?.message || 'Unknown error');
}
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.send(html);
});

// ─── /api/debug-watch ─────────────────────────────────────
app.get('/api/debug-watch', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const response = await axios.get(targetUrl, {
      headers: makeHeaders(BASE + '/'),
      timeout: 20000,
      ...proxyConfig(),
    });
    const html = response.data;
    const $ = cheerio.load(html);
    const cloudflare = isCloudflareBlock($);
    const elements = [];
    $('video').each((_, el) => elements.push({ tag:'video', id:$(el).attr('id'), src:$(el).attr('src'), 'data-hls-src':$(el).attr('data-hls-src'), 'data-src':$(el).attr('data-src'), 'data-file':$(el).attr('data-file') }));
    $('iframe').each((_, el) => elements.push({ tag:'iframe', src:$(el).attr('src'), 'data-src':$(el).attr('data-src') }));
    $('source').each((_, el) => elements.push({ tag:'source', src:$(el).attr('src') }));
    $('li.option, li[data-value]').each((_, el) => elements.push({ tag:'li.option', text:$(el).text().trim().substring(0,60), 'data-value':$(el).attr('data-value') }));
    $('select option').each((_, el) => elements.push({ tag:'option', text:$(el).text().trim(), value:$(el).attr('value') }));
    res.json({ status:response.status, url:targetUrl, cloudflare, elements, htmlLength:html.length, cookieSet:!!KURAMANIME_COOKIE, proxySet:!!PROXY_URL });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ═══════════════════════════════════════════════════════════
// ─── API ROUTES ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

app.get('/api/mirror', (req, res) => res.json({ base: BASE, cookieSet: !!KURAMANIME_COOKIE, proxySet: !!PROXY_URL }));

app.get('/api/latest', async (req, res) => {
  try { res.json(await animeterbaru(req.query.page || 1)); }
  catch (e) { res.status(500).json({ error: e.message, hint: 'Coba set env var KURAMANIME_COOKIE', base: BASE }); }
});

app.get('/api/image', async (req, res) => {
  try { res.json({ image: await getAnimeImage(req.query.url) }); }
  catch { res.json({ image: '' }); }
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
  try { res.json(await download(req.query.url, req)); }
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

app.get('/api/health', (req, res) => res.json({
  status: 'ok', source: 'kuramanime', version: '3.4.0',
  base: BASE, cookieSet: !!KURAMANIME_COOKIE, proxySet: !!PROXY_URL,
}));

// ─── STATIC ────────────────────────────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/masuk', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('*',       (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`AniZone API port ${PORT} | Mirror: ${BASE} | Cookie: ${KURAMANIME_COOKIE ? 'OK' : 'NOT SET'} | Proxy: ${PROXY_URL || 'none'}`)
);

module.exports = app;
