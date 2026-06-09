const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache'
};

const BASE          = 'https://otakudesu.blog';
const CORS_PROXIES  = [
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];
const MAL_API       = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// ─── HELPERS ──────────────────────────────────────────────

function toAbs(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BASE + (url.startsWith('/') ? url : '/' + url);
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// axGet: coba langsung dulu, kalau gagal coba tiap CORS proxy satu per satu
async function axGet(url, extraHeaders = {}) {
  const cfg = {
    headers: { ...headers, Referer: BASE + '/', ...extraHeaders },
    timeout: 20000
  };

  // 1. Coba langsung
  try {
    return await axios.get(url, cfg);
  } catch (err) {
    // lanjut ke proxy
  }

  // 2. Coba tiap CORS proxy
  let lastErr;
  for (const makeProxy of CORS_PROXIES) {
    try {
      await new Promise(r => setTimeout(r, 500));
      return await axios.get(makeProxy(url), { ...cfg, headers: { ...cfg.headers } });
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr;
}

// ─── SCRAPERS ─────────────────────────────────────────────

// 1. Latest / Ongoing anime (dari /ongoing-anime/ yang punya pagination)
async function animeterbaru(page = 1) {
  const url = page > 1
    ? `${BASE}/ongoing-anime/page/${page}/`
    : `${BASE}/ongoing-anime/`;

  const res = await axGet(url);
  const $   = cheerio.load(res.data);
  const data = [];

  // Struktur: .venz ul li > .detpost
  $('.venz ul li').each((_, el) => {
    const title   = clean($(el).find('.jdlflm').text());
    const href    = $(el).find('.thumb a').attr('href');
    const image   = $(el).find('.thumb img').attr('src') || '';
    // ".epz" isinya icon + teks seperti " Episode 7"
    const epzText = clean($(el).find('.epz').text());
    const episode = epzText.replace(/^.*?(?:Episode\s*)?(\d+.*)$/i, '$1').trim() || epzText;
    // ".epztipe" → hari (Senin, Selasa, dst)
    const day     = clean($(el).find('.epztipe').text());
    const date    = clean($(el).find('.newnime').text());

    if (title && href) {
      data.push({ title, url: toAbs(href), image, episode, day, date });
    }
  });

  return data;
}

// 2. Search anime
async function search(query) {
  const url = `${BASE}/?s=${encodeURIComponent(query)}&post_type=anime`;
  const res = await axGet(url, { Referer: `${BASE}/` });
  const $   = cheerio.load(res.data);
  const data = [];

  // Search result: ul.chivsrc li
  $('ul.chivsrc li').each((_, el) => {
    const titleAnchor = $(el).find('.col-anime-title a, h2 a').first();
    const title  = clean(titleAnchor.text());
    const href   = titleAnchor.attr('href');
    const image  = $(el).find('img').first().attr('src') || '';
    const type   = clean($(el).find('.type').text());
    const status = clean($(el).find('.status').text());
    const score  = clean($(el).find('.col-anime-sta-act').text());

    const genres = [];
    $(el).find('.genre-info a').each((_, a) => genres.push(clean($(a).text())));

    if (title) {
      data.push({ title, url: toAbs(href), image, type, status, score, genres });
    }
  });

  return data;
}

// 3. Detail anime page  (/anime/slug-sub-indo/)
async function detail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axGet(targetUrl, { Referer: `${BASE}/` });
  const $   = cheerio.load(res.data);

  // ── Title ──
  let title = clean($('h1.entry-title').text());
  if (!title) {
    title = clean($('title').text())
      .replace('Subtitle Indonesia', '')
      .replace('| Otaku Desu', '')
      .trim();
  }

  // ── Thumbnail ──
  const image = $('.fotoanime img').attr('src')
    || $('meta[property="og:image"]').attr('content')
    || '';

  // ── Synopsis ──
  let description = clean($('.sinopc p').text())
    || clean($('.sinopc').text())
    || clean($('.entry-content p').first().text())
    || $('meta[name="description"]').attr('content')
    || '';

  // ── Info box (.infozingle span) ──
  // Struktur: <span><b>Judul:</b> Nilai</span>
  const info = {};
  const genres = [];
  $('.infozingle span').each((_, el) => {
    const bText = clean($(el).find('b').text()).replace(/:$/, '');
    const key   = bText.toLowerCase().replace(/\s+/g, '_');
    // Nilai = semua teks di luar tag <b>
    const fullText = clean($(el).text());
    const value    = fullText.replace(clean($(el).find('b').text()), '').trim();

    if (key) info[key] = value;

    // Kumpulkan genre
    if (bText.toLowerCase() === 'genre') {
      $(el).find('a').each((_, a) => genres.push(clean($(a).text())));
    }
  });

  // ── Daftar episode (#episodelist) ──
  const episodes = [];
  $('#episodelist ul li').each((_, el) => {
    const a      = $(el).find('.epss a');
    const epTitle = clean(a.text());
    const epHref  = a.attr('href');
    const date    = clean($(el).find('.zeebr').text());
    if (epTitle && epHref) {
      episodes.push({ title: epTitle, url: toAbs(epHref), date });
    }
  });

  // ── Override sinopsis dari MAL ──
  if (MAL_CLIENT_ID) {
    try {
      const malDesc = await getMalDescription(title);
      if (malDesc) description = malDesc;
    } catch (_) {}
  }

  return { title, image, description, episodes, info, genres };
}

// 4. Episode / Watch page  (/episode/slug-episode-N-sub-indo/)
async function download(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axGet(targetUrl, { Referer: `${BASE}/` });
  const $   = cheerio.load(res.data);

  const title = clean($('h1.entry-title').text());

  // ── Stream iframe (desustream / otakudesu player) ──
  const streamUrl =
    clean($('.responsive-embed-desu iframe').attr('src'))
    || clean($('#embed_holder iframe').attr('src'))
    || clean($('iframe[src*="desustream"]').attr('src'))
    || clean($('iframe[src*="otakudesu"]').attr('src'))
    || '';

  // ── Download links (.download-eps ul li) ──
  // Struktur per li: <strong>Mp4 360p</strong><small>44.8 MB</small><a href>Zippy</a>...
  const downloads = [];
  $('.download-eps ul li, .dlbod ul li').each((_, el) => {
    const quality = clean($(el).find('strong').text());
    const size    = clean($(el).find('small').text());
    const links   = [];
    $(el).find('a').each((_, a) => {
      const server = clean($(a).text());
      const url    = $(a).attr('href');
      if (server && url && !url.startsWith('#')) {
        links.push({ server, url });
      }
    });
    if (quality && links.length > 0) {
      downloads.push({ quality, size, links });
    }
  });

  // ── Susun "streams" (kompatibel dengan app.js yang pakai result.streams) ──
  const streams = [];
  if (streamUrl) streams.push({ server: 'OtakuDesu Stream', url: streamUrl });
  downloads.forEach(dl => {
    dl.links.forEach(l => {
      streams.push({ server: `${dl.quality} – ${l.server}`, url: l.url });
    });
  });

  return { title, streams, downloads };
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
  } catch (_) { return null; }
}

async function getMalAnime(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { q: title, limit: 1, fields: 'synopsis,mean,genres,status,num_episodes,start_season,main_picture,rank,popularity' }
    });
    return res.data?.data?.[0]?.node || null;
  } catch (_) { return null; }
}

