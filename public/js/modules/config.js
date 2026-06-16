// ─── CONFIG & SHARED STATE ───────────────────────────────
// Semua konstanta dan state global dikumpulkan di sini.

const API_BASE = '/api';

// Cache skor MAL agar tidak fetch berulang untuk judul yang sama
const MAL_SCORE_CACHE = new Map();

// ID semua view — digunakan oleh switchTab untuk hide/show
const ALL_VIEWS = [
  'home-view', 'anime-view', 'recent-view', 'favorite-view', 'bookmark-view',
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
  "Action":         ["action","shounen","fight","jujutsu","kimetsu"],
  "Adventure":      ["adventure","journey","world","isekai"],
  "Comedy":         ["comedy","slice of life","laugh","bocchi"],
  "Drama":          ["drama","cry","love","romance","kanojo"],
  "Fantasy":        ["fantasy","magic","maou","dragon","hero"],
  "Isekai":         ["isekai","reincarnation","world","slime","tensei"],
  "Magic":          ["magic","mahou","witch","wizard"],
  "Romance":        ["romance","love","kanojo","couple"],
  "School":         ["school","gakuen","classroom","student"],
  "Slice of Life":  ["slice of life","daily","chill","camp"],
  "Sports":         ["sports","soccer","football","blue lock","haikyuu"],
  "Aksi":           ["aksi","action","shounen","fight"],
  "Anak-Anak":      ["anak","kids","children","kodomo"],
  "Antariksa":      ["antariksa","space","cosmos","galactic"],
  "Avant Garde":    ["avant garde","experimental","surreal"],
  "Dimensia":       ["dimensia","dementia","surreal","psychological"],
  "Donghua":        ["donghua","chinese","tiongkok","manhua"],
  "Ecchi":          ["ecchi","fanservice","harem"],
  "Fantasi":        ["fantasi","fantasy","magic","sihir"],
  "Fantasi Urban":  ["fantasi urban","urban fantasy","modern magic"],
  "Game":           ["game","gamer","virtual","sao","overlord"],
  "Gourmet":        ["gourmet","food","cooking","shokugeki"],
  "Harem":          ["harem","hareemu","multiple girls"],
  "Horror":         ["horror","scary","ghost","zombie","terror"],
  "Iblis":          ["iblis","demon","maou","devil","akuma"],
  "Josei":          ["josei","mature woman","adult romance"],
  "Ketegangan":     ["ketegangan","thriller","suspense","tension"],
  "Komedi":         ["komedi","comedy","humor","funny"],
  "Live Action":    ["live action","real","dorama"],
  "Makanan":        ["makanan","food","gourmet","cooking"],
  "Martial Arts":   ["martial arts","kung fu","bela diri","taijutsu"],
  "Medis":          ["medis","medical","dokter","hospital","surgery"],
  "Militer":        ["militer","military","war","army","tactic"],
  "Misteri":        ["misteri","mystery","detective","case","clue"],
  "Mitologi":       ["mitologi","mythology","dewa","god","legend"],
  "Mobil":          ["mobil","car","racing","drift","speed"],
  "Musik":          ["musik","music","band","idol","song"],
  "Olahraga":       ["olahraga","sports","athlete","tournament"],
  "Parodi":         ["parodi","parody","satire","spoof"],
  "Perang":         ["perang","war","battle","combat","militer"],
  "Petualangan":    ["petualangan","adventure","journey","quest"],
  "Polisi":         ["polisi","police","cop","detective","crime"],
  "Politik":        ["politik","politics","government","strategy"],
  "Psikologis":     ["psikologis","psychological","mind","mental"],
  "Reinkarnasi":    ["reinkarnasi","reincarnation","tensei","isekai"],
  "Robot":          ["robot","mecha","gundam","evangelion","mech"],
  "Romansa":        ["romansa","romance","love","couple","shoujo"],
  "Samurai":        ["samurai","katana","bushido","sengoku","ronin"],
  "Sci-Fi":         ["sci-fi","science","science fiction","futuristic","gundam","mecha"],
  "Seinen":         ["seinen","adult male","mature","dark"],
  "Sejarah":        ["sejarah","history","historical","period","era"],
  "Sekolahan":      ["sekolahan","school","gakuen","student","campus"],
  "Shoujo":         ["shoujo","girl","magical girl","romance"],
  "Shoujo Ai":      ["shoujo ai","yuri","girls love","lesbian"],
  "Shounen":        ["shounen","boy","young male","battle","power"],
  "Shounen Ai":     ["shounen ai","yaoi","boys love","bromance"],
  "Sihir":          ["sihir","magic","mahou","spell","wizard"],
  "Super Power":    ["super power","kekuatan","ability","quirk","boku no hero"],
  "Supranatural":   ["supranatural","supernatural","paranormal","ghost","spirit"],
  "Thriller":       ["thriller","suspense","tension","mystery","dark"],
  "Time Travel":    ["time travel","waktu","tensei","rewind","loop"],
  "Vampir":         ["vampir","vampire","darah","blood","dracula"],
  "Wuxia":          ["wuxia","xianxia","cultivation","chinese","martial"],
  "Yaoi":           ["yaoi","boys love","shounen ai","bl"],
};

const KATEGORI_LIST = Object.keys(GENRE_KEYWORDS);
