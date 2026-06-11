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
const BASE  = 'https://v2.samehadaku.how';
const MAL_API = 'https://api.myanimelist.net/v2';
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// ─── SCRAPERS ─────────────────────────────────────────────

async function animeterbaru(page = 1) {
  const res = await axios.get(`${PROXY}${BASE}/anime-terbaru/page/${page}/`, { headers });
  const $ = cheerio.load(res.data);
  const data = [];
  $('.post-show ul li').each((_, e) => {
    const a = $(e).find('.dtla h2 a');
    data.push({
      title: a.text().trim(),
      url: a.attr('href'),
      image: $(e).find('.thumb img').attr('src'),
      episode: $(e).find('.dtla span:contains("Episode")').text().replace('Episode', '').trim(),
    });
  });
  return data;
}

async function search(query) {
  const res = await axios.get(`${PROXY}${BASE}/?s=${encodeURIComponent(query)}`, { headers });
  const $ = cheerio.load(res.data);
  const data = [];
  $('.animpost').each((_, e) => {
    data.push({
      title: $(e).find('.data .title h2').text().trim(),
      image: $(e).find('.content-thumb img').attr('src'),
      type: $(e).find('.type').text().trim(),
      score: $(e).find('.score').text().trim(),
      url: $(e).find('a').attr('href')
    });
  });
  return data;
}

async function detail(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(`${PROXY}${targetUrl}`, { headers });
  const $ = cheerio.load(res.data);

  const episodes = [];
  $('.lstepsiode ul li').each((_, e) => {
    episodes.push({
      title: $(e).find('.epsleft .lchx a').text().trim(),
      url: $(e).find('.epsleft .lchx a').attr('href'),
      date: $(e).find('.epsleft .date').text().trim()
    });
  });

  const info = {};
  $('.anim-senct .right-senc .spe span').each((_, e) => {
    const t = $(e).text();
    if (t.includes(':')) {
      const [k, v] = t.split(':');
      info[k.trim().toLowerCase().replace(/\s+/g, '_')] = v.trim();
    }
  });

  const title = $('title').text().replace(' - Samehadaku', '').trim();
  let description = $('.entry-content').text().trim() || $('meta[name="description"]').attr('content') || '';

  // Fetch MAL data (description + score) if available
  if (MAL_CLIENT_ID) {
    try {
      const malAnime = await getMalAnime(title);
      if (malAnime) {
        if (malAnime.synopsis) description = malAnime.synopsis;
        if (malAnime.mean && !info.score && !info.skor) info.score = String(malAnime.mean);
      }
    } catch (e) {}
  }

  return { title, image: $('meta[property="og:image"]').attr('content'), description, episodes, info };
}

async function download(link) {
  const targetUrl = link.startsWith('http') ? link : `${BASE}${link}`;
  const res = await axios.get(`${PROXY}${targetUrl}`, { headers });
  const cookies = res.headers['set-cookie']?.map(v => v.split(';')[0]).join('; ') || '';
  const $ = cheerio.load(res.data);
  const streams = [];

  for (const li of $('div#server > ul > li').toArray()) {
    const div = $(li).find('div');
    const post = div.attr('data-post');
    const nume = div.attr('data-nume');
    const type = div.attr('data-type');
    const name = $(li).find('span').text().trim();
    if (!post) continue;

    const body = new URLSearchParams({ action: 'player_ajax', post, nume, type }).toString();
    try {
      const r = await axios.post(`${PROXY}${BASE}/wp-admin/admin-ajax.php`, body, {
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies, 'Referer': targetUrl }
      });
      const $$ = cheerio.load(r.data);
      const iframe = $$('iframe').attr('src');
      if (iframe) streams.push({ server: name, url: iframe });
    } catch (e) { console.log('Error fetching server:', name); }
  }

  // Scrape download links from #downloaddb
  // Structure from samehadaku: div.download-eps#downloaddb > p(format title) > ul > li > strong(res) + span > a(host)
  const downloads = [];
  const dlContainer = $('#downloaddb, .download-eps, [id*="download"]').first();
  let currentFormat = 'Download';
  dlContainer.children().each((_, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase();
    if (tag === 'p') {
      // Format label like "MKV" or "MP4"
      const txt = $(el).text().trim();
      if (txt && !$(el).find('a').length) currentFormat = txt;
    } else if (tag === 'ul') {
      $(el).find('li').each((_, li) => {
        const strong = $(li).find('strong').first().text().trim();
        const links = [];
        $(li).find('a').each((_, a) => {
          const href = $(a).attr('href');
          const host = $(a).text().trim();
          if (href && host) links.push({ host, url: href });
        });
        if (links.length) downloads.push({ resolution: strong || '?', format: currentFormat, links });
      });
    }
  });
  // Fallback: just grab all li with links
  if (!downloads.length) {
    dlContainer.find('li').each((_, li) => {
      const strong = $(li).find('strong').first().text().trim();
      const links = [];
      $(li).find('a').each((_, a) => {
        const href = $(a).attr('href');
        const host = $(a).text().trim();
        if (href && host) links.push({ host, url: href });
      });
      if (links.length) downloads.push({ resolution: strong || '?', format: 'Download', links });
    });
  }

  return { title: $('h1[itemprop="name"]').text().trim(), streams, downloads };
}

