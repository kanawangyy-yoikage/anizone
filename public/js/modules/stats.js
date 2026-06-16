// ─── ANIZONE — ANIME STATS MODULE ────────────────────────
// Menganalisis history & bookmark user untuk menampilkan
// statistik anime: genre favorit, total jam nonton, dll.
// ─────────────────────────────────────────────────────────

async function loadAnimeStats() {
  const container = document.getElementById('stats-section-container');
  if (!container) return;

  // Tunggu auth siap (maks 3 detik)
  const uid = await new Promise(resolve => {
    if (typeof auth === 'undefined') { resolve(null); return; }
    if (auth.currentUser) { resolve(auth.currentUser.uid); return; }
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      resolve(user ? user.uid : null);
    });
    setTimeout(() => { unsub(); resolve(null); }, 3000);
  });

  if (!uid) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Login untuk melihat statistik.</p>';
    return;
  }

  container.innerHTML = '<div class="spinner" style="margin:30px auto"></div>';

  try {
    // Load history — fallback tanpa orderBy kalau index belum ada
    let historySnap, bookmarkSnap;
    try {
      [historySnap, bookmarkSnap] = await Promise.all([
        db.collection('users').doc(uid).collection('history').orderBy('timestamp', 'desc').limit(200).get(),
        db.collection('users').doc(uid).collection('bookmarks').get(),
      ]);
    } catch {
      // Fallback: tanpa orderBy (tidak butuh index)
      [historySnap, bookmarkSnap] = await Promise.all([
        db.collection('users').doc(uid).collection('history').limit(200).get(),
        db.collection('users').doc(uid).collection('bookmarks').get(),
      ]);
    }

    const history   = historySnap.docs.map(d => d.data());
    const bookmarks = bookmarkSnap.docs.map(d => d.data());

    // ── Stats dasar ───────────────────────────────────────
    const totalWatched  = history.length;
    const totalBookmark = bookmarks.length;

    // Bookmark by status
    const bmByStatus = { plan_to_watch: 0, watching: 0, completed: 0, dropped: 0 };
    bookmarks.forEach(b => { if (bmByStatus[b.status] !== undefined) bmByStatus[b.status]++; });

    // Score rata-rata (dari history yang punya score)
    const scored = history.filter(h => h.score && h.score !== 'N/A' && parseFloat(h.score) > 0);
    const avgScore = scored.length
      ? (scored.reduce((s, h) => s + parseFloat(h.score), 0) / scored.length).toFixed(1)
      : 'N/A';

    // Estimasi jam nonton (asumsi rata-rata 24 menit/episode)
    const estimatedMinutes = totalWatched * 24;
    const hoursStr = estimatedMinutes >= 60
      ? `${Math.floor(estimatedMinutes / 60)}j ${estimatedMinutes % 60}m`
      : `${estimatedMinutes}m`;

    // ── Render ─────────────────────────────────────────────
    container.innerHTML = `
      <div class="stats-section">

        <!-- Header -->
        <div class="profile-section-header" style="margin-bottom:14px">
          <div class="profile-section-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Statistik Anime
          </div>
        </div>

        <!-- Quick stats grid -->
        <div class="stats-quick-grid">
          <div class="stats-quick-card">
            <div class="stats-quick-icon" style="background:rgba(66,133,244,0.15);color:var(--accent)">▶️</div>
            <div class="stats-quick-val">${totalWatched}</div>
            <div class="stats-quick-label">Episode Ditonton</div>
          </div>
          <div class="stats-quick-card">
            <div class="stats-quick-icon" style="background:rgba(167,139,250,0.15);color:#a78bfa">📌</div>
            <div class="stats-quick-val">${totalBookmark}</div>
            <div class="stats-quick-label">Di Watchlist</div>
          </div>
          <div class="stats-quick-card">
            <div class="stats-quick-icon" style="background:rgba(251,191,36,0.15);color:#fbbf24">⭐</div>
            <div class="stats-quick-val">${avgScore}</div>
            <div class="stats-quick-label">Skor Rata-rata</div>
          </div>
          <div class="stats-quick-card">
            <div class="stats-quick-icon" style="background:rgba(52,211,153,0.15);color:#34d399">⏱️</div>
            <div class="stats-quick-val">${hoursStr}</div>
            <div class="stats-quick-label">Estimasi Nonton</div>
          </div>
        </div>

        <!-- Watchlist breakdown -->
        ${totalBookmark > 0 ? `
        <div class="stats-watchlist-card">
          <div class="stats-sub-title">Status Watchlist</div>
          <div class="stats-wl-bars">
            ${renderWatchlistBars(bmByStatus, totalBookmark)}
          </div>
        </div>` : ''}

        <!-- Activity heatmap (last 30 hari dari history) -->
        ${history.length > 0 ? `
        <div class="stats-activity-card">
          <div class="stats-sub-title">Aktivitas 30 Hari Terakhir</div>
          <div class="stats-heatmap" id="statsHeatmap"></div>
        </div>` : ''}

      </div>`;

    container.dataset.loaded = 'true'; // cache ringan — reset otomatis saat pindah tab
    // Render heatmap
    if (history.length > 0) renderHeatmap(history);

  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Gagal memuat statistik.</p>';
    console.error('[stats]', e);
  }
}

