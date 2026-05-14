# AniZone

AniZone adalah web app streaming anime berbasis PWA (Progressive Web App) dengan tampilan modern dan API scraper anime menggunakan Node.js + Express. Project ini dibuat buat nonton anime dengan UI clean, responsif, dan bisa dipasang langsung ke home screen HP. Karena manusia suka ribet, jadi sekalian ada fitur favorit, riwayat tontonan, pencarian anime, sampai multi server streaming.

## Preview Fitur

* Streaming anime langsung dari web
* Search anime realtime
* Detail anime + daftar episode
* Multi server player
* Favorite anime
* Riwayat tontonan
* Dark mode
* Responsive mobile UI
* PWA support (install ke HP seperti aplikasi)
* Backend scraper API menggunakan Express

## Tech Stack

### Frontend

* HTML
* CSS
* Vanilla JavaScript
* PWA (Service Worker + Manifest)

### Backend

* Node.js
* Express.js
* Axios
* Cheerio
* CORS

## Struktur Folder

```bash
anizone-main/
├── api/
│   └── index.js
├── public/
│   ├── app.js
│   ├── style.css
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── bg.jpg
│   └── pp.png
├── package.json
├── vercel.json
└── README.md
```

## Installation

Clone project:

```bash
git clone https://github.com/username/anizone.git
```

Masuk ke folder project:

```bash
cd anizone
```

Install dependency:

```bash
npm install
```

Jalankan server:

```bash
npm start
```

Server akan berjalan di:

```bash
http://localhost:3000
```

## API Endpoint

### Get Latest Anime

```http
GET /api/latest?page=1
```

### Search Anime

```http
GET /api/search?q=naruto
```

### Anime Detail

```http
GET /api/detail?url=anime-url
```

### Watch Episode

```http
GET /api/watch?url=episode-url
```

## Deployment

Project ini sudah support deployment ke:

* Vercel
* Render
* Railway
* VPS Node.js

Deploy ke Vercel tinggal connect repository GitHub. Karena manusia modern lebih suka klik tombol daripada setting server manual sambil nangis baca dokumentasi.

## Screenshot

Tambahkan screenshot project di sini.

```md
![Preview](preview.png)
```

## Disclaimer

Project ini dibuat untuk pembelajaran dan eksperimen teknologi web scraping + streaming interface. Semua konten anime berasal dari pihak ketiga.

## Developer

Developed by KanaWangyy (YoiKage)

GitHub:

```txt
https://github.com/kanawangyy-yoikage
```

## License

MIT License
