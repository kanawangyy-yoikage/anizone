// ─── CONFIG & SHARED STATE ───────────────────────────────
// Kuramanime Edition

const API_BASE = '/api';

const MAL_SCORE_CACHE = new Map();
const MAL_DATA_CACHE  = new Map();

const ALL_VIEWS = [
  'home-view', 'anime-view', 'recent-view', 'favorite-view', 'bookmark-view',
  'developer-view', 'detail-view', 'watch-view', 'profile-view',
];

// Konfigurasi section beranda — memakai endpoint Kuramanime
const HOME_SECTIONS = [
  { title: 'Sedang Hangat',      mode: 'latest',   endpoint: 'ongoing'  },
  { title: 'Populer',            mode: 'popular',  endpoint: 'popular'  },
  { title: 'Movie',              mode: 'movie',    endpoint: 'movie'    },
  { title: 'Donghua',            mode: 'donghua',  endpoint: 'donghua'  },
];

// Keyword per genre (untuk fitur pencarian beranda)
const GENRE_KEYWORDS = {
  'Action'      : ['action', 'shounen', 'fight', 'jujutsu', 'kimetsu'],
  'Adventure'   : ['adventure', 'journey', 'world', 'isekai'],
  'Comedy'      : ['comedy', 'slice of life', 'laugh', 'bocchi'],
  'Drama'       : ['drama', 'cry', 'love', 'romance', 'kanojo'],
  'Fantasy'     : ['fantasy', 'magic', 'maou', 'dragon', 'hero'],
  'Isekai'      : ['isekai', 'reincarnation', 'world', 'slime', 'tensei'],
  'Romance'     : ['romance', 'love', 'kanojo', 'couple'],
  'School'      : ['school', 'gakuen', 'classroom', 'student'],
  'Sci-Fi'      : ['sci-fi', 'science', 'gundam', 'mecha'],
  'Sports'      : ['sports', 'soccer', 'football', 'blue lock', 'haikyuu'],
};

const KATEGORI_LIST = Object.keys(GENRE_KEYWORDS);
