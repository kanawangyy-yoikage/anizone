// ─── ANIME MODULE ────────────────────────────────────────
// Kategori, detail, tonton, pencarian, ongoing, completed, A-Z unlimited.

// ── State paginasi ────────────────────────────────────────
const _catState = {
  mode      : 'genre',   // 'genre'|'ongoing'|'completed'|'animelist'
  slug      : '',
  letter    : 'A',
  page      : 1,
  totalPages: 1,
  loading   : false,
};

// ── Halaman Kategori — render tab bar ─────────────────────
async function renderCategoryPage() {
  const view = document.getElementById('anime-view');
  if (view.dataset.rendered === 'true') return;
  view.dataset.rendered = 'true';

  view.innerHTML = `
    <!-- Tab bar navigasi -->
    <div class="anime-tab-bar" id="animeTabBar">
      <button class="anime-tab active" onclick="switchAnimeTab('genre',this)">Genre</button>
      <button class="anime-tab" onclick="switchAnimeTab('ongoing',this)">Ongoing</button>
      <button class="anime-tab" onclick="switchAnimeTab('completed',this)">Selesai</button>
      <button class="anime-tab" onclick="switchAnimeTab('animelist',this)">A–Z</button>
    </div>
    <!-- Konten tiap tab -->
    <div id="anime-tab-content"></div>`;

  switchAnimeTab('genre', view.querySelector('.anime-tab'));
}

function switchAnimeTab(mode, btn) {
  document.querySelectorAll('.anime-tab').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  _catState.mode = mode;
  _catState.page = 1;

  const c = document.getElementById('anime-tab-content');
  c.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';

  switch (mode) {
    case 'genre'     : loadGenreTab(c);      break;
    case 'ongoing'   : loadListTab(c, 'ongoing',   'Sedang Tayang');    break;
    case 'completed' : loadListTab(c, 'completed', 'Anime Selesai');    break;
    case 'animelist' : loadAnimeListTab(c);  break;
  }
}