function renderWatchlistBars(bmByStatus, total) {
  const items = [
    { key: 'plan_to_watch', label: 'Mau Nonton',    emoji: '📌', color: '#60a5fa' },
    { key: 'watching',      label: 'Sedang Nonton', emoji: '▶️', color: '#34d399' },
    { key: 'completed',     label: 'Selesai',        emoji: '✅', color: '#a78bfa' },
    { key: 'dropped',       label: 'Dropped',        emoji: '🚫', color: '#f87171' },
  ];
  return items.filter(i => bmByStatus[i.key] > 0).map(i => {
    const pct = Math.round((bmByStatus[i.key] / total) * 100);
    return `
      <div class="stats-wl-row">
        <div class="stats-wl-info">
          <span>${i.emoji} ${i.label}</span>
          <span class="stats-wl-count">${bmByStatus[i.key]}</span>
        </div>
        <div class="stats-wl-track">
          <div class="stats-wl-fill" style="width:${pct}%;background:${i.color}"></div>
        </div>
      </div>`;
  }).join('');
}

function renderHeatmap(history) {
  const el = document.getElementById('statsHeatmap');
  if (!el) return;

  // Count per day (last 35 days)
  const now  = Date.now();
  const days = 35;
  const counts = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * 86400000);
    counts[dateKey(d)] = 0;
  }
  history.forEach(h => {
    if (!h.timestamp) return;
    const d = new Date(h.timestamp);
    const k = dateKey(d);
    if (counts[k] !== undefined) counts[k]++;
  });

  const dayKeys = Object.keys(counts).sort();
  const maxVal  = Math.max(...Object.values(counts), 1);

  const cells = dayKeys.map(k => {
    const v   = counts[k];
    const pct = v / maxVal;
    const bg  = v === 0
      ? 'var(--bg-input)'
      : `rgba(66,133,244,${0.2 + pct * 0.8})`;
    const d   = new Date(k);
    const label = `${d.getDate()}/${d.getMonth()+1}: ${v} ep`;
    return `<div class="heatmap-cell" style="background:${bg}" title="${label}"></div>`;
  }).join('');

  el.innerHTML = `<div class="heatmap-grid">${cells}</div>
    <div class="heatmap-legend">
      <span>Jarang</span>
      <div class="heatmap-legend-cells">
        ${[0, 0.25, 0.5, 0.75, 1].map(p =>
          `<div class="heatmap-cell" style="background:${p === 0 ? 'var(--bg-input)' : `rgba(66,133,244,${0.2 + p * 0.8})`}"></div>`
        ).join('')}
      </div>
      <span>Banyak</span>
    </div>`;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
