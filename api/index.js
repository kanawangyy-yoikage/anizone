// ─── ANIZONE API — ENTRY POINT ───────────────────────────
// Scraping sumber: sankavollerei.web.id/anime/
// Referensi endpoint: https://sankavollerei.web.id/anime/

const path    = require('path');
const express = require('express');
const cors    = require('cors');

const scraper = require('./services/scraper');
const mal     = require('./services/mal');

// CRUD routes (Firestore)
const handleAnime     = require('./routes/anime');
const handleUsers     = require('./routes/users');
const handleFavorites = require('./routes/favorites');

const app = express();
app.use(cors());
app.use(express.json());

// ── Helper error handler ──────────────────────────────────
const wrap = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    console.error('[API Error]', e.message);
    res.status(500).json({ error: e.message });
  }
};

// ── Scraping & MAL Routes ─────────────────────────────────

// Latest / Ongoing (beranda)
app.get('/api/latest', wrap(async (req, res) => {
  res.json(await scraper.getLatest(req.query.page || 1));
}));

// Search
app.get('/api/search', wrap(async (req, res) => {
  res.json(await scraper.searchAnime(req.query.q || req.query.keyword || ''));
}));

// Detail anime (adapter, cocok dengan frontend lama)
app.get('/api/detail', wrap(async (req, res) => {
  const url  = req.query.url || '';
  const data = await scraper.getDetail(url);
  // Augment dengan data MAL jika ada
  try {
    const malData = await mal.getMalAnime(data.title).catch(() => null);
    if (malData?.synopsis && !data.description) data.description = malData.synopsis;
    if (malData?.mean && (data.info.score === 'N/A' || !data.info.score)) {
      data.info.score = String(malData.mean);
    }
  } catch {}
  res.json(data);
}));

// Watch / Stream episode
app.get('/api/watch', wrap(async (req, res) => {
  res.json(await scraper.getWatch(req.query.url || ''));
}));

// Stream server URL (ambil embed URL berdasarkan serverId)
app.get('/api/server/:serverId', wrap(async (req, res) => {
  const url = await scraper.getStreamUrl(req.params.serverId);
  res.json({ url });
}));

// MAL
app.get('/api/mal/anime', wrap(async (req, res) => {
  res.json(await mal.getMalAnime(req.query.title));
}));

// Schedule
app.get('/api/schedule', wrap(async (req, res) => {
  try {
    // Coba MAL schedule dulu
    const malSchedule = await mal.getMalSchedule();
    if (malSchedule && Object.keys(malSchedule).length > 0) return res.json(malSchedule);
  } catch {}
  // Fallback ke scraper schedule
  res.json(await scraper.getScrapedSchedule());
}));

// Trending
app.get('/api/trending', wrap(async (req, res) => {
  try {
    const malTrending = await mal.getMalTrending();
    if (malTrending?.length) return res.json(malTrending);
  } catch {}
  res.json(await scraper.getScrapedTrending());
}));

// News
app.get('/api/news', wrap(async (req, res) => {
  res.json(await mal.getAnimeNews());
}));

// ── Route Baru (langsung ke API sankavollerei) ────────────

// Home page data
app.get('/api/home', wrap(async (req, res) => {
  res.json(await scraper.api.getHome());
}));

// Ongoing anime
app.get('/api/ongoing', wrap(async (req, res) => {
  res.json(await scraper.api.getOngoingAnime(req.query.page || 1));
}));

// Complete/Tamat anime
app.get('/api/complete', wrap(async (req, res) => {
  res.json(await scraper.api.getCompleteAnime(req.query.page || 1));
}));

// Genre list
app.get('/api/genre', wrap(async (req, res) => {
  res.json(await scraper.api.getGenreList());
}));

// Anime by genre
app.get('/api/genre/:slug', wrap(async (req, res) => {
  res.json(await scraper.api.getAnimeByGenre(req.params.slug, req.query.page || 1));
}));

// Anime detail (raw)
app.get('/api/anime/:slug', wrap(async (req, res) => {
  res.json(await scraper.api.getAnimeDetail(req.params.slug));
}));

// Episode detail (raw)
app.get('/api/episode/:slug', wrap(async (req, res) => {
  res.json(await scraper.api.getEpisode(req.params.slug));
}));

// Batch download
app.get('/api/batch/:slug', wrap(async (req, res) => {
  res.json(await scraper.api.getBatch(req.params.slug));
}));

// All anime
app.get('/api/unlimited', wrap(async (req, res) => {
  res.json(await scraper.api.getAllAnime());
}));

// Health check
app.get('/api/health', (_req, res) => res.json({
  status  : 'ok',
  version : '3.0.0',
  source  : 'sankavollerei.web.id',
}));

// ── CRUD Routes (Firestore) ───────────────────────────────
app.all('/api/crud/anime',     (req, res) => handleAnime(req, res));
app.all('/api/crud/users',     (req, res) => handleUsers(req, res));
app.all('/api/crud/favorites', (req, res) => handleFavorites(req, res));

// ── Static Files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/masuk', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ── Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`AniZone API v3 (sankavollerei) running on port ${PORT}`)
);

module.exports = app;
