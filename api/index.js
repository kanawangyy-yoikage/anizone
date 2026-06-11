// ─── ANIZONE API — ENTRY POINT ───────────────────────────
// File ini hanya berisi setup server dan routing.
// Logic scraping → api/services/scraper.js
// Logic MAL      → api/services/mal.js
// Konstanta      → api/config.js

const path    = require('path');
const express = require('express');
const cors    = require('cors');

const scraper = require('./services/scraper');
const mal     = require('./services/mal');

const app = express();
app.use(cors());
app.use(express.json());

// ── API Routes ────────────────────────────────────────────

app.get('/api/latest', async (req, res) => {
  try { res.json(await scraper.getLatest(req.query.page || 1)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  try { res.json(await scraper.searchAnime(req.query.q)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/detail', async (req, res) => {
  try {
    const data    = await scraper.getDetail(req.query.url);
    const malData = await mal.getMalAnime(data.title).catch(() => null);
    if (malData?.synopsis) data.description = malData.synopsis;
    if (malData?.mean && !data.info.score && !data.info.skor) data.info.score = String(malData.mean);
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/watch', async (req, res) => {
  try { res.json(await scraper.getWatch(req.query.url)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mal/anime', async (req, res) => {
  try { res.json(await mal.getMalAnime(req.query.title)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/schedule', async (req, res) => {
  try { res.json(await mal.getMalSchedule()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/trending', async (req, res) => {
  try { res.json(await mal.getMalTrending()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/news', async (req, res) => {
  try { res.json(await mal.getAnimeNews()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// ── Static Files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/masuk', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/login', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'login.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));
app.get('/panel', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin.html')));

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ── Start Server ──────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`AniZone API running on port ${PORT}`));

module.exports = app;
