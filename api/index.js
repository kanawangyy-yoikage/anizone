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
// Mirror otakudesu — coba dari yang paling baru
const BASE_MIRRORS = [
  'https://otakudesu.blog',
  'https://otakudesu.cloud',
  'https://otakudesu.lol',
  'https://otakudesu.cam',
  'https://otakudesu.ink',
];
let BASE = BASE_MIRRORS[0];
const MAL_API = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// Proxy HTTP opsional — set PROXY_URL di Railway jika IP diblokir
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
        console.log(`[Mirror] Cloudflare block di ${mirror}`);
      }
    } catch (e) {
      console.log(`[Mirror] Gagal ${mirror}: ${e.message}`);
    }
  }
  console.warn('[Mirror] Semua mirror gagal. Pakai default.');
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
        throw new Error('Cloudflare block — coba set PROXY_URL atau tunggu beberapa menit');
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

// ─── SCRAPERS OTAKUDESU ───────────────────────────────────
//
// Struktur halaman otakudesu:
//   Ongoing  : BASE/?page=N  → div.venz > ul > li  dengan class .episodelist
//   Completed: BASE/complete-anime/?page=N → sama
//   Search   : BASE/?s=QUERY → div.chivsrc > ul > li
//   Detail   : BASE/anime/SLUG/  → div.infoanime, div.episodelist
//   Episode  : BASE/episode/SLUG/ → div.nonton-embed iframe, div.download-eps
//
// Semua URL bersifat "slug-based":
//   Anime  : https://otakudesu.blog/anime/shingeki-no-kyojin-sub-indo/
//   Episode: https://otakudesu.blog/episode/snk-episode-1-sub-indo/

// ─── anime terbaru (ongoing) ─────────────────────────────
async function animeterbaru(page = 1) {
  const url = page > 1 ? `${BASE}/?page=${page}` : `${BASE}/`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();

  // Otakudesu struktur HTML (berlaku untuk semua domain mirror):
  //   div.venz > ul > li  — setiap item ongoing
  //     img               — thumbnail anime
  //     h2.jdlflm > a     — judul + link ke halaman anime
  //     div.epz           — nomor episode terbaru, mis. "Episode 12"
  //     div.epztipe       — status, mis. "Ongoing"
  //     div.newnime       — link ke episode terbaru (href di <a>)
  //
  // Fallback: beberapa mirror pakai class berbeda:
  //   div.chblock, div.dcblock, article.episodio

  function extractItems(selector, titleSel, imgSel, epSel, typeSel, epLinkSel) {
    $(selector).each((_, el) => {
      const a = $(el).find(titleSel).first();
      const title = a.text().trim();
      const href = a.attr('href') || '';
      if (!href || !title || title.length < 2) return;
      if (seen.has(href)) return;
      seen.add(href);

      // Image: coba semua atribut lazy-load umum
      const imgEl = $(el).find(imgSel).first();
      const image = imgEl.attr('src') || imgEl.attr('data-src')
        || imgEl.attr('data-lazy-src') || imgEl.attr('data-original') || '';

      // Episode number
      const epText = $(el).find(epSel).text().trim();
      const epMatch = epText.match(/(\d+(?:\.\d+)?)/);
      const episode = epMatch ? epMatch[1] : '?';

      const type = $(el).find(typeSel).text().trim() || 'Anime';

      // episodeUrl: link langsung ke episode terbaru jika ada
      let episodeUrl = href;
      if (epLinkSel) {
        const epA = $(el).find(epLinkSel + ' a').first();
        const epHref = epA.attr('href') || '';
        if (epHref) episodeUrl = epHref.startsWith('http') ? epHref : BASE + epHref;
      }

      data.push({
        title,
        url: href.startsWith('http') ? href : BASE + href,
        episodeUrl,
        image,
        episode,
        totalEpisode: '?',
        score: 'N/A',
        type,
      });
    });
  }

  // Coba selector utama otakudesu
  extractItems('div.venz ul li', 'h2.jdlflm a', 'img', 'div.epz', 'div.epztipe', 'div.newnime');

  // Fallback 1: beberapa mirror pakai div.chblock
  if (data.length === 0) {
    extractItems('div.chblock', '.name a, h2 a, .title a', 'img', '.chapter, .episode, .epz', '.type, .status', null);
  }

  // Fallback 2: WordPress theme lainnya yang kadang dipakai mirror
  if (data.length === 0) {
    extractItems('article.episodio, div.episodiotitle', 'a', 'img', '.numerando, .epnumber', '.genres a', null);
  }

  // Fallback 3: ambil semua link anime dari halaman jika semua gagal
  if (data.length === 0) {
    $('a[href*="/anime/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      if (!href || !title || title.length < 2 || seen.has(href)) return;
      if (title.length > 120 || /^(home|beranda|search|login|kategori)/i.test(title)) return;
      seen.add(href);
      const image = $(el).find('img').attr('src') || $(el).find('img').attr('data-src') || '';
      data.push({
        title,
        url: href.startsWith('http') ? href : BASE + href,
        episodeUrl: href.startsWith('http') ? href : BASE + href,
        image,
        episode: '?',
        totalEpisode: '?',
        score: 'N/A',
        type: 'Anime',
      });
    });
  }

  return data;
}

