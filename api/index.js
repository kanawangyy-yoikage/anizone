// ─── ANIZONE API — ENTRY POINT ───────────────────────────
// Sumber: sankavollerei.web.id/anime/kura (Kuramanime)

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

// ── Route Adapter (kompatibel dengan frontend) ────────────

// Beranda — ongoing list
app.get('/api/latest', wrap(async (req, res) => {
  res.json(await scraper.getLatest(req.query.page || 1));
}));

// Pencarian
app.get('/api/search', wrap(async (req, res) => {
  res.json(await scraper.searchAnime(req.query.q || req.query.keyword || ''));
}));

// Detail anime — url = "animeId/slug"
app.get('/api/detail', wrap(async (req, res) => {
  const endpoint = req.query.url || '';
  let data;
  try {
    data = await scraper.getDetail(endpoint);
  } catch (err) {
    // Fallback: coba search
    console.warn('[detail] gagal dengan endpoint:', endpoint, '- fallback search');
    try {
      const keyword = endpoint.split('/').pop().replace(/-/g, ' ').trim();
      const searchRaw = await scraper.api.search(keyword);
      const list = searchRaw.data?.animeList || searchRaw.data || [];
      if (list.length > 0) {
        const item = list[0];
        const fb   = scraper.normalizeItem(item);
        data = await scraper.getDetail(fb.url);
      } else {
        return res.status(404).json({ error: 'Anime tidak ditemukan', endpoint });
      }
    } catch (err2) {
      console.error('[detail] fallback gagal:', err2.message);
      return res.status(404).json({ error: 'Anime tidak ditemukan', endpoint });
    }
  }
  res.json(data);
}));

// Watch episode — url = "animeId/slug/episode"
app.get('/api/watch', wrap(async (req, res) => {
  res.json(await scraper.getWatch(req.query.url || ''));
}));

// Jadwal rilis
app.get('/api/schedule', wrap(async (req, res) => {
  try {
    const mal_ = await mal.getMalSchedule();
    if (mal_ && Object.keys(mal_).length) return res.json(mal_);
  } catch {}
  res.json(await scraper.getScrapedSchedule());
}));

// Trending / Popular
app.get('/api/trending', wrap(async (req, res) => {
  try {
    const mal_ = await mal.getMalTrending();
    if (mal_?.length) return res.json(mal_);
  } catch {}
  res.json(await scraper.getScrapedTrending());
}));

// Berita dari MAL
app.get('/api/news', wrap(async (req, res) => {
  res.json(await mal.getAnimeNews());
}));

app.get('/api/mal/anime', wrap(async (req, res) => {
  res.json(await mal.getMalAnime(req.query.title));
}));

// ── Route Kuramanime Langsung ─────────────────────────────

// Home
app.get('/api/home', wrap(async (req, res) =>
  res.json(await scraper.api.home())
));

// Quick lists
app.get('/api/ongoing',  wrap(async (req, res) =>
  res.json(await scraper.api.ongoing(req.query.page, req.query.order_by))
));
app.get('/api/completed', wrap(async (req, res) =>
  res.json(await scraper.api.finished(req.query.page, req.query.order_by))
));
app.get('/api/popular', wrap(async (req, res) =>
  res.json(await scraper.api.popular(req.query.page, req.query.order_by))
));
app.get('/api/movie', wrap(async (req, res) =>
  res.json(await scraper.api.movie(req.query.page, req.query.order_by))
));
app.get('/api/donghua', wrap(async (req, res) =>
  res.json(await scraper.api.donghua(req.query.page, req.query.order_by))
));

// Anime list A-Z
app.get('/api/unlimited', wrap(async (req, res) =>
  res.json(await scraper.api.animeList(req.query.page, req.query.order_by))
));
app.get('/api/anime-list', wrap(async (req, res) =>
  res.json(await scraper.api.animeList(req.query.page, req.query.order_by))
));

// Jadwal dengan filter hari
app.get('/api/schedule/:day', wrap(async (req, res) =>
  res.json(await scraper.api.schedule(req.params.day))
));

// Genre
app.get('/api/genres',      wrap(async (req, res) => res.json(await scraper.api.genres())));
app.get('/api/genre/:slug', wrap(async (req, res) => res.json(await scraper.api.genre(req.params.slug))));

// Season
app.get('/api/seasons',       wrap(async (req, res) => res.json(await scraper.api.seasons())));
app.get('/api/season/:slug',  wrap(async (req, res) => res.json(await scraper.api.season(req.params.slug))));

// Studio
app.get('/api/studios',       wrap(async (req, res) => res.json(await scraper.api.studios())));
app.get('/api/studio/:slug',  wrap(async (req, res) => res.json(await scraper.api.studio(req.params.slug))));

// Type
app.get('/api/types',         wrap(async (req, res) => res.json(await scraper.api.types())));
app.get('/api/type/:slug',    wrap(async (req, res) => res.json(await scraper.api.type(req.params.slug))));

// Quality
app.get('/api/qualities',     wrap(async (req, res) => res.json(await scraper.api.qualities())));
app.get('/api/quality/:slug', wrap(async (req, res) => res.json(await scraper.api.quality(req.params.slug))));

// Source
app.get('/api/sources',       wrap(async (req, res) => res.json(await scraper.api.sources())));
app.get('/api/source/:slug',  wrap(async (req, res) => res.json(await scraper.api.source(req.params.slug))));

// Country
app.get('/api/countries',      wrap(async (req, res) => res.json(await scraper.api.countries())));
app.get('/api/country/:slug',  wrap(async (req, res) => res.json(await scraper.api.country(req.params.slug))));

// Detail anime langsung: /api/anime/:id/:slug
app.get('/api/anime/:id/:slug', wrap(async (req, res) =>
  res.json(await scraper.api.detail(req.params.id, req.params.slug))
));

// Watch episode langsung: /api/watch/:id/:slug/:episode
app.get('/api/watch/:id/:slug/:episode', wrap(async (req, res) =>
  res.json(await scraper.api.watch(req.params.id, req.params.slug, req.params.episode))
));

// Batch download: /api/batch/:id/:slug/:batchId
app.get('/api/batch/:id/:slug/:batchId', wrap(async (req, res) =>
  res.json(await scraper.api.batch(req.params.id, req.params.slug, req.params.batchId))
));

// Search
app.get('/api/search/:keyword', wrap(async (req, res) =>
  res.json(await scraper.api.search(req.params.keyword))
));

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', version: '4.0.0', source: 'kuramanime' })
);

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
  console.log(`AniZone v4 (kuramanime) running on port ${PORT}`)
);

module.exports = app;
