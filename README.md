````md
<div align="center">

# 🎌 AniZone 2026

### The Indonesian Anime Streaming Platform That Refuses To Die

Anime streaming platform powered by Samehadaku scraper + MyAnimeList API.  
Built for wibu society that somehow survives on instant noodles, unfinished side projects, and seasonal anime depression.

Fast. Responsive. Installable. Clean.  
No bloated framework nonsense. Just pure anime energy and sleep deprivation.

<img src="public/pp.png" width="180"/>

<br>

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node.js-18+-green)
![PHP](https://img.shields.io/badge/php-8+-777BB4)
![License](https://img.shields.io/badge/license-MIT-purple)
![Status](https://img.shields.io/badge/status-active-success)

</div>

---

# 🧠 What Even Is AniZone?

AniZone is a modern anime streaming platform focused on Indonesian anime communities.

Instead of making another generic streaming clone with 97 ads and a video player held together using duct tape and human suffering, this project tries to be:

- fast
- lightweight
- responsive
- actually usable
- installable as PWA
- deployable without sacrificing your soul

AniZone uses:

- Samehadaku scraper for anime content
- MyAnimeList API for metadata
- Firebase for authentication/database
- Vanilla JS because frameworks reproduce faster than rabbits

This project exists because modern web development somehow turned "show anime list" into a 14GB dependency nightmare.

Humanity truly peaked at `index.html`.

---

# ✨ Features

## 🎥 Anime Streaming
Watch anime subtitle Indonesia directly from scraped sources.

No, AniZone does NOT host the videos itself. Calm down, copyright demons.

---

## 🔍 Smart Anime Search
Search anime titles quickly with responsive results.

Because scrolling endlessly through anime lists like a caveman is inefficient.

---

## 📈 Trending Anime
Real-time trending anime powered by MyAnimeList.

So you can pretend your taste is unique while watching the exact same anime as everyone else.

---

## 📅 Seasonal Schedule
Track currently airing anime schedules.

Finally, a system to organize weekly emotional damage.

---

## 📰 Anime News
Integrated anime news updates.

Useful for finding out which studio exploded this week.

---

## 📖 MAL Synopsis Integration
Automatically fetch anime synopsis and metadata from MyAnimeList API.

Because manually writing 500 anime descriptions would be psychological warfare.

---

## 👤 Authentication System
Firebase Auth integration.

Supports user login system without writing ancient forbidden authentication code from 2009.

---

## 🛠️ Admin Dashboard
Manage content, system settings, and platform controls.

Yes. You get a fancy admin panel.  
Every developer eventually wants a dashboard.  
It's basically a law of nature.

---

## 📱 Progressive Web App (PWA)
Install AniZone like a native app.

Modern browsers really saw websites and said:
> "what if app but website"

And somehow it worked.

---

## ⚡ Clean URL Support
Cleaner routes and better navigation.

No disgusting `page.php?id=7272727&watch=true&type=anime_final_v2_real`.

Civilization advances slowly.

---

## ☁️ Deploy Ready
Supports:
- Vercel
- Railway
- Docker
- Shared hosting
- VPS
- probably your uncle's dusty old server too

---

## 🐘 Optional PHP Backend
Yes, PHP exists here too.

Before frontend elitists start crying:
PHP is still everywhere.  
It survives like a cockroach after nuclear war.

And honestly? Respect.

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
| Developer Mental State | Unstable |

---

# 📂 Project Structure

```bash
anizone/
├── api/
├── docker/
├── php/                        # Optional PHP backend
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
````

Beautiful structure.
Unlike most repositories where everything is thrown into `/src/final_final_fix_real_v2`.

---

# ⚙️ Installation

## 📥 Clone Repository

```bash
git clone https://github.com/kanawangyy-yoikage/anizone.git
cd anizone
```

Congratulations.
You are now legally responsible for another unfinished project.

---

# 📦 Install Dependencies

```bash
npm install
```

Go make coffee.
Node modules are about to download the entire observable universe.

---

# 🔑 Environment Variables

Create `.env`

```env
MAL_CLIENT_ID=your_myanimelist_client_id
```

Get your API key here:

[https://myanimelist.net/apiconfig](https://myanimelist.net/apiconfig)

Because APIs apparently need keys now.
Humanity invented digital bureaucracy.

---

# 🚀 Run Local Development

```bash
npm run dev
```

Open:

```bash
http://localhost:3000
```

If it works first try:

* you're lucky
* your ancestors are protecting you
* or the code accidentally behaved for once

---

# 🐘 PHP Module

AniZone includes optional PHP modules for:

* lightweight hosting
* shared hosting compatibility
* alternative API handling
* legacy server support
* ancient hosting environments maintained by mysterious forces

## Run PHP Server

```bash
cd php
php -S localhost:8000
```

Open:

```bash
http://localhost:8000
```

Simple.
No 400-step Kubernetes ritual required.

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

Or connect repository directly:

[https://vercel.com/new](https://vercel.com/new)

Modern deployment truly became:

> "push button and pray"

---

# 🐳 Docker Support

Because developers love containers almost as much as they love arguing online.

## Build Docker Image

```bash
docker build -t anizone .
```

## Run Container

```bash
docker run -p 3000:3000 anizone
```

Boom. Anime in a box.

---

# 📡 API Endpoints

| Endpoint           | Description    |
| ------------------ | -------------- |
| `/api/latest`      | Latest anime   |
| `/api/search?q=`   | Search anime   |
| `/api/detail?url=` | Anime details  |
| `/api/watch?url=`  | Stream source  |
| `/api/trending`    | MAL trending   |
| `/api/schedule`    | Anime schedule |
| `/api/news`        | Anime news     |
| `/api/health`      | Health check   |

Clean APIs.
No cursed XML responses from prehistoric civilizations.

---

# 🔥 Roadmap

* [ ] Multi server streaming
* [ ] Anime watchlist
* [ ] Continue watching
* [ ] Better dark mode
* [ ] Mobile app version
* [ ] Discord RPC integration
* [ ] Recommendation AI
* [ ] Offline anime caching
* [ ] User profile customization
* [ ] Reduce developer suffering by 2%

---

# 🛡️ Disclaimer

AniZone does NOT host any video files.

All content comes from third-party providers.

This project exists for educational and experimental purposes.

Please support official anime releases whenever possible.
Anime studios deserve better than surviving on instant ramen while producing peak fiction.

---

# 👑 Author

Made with:

* caffeine
* insomnia
* poor life decisions
* anime openings at 3AM

## Caliph / YoiKage

GitHub:
[https://github.com/kanawangyy-yoikage](https://github.com/kanawangyy-yoikage)

---

# ⭐ Support

If this project helped you:

* ⭐ Star this repository
* 🍴 Fork this repository
* 📢 Share to fellow wibu degenerates
* ☕ Stay hydrated while debugging
* 💤 Sleep occasionally

Seriously.
Some of you deploy production apps at 4AM while hallucinating from lack of sleep.

---

# 📜 License

This project is licensed under the MIT License.

Meaning:

* you can use it
* modify it
* distribute it
* break it
* somehow turn it into crypto garbage if you really insist

Just include the original license and copyright.

Humanity invented open source so developers could suffer together efficiently.

```
```
