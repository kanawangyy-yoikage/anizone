<div align="center">

# 🎌 AniZone 2026

### Modern Anime Streaming Platform Indonesia

Anime streaming platform powered by Samehadaku scraper + MyAnimeList API.  
Fast, clean, responsive, and installable as PWA.

<img src="public/pp.png" width="180"/>

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node.js-18+-green)
![License](https://img.shields.io/badge/license-MIT-purple)
![Status](https://img.shields.io/badge/status-active-success)

</div>

---

# ✨ Features

- 🎥 Streaming anime subtitle Indonesia
- 🔍 Anime search system
- 📈 Real-time anime trending
- 📅 Seasonal anime schedule
- 📰 Anime news update
- 📖 MyAnimeList synopsis integration
- 👤 Authentication system
- 🛠️ Admin dashboard
- 📱 Progressive Web App (PWA)
- ⚡ Clean URLs support
- ☁️ Vercel deployment ready

---

# 🖼️ Preview

## Home Page
<img src="preview/home.png"/>

## Admin Panel
<img src="preview/admin.png"/>

---

# 🧱 Tech Stack

| Category | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend | Node.js, Express |
| Database | Firebase Firestore |
| Authentication | Firebase Auth |
| Anime Source | Samehadaku Scraper |
| Anime Metadata | MyAnimeList API v2 |
| Deployment | Vercel / Railway |

---

# 📂 Project Structure

```bash
anizone/
├── api/
├── docker/
├── php/
├── public/
│   ├── css/
│   ├── js/
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   ├── manifest.json
│   └── sw.js
├── Dockerfile
├── package.json
└── railway.toml
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/kanawangyy-yoikage/anizone.git
cd anizone
```

## Install Dependencies

```bash
npm install
```

---

# 🔑 Environment Variables

Create `.env`

```env
MAL_CLIENT_ID=your_myanimelist_client_id
```

Get API key from:

https://myanimelist.net/apiconfig

---

# 🚀 Run Local Development

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

---

# ☁️ Deploy to Vercel

## Install Vercel CLI

```bash
npm i -g vercel
```

## Deploy

```bash
vercel --prod
```

Or directly connect repository on:

https://vercel.com/new

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

---

# 🔥 Roadmap

- [ ] Multi server streaming
- [ ] Anime watchlist
- [ ] Continue watching
- [ ] Dark mode improvement
- [ ] Mobile app version
- [ ] Discord RPC integration

---

# 🛡️ Disclaimer

AniZone does not host any video files.  
All content is provided by third-party sources.

---

# 👑 Author

Made with caffeine and sleep deprivation by:

## Caliph / YoiKage

- GitHub: https://github.com/kanawangyy-yoikage

---

# ⭐ Support

If this project helped you:

- Star this repository
- Fork this repository
- Share to fellow wibu degenerates
