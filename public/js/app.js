/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — MAIN APP MODULE
   ═══════════════════════════════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const API_BASE = '/api';

// ─── FIRESTORE: HISTORY & FAVORITES ──────────────────

function getUID() {
  return (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
}

async function saveHistory(animeObj) {
  const uid = getUID(); if (!uid) return;
  try {
    const key = encodeURIComponent(animeObj.url).replace(/\./g, '%2E');
    await db.collection('users').doc(uid).collection('history').doc(key)
      .set({ ...animeObj, timestamp: Date.now() });
  } catch {}
}

async function getHistory() {
  const uid = getUID(); if (!uid) return [];
  try {
    const snap = await db.collection('users').doc(uid).collection('history')
      .orderBy('timestamp', 'desc').limit(100).get();
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

async function toggleFavorite(url, title, image, score) {
  const uid = getUID(); if (!uid) return;
  try {
    const key = encodeURIComponent(url).replace(/\./g, '%2E');
    const ref = db.collection('users').doc(uid).collection('favorites').doc(key);
    const isFav = await checkFavorite(url);
    const favBtn = document.getElementById('favBtn');
    if (isFav) {
      await ref.delete();
      favBtn?.classList.remove('active');
    } else {
      await ref.set({ url, title, image, score, timestamp: Date.now() });
      favBtn?.classList.add('active');
    }
  } catch {}
}

async function checkFavorite(url) {
  const uid = getUID(); if (!uid) return false;
  try {
    const key = encodeURIComponent(url).replace(/\./g, '%2E');
    const doc = await db.collection('users').doc(uid).collection('favorites').doc(key).get();
    return doc.exists;
  } catch { return false; }
}

async function getFavorites() {
  const uid = getUID(); if (!uid) return [];
  try {
    const snap = await db.collection('users').doc(uid).collection('favorites')
      .orderBy('timestamp', 'desc').get();
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

// ─── HOME SECTIONS CONFIG ────────────────────────────

const HOME_SECTIONS = [
  { title: "Sedang Hangat",  mode: "latest" },
  { title: "Isekai & Fantasy", queries: ["isekai","reincarnation","world","maou"] },
  { title: "Action Hits",    queries: ["kimetsu","jujutsu","piece","bleach","hunter","shingeki"] },
  { title: "Romance & Drama", queries: ["love","kanojo","romance","heroine","uso"] },
  { title: "School Life",    queries: ["school","gakuen","classroom","high school"] },
  { title: "Magic & Adventure", queries: ["magic","adventure","dragon","dungeon"] },
  { title: "Comedy & Chill", queries: ["comedy","slice of life","bocchi","spy"] },
];

const GENRE_KEYWORDS = {
  "Action":       ["action","shounen","fight","jujutsu","kimetsu"],
  "Adventure":    ["adventure","journey","world","isekai"],
  "Comedy":       ["comedy","slice of life","laugh","bocchi"],
  "Drama":        ["drama","cry","love","romance","kanojo"],
  "Fantasy":      ["fantasy","magic","maou","dragon","hero"],
  "Isekai":       ["isekai","reincarnation","world","slime","tensei"],
  "Magic":        ["magic","mahou","witch","wizard"],
  "Romance":      ["romance","love","kanojo","couple"],
  "School":       ["school","gakuen","classroom","student"],
  "Sci-Fi":       ["sci-fi","science","gundam","mecha"],
  "Slice of Life":["slice of life","daily","chill","camp"],
  "Sports":       ["sports","soccer","football","blue lock","haikyuu"],
};
const KATEGORI_LIST = Object.keys(GENRE_KEYWORDS);
let sliderInterval;

// ─── THEME ───────────────────────────────────────────

const moonSVG      = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const sunSVG       = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const moonSVGSmall = moonSVG.replace('22" height="22"','20" height="20"');
const sunSVGSmall  = sunSVG.replace('22" height="22"','20" height="20"');

function updateThemeUI(isLight) {
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = isLight ? sunSVG : moonSVG;
  const sidebarIcon = document.getElementById('sidebarThemeIcon');
  if (sidebarIcon) sidebarIcon.innerHTML = isLight ? sunSVGSmall : moonSVGSmall;
  const sidebarLabel = document.getElementById('sidebarThemeLabel');
  if (sidebarLabel) sidebarLabel.textContent = isLight ? 'Mode Terang' : 'Mode Gelap';
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'dark');
    updateThemeUI(false);
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    updateThemeUI(true);
  }
}

(function() {
  if (localStorage.getItem('theme') === 'light')
    document.documentElement.setAttribute('data-theme', 'light');
})();

// ─── UTILS ───────────────────────────────────────────

const show    = (id) => document.getElementById(id)?.classList.remove('hidden');
const hide    = (id) => {
  document.getElementById(id)?.classList.add('hidden');
  if (id === 'home-view' && sliderInterval) { clearInterval(sliderInterval); sliderInterval = null; }
};
const loader  = (state) => state ? show('loading') : hide('loading');

function removeDuplicates(arr, key) {
  return [...new Map(arr.map(i => [i[key], i])).values()];
}

function setSidebarActive(tabName) {
  document.querySelectorAll('.sidebar-item[id^="stab-"]').forEach(el => el.classList.remove('active'));
  document.getElementById('stab-' + tabName)?.classList.add('active');
}

// ─── SWITCH TAB ──────────────────────────────────────

const ALL_VIEWS = ['home-view','anime-view','recent-view','favorite-view',
                   'developer-view','detail-view','watch-view','profile-view'];

function switchTab(tabName) {
  ALL_VIEWS.forEach(v => hide(v));
  show('bottomNav');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  setSidebarActive(tabName);

  if (tabName === 'home') {
    show('home-view');
    document.getElementById('tab-home')?.classList.add('active');
    if (!document.getElementById('home-view').innerHTML.trim()) loadHome();
  } else if (tabName === 'anime') {
    show('anime-view');
    document.getElementById('tab-anime')?.classList.add('active');
    renderCategoryPage();
  } else if (tabName === 'recent') {
    show('recent-view');
    document.getElementById('tab-recent')?.classList.add('active');
    loadRecentHistory();
  } else if (tabName === 'favorite') {
    show('favorite-view');
    document.getElementById('tab-favorite')?.classList.add('active');
    loadFavorites();
  } else if (tabName === 'developer') {
    show('developer-view');
    fetchWAFollowers();
  } else if (tabName === 'profile') {
    show('profile-view');
    document.getElementById('tab-profile')?.classList.add('active');
    // Profile data sudah di-load oleh onAuthStateChanged di auth.js saat halaman pertama dibuka.
    // Tidak perlu loadUserProfile ulang — itu justru menyebabkan data overwrite dengan
    // hasil Firestore yang bisa gagal (return {}) sehingga role jadi 'user' dan foto hilang.
  }
}

// ─── HOME (TABS: Beranda / Trending / Jadwal / Berita) ─

async function loadHome() {
  const homeEl = document.getElementById('home-view');
  homeEl.innerHTML = `
    <div class="home-tab-bar">
      <button class="home-tab active" onclick="switchHomeTab('beranda', this)">🏠 Beranda</button>
      <button class="home-tab" onclick="switchHomeTab('trending', this)">🔥 Trending</button>
      <button class="home-tab" onclick="switchHomeTab('jadwal', this)">📅 Jadwal Rilis</button>
      <button class="home-tab" onclick="switchHomeTab('berita', this)">📰 Berita</button>
    </div>
    <div id="tab-beranda" class="home-tab-content active"></div>
    <div id="tab-trending" class="home-tab-content"></div>
    <div id="tab-jadwal" class="home-tab-content"></div>
    <div id="tab-berita" class="home-tab-content"></div>`;

  loadLatestTab();
}

function switchHomeTab(name, btn) {
  document.querySelectorAll('.home-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.home-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  const content = document.getElementById('tab-' + name);
  if (content) content.classList.add('active');

  if (name === 'trending'  && !content.innerHTML.trim()) loadTrending();
  if (name === 'jadwal'    && !content.innerHTML.trim()) loadSchedule();
  if (name === 'berita'    && !content.innerHTML.trim()) loadNews();
}

// ─── LATEST TAB ──────────────────────────────────────

async function loadLatestTab() {
  loader(true);
  const container = document.getElementById('tab-beranda');
  try {
    let sliderData = [];
    try { const r = await fetch(`${API_BASE}/latest`); sliderData = await r.json(); } catch {}

    if (sliderData?.length > 0) {
      const top10 = sliderData.slice(0, 10);
      renderHeroSlider(top10, container);
      loader(false);

      top10.forEach(async (item) => {
        try {
          const r = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(item.url)}`);
          const d = await r.json();
          if (d?.info) {
            const score = d.info.skor || d.info.score || 'N/A';
            const type  = d.info.tipe || d.info.type  || 'Anime';
            const musim = d.info.musim || d.info.season || '';
            const rilis = d.info.dirilis || d.info.released || '';
            const year  = `${musim} ${rilis}`.trim() || 'Unknown';
            document.querySelectorAll(`.hero-meta[data-url="${item.url}"]`).forEach(el => {
              el.innerHTML = `<span>⭐ ${score}</span> • <span>${type}</span> • <span>${year}</span>`;
            });
          }
        } catch {}
      });
    } else { loader(false); }

    for (let i = 1; i < HOME_SECTIONS.length; i++) {
      const sec = HOME_SECTIONS[i];
      (async () => {
        let combined = [];
        const results = await Promise.all(sec.queries.map(q =>
          fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => [])
        ));
        results.forEach(list => { if (Array.isArray(list)) combined.push(...list); });
        combined = removeDuplicates(combined, 'url');
        if (combined.length > 0) {
          if (combined.length < 6) combined = [...combined, ...combined, ...combined];
          renderSection(sec.title, combined.slice(0, 15), container);
        }
      })();
    }
  } catch { loader(false); }
}

// ─── TRENDING TAB ─────────────────────────────────────

async function loadTrending() {
  const container = document.getElementById('tab-trending');
  container.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
  try {
    const data = await fetch(`${API_BASE}/trending`).then(r => r.json());
    if (!data?.length) {
      container.innerHTML = '<div class="empty-state"><h2>Data trending tidak tersedia</h2></div>'; return;
    }
    container.innerHTML = `
      <div class="section-header mt-large" style="padding:14px 16px 10px"><div class="bar-accent"></div><h2>🔥 Anime Trending</h2></div>
      <div class="trending-list">
        ${data.map((a, i) => `
          <div class="trending-item" onclick="handleSearch('${(a.title||'').replace(/'/g,"\\'")}')">
            <div class="trending-rank ${i < 3 ? 'top3' : ''}">${(a.rank || i+1)}</div>
            <div class="trending-img">
              ${a.image ? `<img src="${a.image}" alt="${a.title}" loading="lazy">` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">📺</div>'}
            </div>
            <div class="trending-info">
              <div class="trending-title">${a.title}</div>
              <div class="trending-meta">
                ${a.score ? `<span class="trending-score">⭐ ${a.score}</span>` : ''}
                ${a.genres?.length ? `<span>${a.genres.join(', ')}</span>` : ''}
                ${a.episodes ? `<span>${a.episodes} eps</span>` : ''}
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch {
    container.innerHTML = '<div class="empty-state"><h2>Gagal memuat trending</h2></div>';
  }
}

// ─── SCHEDULE TAB ─────────────────────────────────────

async function loadSchedule() {
  const container = document.getElementById('tab-jadwal');
  container.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
  try {
    const data = await fetch(`${API_BASE}/schedule`).then(r => r.json());
    if (!data?.length) {
      container.innerHTML = '<div class="empty-state"><h2>Jadwal tidak tersedia saat ini</h2></div>'; return;
    }

    // Group by day of week if broadcast info available
    const days = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
    const dayMap = { 'monday':'Senin','tuesday':'Selasa','wednesday':'Rabu','thursday':'Kamis','friday':'Jumat','saturday':'Sabtu','sunday':'Minggu' };
    const grouped = {};
    const ungrouped = [];

    data.forEach(a => {
      const dayKey = a.broadcast?.day_of_the_week;
      if (dayKey && dayMap[dayKey]) {
        const day = dayMap[dayKey];
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(a);
      } else {
        ungrouped.push(a);
      }
    });

    let html = `<div class="section-header mt-large" style="padding:14px 16px 10px"><div class="bar-accent"></div><h2>📅 Jadwal Rilis Anime</h2></div>`;

    const hasDays = Object.keys(grouped).length > 0;
    if (hasDays) {
      days.forEach(day => {
        const items = grouped[day] || [];
        if (!items.length) return;
        html += `<div style="padding:10px 16px 8px"><span class="schedule-day-badge">${day}</span></div>`;
        html += `<div class="schedule-grid">` + items.map(a => scheduleCard(a)).join('') + `</div>`;
      });
      if (ungrouped.length) {
        html += `<div style="padding:10px 16px 8px"><span class="schedule-day-badge">Lainnya</span></div>`;
        html += `<div class="schedule-grid">` + ungrouped.map(a => scheduleCard(a)).join('') + `</div>`;
      }
    } else {
      html += `<div class="schedule-grid">` + data.map(a => scheduleCard(a)).join('') + `</div>`;
    }

    container.innerHTML = html;
  } catch {
    container.innerHTML = '<div class="empty-state"><h2>Gagal memuat jadwal</h2></div>';
  }
}

function scheduleCard(a) {
  const title = (a.title || '').length > 40 ? a.title.substring(0,38)+'...' : (a.title || '');
  const onclick = a.url ? `loadDetail('${a.url}')` : `handleSearch('${(a.title||'').replace(/'/g,"\\'")}')`;
  return `
    <div class="schedule-card" onclick="${onclick}">
      <div class="schedule-card-img">
        ${a.image ? `<img src="${a.image}" alt="${a.title}" loading="lazy">` : '<div style="width:100%;height:100%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:32px;">📺</div>'}
      </div>
      <div class="schedule-card-body">
        <div class="schedule-card-title">${title}</div>
        <div class="schedule-card-meta">
          ${a.score && a.score !== 'N/A' ? `⭐ ${a.score}` : ''}
          ${a.episodes ? ` · ${a.episodes} eps` : ''}
        </div>
      </div>
    </div>`;
}

// ─── NEWS TAB ─────────────────────────────────────────

async function loadNews() {
  const container = document.getElementById('tab-berita');
  container.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
  try {
    const data = await fetch(`${API_BASE}/news`).then(r => r.json());
    if (!data?.length) {
      container.innerHTML = '<div class="empty-state"><h2>Berita tidak tersedia</h2></div>'; return;
    }
    container.innerHTML = `
      <div class="section-header mt-large" style="padding:14px 16px 10px"><div class="bar-accent"></div><h2>📰 Berita Anime Terbaru</h2></div>
      <div class="news-list" style="padding-bottom:80px">
        ${data.map((n, i) => `
          <div class="news-card" style="animation-delay:${i*0.05}s" onclick="${n.url && n.url !== '#' ? `window.open('${n.url}','_blank')` : ''}">
            <div class="news-img">
              ${n.image ? `<img src="${n.image}" alt="${n.title}" loading="lazy">` : `<div class="news-img-placeholder">📰</div>`}
            </div>
            <div class="news-info">
              <div class="news-title">${n.title}</div>
              ${n.description ? `<div class="news-desc">${n.description}</div>` : ''}
              <div class="news-date">${n.date || ''}</div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch {
    container.innerHTML = '<div class="empty-state"><h2>Gagal memuat berita</h2></div>';
  }
}

// ─── HERO SLIDER ──────────────────────────────────────

function renderHeroSlider(data, container) {
  const loopData = [...data, data[0]];
  const slidesHtml = loopData.map((a, i) => {
    let eps = a.episode ? `Ep ${(a.episode.match(/\d+(\.\d+)?/)||[''])[0]}` : '';
    return `
      <div class="hero-slide">
        <img src="${a.image}" class="hero-bg" alt="${a.title}" loading="${i===0?'eager':'lazy'}">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          ${eps ? `<div class="hero-badge">${eps}</div>` : ''}
          <h2 class="hero-title">${a.title}</h2>
          <div class="hero-meta" data-url="${a.url}"><span>⭐ ${a.score||'N/A'}</span> • <span>${a.type||'Anime'}</span></div>
          <button onclick="loadDetail('${a.url}')" class="hero-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Nonton Sekarang
          </button>
        </div>
      </div>`;
  }).join('');

  const dotsHtml = data.map((_,i) => `<div class="hero-dot ${i===0?'active':''}" onclick="goToSlide(${i})"></div>`).join('');

  const section = document.createElement('div');
  section.className = 'hero-section-container';
  section.innerHTML = `
    <div class="hero-slider">
      <div class="hero-wrapper" id="heroWrapper">${slidesHtml}</div>
      <div class="hero-dots" id="heroDots">${dotsHtml}</div>
    </div>`;

  if (container.firstChild) container.insertBefore(section, container.firstChild);
  else container.appendChild(section);

  const wrapper = document.getElementById('heroWrapper');
  let cur = 0, total = loopData.length;
  if (sliderInterval) clearInterval(sliderInterval);
  sliderInterval = setInterval(() => {
    if (!wrapper || document.getElementById('home-view')?.classList.contains('hidden')) return;
    cur++;
    wrapper.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
    wrapper.style.transform = `translateX(-${cur*100}%)`;
    updateHeroDots(cur % (total-1));
    if (cur === total-1) {
      setTimeout(() => { wrapper.style.transition='none'; cur=0; wrapper.style.transform='translateX(0)'; updateHeroDots(0); }, 600);
    }
  }, 5000);
}

window.goToSlide = function(index) {
  const w = document.getElementById('heroWrapper');
  if (!w) return;
  w.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
  w.style.transform = `translateX(-${index*100}%)`;
  updateHeroDots(index);
};

function updateHeroDots(index) {
  document.querySelectorAll('.hero-dot').forEach((d,i) => d.classList.toggle('active', i===index));
}

// ─── RENDER SECTION ──────────────────────────────────

function renderSection(title, data, container) {
  const kw = title.split(' ')[0];
  const div = document.createElement('div');
  div.className = 'category-section';
  div.innerHTML = `
    <div class="header-flex">
      <div class="section-header"><div class="bar-accent"></div><h2>${title}</h2></div>
      <a href="#" class="more-link" onclick="handleSearch('${kw}');return false;">Lainnya →</a>
    </div>
    <div class="horizontal-scroll">
      ${data.map((a,i) => `
        <div class="scroll-card" onclick="loadDetail('${a.url}')" style="animation-delay:${i*0.04}s">
          <div class="scroll-card-outer">
            <div class="scroll-card-img">
              <img src="${a.image}" alt="${a.title}" loading="lazy">
              <div class="ep-badge">Ep ${a.episode||a.score||'?'}</div>
            </div>
          </div>
          <div class="scroll-card-title">${a.title.length>35?a.title.substring(0,35)+'...':a.title}</div>
        </div>`).join('')}
    </div>`;
  container.appendChild(div);
}

// ─── CATEGORY PAGE ────────────────────────────────────

function renderCategoryPage() {
  const grid = document.getElementById('genre-grid');
  if (grid.innerHTML) return;
  grid.innerHTML = KATEGORI_LIST.map(g => `<button class="genre-btn" onclick="loadCategory('${g}',this)"><span>${g}</span></button>`).join('');
  loadCategory(KATEGORI_LIST[0], grid.firstElementChild);
}

async function loadCategory(genre, btn) {
  document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');
  loader(true);
  try {
    const queries = GENRE_KEYWORDS[genre] || [genre];
    let combined = [];
    const results = await Promise.all(queries.map(q =>
      fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => [])
    ));
    results.forEach(l => { if (Array.isArray(l)) combined.push(...l); });
    combined = removeDuplicates(combined, 'url');
    const c = document.getElementById('category-results-container');
    if (!combined.length) { c.innerHTML = '<p style="text-align:center;color:var(--text-muted);margin-top:20px;">Tidak ada anime ditemukan.</p>'; return; }
    c.innerHTML = `
      <div class="section-header mt-large"><div class="bar-accent"></div><h2>Anime ${genre}</h2></div>
      <div class="anime-grid">
        ${combined.map(a => `
          <div class="scroll-card" onclick="loadDetail('${a.url}')" style="min-width:auto;max-width:none">
            <div class="scroll-card-img"><img src="${a.image}" alt="${a.title}" loading="lazy"><div class="ep-badge">⭐ ${a.score||'?'}</div></div>
            <div class="scroll-card-title">${a.title}</div>
          </div>`).join('')}
      </div>`;
  } catch {} finally { loader(false); }
}

// ─── RECENT & FAVORITES ───────────────────────────────

async function loadRecentHistory() {
  const c = document.getElementById('recent-results-container');
  c.innerHTML = '<div class="spinner" style="margin:60px auto 20px"></div>';
  const data = await getHistory();
  if (!data.length) { c.innerHTML = emptyState('clock','Belum ada riwayat','Anime yang baru saja kamu tonton akan muncul di sini.'); return; }
  c.innerHTML = `<div class="anime-grid">${data.map(a => animeCard(a)).join('')}</div>`;
}

async function loadFavorites() {
  const c = document.getElementById('favorite-results-container');
  c.innerHTML = '<div class="spinner" style="margin:60px auto 20px"></div>';
  const data = await getFavorites();
  if (!data.length) { c.innerHTML = emptyState('heart','Belum ada Favorit','Simpan anime kesukaanmu dengan menekan ikon hati.'); return; }
  c.innerHTML = `<div class="anime-grid">${data.map(a => animeCard(a)).join('')}</div>`;
}

function animeCard(a) {
  return `
    <div class="scroll-card" onclick="loadDetail('${a.url}')" style="min-width:auto;max-width:none">
      <div class="scroll-card-img"><img src="${a.image}" alt="${a.title}" loading="lazy"><div class="ep-badge">⭐ ${a.score||'?'}</div></div>
      <div class="scroll-card-title">${a.title}</div>
    </div>`;
}

function emptyState(icon, title, desc) {
  const icons = { clock: '⏱️', heart: '❤️' };
  return `<div class="empty-state"><div style="font-size:48px;margin-bottom:12px">${icons[icon]||'📦'}</div><h2>${title}</h2><p>${desc}</p></div>`;
}

// ─── SEARCH ───────────────────────────────────────────

async function handleSearch(manualQuery = null) {
  const inp = document.getElementById('searchInput');
  const query = manualQuery || inp?.value?.trim();
  if (inp && manualQuery) inp.value = manualQuery;
  if (!query) { switchTab('home'); return; }

  switchTab('home');
  loader(true);
  try {
    const data = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`).then(r => r.json());
    const homeEl = document.getElementById('home-view');
    homeEl.innerHTML = `
      <div class="home-tab-bar">
        <button class="home-tab active">🔍 Hasil Pencarian</button>
      </div>
      <div class="section-header mt-large"><div class="bar-accent"></div><h2>Hasil: "${query}"</h2></div>
      <div class="anime-grid" style="padding-bottom:80px">
        ${data.map(a => `
          <div class="scroll-card" onclick="loadDetail('${a.url}')" style="min-width:auto;max-width:none">
            <div class="scroll-card-img"><img src="${a.image}" alt="${a.title}" loading="lazy"><div class="ep-badge">⭐ ${a.score||'?'}</div></div>
            <div class="scroll-card-title">${a.title}</div>
          </div>`).join('')}
      </div>`;
  } catch {} finally { loader(false); }
}

// ─── DETAIL ───────────────────────────────────────────

async function loadDetail(url) {
  loader(true);
  try {
    const data = await fetch(`${API_BASE}/detail?url=${encodeURIComponent(url)}`).then(r => r.json());
    ALL_VIEWS.forEach(v => hide(v));
    if (window.innerWidth < 900) hide('bottomNav');
    show('detail-view');

    const info = data.info || {};
    const status    = info.status || 'Ongoing';
    const score     = info.skor   || info.score    || '0';
    const type      = info.tipe   || info.type     || 'TV';
    const totalEps  = info.total_episode || info.episode || '?';
    const duration  = info.durasi || info.duration || '?';
    const musim     = info.musim  || info.season   || '';
    const rilis     = info.dirilis|| info.released || '';
    const seasonInfo = `${musim} ${rilis}`.trim() || 'Unknown Date';
    const genreText = info.genre  || info.genres   || '';
    const genres    = genreText ? genreText.split(',').map(g => g.trim()) : ['Anime'];
    const isEps     = data.episodes?.length > 0;
    const newestUrl = isEps ? data.episodes[0].url : '';
    const oldestUrl = isEps ? data.episodes[data.episodes.length-1].url : '';

    let newestNum = '?';
    if (isEps) {
      const m = data.episodes[0].title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i);
      if (m) newestNum = m[1];
      else { const n = data.episodes[0].title.match(/\d+/g); newestNum = n ? n[n.length-1] : data.episodes.length; }
    }

    saveHistory({ url, title: data.title, image: data.image, score });
    const isFav = await checkFavorite(url);

    // Try to fetch MAL description if local description is short
    let description = data.description || 'Tidak ada deskripsi tersedia.';
    if (description.length < 100) {
      try {
        const malRes = await fetch(`${API_BASE}/mal/description?title=${encodeURIComponent(data.title)}`);
        const malData = await malRes.json();
        if (malData.description) description = malData.description;
      } catch {}
    }

    document.getElementById('anime-info').innerHTML = `
      <div class="detail-breadcrumb">Beranda / ${data.title}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <h1 class="detail-title">${data.title}</h1>
        <button id="favBtn" class="btn-fav-detail ${isFav?'active':''}"
          onclick="toggleFavorite('${url}','${data.title.replace(/'/g,"\\'")}','${data.image}','${score}')">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="${isFav?'var(--danger)':'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <div class="detail-subtitle">${info.japanese || data.title}</div>
      <div class="detail-main-layout">
        <div class="detail-poster"><img src="${data.image}" alt="${data.title}"></div>
        <div class="detail-info-col">
          <div class="detail-badges">
            <span class="badge status">${status.replace(' ','_')}</span>
            <span class="badge score">⭐ ${score}</span>
            <span class="badge type">${type}</span>
          </div>
          <div class="detail-genres">${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>
          <div class="detail-season">${seasonInfo.toUpperCase()}</div>
          <p class="detail-synopsis">${description}</p>
          <div style="margin-bottom:10px"><span class="mal-badge">📊 MyAnimeList</span></div>
          <div class="detail-actions">
            <button class="btn-action" onclick="${oldestUrl?`loadVideo('${oldestUrl}')`:"alert('Belum ada episode')"}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Nonton
            </button>
            <button class="btn-action" onclick="${newestUrl?`loadVideo('${newestUrl}')`:"alert('Belum ada episode')"}">
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

    // Init batch download state
    initBatchDownload(data.episodes || []);

    document.getElementById('episode-header-container').innerHTML = `
      <div class="ep-header-wrapper">
        <h2 class="ep-header-title">Daftar Episode</h2>
        ${isEps ? `<div class="ep-range-badge">1 – ${newestNum}</div>` : ''}
        ${isEps ? `<button id="batchModeBtn" class="btn-batch-mode" onclick="toggleBatchMode()" title="Pilih episode untuk download">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Batch Download
        </button>` : ''}
      </div>
      ${isEps ? `<div id="batchPanel" style="display:none;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 0 4px;border-top:1px solid var(--border);margin-top:8px;">
        <button class="btn-batch-action" onclick="selectAllEpisodes()">Pilih Semua</button>
        <button class="btn-batch-action" onclick="clearEpSelection()">Batal Pilih</button>
        <span class="batch-count-label"><b id="batchCount">0</b> dipilih</span>
        <button id="batchDlBtn" class="btn-batch-start" onclick="startBatchDownload()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download Terpilih
        </button>
        <p id="batchNote" class="dl-note" style="width:100%;margin:4px 0 0;"></p>
      </div>` : ''}`;

    // Render episode grid via fungsi terpusat (support batch mode)
    renderEpisodeGrid();

  } catch(e) { console.error(e); } finally { loader(false); }
}

// ─── WATCH ────────────────────────────────────────────

// State untuk download
let _watchStreams = [];
let _watchTitle   = '';

async function loadVideo(url) {
  loader(true);
  try {
    const data = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(url)}`).then(r => r.json());
    hide('detail-view'); show('watch-view');
    if (window.innerWidth < 900) hide('bottomNav');

    _watchTitle   = data.title || 'anime';
    _watchStreams  = data.streams || [];

    document.getElementById('video-title').textContent = data.title;
    const player  = document.getElementById('video-player');
    const servers = document.getElementById('server-options');

    if (_watchStreams.length > 0) {
      player.src = _watchStreams[0].url;
      servers.innerHTML = _watchStreams.map((s, i) =>
        `<button class="server-tag ${i===0?'active':''}" onclick="changeServer('${s.url}',this)">${s.server}</button>`
      ).join('');
      renderDownloadBtn(_watchStreams[0].url);
    } else {
      alert('Maaf, stream belum tersedia untuk episode ini.');
      servers.innerHTML = '';
      renderDownloadBtn(null);
    }
  } catch {} finally { loader(false); }
}

function renderDownloadBtn(streamUrl) {
  let dlArea = document.getElementById('watch-download-area');
  if (!dlArea) return;

  if (!streamUrl) {
    dlArea.innerHTML = '<p class="dl-note">⚠️ Tidak ada stream tersedia untuk diunduh.</p>';
    return;
  }

  const isDirectFile = /\.(mp4|mkv|webm|avi)(\?|$)/i.test(streamUrl);

  dlArea.innerHTML = `
    <div class="dl-section">
      <button class="btn-download-single" onclick="downloadSingle()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Episode Ini
      </button>
      ${!isDirectFile ? '<p class="dl-note">⚠️ <b>Catatan:</b> Stream ini menggunakan embed pihak ketiga. Jika download gagal atau terbuka halaman lain, gunakan ekstensi browser seperti <b>Video DownloadHelper</b> atau putar video lalu simpan via browser.</p>' : ''}
    </div>`;
}

function downloadSingle() {
  const player = document.getElementById('video-player');
  const streamUrl = player?.src;
  if (!streamUrl) return;
  const isDirectFile = /\.(mp4|mkv|webm|avi)(\?|$)/i.test(streamUrl);
  if (isDirectFile) {
    const a = document.createElement('a');
    a.href = streamUrl;
    a.download = (_watchTitle || 'anime').replace(/[^a-z0-9\s\-]/gi, '') + '.mp4';
    a.click();
  } else {
    window.open(streamUrl, '_blank', 'noopener');
  }
}

function changeServer(url, btn) {
  document.getElementById('video-player').src = url;
  document.querySelectorAll('.server-tag').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDownloadBtn(url);
}

// ─── BATCH DOWNLOAD ───────────────────────────────────

let _batchEpisodes  = [];
let _batchSelected  = new Set();
let _batchMode      = false;

function initBatchDownload(episodes) {
  _batchEpisodes = episodes;
  _batchSelected.clear();
  _batchMode = false;
}

function toggleBatchMode() {
  _batchMode = !_batchMode;
  _batchSelected.clear();
  const btn   = document.getElementById('batchModeBtn');
  const panel = document.getElementById('batchPanel');
  if (btn)   btn.classList.toggle('active', _batchMode);
  if (panel) panel.style.display = _batchMode ? 'flex' : 'none';
  renderEpisodeGrid();
}

function renderEpisodeGrid() {
  const grid = document.getElementById('episode-grid');
  if (!grid) return;
  grid.innerHTML = _batchEpisodes.map((ep, i) => {
    let num = ep.title.match(/(?:Episode|Eps|Ep)\s*(\d+(\.\d+)?)/i)?.[1]
              || (ep.title.match(/\d+/g)||[i+1]).slice(-1)[0];
    if (_batchMode) {
      const checked = _batchSelected.has(i);
      return `<div class="ep-box ${checked?'ep-selected':''}" title="${ep.title}"
        onclick="toggleEpSelect(${i},this)" style="animation-delay:${Math.min(i*0.02,0.3)}s">
        ${checked?'✓ ':''}<span>${num}</span></div>`;
    } else {
      return `<div class="ep-box" title="${ep.title}" onclick="loadVideo('${ep.url}')"
        style="animation-delay:${Math.min(i*0.02,0.3)}s">${num}</div>`;
    }
  }).join('');
}

function toggleEpSelect(idx, el) {
  if (_batchSelected.has(idx)) {
    _batchSelected.delete(idx);
    el.classList.remove('ep-selected');
  } else {
    _batchSelected.add(idx);
    el.classList.add('ep-selected');
  }
  // Re-render hanya teks checkmark
  const span = el.querySelector('span');
  if (span) el.innerHTML = (_batchSelected.has(idx) ? '✓ ' : '') + '<span>' + span.textContent + '</span>';
  const cnt = document.getElementById('batchCount');
  if (cnt) cnt.textContent = _batchSelected.size;
}

function selectAllEpisodes() {
  _batchEpisodes.forEach((_, i) => _batchSelected.add(i));
  renderEpisodeGrid();
  const cnt = document.getElementById('batchCount');
  if (cnt) cnt.textContent = _batchSelected.size;
}

function clearEpSelection() {
  _batchSelected.clear();
  renderEpisodeGrid();
  const cnt = document.getElementById('batchCount');
  if (cnt) cnt.textContent = 0;
}

async function startBatchDownload() {
  if (_batchSelected.size === 0) {
    alert('Pilih minimal 1 episode terlebih dahulu.');
    return;
  }
  const indices = [..._batchSelected].sort((a,b) => a - b);
  const note    = document.getElementById('batchNote');
  const dlBtn   = document.getElementById('batchDlBtn');
  if (dlBtn)  dlBtn.disabled = true;
  if (note)   note.textContent = `⏳ Memulai download ${indices.length} episode...`;

  for (let i = 0; i < indices.length; i++) {
    const ep = _batchEpisodes[indices[i]];
    if (!ep?.url) continue;
    try {
      const data   = await fetch(`${API_BASE}/watch?url=${encodeURIComponent(ep.url)}`).then(r => r.json());
      const stream = data?.streams?.[0]?.url;
      if (!stream) { if (note) note.textContent = `⚠️ (${i+1}/${indices.length}) ${ep.title}: stream tidak tersedia, skip.`; continue; }

      const isDirectFile = /\.(mp4|mkv|webm|avi)(\?|$)/i.test(stream);
      if (isDirectFile) {
        const a = document.createElement('a');
        a.href = stream;
        a.download = (data.title || ep.title).replace(/[^a-z0-9\s\-]/gi, '') + '.mp4';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        window.open(stream, '_blank', 'noopener');
        await new Promise(r => setTimeout(r, 2000));
      }
      if (note) note.textContent = `⏳ Memproses ${i+1}/${indices.length}: ${data.title || ep.title}`;
    } catch { continue; }
  }
  if (note)  note.textContent = `✅ Selesai! ${indices.length} episode diproses.`;
  if (dlBtn) dlBtn.disabled = false;
}

function goHome() { switchTab('home'); }

function backToDetail() {
  hide('watch-view'); show('detail-view');
  document.getElementById('video-player').src = '';
  if (window.innerWidth < 900) show('bottomNav');
}

// ─── DEVELOPER TABS ───────────────────────────────────

function switchDevTab(el, index) {
  document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('[id^="dev-tab-"]').forEach(t => t.style.display = 'none');
  const target = document.getElementById('dev-tab-' + index);
  if (target) {
    target.style.display = 'block';
    target.querySelectorAll('.doc-card').forEach((c,i) => {
      c.style.animation='none'; c.offsetHeight; c.style.animation=''; c.style.animationDelay=(i*0.08)+'s';
    });
  }
}

async function fetchWAFollowers() {
  const el = document.getElementById('wa-follower-count');
  if (!el) return;
  try {
    const res = await fetch(`https://cors.caliph.my.id/https://whatsapp.com/channel/0029VbB3bZLAO7RPl6shiI2C`);
    const html = await res.text();
    const m = html.match(/([\d.,]+(?:K|M)?)\s+followers/i) || html.match(/([\d.,]+(?:K|M)?)\s+pengikut/i);
    el.textContent = m?.[1] || '22.2K';
  } catch { el.textContent = '22.2K'; }
}

function toggleDevFollow(btn) {
  const isFollowing = btn.dataset.following === 'true';
  const checkIcon = document.getElementById('devFollowCheck');
  const textEl    = document.getElementById('devFollowText');
  if (isFollowing) {
    btn.dataset.following = 'false';
    btn.className = btn.className.replace('following','').trim();
    if (checkIcon) checkIcon.style.display = 'none';
    if (textEl) textEl.textContent = 'Follow';
  } else {
    btn.dataset.following = 'true';
    btn.classList.add('following');
    if (checkIcon) checkIcon.style.display = 'inline-block';
    if (textEl) textEl.textContent = 'Following';
    window.open('https://github.com/kanawangyy-yoikage', '_blank');
  }
}

// ─── INIT ────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const isLight = localStorage.getItem('theme') === 'light';
  updateThemeUI(isLight);
  switchTab('home');
});

document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});

firebase.auth().onAuthStateChanged((user) => {
  if (!user) window.location.href = 'login.html';
});
