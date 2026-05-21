<div align="center">

# 🎌 AniZone 2026

### Modern Anime Streaming Platform Indonesia

> Fast. Clean. Responsive. Installable.  
> Dibuat untuk para wibu yang hidupnya setengah anime, setengah bug fixing.

<br>

<img src="public/pp.png" width="180"/>

<br><br>

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node.js-18+-green)
![PHP](https://img.shields.io/badge/php-8+-777BB4)
![License](https://img.shields.io/badge/license-MIT-purple)
![Status](https://img.shields.io/badge/status-active-success)

<br>

Anime streaming platform powered by **Samehadaku Scraper** + **MyAnimeList API**.  
Built with pure chaos, caffeine, insomnia, and questionable life choices.

</div>

---

# 🧠 What is AniZone?

AniZone adalah platform streaming anime modern berbasis web yang fokus ke performa, tampilan clean, dan pengalaman pengguna yang gak bikin pengen banting monitor.

Project ini dibuat karena kebanyakan website anime sekarang:
- penuh iklan judi
- player lemot
- UI kek hasil copy paste 2017
- scroll dikit disuruh close popup 18 kali

Peradaban manusia gagal total.

Jadi lahirlah AniZone.

Menggunakan:
- 🔥 Samehadaku Scraper
- 📖 MyAnimeList API
- ⚡ Vanilla JS
- ☁️ Firebase
- 🐘 PHP optional backend
- 🧠 sedikit kewarasan developer yang tersisa

---

# ✨ Features

## 🎥 Anime Streaming
Streaming anime subtitle Indonesia dengan source otomatis.

Tidak host video sendiri.  
Tenang aja, pengacara copyright gak usah lari sprint dulu.

---

## 🔍 Fast Anime Search
Cari anime dengan cepat tanpa loading 3 generasi.

---

## 📈 Trending Anime
Realtime trending anime dari MyAnimeList.

Biar bisa ikut nonton anime mainstream sambil pura-pura bilang:
> "gw beda dari yang lain"

---

## 📅 Anime Schedule
Jadwal anime seasonal realtime.

Karena manusia modern perlu sistem untuk mengatur jadwal nangis mingguan.

---

## 📰 Anime News
Update berita anime terbaru.

Termasuk:
- studio collapse
- author hiatus
- adaptasi random
- fandom ngamuk massal

---

## 📖 MAL Synopsis Integration
Auto fetch synopsis dan metadata dari MyAnimeList API.

Karena nulis deskripsi ribuan anime manual itu termasuk tindakan kriminal terhadap mental developer.

---

## 👤 Authentication System
Firebase authentication support.

Login system modern tanpa harus bikin session PHP horor tahun 2009.

---

## 🛠️ Admin Dashboard
Panel admin buat manage sistem dan konten.

Karena semua developer pasti punya mimpi bikin dashboard.  
Entah dipakai atau gak.

---

## 📱 Progressive Web App (PWA)
Bisa diinstall kayak aplikasi native.

Browser modern benar-benar bilang:
> "gimana kalau website pura-pura jadi app"

Dan entah kenapa berhasil.

---

## ⚡ Clean URLs
URL bersih dan enak dilihat.

Bukan:
```url
watch.php?id=7272&type=anime_final_fix_real_v2
```

Itu bukan URL.  
Itu teriakan minta tolong.

---

## ☁️ Deploy Ready
Support:
- Vercel
- Railway
- VPS
- Docker
- Shared Hosting
- server tua peninggalan leluhur juga mungkin bisa

---

## 🐘 Optional PHP Backend
Iya. Ada PHP juga.

Sebelum frontend elitist ngamuk:
PHP masih hidup.  
Masih dipakai.  
Masih menghasilkan duit.

Sakit? Memang.

---

# 🖼️ Preview

## 🏠 Home Page

<img src="preview/home.png"/>

---

## 🛠️ Admin Panel

<img src="preview/admin.png"/>

---

# 🧱 Tech Stack

| Category | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js, Express, PHP |
| Database | Firebase Firestore |
| Authentication | Firebase Auth |
| Anime Source | Samehadaku Scraper |
| Anime Metadata | MyAnimeList API v2 |
| Deployment | Vercel / Railway |
| Developer Mental State | Critical |

---

# 📂 Project Structure

```bash
anizone/
├── api/
├── docker/
├── php/
│   ├── api/
│   ├── config/
│   ├── functions/
│   └── index.php
│
├── public/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   ├── manifest.json
│   └── sw.js
│
├── Dockerfile
├── package.json
├── railway.toml
└── README.md
```

Rapih.  
Tidak seperti folder download manusia normal.

---

# ⚙️ Installation

## 📥 Clone Repository

```bash
git clone https://github.com/kanawangyy-yoikage/anizone.git
cd anizone
```

Selamat.  
Sekarang punya tanggung jawab terhadap project baru yang kemungkinan bakal diupdate jam 2 pagi.

---

# 📦 Install Dependencies

```bash
npm install
```

Silakan tunggu Node.js mendownload separuh isi galaksi.

---

# 🔑 Environment Variables

Create `.env`

```env
MAL_CLIENT_ID=your_myanimelist_client_id
```

Get API key from:

```url
https://myanimelist.net/apiconfig
```

Karena semua hal sekarang perlu API key.  
Termasuk mungkin buat buka pintu rumah nanti.

---

# 🚀 Run Development Server

```bash
npm run dev
```

Open browser:

```url
http://localhost:3000
```

Kalau langsung jalan tanpa error:
- hoki
- leluhur melindungi
- atau codingannya lagi baik hati

---

# 🐘 PHP Module

AniZone juga punya optional PHP backend buat:
- shared hosting
- lightweight deployment
- alternative API system
- compatibility server kentang

## Run PHP Server

```bash
cd php
php -S localhost:8000
```

Open:

```url
http://localhost:8000
```

Simple.  
Tidak perlu ritual Kubernetes dan pengorbanan tumbal DevOps.

---

# ☁️ Deploy to Vercel

## Install Vercel CLI

```bash
npm install -g vercel
```

## Deploy

```bash
vercel --prod
```

Atau connect repository langsung ke:

```url
https://vercel.com/new
```

Deployment modern pada dasarnya cuma:
> "klik tombol lalu berdoa"

---

# 🐳 Docker Support

Karena developer modern suka masukin semua hal ke container.

## Build Docker Image

```bash
docker build -t anizone .
```

## Run Container

```bash
docker run -p 3000:3000 anizone
```

Anime dalam kotak.  
Teknologi manusia makin aneh tiap tahun.

---

# 📡 API Endpoints

| Endpoint | Description |
|---|---|
| `/api/latest` | Latest anime |
| `/api/search?q=` | Search anime |
| `/api/detail?url=` | Anime details |
| `/api/watch?url=` | Stream source |
| `/api/trending` | MAL trending |
| `/api/schedule` | Anime schedule |
| `/api/news` | Anime news |
| `/api/health` | Health check |

API bersih.  
Tidak ada XML kutukan dari zaman batu.

---

# 🔥 Roadmap

- [ ] Multi server streaming
- [ ] Anime watchlist
- [ ] Continue watching
- [ ] Better dark mode
- [ ] Mobile app version
- [ ] Discord RPC integration
- [ ] Recommendation AI
- [ ] Offline caching
- [ ] User profile customization
- [ ] Mengurangi penderitaan developer sebesar 1%

---

# 🛡️ Disclaimer

AniZone tidak meng-host video apapun.

Semua konten berasal dari pihak ketiga.

Project ini dibuat untuk tujuan edukasi dan eksperimen.

Support anime official kalau mampu.  
Studio anime sudah cukup menderita.

---

# 👑 Author

Made with:
- caffeine
- insomnia
- seasonal anime addiction
- keyboard abuse

## Caliph / YoiKage

GitHub:
```url
https://github.com/kanawangyy-yoikage
```

---

# ⭐ Support

Kalau project ini membantu:

- ⭐ Star repository ini
- 🍴 Fork repository ini
- 📢 Share ke sesama wibu
- ☕ Minum air putih
- 💤 Tidur sesekali

Serius.  
Sebagian developer ngoding production jam 4 pagi sambil halusinasi.

---

# 📜 License

Licensed under MIT License.

Artinya:
- bebas dipakai
- bebas dimodif
- bebas didistribusi
- bebas dibikin makin cursed

Asal license aslinya tetap dicantumkan.

Open source adalah cara manusia berbagi penderitaan secara efisien.