// ─── search ───────────────────────────────────────────────
async function search(query) {
  const url = `${BASE}/?s=${encodeURIComponent(query)}`;
  const $ = await fetchPage(url);
  const data = [];
  const seen = new Set();

  const BLACKLIST = /^(beranda|home|trending|jadwal|login|daftar|masuk|keluar|profil|kategori|genre|search|cari|lainnya|more|next|prev|previous|episode|batch|subtitle|download|stream|server|komentar)$/i;

  function addResult(href, title, imgEl, genreEl, statusEl, ratingEl) {
    if (!href || !title || title.length < 2 || title.length > 120) return;
    if (BLACKLIST.test(title.trim())) return;
    if (/^[\d\s\-_.]+$/.test(title)) return;
    const fullHref = href.startsWith('http') ? href : BASE + href;
    if (seen.has(fullHref)) return;
    seen.add(fullHref);
    const image = imgEl ? (imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || '') : '';
    const genres = [];
    if (genreEl) genreEl.find('a').each((_, g) => genres.push($(g).text().trim()));
    const status = statusEl ? statusEl.text().trim() : '';
    const rating = ratingEl ? ratingEl.text().replace(/rating/i, '').trim() : '';
    data.push({ title, url: fullHref, image, type: status || 'Anime', score: rating || 'N/A', genres });
  }

  // Selector utama otakudesu search: div.chivsrc ul li
  $('div.chivsrc ul li').each((_, el) => {
    const a = $(el).find('h2 a, .name a, h3 a').first();
    addResult(
      a.attr('href') || '',
      a.text().trim(),
      $(el).find('img').first(),
      $(el).find('div.set span.lm'),
      $(el).find('div.set span.lm').last(),
      $(el).find('div.epzt')
    );
  });

  // Fallback: hasil search kadang ada di div.venz atau artikel biasa
  if (data.length === 0) {
    $('a[href*="/anime/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim() || $(el).find('img').attr('alt') || '';
      if (!href.match(/\/anime\/[^/]+\/?$/) || href.includes('/episode/')) return;
      addResult(href, title, $(el).find('img').first(), null, null, null);
    });
  }

  return data;
}

