# AniZone 2026 v2.0.0

Platform streaming anime subtitle Indonesia dengan fitur lengkap — powered by Samehadaku scraper + MyAnimeList API.

## ✨ Fitur

- 📅 **Jadwal Rilis** — Anime musim ini dari MyAnimeList API
- 📰 **Berita Anime** — Dari AnimenewsNetwork & sumber terpercaya
- 🔥 **Anime Trending** — Ranking real-time dari MyAnimeList
- 📖 **Sinopsis MAL** — Deskripsi lengkap via MyAnimeList API v2
- 🛡️ **Admin Panel** — Kelola pengguna, statistik, log aktivitas
- 📱 **PWA** — Bisa diinstall di mobile & desktop
- 🌐 **Clean URLs** — `/login`, `/admin`, `/` tanpa `.html`

---

## 📁 Struktur File

```
anizone/
├── api/
│   └── index.js          # Backend Node.js + Express (Vercel Serverless)
├── public/               ← outputDirectory Vercel (static files)
│   ├── css/
│   │   ├── style.css
│   │   ├── login.css
│   │   └── admin.css
│   ├── js/
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── login.js
│   │   └── admin.js
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   ├── manifest.json
│   ├── sw.js
│   ├── pp.png
│   └── bg.jpg
├── vercel.json           # Config Vercel
└── package.json
```

---

## 🚀 Deploy ke Vercel

### 1. Clone & Install

```bash
git clone <repo-url>
cd anizone
npm install
```

### 2. Set Environment Variables

Di **Vercel Dashboard → Project → Settings → Environment Variables**, tambahkan:

| Variable | Value | Keterangan |
|---|---|---|
| `MAL_CLIENT_ID` | `your_client_id` | Dari myanimelist.net/apiconfig |

> ⚠️ Tanpa `MAL_CLIENT_ID`, fitur jadwal/trending/sinopsis MAL otomatis fallback ke scraper.

### 3. Deploy

```bash
# Install Vercel CLI dulu (jika belum)
npm i -g vercel

# Deploy
vercel --prod
```

Atau push ke GitHub dan connect repo di [vercel.com/new](https://vercel.com/new).

---

## 💻 Development Lokal

```bash
npm run dev
# → http://localhost:3000
```

> File statis di `public/` harus diakses langsung di dev: `http://localhost:3000/public/index.html`  
> Di Vercel (production), akses via `/` karena `outputDirectory` sudah diset ke `public/`.

---

## 🔗 API Endpoints

| Method | Endpoint | Parameter | Deskripsi |
|---|---|---|---|
| GET | `/api/latest` | `?page=1` | Anime terbaru |
| GET | `/api/search` | `?q=naruto` | Cari anime |
| GET | `/api/detail` | `?url=...` | Detail + daftar episode |
| GET | `/api/watch` | `?url=...` | Stream URL per server |
| GET | `/api/trending` | — | Anime trending (MAL ranking) |
| GET | `/api/schedule` | — | Jadwal rilis musiman |
| GET | `/api/news` | — | Berita anime terbaru |
| GET | `/api/mal/description` | `?title=...` | Sinopsis dari MAL |
| GET | `/api/mal/anime` | `?title=...` | Data lengkap MAL |
| GET | `/api/health` | — | Health check |

---

## 🌐 URL Bersih (Production)

| URL | Halaman |
|---|---|
| `/` | Halaman utama |
| `/login` atau `/masuk` | Login & Register |
| `/admin` atau `/panel` | Admin Panel |

---

## 🛡️ Admin Panel

1. Login dengan akun yang punya role `admin`
2. Pergi ke Profil → tombol **Admin Panel** muncul
3. Atau akses langsung: `https://domain.vercel.app/admin`

Untuk set user sebagai admin, update Firestore:
```
users/{uid} → { role: "admin" }
```

---

## ⚠️ Troubleshooting Deploy Vercel

| Problem | Penyebab | Solusi |
|---|---|---|
| Static file 404 | `outputDirectory` tidak diset | Pastikan `"outputDirectory": "public"` ada di `vercel.json` |
| API 500 / crash | `app.listen()` dipanggil di serverless | Jangan panggil `listen()` di production — sudah diperbaiki |
| Rewrite tidak jalan | Path rewrite masih prefix `/public/` | Path harus relatif terhadap `outputDirectory`, misal `/login.html` bukan `/public/login.html` |
| MAL API error | `MAL_CLIENT_ID` belum diset | Set env var di Vercel Dashboard, atau biarkan fallback ke scraper |

---

## 🔌 Tech Stack

- **Frontend**: HTML5 + CSS3 + Vanilla JS
- **Backend**: Node.js + Express (Vercel Serverless Function)
- **Auth & DB**: Firebase Authentication + Firestore
- **Data**: Samehadaku scraper (cheerio + axios) + MyAnimeList API v2
- **Deploy**: Vercel

---

Made with ❤️ by [Caliph](https://github.com/kanawangyy-yoikage)
