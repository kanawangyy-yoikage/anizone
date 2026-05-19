# AniZone 2026 v2.0.0

Platform streaming anime subtitle Indonesia dengan fitur lengkap.

## 🚀 Fitur Baru

- 📅 **Jadwal Rilis Terjadwal** — Anime musim ini dari MyAnimeList API
- 📰 **Berita Anime Terbaru** — Dari AnimenewsNetwork & sumber terpercaya
- 🔥 **Anime Trending** — Ranking real-time dari MyAnimeList
- 📖 **Deskripsi dari MAL** — Sinopsis lengkap via MyAnimeList API v2
- 🛡️ **Admin Panel Lengkap** — Kelola pengguna, statistik, log aktivitas
- 🗂️ **File Terpisah** — HTML / CSS / JS masing-masing file sendiri
- 🌐 **Clean URLs** — `/login`, `/admin`, `/` tanpa `.html`

## 📁 Struktur File

```
anizone/
├── api/
│   └── index.js          # Backend Node.js + Express
├── public/
│   ├── css/
│   │   ├── style.css     # Style utama (app)
│   │   └── admin.css     # Style admin panel
│   ├── js/
│   │   ├── app.js        # Logic utama aplikasi
│   │   ├── auth.js       # Auth & profil Firebase
│   │   └── admin.js      # Logic admin panel
│   ├── index.html        # Halaman utama
│   ├── login.html        # Halaman login/register
│   ├── admin.html        # Admin panel
│   ├── manifest.json     # PWA manifest
│   ├── sw.js             # Service Worker
│   ├── pp.png            # App icon
│   └── bg.jpg            # Background image
├── vercel.json           # Config Vercel (clean URLs)
└── package.json
```

## 🔧 Setup

### 1. Clone & Install

```bash
git clone <repo>
cd anizone
npm install
```

### 2. Environment Variables

Buat `.env` atau set di Vercel dashboard:

```env
MAL_CLIENT_ID=your_myanimelist_client_id
```

Dapatkan MAL Client ID di: https://myanimelist.net/apiconfig

### 3. Jalankan Lokal

```bash
npm run dev
```

### 4. Deploy ke Vercel

```bash
vercel --prod
```

## 🔗 API Endpoints

| Endpoint | Deskripsi | Parameter |
|---|---|---|
| `GET /api/latest` | Anime terbaru | `?page=1` |
| `GET /api/search` | Cari anime | `?q=naruto` |
| `GET /api/detail` | Detail anime | `?url=...` |
| `GET /api/watch` | Stream URL | `?url=...` |
| `GET /api/trending` | Anime trending MAL | — |
| `GET /api/schedule` | Jadwal rilis musiman | — |
| `GET /api/news` | Berita anime | — |
| `GET /api/mal/description` | Deskripsi dari MAL | `?title=...` |
| `GET /api/mal/anime` | Data lengkap MAL | `?title=...` |

## 🌐 URL Bersih (setelah deploy)

- `/` → Halaman utama
- `/login` → Login & Register
- `/admin` → Admin Panel (hanya untuk role admin)

## 🛡️ Admin Panel

Untuk mengakses admin panel:
1. Login dengan akun yang memiliki role `admin`
2. Pergi ke Profil → tombol "Admin Panel" akan muncul
3. Atau akses langsung: `domain.vercel.app/admin`

Untuk set user sebagai admin, update Firestore:
```
users/{uid} → { role: "admin" }
```

## 📱 PWA

AniZone support installasi sebagai Progressive Web App di mobile dan desktop.

## 🔌 Tech Stack

- **Frontend**: HTML5 + CSS3 + Vanilla JS (terpisah per file)
- **Backend**: Node.js + Express
- **Database & Auth**: Firebase (Firestore + Authentication)
- **Anime Data**: Samehadaku scraper + MyAnimeList API v2
- **Deploy**: Vercel

---

Made with ❤️ by [Caliph](https://github.com/kanawangyy-yoikage)