// ─── detail anime ─────────────────────────────────────────
async function detail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const $ = await fetchPage(targetUrl);

  const image = $('meta[property="og:image"]').attr('content')
    || $('div.fotoanime img').attr('src')
    || $('div.infoanime img').attr('src')
    || '';
  if (image) imageCache.set(targetUrl, image);

  const rawTitle = $('title').text().trim();
  // Hapus suffix " – Otakudesu" atau " - Otakudesu" dari title
  const title = rawTitle.replace(/\s*[-–]\s*Otakudesu\s*$/i, '').trim()
    || $('h1.entry-title').text().trim()
    || $('div.infoanime h1').text().trim();

  // Synopsis
  let description = $('div.sinopc').text().trim()
    || $('meta[property="og:description"]').attr('content')
    || $('meta[name="description"]').attr('content')
    || '';

  // Info tabel (judul_jepang, studio, skor, dll)
  const info = {};
  $('div.infoanime table tr, div.infozin span').each((_, el) => {
    const text = $(el).text().trim();
    const colonIdx = text.indexOf(':');
    if (colonIdx < 1 || colonIdx > 40) return;
    const key = text.substring(0, colonIdx).trim().toLowerCase().replace(/\s+/g, '_');
    const val = text.substring(colonIdx + 1).trim().split('\n')[0].trim();
    if (key && val && val.length < 200) info[key] = val;
  });

  // Daftar episode
  const episodes = [];
  const epSeen = new Set();

  // Otakudesu menyimpan daftar episode di div.episodelist ul li a
  $('div.episodelist ul li a, div.lstsz ul li a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!href || epSeen.has(href)) return;
    epSeen.add(href);
    episodes.push({
      title: text || `Episode`,
      url: href.startsWith('http') ? href : BASE + href,
      date: $(el).closest('li').find('span.zeebr').text().trim() || '',
    });
  });

  if (MAL_CLIENT_ID) {
    try { const d = await getMalDescription(title); if (d) description = d; } catch {}
  }

  return { title, image, description, episodes, info };
}