// ── Tab Genre ─────────────────────────────────────────────
async function loadGenreTab(c) {
  try {
    const genres = await fetch(`${API_BASE}/genres`).then(r => r.json());
    const list = Array.isArray(genres) ? genres : (genres.data?.genreList || genres.data || genres.genres || genres.genreList || []);
    if (!list.length) { c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Tidak ada genre.</p>'; return; }

    c.innerHTML = `
      <div class="genre-pill-bar" id="genrePillBar">
        ${list.map((g, i) => {
          const name = g.name || g.genre || g.title || g.slug || '';
          const slug = g.genreId || g.slug || name.toLowerCase().replace(/\s+/g, '-');
          return `<button class="genre-pill ${i===0?'active':''}" data-slug="${slug}"
            onclick="loadGenreResult('${name.replace(/'/g,"\\'")}','${slug}',this)">${name}</button>`;
        }).join('')}
      </div>
      <div id="genre-result-container" style="padding:0 16px 80px"></div>`;

    // Auto-load genre pertama
    const first = list[0];
    const name = first.name || first.genre || first.title || first.slug || '';
    const slug = first.genreId || first.slug || name.toLowerCase().replace(/\s+/g, '-');
    loadGenreResult(name, slug, c.querySelector('.genre-pill'));
  } catch {
    c.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Gagal memuat genre.</p>';
  }
}

async function loadGenreResult(genre, slug, btn, page = 1) {
  document.querySelectorAll('.genre-pill').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  _catState.slug = slug;
  _catState.page = page;

  const c = document.getElementById('genre-result-container');
  if (!c) return;
  c.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';

  try {
    const data = await fetch(`${API_BASE}/genre/${encodeURIComponent(slug)}?page=${page}`).then(r => r.json());
    const list = Array.isArray(data) ? data : (data.data?.animeList || data.animes || data.data || data.anime || data.results || []);
    const totalPages = data.data?.totalPages || data.totalPages || data.total_pages || 1;
    _catState.totalPages = totalPages;

    if (!list.length) {
      c.innerHTML = '<p style="text-align:center;color:var(--text-muted);margin-top:20px">Tidak ada anime ditemukan.</p>';
      return;
    }
    c.innerHTML = `
      <div class="section-header mt-large"><div class="bar-accent"></div><h2>Anime ${genre}</h2></div>
      <div class="anime-grid">${list.map(animeCardCat).join('')}</div>
      ${paginationHtml(page, totalPages, `loadGenreResult('${genre.replace(/'/g,"\\'")}','${slug}',document.querySelector('.genre-pill.active')`)}`;
    lazyLoadScores(c);
  } catch {
    c.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Gagal memuat.</p>';
  }
}

// ── Tab List (popular/movies/ongoing/completed) ───────────
async function loadListTab(c, endpoint, title, page = 1) {
  _catState.page = page;
  c.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
  try {
    const raw  = await fetch(`${API_BASE}/${endpoint}?page=${page}`).then(r => r.json());
    const list = extractList(raw);
    const totalPages = raw.data?.totalPages || raw.totalPages || raw.total_pages || 1;
    _catState.totalPages = totalPages;

    if (!list.length) {
      c.innerHTML = `<div class="empty-state"><h2>Data tidak tersedia</h2></div>`;
      return;
    }
    c.innerHTML = `
      <div style="padding:14px 16px 10px">
        <div class="section-header"><div class="bar-accent"></div><h2>${title}</h2></div>
      </div>
      <div class="anime-grid" style="padding:0 16px">${list.map(animeCardCat).join('')}</div>
      ${paginationHtml(page, totalPages, `loadListTab(document.getElementById('anime-tab-content'),'${endpoint}','${title}'`)}`;
    lazyLoadScores(c);
  } catch {
    c.innerHTML = `<div class="empty-state"><h2>Gagal memuat data</h2></div>`;
  }
}

// ── Tab A-Z (unlimited) ──────────────────────────────────
let _azCache = null; // cache supaya tidak fetch ulang tiap ganti huruf

async function loadAnimeListTab(c) {
  const letters = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  c.innerHTML = `
    <div class="az-bar" id="azBar">
      ${letters.map(l => `<button class="az-btn ${l==='A'?'active':''}" onclick="loadAZResult('${l}',this)">${l}</button>`).join('')}
    </div>
    <div id="az-result" style="padding:0 16px 80px"><div class="spinner" style="margin:40px auto"></div></div>`;

  // Fetch unlimited sekali, lalu filter per huruf
  if (!_azCache) {
    try {
      const raw = await fetch(`${API_BASE}/unlimited`).then(r => r.json());
      // Response: { data: { list: [{ startWith, animeList:[{title,animeId,href}] }] } }
      _azCache = raw.data?.list || [];
    } catch {
      document.getElementById('az-result').innerHTML =
        '<p style="text-align:center;color:var(--text-muted)">Gagal memuat data.</p>';
      return;
    }
  }
  loadAZResult('A', c.querySelector('.az-btn.active'));
}

function loadAZResult(letter, btn) {
  document.querySelectorAll('.az-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  _catState.letter = letter;

  const c = document.getElementById('az-result');
  if (!c) return;

  if (!_azCache) { c.innerHTML = '<div class="spinner" style="margin:40px auto"></div>'; return; }

  // Cari group yang cocok (startWith '#' atau huruf)
  const group = _azCache.find(g => g.startWith?.toUpperCase() === letter.toUpperCase());
  const list  = group?.animeList || [];

  if (!list.length) {
    c.innerHTML = '<p style="text-align:center;color:var(--text-muted);margin-top:20px">Tidak ada anime ditemukan.</p>';
    return;
  }

  c.innerHTML = `
    <div class="section-header mt-large"><div class="bar-accent"></div><h2>Anime — ${letter}</h2></div>
    <div class="anime-grid">${list.map(animeCardCat).join('')}</div>`;
  lazyLoadScores(c);
}

// ── Tab Karakter dihapus (tidak didukung Otakudesu API) ──

// ── Helpers ───────────────────────────────────────────────
function extractList(raw) {
  const arr = raw.data?.animeList || raw.animes || raw.animeList
    || raw.data?.animes || raw.data || (Array.isArray(raw) ? raw : []);
  return Array.isArray(arr) ? arr : [];
}

function animeCardCat(a) {
  const img   = a.image || a.poster || a.thumbnail || '';
  const title = a.title || '';
  const score = a.score || a.rating || '?';
  const ep    = a.episode || a.episodes || '';
  const slug  = a.animeId || a.slug || a.url || a.endpoint || '';
  const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '');
  const onclick = slug ? `loadDetailBySlug('${slug}')` : `handleSearch('${safeTitle}')`;
  const badgeText = ep ? `Ep ${ep}` : `⭐ ${score}`;
  return `
    <div class="scroll-card-wrapper">
      <div class="scroll-card" onclick="${onclick}">
        <div class="scroll-card-outer">
          <div class="scroll-card-img">
            <img src="${img}" alt="${safeTitle}" loading="lazy">
            <div class="ep-badge" data-mal-title="${safeTitle}">${badgeText}</div>
          </div>
        </div>
        <div class="scroll-card-title">${title}</div>
      </div>
    </div>`;
}

function paginationHtml(page, totalPages, fnPrefix, extraArg = '') {
  if (totalPages <= 1) return '';
  const prev = page > 1 ? `<button class="page-btn" onclick="${fnPrefix},${page-1}${extraArg?','+extraArg:''})">‹ Prev</button>` : '';
  const next = page < totalPages ? `<button class="page-btn" onclick="${fnPrefix},${page+1}${extraArg?','+extraArg:''})">Next ›</button>` : '';
  return `<div class="pagination-bar">${prev}<span class="page-info">Hal ${page} / ${totalPages}</span>${next}</div>`;
}

// ── goToGenre (kompatibilitas dari home) ──────────────────
async function goToGenre(slug) {
  const view = document.getElementById('anime-view');
  if (view.dataset.rendered !== 'true') {
    view.dataset.rendered = '';
    await renderCategoryPage();
  }
  switchAnimeTab('genre', document.querySelector('.anime-tab'));
  // Tunggu genre pills muncul
  await new Promise(r => setTimeout(r, 300));
  const btn = document.querySelector(`.genre-pill[data-slug="${slug}"]`);
  if (btn) {
    const name = btn.textContent.trim();
    loadGenreResult(name, slug, btn);
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
}

// ── Riwayat & Favorit ─────────────────────────────────────
async function loadRecentHistory() {
  const c = document.getElementById('recent-results-container');
  c.innerHTML = '<div class="spinner" style="margin:60px auto 20px"></div>';
  const data = await getHistory();
  if (!data.length) {
    c.innerHTML = emptyState('clock', 'Belum ada riwayat', 'Anime yang baru saja kamu tonton akan muncul di sini.');
    return;
  }
  c.innerHTML = `<div class="anime-grid">${data.map(animeCard).join('')}</div>`;
}

async function loadFavorites() {
  const c = document.getElementById('favorite-results-container');
  c.innerHTML = '<div class="spinner" style="margin:60px auto 20px"></div>';
  const data = await getFavorites();
  if (!data.length) {
    c.innerHTML = emptyState('heart', 'Belum ada Favorit', 'Simpan anime kesukaanmu dengan menekan ikon hati.');
    return;
  }
  c.innerHTML = `<div class="anime-grid">${data.map(animeCard).join('')}</div>`;
}

// ── Pencarian ─────────────────────────────────────────────
async function handleSearch(manualQuery = null) {
  const inp   = document.getElementById('searchInput');
  const query = manualQuery || inp?.value?.trim();
  if (inp && manualQuery) inp.value = manualQuery;
  if (!query) { switchTab('home'); return; }
  openAdvancedSearch(query);
}

// ── Detail by slug ────────────────────────────────────────
async function loadDetailBySlug(slug) {
  if (!slug) return;
  loader(true);
  try {
    // Coba lewat /api/anime/:slug dulu (langsung ke animasu API)
    const data = await fetch(`${API_BASE}/anime/${encodeURIComponent(slug)}`).then(r => r.json());
    const d    = data.detail || data.data || data;
    const url  = d.url || d.href || slug;
    await loadDetail(url);
  } catch { loader(false); }
}

// ── Detail Anime ──────────────────────────────────────────
async function loadDetail(url) {
  loader(true);
  try {
    const data = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`).then(r => r.json());
    ALL_VIEWS.forEach(v => hide(v));
    if (window.innerWidth < 900) hide('bottomNav');
    show('detail-view');

    const info      = data.info || {};
    const isEps      = data.episodes?.length > 0;
    const newestUrl  = isEps ? data.episodes[0].url : '';
    const oldestUrl  = isEps ? data.episodes[data.episodes.length - 1].url : '';

    let newestNum = '?';
    if (isEps) {
      const m = data.episodes[0].title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
      if (m) { newestNum = m[1]; }
      else {
        const n = data.episodes[0].title.match(/\d+/g);
        newestNum = n ? n[n.length - 1] : data.episodes.length;
      }
    }

    // Fetch MAL data paralel dengan detail scraper
    const malData = await fetch(`${API_BASE}/mal/anime?title=${encodeURIComponent(data.title)}`)
      .then(r => r.json()).catch(() => null);

    // Mapping helpers
    const ratingMap = { g:'G - Semua Umur', pg:'PG - Anak-anak', pg_13:'PG-13 - Remaja', r:'R - 17+', 'r+':'R+ - Dewasa', rx:'Rx - Hentai' };
    const statusMap = { currently_airing:'Ongoing', finished_airing:'Selesai', not_yet_aired:'Belum Tayang' };
    const seasonLabelMap = { winter:'Winter', spring:'Spring', summer:'Summer', fall:'Fall' };

    // Merge — MAL prioritas, scraper sebagai fallback
    const status     = (malData?.status ? statusMap[malData.status] || malData.status : null) || info.status || 'Ongoing';
    const type       = info.tipe || info.type || 'TV';
    const totalEps   = malData?.num_episodes || info.total_episode || info.episode || '?';
    const duration   = malData?.duration || info.durasi || info.duration || 'Unknown';
    const score      = malData?.mean || info.score || info.skor || info.rating || 'N/A';
    const description = malData?.synopsis || data.description || info.synopsis || 'Tidak ada deskripsi tersedia.';
    const titleJP    = malData?.alternative_titles?.ja || info.japanese || '';
    const titleEN    = malData?.title_english || malData?.alternative_titles?.en || '';
    const rating     = malData?.rating ? (ratingMap[malData.rating] || malData.rating.toUpperCase()) : '';
    const studios    = malData?.studios?.map(s => s.name).join(', ') || '';
    const source     = malData?.source ? malData.source.replace(/_/g, ' ') : '';
    const rank       = malData?.rank ? `#${malData.rank}` : '';
    const popularity = malData?.popularity ? `#${malData.popularity}` : '';

    const genreText = info.genre || info.genres || '';
    const genres = genreText ? genreText.split(',').map(g => g.trim()).filter(Boolean) : (malData?.genres?.map(g => g.name) || ['Anime']);

    let seasonInfo = '';
    if (malData?.start_season) {
      const s = malData.start_season;
      seasonInfo = `${seasonLabelMap[s.season] || s.season} ${s.year}`.trim();
    } else {
      const musim = info.musim || info.season || '';
      const rilis = info.dirilis || info.released || '';
      seasonInfo = `${musim} ${rilis}`.trim() || 'Unknown Date';
    }

    saveHistory({ url, title: data.title, image: data.image, score });
    const isFav = await checkFavorite(url);

    window._currentAnime = { url, title: data.title, image: data.image, score, episodes: data.episodes || [] };
    if (typeof GESTURES !== 'undefined') GESTURES.setEpisodeList(data.episodes || [], null);

    // Build metadata grid
    const metaRows = [
      { label: 'STATUS',       html: `<span class="meta-pill">${status.toUpperCase()}</span>` },
      { label: 'TOTAL EPS',    html: `<span class="meta-value">${totalEps}</span>` },
      { label: 'DURASI',       html: `<span class="meta-value">${duration}</span>` },
      { label: 'TIPE',         html: `<span class="meta-value">${type}</span>` },
      studios    ? { label: 'STUDIO',      html: `<span class="meta-value">${studios}</span>` }    : null,
      source     ? { label: 'SOURCE',      html: `<span class="meta-value">${source}</span>` }     : null,
      rating     ? { label: 'RATING',      html: `<span class="meta-value">${rating}</span>` }     : null,
      rank       ? { label: 'RANK MAL',    html: `<span class="meta-value">${rank}</span>` }       : null,
      popularity ? { label: 'POPULARITAS', html: `<span class="meta-value">${popularity}</span>` } : null,
      titleEN    ? { label: 'JUDUL ENG',   html: `<span class="meta-value">${titleEN}</span>`, span: true } : null,
    ].filter(Boolean);

    document.getElementById('anime-info').innerHTML = `
      <div class="detail-breadcrumb">Beranda / ${data.title}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <h1 class="detail-title">${data.title}</h1>
        <button id="favBtn" class="btn-fav-detail ${isFav ? 'active' : ''}"
          onclick="toggleFavorite('${url}','${data.title.replace(/'/g,"\\'")}','${data.image}','${score}')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="${isFav ? 'var(--danger)' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      ${titleJP ? `<div class="detail-subtitle">${titleJP}</div>` : ''}
      <div class="detail-main-layout">
        <div class="detail-poster"><img src="${data.image}" alt="${data.title}"></div>
        <div class="detail-info-col">
          <div class="detail-badges">
            <span class="badge status">${status.replace(' ', '_')}</span>
            <span class="badge score">⭐ ${score}</span>
            <span class="badge type">${type}</span>
          </div>
          <div class="detail-genres">${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>
          <div class="detail-season">${seasonInfo.toUpperCase()}</div>
          <p class="detail-synopsis">${description}</p>
          <div class="detail-actions">
            <button class="btn-action" onclick="${oldestUrl ? `loadVideo('${oldestUrl}')` : "alert('Belum ada episode')"}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Nonton
            </button>
            <button class="btn-action" onclick="${newestUrl ? `loadVideo('${newestUrl}')` : "alert('Belum ada episode')"}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Terbaru (${newestNum})
            </button>
          </div>
          <div id="bookmarkBtnContainer" style="margin-top:10px"></div>
        </div>
      </div>
      <div class="metadata-grid">
        ${metaRows.map(r => `
        <div class="meta-item"${r.span ? ' style="grid-column:span 2"' : ''}>
          <span class="meta-label">${r.label}</span>
          ${r.html}
        </div>`).join('')}
      </div>`;

    document.getElementById('episode-header-container').innerHTML = `
      <div class="ep-header-wrapper">
        <h2 class="ep-header-title">Daftar Episode</h2>
        ${isEps ? `<div class="ep-range-badge">1 – ${newestNum}</div>` : ''}
      </div>`;

    const animeTitle = data.title || '';
    const animeImage = data.image || '';
    const animeScore = score || '?';
    document.getElementById('episode-grid').innerHTML = data.episodes.map((ep, i) => {
      const num = ep.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i)?.[1]
        || (ep.title.match(/\d+/g) || [i + 1]).slice(-1)[0];
      const epLabel = escapeStr(`${animeTitle} - Ep ${num}`);
      return `<div class="ep-box" title="${ep.title}" style="animation-delay:${Math.min(i * 0.02, 0.3)}s">
        <span class="ep-num" onclick="loadVideo('${ep.url}')">${num}</span>
        <button class="ep-bm-btn" title="Bookmark episode ini"
          onclick="event.stopPropagation();bookmarkEpisode('${ep.url}','${epLabel}','${escapeStr(animeImage)}','${animeScore}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>`;
    }).join('');

    if (typeof CW !== 'undefined') CW.renderEpisodeProgress(data.episodes, url);
    if (typeof loadRecommendations !== 'undefined') {
      const detailView = document.getElementById('detail-view');
      detailView.querySelectorAll('[id^="reco-container-"]').forEach(el => el.remove());
      const recoContainer = document.createElement('div');
      recoContainer.id = 'reco-container-' + Date.now();
      recoContainer.style.cssText = 'padding-bottom:90px';
      detailView.appendChild(recoContainer);
      loadRecommendations(recoContainer);
    }

    await renderBookmarkBtn(url, data.title, data.image, score);
  } catch (e) { console.error(e); } finally { loader(false); }
}

