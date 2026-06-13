// ─── ANIME MODULE ────────────────────────────────────────
// Kategori, halaman detail, halaman tonton, dan pencarian.

// ── Halaman Kategori ──────────────────────────────────────
function renderCategoryPage() {
  const grid = document.getElementById('genre-grid');
  if (grid.innerHTML) return; // sudah di-render
  grid.innerHTML = KATEGORI_LIST
    .map(g => `<button class="genre-btn" onclick="loadCategory('${g}',this)"><span>${g}</span></button>`)
    .join('');
  loadCategory(KATEGORI_LIST[0], grid.firstElementChild);
}

async function loadCategory(genre, btn) {
  document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  loader(true);
  try {
    const queries = GENRE_KEYWORDS[genre] || [genre];
    const results = await Promise.all(
      queries.map(q =>
        fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => [])
      )
    );
    let combined = [];
    results.forEach(l => { if (Array.isArray(l)) combined.push(...l); });
    combined = removeDuplicates(combined, 'url');

    const c = document.getElementById('category-results-container');
    if (!combined.length) {
      c.innerHTML = '<p style="text-align:center;color:var(--text-muted);margin-top:20px;">Tidak ada anime ditemukan.</p>';
      return;
    }
    c.innerHTML = `
      <div class="section-header mt-large"><div class="bar-accent"></div><h2>Anime ${genre}</h2></div>
      <div class="anime-grid">
        ${combined.map(a => `
          <div class="scroll-card" onclick="loadDetail('${a.url}')" style="min-width:auto;max-width:none">
            <div class="scroll-card-img">
              <img src="${a.image}" alt="${a.title}" loading="lazy">
              <div class="ep-badge" data-mal-title="${(a.title || '').replace(/"/g, '')}">⭐ ${a.score || '?'}</div>
            </div>
            <div class="scroll-card-title">${a.title}</div>
          </div>`).join('')}
      </div>`;
    lazyLoadScores(c);
  } catch {} finally { loader(false); }
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

  switchTab('home');
  loader(true);
  try {
    const data   = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`).then(r => r.json());
    const homeEl = document.getElementById('home-view');
    homeEl.innerHTML = `
      <div class="home-tab-bar">
        <button class="home-tab active">🔍 Hasil Pencarian</button>
      </div>
      <div class="section-header mt-large"><div class="bar-accent"></div><h2>Hasil: "${query}"</h2></div>
      <div class="anime-grid" style="padding-bottom:80px">
        ${data.map(a => `
          <div class="scroll-card" onclick="loadDetail('${a.url}')" style="min-width:auto;max-width:none">
            <div class="scroll-card-img">
              <img src="${a.image}" alt="${a.title}" loading="lazy">
              <div class="ep-badge">⭐ ${a.score || '?'}</div>
            </div>
            <div class="scroll-card-title">${a.title}</div>
          </div>`).join('')}
      </div>`;
  } catch {} finally { loader(false); }
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
    const status    = info.status || 'Ongoing';
    const type      = info.tipe   || info.type     || 'TV';
    const totalEps  = info.total_episode || info.episode || '?';
    const duration  = info.durasi  || info.duration || '?';
    const musim     = info.musim   || info.season   || '';
    const rilis     = info.dirilis || info.released || '';
    const seasonInfo = `${musim} ${rilis}`.trim() || 'Unknown Date';
    const genreText  = info.genre  || info.genres   || '';
    const genres     = genreText ? genreText.split(',').map(g => g.trim()) : ['Anime'];
    const isEps      = data.episodes?.length > 0;
    const newestUrl  = isEps ? data.episodes[0].url : '';
    const oldestUrl  = isEps ? data.episodes[data.episodes.length - 1].url : '';

    // Nomor episode terbaru
    let newestNum = '?';
    if (isEps) {
      const m = data.episodes[0].title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
      if (m) {
        newestNum = m[1];
      } else {
        const n = data.episodes[0].title.match(/\d+/g);
        newestNum = n ? n[n.length - 1] : data.episodes.length;
      }
    }

    // Skor & deskripsi dari MAL (sudah di-augment di server, fallback fetch langsung)
    let score       = info.score || info.skor || 'N/A';
    let description = data.description || 'Tidak ada deskripsi tersedia.';
    try {
      const malRes  = await fetch(`${API_BASE}/mal/anime?title=${encodeURIComponent(data.title)}`);
      const malData = await malRes.json();
      if (malData?.mean) {
        score = String(malData.mean);
        MAL_SCORE_CACHE.set(data.title, score);
      }
      if (malData?.synopsis) description = malData.synopsis;
    } catch {}

    saveHistory({ url, title: data.title, image: data.image, score });
    const isFav = await checkFavorite(url);

    // ── Store current anime context for continue-watching & gestures ──
    window._currentAnime = { url, title: data.title, image: data.image, score, episodes: data.episodes || [] };
    if (typeof GESTURES !== 'undefined') GESTURES.setEpisodeList(data.episodes || [], null);

    document.getElementById('anime-info').innerHTML = `
      <div class="detail-breadcrumb">Beranda / ${data.title}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <h1 class="detail-title">${data.title}</h1>
        <button id="favBtn" class="btn-fav-detail ${isFav ? 'active' : ''}"
          onclick="toggleFavorite('${url}','${data.title.replace(/'/g, "\\'")}','${data.image}','${score}')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="${isFav ? 'var(--danger)' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <div class="detail-subtitle">${info.japanese || data.title}</div>
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
          <div style="margin-bottom:10px"><span class="mal-badge">📊 MyAnimeList</span></div>
          <div class="detail-actions">
            <button class="btn-action" onclick="${oldestUrl ? `loadVideo('${oldestUrl}')` : "alert('Belum ada episode')"}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Nonton
            </button>
            <button class="btn-action" onclick="${newestUrl ? `loadVideo('${newestUrl}')` : "alert('Belum ada episode')"}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Terbaru (${newestNum})
            </button>
          </div>
        </div>
      </div>
      <div class="metadata-grid">
        <div class="meta-item"><span class="meta-label">STATUS</span><span class="meta-pill">${status.toUpperCase()}</span></div>
        <div class="meta-item"><span class="meta-label">TOTAL EPS</span><span class="meta-value">${totalEps}</span></div>
        <div class="meta-item" style="grid-column:span 2"><span class="meta-label">DURASI</span><span class="meta-value">${duration}</span></div>
      </div>`;

    document.getElementById('episode-header-container').innerHTML = `
      <div class="ep-header-wrapper">
        <h2 class="ep-header-title">Daftar Episode</h2>
        ${isEps ? `<div class="ep-range-badge">1 – ${newestNum}</div>` : ''}
      </div>`;

    document.getElementById('episode-grid').innerHTML = data.episodes.map((ep, i) => {
      const num = ep.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i)?.[1]
        || (ep.title.match(/\d+/g) || [i + 1]).slice(-1)[0];
      return `<div class="ep-box" title="${ep.title}" onclick="loadVideo('${ep.url}')" style="animation-delay:${Math.min(i * 0.02, 0.3)}s">${num}</div>`;
    }).join('');

    // ── Episode progress overlay ──────────────────────────
    if (typeof CW !== 'undefined') {
      CW.renderEpisodeProgress(data.episodes, url);
    }

    // ── Recommendation (async, non-blocking) ─────────────
    if (typeof loadRecommendations !== 'undefined') {
      const detailView = document.getElementById('detail-view');
      detailView.querySelectorAll('[id^="reco-container-"]').forEach(el => el.remove());
      const recoContainer = document.createElement('div');
      recoContainer.id = 'reco-container-' + Date.now();
      recoContainer.style.cssText = 'padding-bottom:90px';
      detailView.appendChild(recoContainer);
      loadRecommendations(recoContainer);
    }

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

    // ── Continue Watching: attach tracker ───────────────
    const anime = window._currentAnime || {};
    if (typeof CW !== 'undefined') {
      CW.attachToPlayer(url, data.title, anime.url, anime.title, anime.image);
    }
    // ── Gestures: update current episode index for swipe nav ──
    if (typeof GESTURES !== 'undefined' && anime.episodes) {
      GESTURES.setEpisodeList(anime.episodes, url);
    }


    if (data.streams?.length > 0) {
      player.src = data.streams[0].url;
      servers.innerHTML = data.streams.map((s, i) =>
        `<button class="server-tag ${i === 0 ? 'active' : ''}" onclick="changeServer('${s.url}',this)">${s.server}</button>`
      ).join('');
    } else {
      alert('Maaf, stream belum tersedia untuk episode ini.');
    }

    // Link unduh — dikelompokkan per format
    const dlSection  = document.getElementById('download-section');
    const dlList     = document.getElementById('download-list');
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

// ── Mark episode as completed manually ────────────────────
function markEpisodeComplete() {
  if (typeof CW === 'undefined') return;
  const url = CW._currentUrl;
  if (!url) return;
  CW.markCompleted(url);
  const bar = document.getElementById('cwProgressBar');
  if (bar) bar.style.width = '100%';
  if (typeof showToast === 'function') showToast('✅ Episode ditandai selesai!');
}
