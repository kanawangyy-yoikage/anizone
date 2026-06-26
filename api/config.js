// ─── ANIZONE API CONFIG ───────────────────────────────────
// Sumber: sankavollerei.web.id/anime/kura (Kuramanime)
const BASE      = 'https://www.sankavollerei.web.id';
const ANIME_API = 'https://www.sankavollerei.web.id/anime/kura';
const MAL_API   = 'https://api.myanimelist.net/v2';

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';
const SCRAPE_HEADERS = {};

module.exports = { BASE, ANIME_API, MAL_API, MAL_CLIENT_ID, SCRAPE_HEADERS };
