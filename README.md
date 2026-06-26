# AniZone — Kuramanime Edition

Anime streaming web app menggunakan **Kuramanime API** via `sankavollerei.web.id/anime/kura`.

## Perubahan dari Otakudesu ke Kuramanime

- **Base URL**: `https://www.sankavollerei.web.id/anime/kura`
- **Endpoint detail**: `GET /anime/:id/:slug` (pakai `animeId` + `slug`)
- **Endpoint watch**: `GET /watch/:id/:slug/:episode`
- **Endpoint batch**: `GET /batch/:id/:slug/:batchId`
- **Quick lists**: `/quick/popular`, `/quick/ongoing`, `/quick/finished`, `/quick/movie`, `/quick/donghua`
- **Properties**: `/properties/genre`, `/properties/season`, `/properties/studio`, `/properties/type`, `/properties/quality`, `/properties/source`, `/properties/country`

## Install & Run

```bash
npm install
npm start
```

Server berjalan di port 3000.

## API Endpoints (Internal)

| Endpoint | Deskripsi |
|---|---|
| GET /api/latest | Anime ongoing terbaru |
| GET /api/search?q= | Pencarian |
| GET /api/detail?url=id/slug | Detail anime |
| GET /api/watch?url=id/slug/ep | Streaming episode |
| GET /api/trending | Anime populer |
| GET /api/schedule | Jadwal rilis |
| GET /api/ongoing | List ongoing |
| GET /api/completed | List selesai |
| GET /api/movie | List movie |
| GET /api/donghua | List donghua |
| GET /api/genres | Semua genre |
| GET /api/seasons | Semua season |
| GET /api/studios | Semua studio |
| GET /api/unlimited | Semua anime A-Z |
