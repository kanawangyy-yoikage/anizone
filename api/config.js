// ─── ANIZONE API CONFIG ───────────────────────────────────
const BASE       = 'https://sankavollerei.web.id';
const ANIME_API  = 'https://sankavollerei.web.id/anime';
const MAL_API    = 'https://api.myanimelist.net/v2';

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

const SCRAPE_HEADERS = {};

module.exports = { BASE, ANIME_API, MAL_API, MAL_CLIENT_ID, SCRAPE_HEADERS };