// ── Tonton Episode ────────────────────────────────────────
async function loadVideo(url) {
  loader(true);
  try {
    const data    = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`).then(r => r.json());
    hide('detail-view'); show('watch-view');
    if (window.innerWidth < 900) hide('bottomNav');

    document.getElementById('video-title').textContent = data.title;
    const player  = document.getElementById('video-player');
    const servers = document.getElementById('server-options');

    const anime = window._currentAnime || {};
    if (typeof CW !== 'undefined') CW.attachToPlayer(url, data.title, anime.url, anime.title, anime.image);
    if (typeof GESTURES !== 'undefined' && anime.episodes) GESTURES.setEpisodeList(anime.episodes, url);

    if (data.streams?.length > 0) {
      await loadStreamSrc(player, data.streams[0]);
      servers.innerHTML = data.streams.map((s, i) => {
        const sid  = s.serverId || '';
        const surl = s.url || '';
        const attr = sid ? `data-serverid="${sid}"` : `data-url="${surl}"`;
        return `<button class="server-tag ${i === 0 ? 'active' : ''}" ${attr} onclick="changeServerAuto(this)">${s.server}</button>`;
      }).join('');
    } else {
      alert('Maaf, stream belum tersedia untuk episode ini.');
    }

    const dlSection = document.getElementById('download-section');
    const dlList    = document.getElementById('download-list');
    if (data.downloads?.length > 0) {
      const byFormat = {};
      data.downloads.forEach(d => {
        if (!byFormat[d.format]) byFormat[d.format] = [];
        byFormat[d.format].push(d);
      });
      dlList.innerHTML = Object.entries(byFormat).map(([fmt, items]) => `
        <div class="dl-format-group">
          <div class="dl-format-label">${fmt}</div>
          ${items.map(item => `
            <div class="dl-row">
              <span class="dl-res">${item.resolution}</span>
              <div class="dl-links">
                ${item.links.map(l => `<a class="dl-btn" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.host}</a>`).join('')}
              </div>
            </div>`).join('')}
        </div>`).join('');
      dlSection.style.display = 'block';
    } else {
      dlSection.style.display = 'none';
    }
  } catch {} finally { loader(false); }
}

async function loadStreamSrc(player, stream) {
  let src = stream.url || '';
  if (!src && stream.serverId) {
    try {
      const r = await fetch(`${API_BASE}/server/${encodeURIComponent(stream.serverId)}`);
      const d = await r.json();
      src = d.url || '';
    } catch {}
  }
  if (src) player.src = src;
}

async function changeServerAuto(btn) {
  document.querySelectorAll('.server-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const player   = document.getElementById('video-player');
  const url      = btn.dataset.url      || '';
  const serverId = btn.dataset.serverid || '';
  await loadStreamSrc(player, { url, serverId });
}

function changeServer(url, btn) {
  document.getElementById('video-player').src = url;
  document.querySelectorAll('.server-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function goHome()       { switchTab('home'); }
function backToDetail() {
  if (typeof CW !== 'undefined') CW.detach();
  hide('watch-view'); show('detail-view');
  document.getElementById('video-player').src = '';
  if (window.innerWidth < 900) show('bottomNav');
}

function markEpisodeComplete() {
  if (typeof CW === 'undefined') return;
  const url = CW._currentUrl;
  if (!url) return;
  CW.markCompleted(url);
  const bar = document.getElementById('cwProgressBar');
  if (bar) bar.style.width = '100%';
  if (typeof showToast === 'function') showToast('Episode ditandai selesai!');
}

// Kompatibilitas lama
function renderCategoryPage_old() { renderCategoryPage(); }
function loadCategory(genre, slug, btn) { loadGenreResult(genre, slug, btn); }
