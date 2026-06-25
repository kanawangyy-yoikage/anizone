// ─── ANIZONE API — ENTRY POINT ───────────────────────────
// Sumber: sankavollerei.web.id/anime (Otakudesu)

const path    = require('path');
const express = require('express');
const cors    = require('cors');

const scraper = require('./services/scraper');
const mal     = require('./services/mal');

const handleAnime     = require('./routes/anime');
const handleUsers     = require('./routes/users');
const handleFavorites = require('./routes/favorites');

const app = express();
app.use(cors());
app.use(express.json());

const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    console.error('[API]', e.message);
    res.status(500).json({ error: e.message });
  }
};

// ── Route Adapter (kompatibel dengan frontend lama) ───────

app.get('/api/latest', wrap(async (req, res) => {
  res.json(await scraper.getLatest(req.query.page || 1));
}));

app.get('/api/search', wrap(async (req, res) => {
  res.json(await scraper.searchAnime(req.query.q || req.query.keyword || ''));
}));

app.get('/api/detail', wrap(async (req, res) => {
  const slug = req.query.url || '';
  let data;
  try {
    data = await scraper.getDetail(slug);
  } catch (err) {
    // Fallback: coba search dengan judul dari slug
    console.warn('[detail] gagal dengan slug:', slug, '- coba fallback search');
    try {
      const keyword = slug.replace(/-sub-indo$/i, '').replace(/-s\d+$/i, '').replace(/-/g, ' ').trim();
      const searchRaw = await scraper.api.search(keyword);
      const list = searchRaw.data?.animeList || [];
      if (list.length > 0) {
        const bestSlug = list[0].animeId || slug;
        console.log('[detail] fallback ke slug:', bestSlug);
        data = await scraper.getDetail(bestSlug);
      } else {
        return res.status(404).json({ error: 'Anime tidak ditemukan', slug });
      }
    } catch (err2) {
      console.error('[detail] fallback juga gagal:', err2.message);
      return res.status(404).json({ error: 'Anime tidak ditemukan', slug });
    }
  }
  res.json(data);
}));

app.get('/api/watch', wrap(async (req, res) => {
  res.json(await scraper.getWatch(req.query.url || ''));
}));

app.get('/api/schedule', wrap(async (req, res) => {
  try {
    const mal_ = await mal.getMalSchedule();
    if (mal_ && Object.keys(mal_).length) return res.json(mal_);
  } catch {}
  res.json(await scraper.getScrapedSchedule());
}));

app.get('/api/trending', wrap(async (req, res) => {
  try {
    const mal_ = await mal.getMalTrending();
    if (mal_?.length) return res.json(mal_);
  } catch {}
  res.json(await scraper.getScrapedTrending());
}));

app.get('/api/news', wrap(async (req, res) => {
  res.json(await mal.getAnimeNews());
}));

app.get('/api/mal/anime', wrap(async (req, res) => {
  res.json(await mal.getMalAnime(req.query.title));
}));

// ── Route Baru (langsung ke Otakudesu) ───────────────────

// Halaman home (ongoing + complete snapshot)
app.get('/api/home',      wrap(async (req, res) => res.json(await scraper.api.home())));

// Ongoing & completed
app.get('/api/ongoing',   wrap(async (req, res) => res.json(await scraper.api.ongoing(req.query.page))));
app.get('/api/completed', wrap(async (req, res) => res.json(await scraper.api.completed(req.query.page))));

// Genre
app.get('/api/genres',         wrap(async (req, res) => res.json(await scraper.api.genres())));
app.get('/api/genre/:slug',    wrap(async (req, res) => res.json(await scraper.api.genre(req.params.slug, req.query.page))));

// Detail & episode
app.get('/api/anime/:slug',    wrap(async (req, res) => res.json(await scraper.api.detail(req.params.slug))));
app.get('/api/episode/:slug',  wrap(async (req, res) => res.json(await scraper.api.episode(req.params.slug))));

// Server embed URL
app.get('/api/server/:id',     wrap(async (req, res) => res.json(await scraper.api.server(req.params.id))));

// Batch download
app.get('/api/batch/:slug',    wrap(async (req, res) => res.json(await scraper.api.batch(req.params.slug))));

// Search
app.get('/api/search/:keyword', wrap(async (req, res) => res.json(await scraper.api.search(req.params.keyword))));

// All anime (A-Z unlimited)
app.get('/api/unlimited',      wrap(async (req, res) => res.json(await scraper.api.unlimited())));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '3.1.0', source: 'otakudesu' }));

// ── CRUD Firestore ────────────────────────────────────────
app.all('/api/crud/anime',     (req, res) => handleAnime(req, res));
app.all('/api/crud/users',     (req, res) => handleUsers(req, res));
app.all('/api/crud/favorites', (req, res) => handleFavorites(req, res));

// ── Static ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/masuk', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('*',      (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`AniZone v3 (otakudesu) running on port ${PORT}`)
);

module.exports = app;
