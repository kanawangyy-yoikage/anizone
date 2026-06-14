// ─── ANIZONE API CONFIG ───────────────────────────────────
// Semua konstanta global API dikumpulkan di sini.
// Untuk mengubah base URL atau proxy, cukup edit file ini.

const PROXY      = 'https://cors.caliph.my.id/';
const BASE       = 'https://v2.samehadaku.how';
const MAL_API    = 'https://api.myanimelist.net/v2';

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID || '';

const SCRAPE_HEADERS = {
  'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

module.exports = { PROXY, BASE, MAL_API, MAL_CLIENT_ID, SCRAPE_HEADERS };