// ─── SCHEDULE ─────────────────────────────────────────────

async function getMalSchedule() {
  if (!MAL_CLIENT_ID) return getScrapedSchedule();
  try {
    const now    = new Date();
    const year   = now.getFullYear();
    const month  = now.getMonth() + 1;
    let season   = 'winter';
    if (month >= 4  && month <= 6)  season = 'spring';
    else if (month >= 7  && month <= 9)  season = 'summer';
    else if (month >= 10) season = 'fall';

    const res = await axios.get(`${MAL_API}/anime/season/${year}/${season}`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { limit: 50, fields: 'start_date,mean,num_episodes,status,genres,main_picture,broadcast', sort: 'anime_num_list_users' }
    });
    return res.data?.data?.map(d => ({
      id:        d.node.id,
      title:     d.node.title,
      image:     d.node.main_picture?.medium || d.node.main_picture?.large,
      score:     d.node.mean || 'N/A',
      episodes:  d.node.num_episodes || '?',
      status:    d.node.status,
      genres:    d.node.genres?.map(g => g.name).slice(0, 3) || [],
      broadcast: d.node.broadcast,
      startDate: d.node.start_date,
      season:    `${season} ${year}`
    })) || [];
  } catch (_) {
    return getScrapedSchedule();
  }
}

