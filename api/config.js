// ─── ANIZONE API CONFIG ───────────────────────────────────
const BASE       = 'https://kusonime.com';
const MAL_API    = 'https://api.myanimelist.net/v2';

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

// Tidak perlu SCRAPE_HEADERS — sudah di-handle di scraper via axios instance
const SCRAPE_HEADERS = {};

module.exports = { BASE, MAL_API, MAL_CLIENT_ID, SCRAPE_HEADERS };
