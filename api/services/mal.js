// ─── MAL SERVICE ─────────────────────────────────────────
// Semua integrasi MyAnimeList API dikumpulkan di sini.
// Jika MAL_CLIENT_ID tidak diset, fungsi mengembalikan null / fallback.

const axios = require('axios');
const { MAL_API, MAL_CLIENT_ID } = require('../config');
const { getScrapedSchedule, getScrapedTrending } = require('./scraper');

// Helper header MAL
const malHeaders = () => ({ 'X-MAL-CLIENT-ID': MAL_CLIENT_ID });

// ── Cari satu anime berdasarkan judul ────────────────────
async function getMalAnime(title) {
  if (!MAL_CLIENT_ID) return null;
  try {
    const res = await axios.get(`${MAL_API}/anime`, {
      headers: malHeaders(),
      params : {
        q     : title,
        limit : 1,
        fields: 'synopsis,mean,genres,status,num_episodes,start_season,main_picture,rank,popularity',
      },
    });
    return res.data?.data?.[0]?.node || null;
  } catch { return null; }
}

// ── Jadwal musim ini ──────────────────────────────────────
async function getMalSchedule() {
  if (!MAL_CLIENT_ID) return getScrapedSchedule();

  try {
    const now    = new Date();
    const month  = now.getMonth() + 1;
    const year   = now.getFullYear();
    const season = month >= 10 ? 'fall'
      : month >= 7 ? 'summer'
      : month >= 4 ? 'spring'
      : 'winter';

    const res = await axios.get(`${MAL_API}/anime/season/${year}/${season}`, {
      headers: malHeaders(),
      params : {
        limit : 50,
        fields: 'start_date,mean,num_episodes,status,genres,main_picture,broadcast',
        sort  : 'anime_num_list_users',
      },
    });

    return (res.data?.data || []).map(({ node }) => ({
      id       : node.id,
      title    : node.title,
      image    : node.main_picture?.medium || node.main_picture?.large,
      score    : node.mean || 'N/A',
      episodes : node.num_episodes || '?',
      status   : node.status,
      genres   : (node.genres || []).map(g => g.name).slice(0, 3),
      broadcast: node.broadcast,
      startDate: node.start_date,
      season   : `${season} ${year}`,
    }));
  } catch { return getScrapedSchedule(); }
}

// ── Anime trending / ranking ──────────────────────────────
async function getMalTrending() {
  if (!MAL_CLIENT_ID) return getScrapedTrending();

  try {
    const res = await axios.get(`${MAL_API}/anime/ranking`, {
      headers: malHeaders(),
      params : {
        ranking_type: 'airing',
        limit       : 20,
        fields      : 'mean,genres,num_episodes,status,main_picture,rank',
      },
    });

    return (res.data?.data || []).map(({ node, ranking }) => ({
      rank    : ranking?.rank,
      title   : node.title,
      image   : node.main_picture?.medium || node.main_picture?.large,
      score   : node.mean || 'N/A',
      episodes: node.num_episodes || '?',
      genres  : (node.genres || []).map(g => g.name).slice(0, 2),
      malId   : node.id,
    }));
  } catch { return getScrapedTrending(); }
}

// ── Berita anime ──────────────────────────────────────────
async function getAnimeNews() {
  const axios = require('axios');
  const cheerio = require('cheerio');
  const { PROXY, SCRAPE_HEADERS } = require('../config');

  try {
    const res   = await axios.get(`${PROXY}https://animenewsnetwork.com/newsroom/`, { headers: SCRAPE_HEADERS });
    const $     = cheerio.load(res.data);
    const news  = [];

    $('div.herald.box.news, .news-item, article').each((_, el) => {
      const a     = $(el).find('a').first();
      const title = a.text().trim() || $(el).find('h2, h3').text().trim();
      const href  = a.attr('href');
      const img   = $(el).find('img').first().attr('src');
      const desc  = $(el).find('p, .preview').first().text().trim();
      const date  = $(el).find('time, .date').first().text().trim();

      if (title && title.length > 5) {
        news.push({
          title,
          url        : href ? (href.startsWith('http') ? href : `https://animenewsnetwork.com${href}`) : '#',
          image      : img || '',
          description: desc.substring(0, 200),
          date       : date || new Date().toLocaleDateString('id-ID'),
        });
      }
    });

    if (news.length > 0) return news.slice(0, 12);

    // Fallback: generate from latest anime
    const { getLatest } = require('./scraper');
    const latest = await getLatest(1);
    return latest.slice(0, 8).map(a => ({
      title      : `Update: ${a.title} Episode ${a.episode} Tersedia`,
      url        : a.url,
      image      : a.image,
      description: `Episode terbaru dari ${a.title} sudah dapat ditonton di AniZone.`,
      date       : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
    }));
  } catch {
    return [{
      title      : 'AniZone 2026 - Fitur Baru Telah Hadir!',
      url        : '#',
      image      : '',
      description: 'Nikmati fitur jadwal rilis, berita terbaru, dan anime trending di AniZone 2026.',
      date       : new Date().toLocaleDateString('id-ID'),
    }];
  }
}

module.exports = { getMalAnime, getMalSchedule, getMalTrending, getAnimeNews };
