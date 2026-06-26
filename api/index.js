// ─── ANIZONE API — ENTRY POINT ───────────────────────────
// Sumber: sankavollerei.web.id/anime/nimegami (Nimegami)

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

// Beranda — latest / ongoing
app.get('/api/latest', wrap(async (req, res) => {
  res.json(await scraper.getLatest(req.query.page || 1));
}));

// Pencarian
app.get('/api/search', wrap(async (req, res) => {
  const q    = req.query.q || req.query.keyword || '';
  const page = req.query.page || 1;
  res.json(await scraper.searchAnime(q, page));
}));

// Detail anime — url = slug episode atau slug anime
app.get('/api/detail', wrap(async (req, res) => {
  const endpoint = req.query.url || '';
  let data;
  try {
    data = await scraper.getDetail(endpoint);
  } catch (err) {
    // Fallback: coba search berdasarkan slug
    console.warn('[detail] gagal dengan endpoint:', endpoint, '- fallback search');
    try {
      const keyword = endpoint.replace(/-sub-indo.*$/i, '').replace(/-/g, ' ').trim();
      const results = await scraper.searchAnime(keyword);
      if (results.length > 0) {
        data = await scraper.getDetail(results[0].slug);
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

// Watch episode — url = episode slug
app.get('/api/watch', wrap(async (req, res) => {
  res.json(await scraper.getWatch(req.query.url || ''));
}));

// Jadwal rilis — Nimegami tidak punya jadwal, fallback ke MAL
app.get('/api/schedule', wrap(async (req, res) => {
  try {
    const mal_ = await mal.getMalSchedule();
    if (mal_ && Object.keys(mal_).length) return res.json(mal_);
  } catch {}
  res.json([]);
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

// ── Route Nimegami Langsung ───────────────────────────────

// Home
app.get('/api/home', wrap(async (req, res) =>
  res.json(await scraper.api.home())
));

// Anime list A-Z
app.get('/api/unlimited', wrap(async (req, res) =>
  res.json(await scraper.api.animeList(req.query.page || 1))
));
app.get('/api/anime-list', wrap(async (req, res) =>
  res.json(await scraper.api.animeList(req.query.page || 1))
));

// Search langsung
app.get('/api/search/:keyword', wrap(async (req, res) =>
  res.json(await scraper.api.search(req.params.keyword, req.query.page || 1))
));

// Genre
app.get('/api/genres',      wrap(async (req, res) => res.json(await scraper.api.genreList())));
app.get('/api/genre/:slug', wrap(async (req, res) =>
  res.json(await scraper.api.genre(req.params.slug, req.query.page || 1))
));

// Season
app.get('/api/seasons',      wrap(async (req, res) => res.json(await scraper.api.seasonList())));
app.get('/api/season/:slug', wrap(async (req, res) =>
  res.json(await scraper.api.season(req.params.slug, req.query.page || 1))
));

// Type (TV, Movie, OVA, dll)
app.get('/api/types',       wrap(async (req, res) => res.json(await scraper.api.typeList())));
app.get('/api/type/:slug',  wrap(async (req, res) =>
  res.json(await scraper.api.type(req.params.slug, req.query.page || 1))
));

// Live Action / J-Drama
app.get('/api/j-drama',              wrap(async (req, res) => res.json(await scraper.api.jDrama())));
app.get('/api/live-action',          wrap(async (req, res) => res.json(await scraper.api.liveAction())));
app.get('/api/live-action/:slug',    wrap(async (req, res) => res.json(await scraper.api.liveDetail(req.params.slug))));
app.get('/api/drama/:slug',          wrap(async (req, res) => res.json(await scraper.api.dramaDetail(req.params.slug))));

// Detail anime/episode langsung: /api/detail/:slug
app.get('/api/detail/:slug', wrap(async (req, res) =>
  res.json(await scraper.api.detail(req.params.slug))
));

// Watch episode langsung (alias ke detail, Nimegami pakai slug)
app.get('/api/watch/:slug', wrap(async (req, res) =>
  res.json(await scraper.api.detail(req.params.slug))
));

// Ongoing (alias dari home — ambil list terbaru)
app.get('/api/ongoing', wrap(async (req, res) => {
  const raw = await scraper.api.home();
  res.json(raw);
}));

// Completed — dari type/tv atau type/movie yang sudah selesai (fallback ke anime-list)
app.get('/api/completed', wrap(async (req, res) => {
  const raw = await scraper.api.animeList(req.query.page || 1);
  res.json(raw);
}));

// Movie — dari type/movie
app.get('/api/movie', wrap(async (req, res) => {
  const raw = await scraper.api.type('movie', req.query.page || 1);
  res.json(raw);
}));

// Popular (gunakan trending dari home)
app.get('/api/popular', wrap(async (req, res) => {
  const raw = await scraper.api.home();
  res.json(raw);
}));

// Donghua — tidak ada di Nimegami, return empty
app.get('/api/donghua', wrap(async (_req, res) => {
  res.json({ data: [], message: 'Donghua tidak tersedia di Nimegami' });
}));

// Health check
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', version: '5.0.0', source: 'nimegami' })
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
  console.log(`AniZone v5 (nimegami) running on port ${PORT}`)
);

module.exports = app;
