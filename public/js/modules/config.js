// ─── CONFIG & SHARED STATE ───────────────────────────────
// Semua konstanta dan state global dikumpulkan di sini.

const API_BASE = '/api';

// Cache skor MAL agar tidak fetch berulang untuk judul yang sama
const MAL_SCORE_CACHE = new Map();

// ID semua view — digunakan oleh switchTab untuk hide/show
const ALL_VIEWS = [
  'home-view', 'anime-view', 'recent-view', 'favorite-view',
  'developer-view', 'detail-view', 'watch-view', 'profile-view',
];

// Konfigurasi section beranda
const HOME_SECTIONS = [
  { title: 'Sedang Hangat',      mode: 'latest' },
  { title: 'Isekai & Fantasy',   queries: ['isekai', 'reincarnation', 'world', 'maou'] },
  { title: 'Action Hits',        queries: ['kimetsu', 'jujutsu', 'piece', 'bleach', 'hunter', 'shingeki'] },
  { title: 'Romance & Drama',    queries: ['love', 'kanojo', 'romance', 'heroine', 'uso'] },
  { title: 'School Life',        queries: ['school', 'gakuen', 'classroom', 'high school'] },
  { title: 'Magic & Adventure',  queries: ['magic', 'adventure', 'dragon', 'dungeon'] },
  { title: 'Comedy & Chill',     queries: ['comedy', 'slice of life', 'bocchi', 'spy'] },
];

// Keyword per genre untuk halaman Kategori
const GENRE_KEYWORDS = {
  'Action'      : ['action', 'shounen', 'fight', 'jujutsu', 'kimetsu'],
  'Adventure'   : ['adventure', 'journey', 'world', 'isekai'],
  'Comedy'      : ['comedy', 'slice of life', 'laugh', 'bocchi'],
  'Drama'       : ['drama', 'cry', 'love', 'romance', 'kanojo'],
  'Fantasy'     : ['fantasy', 'magic', 'maou', 'dragon', 'hero'],
  'Isekai'      : ['isekai', 'reincarnation', 'world', 'slime', 'tensei'],
  'Magic'       : ['magic', 'mahou', 'witch', 'wizard'],
  'Romance'     : ['romance', 'love', 'kanojo', 'couple'],
  'School'      : ['school', 'gakuen', 'classroom', 'student'],
  'Sci-Fi'      : ['sci-fi', 'science', 'gundam', 'mecha'],
  'Slice of Life': ['slice of life', 'daily', 'chill', 'camp'],
  'Sports'      : ['sports', 'soccer', 'football', 'blue lock', 'haikyuu'],
};

const KATEGORI_LIST = Object.keys(GENRE_KEYWORDS);