// ─── download / stream dari halaman episode ───────────────
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

  if (isCloudflareBlock($)) throw new Error('Cloudflare block — coba set PROXY_URL');

  const rawTitle = $('title').text().trim();
  const title = rawTitle.replace(/\s*[-–]\s*Otakudesu\s*$/i, '').trim();
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
    const full = url.startsWith('//')  ? 'https:' + url
               : url.startsWith('http') ? url
               : BASE + url;
    if (seen.has(full)) return;
    seen.add(full);
    const type = classifyStream(full);
    const proxyUrl = buildProxyUrl(full, targetUrl, req);
    streams.push({ server: label || serverLabel(full), url: full, proxyUrl, type });
  }

  // 1. iframe streaming — otakudesu pakai div.nonton-embed > iframe
  $('div.nonton-embed iframe, div.embed-responsive iframe, #embed iframe, iframe[src*="desustream"], iframe[src*="desusub"], iframe[src*="otakustream"], iframe[src*="play"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) addStream(src, serverLabel(src));
  });

  // Semua iframe lainnya sebagai fallback
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) addStream(src, serverLabel(src));
  });

  // 2. video / source tag
  $('video, video source, source').each((_, el) => {
    ['src','data-src','data-hls-src','data-hls','data-video','data-file'].forEach(attr => {
      const v = $(el).attr(attr);
      if (v) addStream(v, attr.includes('hls') ? 'Desustream' : 'Direct');
    });
  });

  // 3. Tombol server otakudesu — li.server dengan data-* atau onclick
  // Otakudesu: ul.server-list li[data-server], atau button[data-src], span.server
  $('li[data-server], li[data-src], button[data-src], [data-server], [data-mirror]').each((_, el) => {
    const url = $(el).attr('data-server') || $(el).attr('data-src') || $(el).attr('data-mirror') || '';
    const label = $(el).text().trim() || $(el).attr('data-name') || '';
    if (url && (url.startsWith('http') || url.startsWith('//'))) addStream(url, label || serverLabel(url));
  });

  // 4. div.mirrorstream, div.stream-server — struktur otakudesu modern
  $('div.mirrorstream ul li, div.stream-server ul li').each((_, el) => {
    const a = $(el).find('a').first();
    const url = a.attr('href') || a.attr('data-src') || $(el).attr('data-src') || '';
    const label = a.text().trim() || $(el).text().trim() || '';
    if (url && url !== '#') addStream(url, label || serverLabel(url));
  });

  // 5. Script inline — cari URL streaming
  $('script').each((_, el) => {
    const code = $(el).html() || '';

    // pola JSON key-value standar
    for (const m of code.matchAll(/"(?:url|src|stream|embed|iframe|file|hls|video|player)"\s*:\s*"(https?:\/\/[^"]+)"/gi))
      addStream(m[1], serverLabel(m[1]));

    // pola assignment JS
    for (const m of code.matchAll(/(?:streamUrl|embedUrl|iframeUrl|playerUrl|videoUrl|mirrorUrl|hlsUrl|fileUrl|epsUrl|watchUrl|streamLink|playUrl)\s*=\s*["'`](https?:\/\/[^"'`\n]+)["'`]/gi))
      addStream(m[1], serverLabel(m[1]));

    // pola {label, file} — banyak dipakai player JW / Plyr
    for (const m of code.matchAll(/\{[^{}]{0,300}"?(?:label|name|title)"?\s*:\s*"([^"]+)"[^{}]{0,300}"?(?:file|src|url|hls)"?\s*:\s*"(https?:\/\/[^"]+)"[^{}]{0,300}\}/gi))
      addStream(m[2], m[1]);
    for (const m of code.matchAll(/\{[^{}]{0,300}"?(?:file|src|url|hls)"?\s*:\s*"(https?:\/\/[^"]+)"[^{}]{0,300}"?(?:label|name|title)"?\s*:\s*"([^"]+)"[^{}]{0,300}\}/gi))
      addStream(m[1], m[2]);

    // pola var/const/let = URL video langsung
    for (const m of code.matchAll(/(?:var|const|let)\s+\w+\s*=\s*["'`](https?:\/\/[^"'`\n]*\.(?:m3u8|mp4|webm)[^"'`\n]*)["'`]/gi))
      addStream(m[1], serverLabel(m[1]));

    // pola setup/init player
    for (const m of code.matchAll(/(?:setup|init|load|source|setSource)\s*\(\s*\{[^}]{0,400}["'](?:file|src|url)["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi))
      addStream(m[1], serverLabel(m[1]));
  });

  // 6. Fallback: domain streaming yang umum dipakai otakudesu
  if (streams.length === 0) {
    const pat = /https?:\/\/(?:[a-z0-9-]+\.)?(?:desustream|desusub|desuvid|otakustream|filemoon|streamtape|doodstream|dood\.|mega\.nz|ok\.ru|mp4upload|streamlare|upstream|mixdrop|fembed|vidstream|statically)[^\s"'<>]+/gi;
    for (const m of html.matchAll(pat)) addStream(m[0], serverLabel(m[0]));
  }

  // 7. Last resort: semua URL .m3u8 atau .mp4 dari raw HTML
  if (streams.length === 0) {
    const pat = /https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4|webm)(?:\?[^\s"'<>]*)?/gi;
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
  // Otakudesu tidak punya halaman jadwal khusus per hari,
  // gunakan halaman ongoing sebagai fallback jadwal
  try {
    const $ = await fetchPage(`${BASE}/`);
    const allItems = [];
    const seen = new Set();
    $('div.venz ul li').each((_, el) => {
      const a = $(el).find('h2.jdlflm a').first();
      const title = a.text().trim();
      const href = a.attr('href') || '';
      if (!href || !title || seen.has(href)) return;
      seen.add(href);
      const image = $(el).find('img').attr('src') || '';
      allItems.push({ title, url: href, day: 'ongoing', image, score: 'N/A' });
    });
    return allItems.slice(0, 60);
  } catch { return []; }
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
    // Coba halaman ongoing dulu, fallback ke homepage
    const urls = [`${BASE}/ongoing-anime/`, `${BASE}/`];
    for (const pageUrl of urls) {
      try {
        const $ = await fetchPage(pageUrl);
        const data = []; const seen = new Set();
        // Selector utama
        $('div.venz ul li, div.chblock, .anime-list li').each((_, el) => {
          const a = $(el).find('h2.jdlflm a, h2 a, .name a, h3 a').first();
          const title = a.text().trim();
          const href = a.attr('href') || '';
          if (!href || !title || seen.has(href)) return;
          seen.add(href);
          const imgEl = $(el).find('img').first();
          const image = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || '';
          data.push({ title, url: href.startsWith('http') ? href : BASE + href, image, score: 'N/A' });
        });
        if (data.length > 0) return data.slice(0, 20);
      } catch {}
    }
    return [];
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

const PROXY_ALLOWED_HOSTS = [
  'desustream', 'desusub', 'desuvid', 'otakustream',
  'streamtape', 'doodstream', 'dood.',
  'filemoon', 'mega.nz', 'ok.ru', 'mp4upload', 'streamlare',
  'upstream', 'mixdrop', 'fembed', 'vidstream', 'statically',
  'animenewsnetwork',
  // Mirror otakudesu
  'otakudesu.blog', 'otakudesu.cloud', 'otakudesu.lol',
  'otakudesu.cam', 'otakudesu.ink',
  // CDN umum
  'cdn.statically', 'statically.io',
  'storage.googleapis', 'drive.google',
  'cdn.jsdelivr',
];

function isAllowedProxyHost(urlStr) {
  try {
    const host = new URL(urlStr).hostname;
    return PROXY_ALLOWED_HOSTS.some(d => host.includes(d));
  } catch { return false; }
}

// ─── /api/proxy — pipe konten HTTP ke client ──────────────
app.get('/api/proxy', async (req, res) => {
  const targetUrl = decodeURIComponent(req.query.url || '');
  const referer = req.query.referer ? decodeURIComponent(req.query.referer) : BASE + '/';

  if (!targetUrl) return res.status(400).json({ error: 'url wajib diisi' });
  if (!isAllowedProxyHost(targetUrl)) return res.status(403).json({ error: 'Domain tidak diizinkan', host: (() => { try { return new URL(targetUrl).hostname; } catch { return targetUrl; } })() });

  try {
    let origin;
    try { origin = new URL(referer).origin; } catch { origin = BASE; }

    const reqHeaders = {
      ...makeHeaders(referer),
      'Origin': origin,
      'Referer': referer,
    };
    if (req.headers.range) reqHeaders['Range'] = req.headers.range;

    const response = await axios.get(targetUrl, {
      headers: reqHeaders,
      responseType: 'stream',
      timeout: 60000,
      maxRedirects: 10,
      ...proxyConfig(),
    });

    if (response.status >= 400) {
      if (!res.headersSent) return res.status(response.status).json({ error: `CDN returned ${response.status}`, url: targetUrl });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
    if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);
    res.setHeader('Accept-Ranges', response.headers['accept-ranges'] || 'bytes');

    res.status(response.status);
    response.data.pipe(res);
    req.on('close', () => { try { response.data.destroy(); } catch {} });
  } catch (e) {
    if (!res.headersSent) res.status(502).json({ error: e.message, url: targetUrl });
  }
});

// ─── /api/hls — proxy + rewrite m3u8 manifest ────────────
app.get('/api/hls', async (req, res) => {
  const targetUrl = decodeURIComponent(req.query.url || '');
  const referer = req.query.referer ? decodeURIComponent(req.query.referer) : BASE + '/';

  if (!targetUrl) return res.status(400).json({ error: 'url wajib diisi' });

  if (!isAllowedProxyHost(targetUrl)) {
    return res.status(403).json({ error: 'Domain tidak diizinkan', host: (() => { try { return new URL(targetUrl).hostname; } catch { return targetUrl; } })() });
  }

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        ...makeHeaders(referer),
        'Referer': referer,
      },
      timeout: 15000,
      maxRedirects: 10,
      ...proxyConfig(),
    });

    if (response.status >= 400) {
      return res.status(response.status).json({ error: `CDN returned ${response.status}`, url: targetUrl });
    }

    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

    const rewritten = text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const segUrl = trimmed.startsWith('http') ? trimmed
                   : trimmed.startsWith('//') ? 'https:' + trimmed
                   : baseUrl + trimmed;

      if (trimmed.match(/\.m3u8/i)) {
        return `/api/hls?url=${encodeURIComponent(segUrl)}&referer=${encodeURIComponent(targetUrl)}`;
      }
      return `/api/proxy?url=${encodeURIComponent(segUrl)}&referer=${encodeURIComponent(targetUrl)}`;
    }).join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewritten);
  } catch (e) {
    res.status(502).json({ error: e.message, url: targetUrl });
  }
});

// ─── /api/player — embedded video player ─────────────────
app.get('/api/player', (req, res) => {
  const streamUrl = decodeURIComponent(req.query.url || '');
  const streamType = req.query.type || 'hls';
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

// ─── /api/debug-html ──────────────────────────────────────
app.get('/api/debug-html', async (req, res) => {
  const targetUrl = req.query.url;
  const keyword   = req.query.q || 'episode';
  if (!targetUrl) return res.status(400).json({ error: 'url wajib' });
  try {
    const response = await axios.get(targetUrl, {
      headers: makeHeaders(BASE + '/'),
      timeout: 20000,
      ...proxyConfig(),
    });
    const html = response.data;
    const lines = html.split('\n')
      .map((l, i) => ({ n: i + 1, l: l.trim() }))
      .filter(x => x.l.toLowerCase().includes(keyword.toLowerCase()) && x.l.length < 600)
      .slice(0, 60);
    res.json({ keyword, total: lines.length, htmlLength: html.length, lines });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    $('div.nonton-embed, div.embed-responsive').each((_, el) => elements.push({ tag:'nonton-embed', html:$(el).html()?.substring(0,200) }));
    res.json({ status:response.status, url:targetUrl, cloudflare, elements, htmlLength:html.length, activeMirror: BASE, proxySet:!!PROXY_URL });
  } catch (e) { res.status(500).json({ error:e.message }); }
});

// ═══════════════════════════════════════════════════════════
// ─── API ROUTES ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

app.get('/api/mirror', (req, res) => res.json({ base: BASE, proxySet: !!PROXY_URL }));

// ─── /api/debug-scrape — cek apakah scraping bekerja ─────
// Panggil: /api/debug-scrape
// Return: sample data mentah dari halaman otakudesu + info selector
app.get('/api/debug-scrape', async (req, res) => {
  try {
    const $ = await fetchPage(BASE + '/');
    const info = {
      activeMirror: BASE,
      title: $('title').text(),
      isCloudflare: isCloudflareBlock($),
      selectors: {
        'div.venz ul li': $('div.venz ul li').length,
        'div.chblock': $('div.chblock').length,
        'h2.jdlflm a': $('h2.jdlflm a').length,
        'a[href*="/anime/"]': $('a[href*="/anime/"]').length,
        'img': $('img').length,
      },
      sampleItems: [],
    };
    // ambil max 3 item sample
    $('div.venz ul li').slice(0, 3).each((_, el) => {
      const a = $(el).find('h2.jdlflm a').first();
      info.sampleItems.push({
        title: a.text().trim(),
        href: a.attr('href'),
        image: $(el).find('img').attr('src') || $(el).find('img').attr('data-src'),
        epz: $(el).find('div.epz').text().trim(),
      });
    });
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message, activeMirror: BASE });
  }
});

app.get('/api/stream-test', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'url wajib' });
  try {
    const { title, streams } = await download(targetUrl, req);
    const tested = await Promise.all(streams.map(async s => {
      let accessible = false;
      let statusCode = 0;
      let errorMsg = '';
      let contentType = '';
      try {
        const r = await axios.head(s.url.startsWith('//') ? 'https:' + s.url : s.url, {
          headers: {
            ...makeHeaders(targetUrl),
            'Referer': targetUrl,
          },
          timeout: 8000,
          maxRedirects: 5,
          validateStatus: () => true,
          ...proxyConfig(),
        });
        statusCode = r.status;
        contentType = r.headers['content-type'] || '';
        accessible = r.status < 400;
      } catch (e) { errorMsg = e.message; }
      return { ...s, accessible, statusCode, contentType, error: errorMsg || undefined };
    }));
    res.json({
      title,
      episodeUrl: targetUrl,
      streamCount: streams.length,
      activeMirror: BASE,
      streams: tested,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, hint: 'Coba /api/debug-watch?url=... untuk lihat raw HTML' });
  }
});

app.get('/api/latest', async (req, res) => {
  try { res.json(await animeterbaru(req.query.page || 1)); }
  catch (e) { res.status(500).json({ error: e.message, hint: 'Pastikan mirror otakudesu aktif', base: BASE }); }
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
  status: 'ok', source: 'otakudesu', version: '4.0.0',
  base: BASE, proxySet: !!PROXY_URL,
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
  console.log(`AniZone API port ${PORT} | Source: otakudesu | Mirror: ${BASE} | Proxy: ${PROXY_URL || 'none'}`)
);

module.exports = app;