async function getScrapedSchedule() {
  try {
    const res = await axGet(`${BASE}/jadwal-rilis/`);
    const $   = cheerio.load(res.data);
    const items = [];
    const dayNames = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
    let currentDay = '';

    // Struktur otakudesu /jadwal-rilis/: .kiri h2 (hari) + .kiri li (anime)
    // atau .vzone table dengan kolom per hari
    $('.kiri h2, .kiri li').each((_, el) => {
      const tag = $(el).prop('tagName').toLowerCase();
      if (tag === 'h2') {
        currentDay = clean($(el).text());
      } else if (tag === 'li' && currentDay) {
        const a     = $(el).find('a');
        const title = clean(a.text());
        const href  = a.attr('href');
        if (title) items.push({ title, url: toAbs(href), day: currentDay });
      }
    });

    // Fallback: tabel kolom per hari
    if (items.length === 0) {
      $('table tr').each((i, tr) => {
        $(tr).find('td').each((j, td) => {
          const header = $('table tr').first().find('th, td').eq(j).text().trim();
          const day = dayNames.find(d => header.includes(d)) || `Col${j+1}`;
          $(td).find('a').each((_, a) => {
            const title = clean($(a).text());
            const href  = $(a).attr('href');
            if (title) items.push({ title, url: toAbs(href), day });
          });
        });
      });
    }

    // Fallback total: ambil semua link /anime/ dari halaman jadwal
    if (items.length === 0) {
      $('a[href*="/anime/"]').each((_, el) => {
        const title = clean($(el).text());
        const href  = $(el).attr('href');
        if (title && title.length > 2) {
          items.push({ title, url: toAbs(href) });
        }
      });
    }

    return items.slice(0, 60);
  } catch (_) { return []; }
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
      rank:     d.ranking?.rank,
      title:    d.node.title,
      image:    d.node.main_picture?.medium || d.node.main_picture?.large,
      score:    d.node.mean || 'N/A',
      episodes: d.node.num_episodes || '?',
      genres:   d.node.genres?.map(g => g.name).slice(0, 2) || [],
      malId:    d.node.id
    })) || [];
  } catch (_) { return getScrapedTrending(); }
}

async function getScrapedTrending() {
  try {
    const res = await axGet(`${BASE}/ongoing-anime/`);
    const $   = cheerio.load(res.data);
    const results = [];
    $('.venz ul li').each((_, el) => {
      const title   = clean($(el).find('.jdlflm').text());
      const href    = $(el).find('.thumb a').attr('href');
      const image   = $(el).find('.thumb img').attr('src') || '';
      const epzText = clean($(el).find('.epz').text());
      const episode = epzText.replace(/Episode\s*/i, '').trim();
      if (title) results.push({ title, url: toAbs(href), image, episode });
    });
    return results.slice(0, 20);
  } catch (_) { return []; }
}

// ─── NEWS ─────────────────────────────────────────────────

async function getAnimeNews() {
  try {
    const res = await axios.get('https://animenewsnetwork.com/newsroom/', { headers, timeout: 15000 });
    const $   = cheerio.load(res.data);
    const news = [];

    $('div.herald.box.news, .news-item, article').each((_, el) => {
      const a     = $(el).find('a').first();
      const title = clean(a.text()) || clean($(el).find('h2, h3').text());
      const href  = a.attr('href');
      const img   = $(el).find('img').first().attr('src') || '';
      const desc  = clean($(el).find('p, .preview').first().text());
      const date  = clean($(el).find('time, .date').first().text());

      if (title && title.length > 5) {
        news.push({
          title,
          url: href ? (href.startsWith('http') ? href : 'https://animenewsnetwork.com' + href) : '#',
          image: img,
          description: desc.substring(0, 200),
          date: date || new Date().toLocaleDateString('id-ID')
        });
      }
    });

    if (news.length > 0) return news.slice(0, 12);

    // Fallback: buat news dari anime terbaru
    const latest = await animeterbaru(1);
    return latest.slice(0, 8).map(a => ({
      title:       `Update: ${a.title} Episode ${a.episode} Tersedia`,
      url:         a.url,
      image:       a.image,
      description: `Episode terbaru dari ${a.title} sudah dapat ditonton di AniZone.`,
      date:        new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    }));
  } catch (_) {
    return [{
      title:       'AniZone 2026 - Fitur Baru Telah Hadir!',
      url:         '#',
      image:       '',
      description: 'Nikmati fitur jadwal rilis, berita terbaru, dan anime trending di AniZone 2026.',
      date:        new Date().toLocaleDateString('id-ID')
    }];
  }
}

// ─── ROUTES ───────────────────────────────────────────────

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

app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', version: '2.1.0', source: 'otakudesu.blog' })
);

// ─── STATIC & SPA ─────────────────────────────────────────

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/masuk', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel', (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('*',     (_, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ─── START ────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`AniZone API running on port ${PORT} | source: otakudesu.blog`)
);

module.exports = app;
