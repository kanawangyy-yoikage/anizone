# Struktur Project AniZone (Refactored)

## Ringkasan Perubahan

File asli yang besar dipecah menjadi modul-modul kecil berdasarkan tanggung jawabnya.
**Tampilan dan fitur tidak berubah sama sekali.**

---

## Backend (`api/`)

### Sebelum
```
api/index.js   — 409 baris (scraper + MAL + routes + server setup semuanya campur)
```

### Sesudah
```
api/
├── config.js              — Konstanta (URL, header) — edit di sini jika source/proxy ganti
├── index.js               — Entry point: setup Express + routing saja (~60 baris)
└── services/
    ├── scraper.js         — Semua logic scraping samehadaku
    └── mal.js             — Semua integrasi MyAnimeList API + berita
```

**Aturan:** Jika ingin ganti sumber scraping → ubah `scraper.js`.
Jika ingin tambah endpoint MAL → ubah `mal.js`.
Route baru → cukup tambah di `index.js`.

---

## Frontend (`public/js/`)

### Sebelum
```
js/
├── app.js    — 900 baris (semua logika UI campur jadi satu)
└── auth.js   — 642 baris (auth + profil + waifu list)
```

### Sesudah
```
js/
├── auth.js              — Tidak berubah (Firebase auth + profil + waifu)
└── modules/
    ├── config.js        — Konstanta: API_BASE, HOME_SECTIONS, GENRE_KEYWORDS, ALL_VIEWS
    ├── utils.js         — Helper: show/hide/loader/emptyState/animeCard/removeDuplicates
    ├── theme.js         — Dark/light mode + dropdown pengaturan
    ├── firestore.js     — History & favorites (read/write Firestore)
    ├── home.js          — Beranda: slider, sections, trending, jadwal, berita
    ├── anime.js         — Kategori, detail, tonton, pencarian
    ├── developer.js     — Tab developer, follow, WA followers
    └── navigation.js   — switchTab(), init DOMContentLoaded, auth redirect
```

**Aturan:** Setiap modul punya satu tanggung jawab.
- Tambah fitur beranda → `home.js`
- Ubah logika detail/tonton → `anime.js`
- Ubah tema → `theme.js`
- Ubah konstanta genre → `config.js`

---

## PHP (`php/api/`)
Tidak berubah — sudah cukup modular.

---

## Urutan Load Script di `index.html`

```html
<!-- Firebase (harus pertama) -->
firebase-app-compat.js
firebase-auth-compat.js
firebase-firestore-compat.js

<!-- Auth: inisialisasi firebase + profile + waifu (definisikan auth, db) -->
auth.js

<!-- Modul app (urutan penting) -->
modules/config.js      ← konstanta global
modules/utils.js       ← helper yang dipakai semua modul
modules/theme.js       ← independen
modules/firestore.js   ← butuh: auth, db (dari auth.js)
modules/home.js        ← butuh: API_BASE, loader, removeDuplicates, MAL_SCORE_CACHE
modules/anime.js       ← butuh: semua di atas + saveHistory, toggleFavorite
modules/developer.js   ← independen
modules/navigation.js  ← butuh: semua modul sudah load, dipanggil terakhir
```
