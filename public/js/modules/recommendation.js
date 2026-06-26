// ─── RECOMMENDATION MODULE ───────────────────────────────
// Rekomendasi berdasarkan genre history user + MAL trending
// Kuramanime edition — url format: animeId/slug
// ─────────────────────────────────────────────────────────

function _kuraUrl(item) {
  if (item.animeId && item.slug) return `${item.animeId}/${item.slug}`;
  return item.url || item.slug || item.endpoint || '';
}

async function loadRecommendations(containerEl) {
  if (!containerEl) return;

  const uid = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
  if (!uid) return;

  try {
    const [histSnap, bmSnap] = await Promise.all([
      db.collection('users').doc(uid).collection('history').orderBy('timestamp', 'desc').limit(50).get(),
      db.collection('users').doc(uid).collection('bookmarks').get(),
    ]);
    const history   = histSnap.docs.map(d => d.data());
    const bookmarks = bmSnap.docs.map(d => d.data());
    const watchedUrls = new Set([...history, ...bookmarks].map(a => a.url).filter(Boolean));

    if (history.length < 2) return;

    // Ambil genre dominan dari history (fetch detail 3 anime terakhir)
    const recentSample = history.slice(0, 3);
    const genreCounts  = {};
    await Promise.all(recentSample.map(async item => {
      try {
        const detail = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(item.url)}`).then(r => r.json());
        const genreStr = detail?.info?.genre || detail?.info?.genres || '';
        genreStr.split(',').forEach(g => {
          const key = g.trim().toLowerCase();
          if (key) genreCounts[key] = (genreCounts[key] || 0) + 1;
        });
      } catch {}
    }));

    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);

    if (!topGenres.length) return;

    // Fetch rekomendasi via search keyword genre
    const searchResults = await Promise.all(
      topGenres.map(g =>
        fetch(`${API_BASE}/search?q=${encodeURIComponent(g)}`).then(r => r.json()).catch(() => [])
      )
    );

    let recommendations = [];
    searchResults.forEach(r => {
      const list = r.data?.animeList || r.data?.animes || r.data || (Array.isArray(r) ? r : []);
      if (Array.isArray(list)) recommendations.push(...list.map(a => ({ ...a, url: _kuraUrl(a) })));
    });

    const seen = new Set();
    recommendations = recommendations.filter(a => {
      if (!a.url || seen.has(a.url) || watchedUrls.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    if (!recommendations.length) return;

    recommendations.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));
    recommendations = recommendations.slice(0, 15);

    const section = document.createElement('div');
    section.className = 'reco-strip';
    section.innerHTML = `
      <div class="section-header" style="padding:14px 16px 10px">
        <div class="bar-accent"></div>
        <h2>Rekomendasi Untukmu</h2>
        <span class="reco-genre-hint">Berdasarkan: ${topGenres.join(', ')}</span>
      </div>
      <div class="horizontal-scroll">
        ${recommendations.map((a, i) => _recoCard(a, i)).join('')}
      </div>`;
    containerEl.appendChild(section);
    if (typeof lazyLoadScores === 'function') lazyLoadScores(section);

    // "Because you watched X"
    if (history[0]) await loadBecauseYouWatched(history[0], watchedUrls, containerEl);

  } catch (e) { console.error('[reco]', e); }
}

function _recoCard(a, i) {
  const epNum     = a.episode ? (a.episode.match(/\d+(\.\d+)?/) || [''])[0] : '';
  const epText    = epNum ? `EP ${epNum}` : '';
  const typeText  = a.type || 'TV';
  const badgeText = [epText, typeText].filter(Boolean).join(' · ');
  const shortTitle = (a.title || '').length > 35 ? a.title.substring(0, 35) + '...' : (a.title || '');
  const score     = a.score && a.score !== 'N/A' ? a.score : '';
  const genres    = Array.isArray(a.genres)
    ? a.genres.slice(0, 2).join(', ')
    : String(a.genres || '').split(',').slice(0, 2).map(g => g.trim()).join(', ');
  const url = a.url || _kuraUrl(a);
  return `
    <div class="scroll-card-wrapper"
      data-title="${a.title || ''}"
      data-score="${score}"
      data-type="${typeText}"
      data-url="${url}"
      data-genres="${genres}">
      <div class="scroll-card" onclick="loadDetail('${url}')" style="animation-delay:${i * 0.04}s">
        <div class="scroll-card-outer">
          <div class="scroll-card-img">
            <img src="${a.poster || a.image || ''}" alt="${a.title || ''}" loading="lazy">
            <div class="ep-badge" data-mal-title="${(a.title || '').replace(/"/g, '')}">${badgeText}</div>
          </div>
        </div>
        <div class="scroll-card-title">${shortTitle}</div>
      </div>
    </div>`;
}

async function loadBecauseYouWatched(anime, watchedUrls, containerEl) {
  try {
    const words = (anime.title || '').replace(/[^a-z0-9 ]/gi, ' ').split(' ')
      .filter(w => w.length > 3).slice(0, 2);
    if (!words.length) return;

    const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(words[0])}`).then(r => r.json()).catch(() => []);
    const raw = r.data?.animeList || r.data?.animes || r.data || (Array.isArray(r) ? r : []);
    const similar = raw.map(a => ({ ...a, url: _kuraUrl(a) }));
    const filtered = similar.filter(a => a.url && !watchedUrls.has(a.url)).slice(0, 10);
    if (filtered.length < 3) return;

    const byw = document.createElement('div');
    byw.innerHTML = `
      <div class="section-header" style="padding:14px 16px 10px">
        <div class="bar-accent"></div>
        <h2>Karena kamu nonton <em>${anime.title}</em></h2>
      </div>
      <div class="horizontal-scroll">
        ${filtered.map((a, i) => _recoCard(a, i)).join('')}
      </div>`;
    containerEl.appendChild(byw);
    if (typeof lazyLoadScores === 'function') lazyLoadScores(byw);
  } catch {}
}
