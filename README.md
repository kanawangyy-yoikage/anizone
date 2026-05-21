# AniZone

<p align="center">
  <img src="https://raw.githubusercontent.com/kanawangyy-yoikage/anizone/main/public/icons/icon-512.png" width="120" alt="AniZone Logo">
</p>

<p align="center">
  Modern anime streaming & scraping web application built with Node.js, Express, Vanilla JavaScript, and Samehadaku parser.
</p>

<p align="center">
  <img src="https://img.shields.io/github/license/kanawangyy-yoikage/anizone?color=blue">
  <img src="https://img.shields.io/github/stars/kanawangyy-yoikage/anizone?style=social">
  <img src="https://img.shields.io/github/repo-size/kanawangyy-yoikage/anizone">
  <img src="https://img.shields.io/github/last-commit/kanawangyy-yoikage/anizone">
</p>

---

## Preview

<p align="center">
  <img src="https://placehold.co/1000x500/111827/ffffff?text=AniZone+Preview" alt="AniZone Preview">
</p>

> Replace this preview image with actual screenshots later.  
> Humans click shiny images faster than they read documentation. Tragic species.

---

# Features

- Modern responsive anime streaming UI
- Anime scraping from Samehadaku
- Search anime instantly
- Latest anime updates
- Trending anime section
- Watch anime episodes
- Anime detail pages
- Episode list support
- MyAnimeList metadata integration
- Progressive Web App (PWA)
- Mobile friendly layout
- Admin panel
- Dark mode aesthetic
- Docker support
- REST API backend
- Fast lightweight frontend without framework bloat

---

# Tech Stack

## Frontend
- HTML5
- CSS3
- Vanilla JavaScript

## Backend
- Node.js
- Express.js
- Axios
- Cheerio

## Other
- PWA
- Docker
- Samehadaku Scraper
- MyAnimeList API

---

# Project Structure

```bash
anizone/
├── api/
│   └── index.js
│
├── public/
│   ├── css/
│   ├── js/
│   ├── icons/
│   ├── manifest.json
│   └── sw.js
│
├── index.html
├── login.html
├── admin.html
├── package.json
├── Dockerfile
└── README.md
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/kanawangyy-yoikage/anizone.git
cd anizone
```

## Install Dependencies

```bash
npm install
```

## Run Development Server

```bash
npm run dev
```

## Run Production

```bash
npm start
```

Server will run on:

```bash
http://localhost:3000
```

Because apparently every web project on earth must worship port 3000.

---

# Environment Variables

Create `.env` file:

```env
PORT=3000

MAL_CLIENT_ID=your_myanimelist_client_id

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

# API Endpoints

## Get Latest Anime

```http
GET /api/latest
```

## Search Anime

```http
GET /api/search?q=naruto
```

## Anime Detail

```http
GET /api/anime/:slug
```

## Watch Episode

```http
GET /api/watch/:slug
```

## Trending Anime

```http
GET /api/trending
```

---

# Progressive Web App (PWA)

AniZone supports PWA features:

- Installable on mobile
- Offline support
- App-like experience
- Faster caching

---

# Docker Support

## Build Docker Image

```bash
docker build -t anizone .
```

## Run Container

```bash
docker run -p 3000:3000 anizone
```

Tiny Linux boxes running anime scrapers. Humanity truly reached peak civilization.

---

# Deployment

You can deploy AniZone using:

- Vercel
- Railway
- Render
- VPS
- Docker
- Self-hosted server

---

# Known Issues

- Scraper may break if Samehadaku changes HTML structure
- Proxy dependency may sometimes fail
- MAL API rate limits can occur
- Some anime streams may become unavailable

Welcome to web scraping. Building software on top of somebody else's HTML is basically controlled suffering.

---

# Future Plans

- User authentication
- Bookmark anime
- Watch history
- Anime recommendations
- Better caching system
- Better admin dashboard
- Episode notifications
- Multi-source scraping
- Comments system
- Real database integration

---

# Contributing

Pull requests are welcome.

If you find bugs, open an issue.

If you destroy production, at least leave good commit messages.

---

# License

This project is licensed under the MIT License.

Meaning:
- You can use it
- Modify it
- Share it
- Commercialize it

Just don't pretend you created the whole thing yourself like some LinkedIn motivational tech guru.

---

# Credits

- Samehadaku
- MyAnimeList
- Open source community
- Coffee and sleep deprivation

---

<p align="center">
  Made with questionable sanity by YoiKage
</p>