// ─── MAL INTEGRATION ──────────────────────────────────────

async function getMalDescription(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: { 'X-MAL-CLIENT-ID': MAL_CLIENT_ID },
      params: { q: title, limit: 1, fields: 'synopsis,mean,genres,status,num_episodes,start_season' }
    });
    const anime = res.data?.data?.[0]?.node;
    if (anime?.synopsis) return anime.synopsis;
  } catch (e) {}
  return null;
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

// ─── MAL SCHEDULE (Seasonal) ──────────────────────────────

async function getMalSchedule() {
  if (!MAL_CLIENT_ID) {
    // Fallback: scrape from samehadaku schedule
    return getScrapedSchedule();
  }
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

async function getScrapedSchedule() {
  try {
    const res = await axios.get(`${PROXY}${BASE}/jadwal-rilis/`, { headers });
    const $ = cheerio.load(res.data);
    const schedule = {};
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    $('h2.entry-title, .jadwal-table').each((_, el) => {
      const tag = $(el).prop('tagName').toLowerCase();
      if (tag === 'h2') {
        // day header
      }
    });

    // alternative scrape
    const items = [];
    $('table tr, .schedule-item, .post-show ul li').each((_, e) => {
      const title = $(e).find('a').first().text().trim();
      const url = $(e).find('a').first().attr('href');
      const img = $(e).find('img').attr('src');
      if (title && url) items.push({ title, url, image: img });
    });
    return items.slice(0, 40);
  } catch (e) { return []; }
}

// ─── MAL TRENDING ─────────────────────────────────────────

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

async function getScrapedTrending() {
  try {
    const queries = ['kimetsu', 'jujutsu', 'one piece', 'attack on titan', 'bleach'];
    let results = [];
    for (const q of queries) {
      try {
        const r = await fetch ? [] : (await axios.get(`${PROXY}${BASE}/?s=${encodeURIComponent(q)}`, { headers })).data;
        if (r && r.length) results = [...results, ...r];
      } catch (e) {}
    }
    return results.slice(0, 20);
  } catch (e) { return []; }
}

// ─── ANIME NEWS ────────────────────────────────────────────

async function getAnimeNews() {
  try {
    // Scrape from anime news sources
    const sources = [
      { url: 'https://myanimelist.net/news', title_sel: '.news-unit .title a', img_sel: '.news-unit img', desc_sel: '.news-unit .text' },
    ];

    // Try scraping animenewsnetwork or similar
    const res = await axios.get(`${PROXY}https://animenewsnetwork.com/newsroom/`, { headers });
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

    // Fallback: generate curated news from latest anime
    const latest = await animeterbaru(1);
    return latest.slice(0, 8).map(a => ({
      title: `Update: ${a.title} Episode ${a.episode} Tersedia`,
      url: a.url,
      image: a.image,
      description: `Episode terbaru dari ${a.title} sudah dapat ditonton di AniZone.`,
      date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    }));
  } catch (e) {
    // Fallback news
    return [
      { title: 'AniZone 2026 - Fitur Baru Telah Hadir!', url: '#', image: '', description: 'Nikmati fitur jadwal rilis, berita terbaru, dan anime trending di AniZone 2026.', date: new Date().toLocaleDateString('id-ID') },
    ];
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

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));


// ─── STATIC FILES & ROUTE ALIASES ──────────────────────────
const path = require('path');
app.use(express.static(path.join(__dirname, '..', 'public')));

// Route aliases (previously handled by vercel.json rewrites)
app.get('/masuk',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel',  (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ─── START SERVER ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`AniZone API running on port ${PORT}`));

module.exports = app;
