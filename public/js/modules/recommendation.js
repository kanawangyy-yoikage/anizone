// ─── RECOMMENDATION MODULE ───────────────────────────────
// Rekomendasi berdasarkan:
//  1. Genre dari history user (genre-based CF lite)
//  2. MAL trending yang belum ditonton
//  3. "Because you watched X" — anime dengan judul/kata mirip
// ─────────────────────────────────────────────────────────

async function loadRecommendations(containerEl) {
  if (!containerEl) return;

  const uid = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
  if (!uid) return;

  try {
    // 1. Ambil history + bookmarks
    const [histSnap, bmSnap] = await Promise.all([
      db.collection('users').doc(uid).collection('history').orderBy('timestamp', 'desc').limit(50).get(),
      db.collection('users').doc(uid).collection('bookmarks').get(),
    ]);
    const history   = histSnap.docs.map(d => d.data());
    const bookmarks = bmSnap.docs.map(d => d.data());
    const watchedUrls = new Set([...history, ...bookmarks].map(a => a.url).filter(Boolean));

    if (history.length < 2) return; // not enough data

    // 2. Ambil genre dominan dari history
    // Kita fetch detail 3 anime terakhir untuk mendapat genre
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

    // Top 2 genres
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([g]) => g);

    if (!topGenres.length) return;

    // 3. Fetch recommendations berdasarkan genre
    const searchResults = await Promise.all(
      topGenres.map(g =>
        fetch(`${API_BASE}/search?q=${encodeURIComponent(g)}`).then(r => r.json()).catch(() => [])
      )
    );

    let recommendations = [];
    searchResults.forEach(arr => {
      if (Array.isArray(arr)) recommendations.push(...arr);
    });

    // Deduplicate + filter sudah ditonton
    const seen = new Set();
    recommendations = recommendations.filter(a => {
      if (!a.url || seen.has(a.url) || watchedUrls.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    if (!recommendations.length) return;

    // 4. Sort by score desc
    recommendations.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));
    recommendations = recommendations.slice(0, 15);

    // 5. Render
    const section = document.createElement('div');
    section.className = 'reco-strip';
    section.innerHTML = `
      <div class="section-header" style="padding:14px 16px 10px">
        <div class="bar-accent"></div>
        <h2>✨ Rekomendasi Untukmu</h2>
        <span class="reco-genre-hint">Berdasarkan: ${topGenres.join(', ')}</span>
      </div>
      <div class="horizontal-scroll">
        ${recommendations.map(a => `
          <div class="scroll-card" onclick="loadDetail('${a.url}')">
            <div class="scroll-card-img">
              <img src="${a.image || ''}" alt="${a.title}" loading="lazy">
              <div class="ep-badge">⭐ ${a.score || '?'}</div>
            </div>
            <div class="scroll-card-title">${a.title}</div>
          </div>`).join('')}
      </div>`;
    containerEl.appendChild(section);

    // 6. "Because you watched X" section
    const lastWatched = history[0];
    if (lastWatched) {
      await loadBecauseYouWatched(lastWatched, watchedUrls, containerEl);
    }

  } catch (e) { console.error('[reco]', e); }
}

async function loadBecauseYouWatched(anime, watchedUrls, containerEl) {
  try {
    // Extract keywords from title
    const words = (anime.title || '').replace(/[^a-z0-9 ]/gi, ' ').split(' ')
      .filter(w => w.length > 3).slice(0, 2);
    if (!words.length) return;

    const keyword = words[0];
    const similar = await fetch(`${API_BASE}/search?q=${encodeURIComponent(keyword)}`).then(r => r.json()).catch(() => []);

    const filtered = similar.filter(a => a.url && !watchedUrls.has(a.url)).slice(0, 10);
    if (filtered.length < 3) return;

    const byw = document.createElement('div');
    byw.innerHTML = `
      <div class="section-header" style="padding:14px 16px 10px">
        <div class="bar-accent"></div>
        <h2>💡 Karena kamu nonton <em>${anime.title}</em></h2>
      </div>
      <div class="horizontal-scroll">
        ${filtered.map(a => `
          <div class="scroll-card" onclick="loadDetail('${a.url}')">
            <div class="scroll-card-img">
              <img src="${a.image || ''}" alt="${a.title}" loading="lazy">
              <div class="ep-badge">⭐ ${a.score || '?'}</div>
            </div>
            <div class="scroll-card-title">${a.title}</div>
          </div>`).join('')}
      </div>`;
    containerEl.appendChild(byw);
  } catch {}
}
