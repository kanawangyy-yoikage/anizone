// ─── ANIZONE — BOOKMARK MODULE ───────────────────────────
// Fitur watchlist dengan status: plan_to_watch, watching, completed, dropped
// Data disimpan di Firestore: users/{uid}/bookmarks/{key}
//
// Status:
//   plan_to_watch  → Mau Nonton
//   watching       → Sedang Nonton
//   completed      → Selesai
//   dropped        → Dropped
// ─────────────────────────────────────────────────────────

const BOOKMARK_STATUSES = {
  plan_to_watch: { label: 'Mau Nonton',    emoji: '📌', color: '#60a5fa' },
  watching:      { label: 'Sedang Nonton', emoji: '▶️', color: '#34d399' },
  completed:     { label: 'Selesai',       emoji: '✅', color: '#a78bfa' },
  dropped:       { label: 'Dropped',       emoji: '🚫', color: '#f87171' },
};

// ── Firestore Helpers ─────────────────────────────────────

function getUID() {
  return (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
}

function urlToKey(url) {
  return encodeURIComponent(url).replace(/\./g, '%2E');
}

async function getBookmarkDoc(url) {
  const uid = getUID(); if (!uid) return null;
  try {
    const key = urlToKey(url);
    const doc = await db.collection('users').doc(uid).collection('bookmarks').doc(key).get();
    return doc.exists ? doc.data() : null;
  } catch { return null; }
}

async function saveBookmark(url, title, image, score, status) {
  const uid = getUID(); if (!uid) return false;
  try {
    const key = urlToKey(url);
    await db.collection('users').doc(uid).collection('bookmarks').doc(key).set({
      url, title, image, score, status,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  } catch { return false; }
}

async function deleteBookmark(url) {
  const uid = getUID(); if (!uid) return false;
  try {
    const key = urlToKey(url);
    await db.collection('users').doc(uid).collection('bookmarks').doc(key).delete();
    return true;
  } catch { return false; }
}

async function getAllBookmarks() {
  const uid = getUID(); if (!uid) return [];
  try {
    // Coba dengan orderBy dulu; kalau index belum dibuat, fallback tanpa sorting
    let snap;
    try {
      snap = await db.collection('users').doc(uid).collection('bookmarks')
        .orderBy('updatedAt', 'desc').get();
    } catch {
      snap = await db.collection('users').doc(uid).collection('bookmarks').get();
    }
    const data = snap.docs.map(d => d.data());
    // Sort di sisi client sebagai fallback
    return data.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch { return []; }
}

// ── Bookmark Button (di halaman detail) ──────────────────

async function renderBookmarkBtn(url, title, image, score) {
  const container = document.getElementById('bookmarkBtnContainer');
  if (!container) return;

  const bm = await getBookmarkDoc(url);
  const current = bm?.status || null;

  container.innerHTML = `
    <div class="bm-btn-wrap" id="bmBtnWrap">
      <button class="btn-bookmark ${current ? 'active' : ''}" id="bmMainBtn"
        onclick="toggleBookmarkMenu()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="${current ? 'var(--accent)' : 'none'}"
          stroke="${current ? 'var(--accent)' : 'currentColor'}" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        ${current ? BOOKMARK_STATUSES[current].label : 'Watchlist'}
      </button>
      <div class="bm-dropdown" id="bmDropdown" style="display:none">
        ${Object.entries(BOOKMARK_STATUSES).map(([key, s]) => `
          <button class="bm-option ${current === key ? 'active' : ''}"
            onclick="setBookmarkStatus('${url}','${escapeStr(title)}','${escapeStr(image)}','${score}','${key}')">
            <span>${s.emoji}</span>
            <span>${s.label}</span>
            ${current === key ? '<span class="bm-check">✓</span>' : ''}
          </button>
        `).join('')}
        ${current ? `
          <div class="bm-divider"></div>
          <button class="bm-option bm-remove" onclick="removeBookmark('${url}')">
            <span>🗑️</span> <span>Hapus dari Watchlist</span>
          </button>
        ` : ''}
      </div>
    </div>`;
}

function escapeStr(s) {
  return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function toggleBookmarkMenu() {
  const dd = document.getElementById('bmDropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  // Close on outside click
  if (dd.style.display === 'block') {
    setTimeout(() => {
      document.addEventListener('click', closeBmDropdown, { once: true });
    }, 50);
  }
}

function closeBmDropdown(e) {
  const wrap = document.getElementById('bmBtnWrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('bmDropdown');
    if (dd) dd.style.display = 'none';
  }
}

async function setBookmarkStatus(url, title, image, score, status) {
  const dd = document.getElementById('bmDropdown');
  if (dd) dd.style.display = 'none';
  const ok = await saveBookmark(url, title, image, score, status);
  if (ok) {
    const s = BOOKMARK_STATUSES[status];
    showToast(`${s.emoji} Ditambahkan ke "${s.label}"`);
    await renderBookmarkBtn(url, title, image, score);
  } else {
    showToast('Gagal menyimpan bookmark', 'error');
  }
}

async function removeBookmark(url) {
  const dd = document.getElementById('bmDropdown');
  if (dd) dd.style.display = 'none';
  const ok = await deleteBookmark(url);
  if (ok) {
    showToast('🗑️ Dihapus dari watchlist');
    const container = document.getElementById('bookmarkBtnContainer');
    if (container) {
      container.innerHTML = `
        <div class="bm-btn-wrap">
          <button class="btn-bookmark" onclick="toggleBookmarkMenu()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Watchlist
          </button>
        </div>`;
    }
    await renderBookmarkBtn(url, '', '', '');
  }
}

// ── Toast notification ────────────────────────────────────

function showToast(msg, type = 'success') {
  let toast = document.getElementById('anizoneToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'anizoneToast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = `anizone-toast ${type}`;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Bookmark View (tab) ───────────────────────────────────

async function loadBookmarks() {
  const c = document.getElementById('bookmark-results-container');
  if (!c) return;
  c.innerHTML = '<div class="spinner" style="margin:60px auto 20px"></div>';

  const all = await getAllBookmarks();
  if (!all.length) {
    c.innerHTML = `
      <div class="empty-state">
        <div style="font-size:48px;margin-bottom:12px">📌</div>
        <h2>Watchlist Kosong</h2>
        <p>Tandai anime yang ingin atau sedang kamu tonton.</p>
      </div>`;
    return;
  }

  // Group by status
  const groups = {};
  for (const key of Object.keys(BOOKMARK_STATUSES)) groups[key] = [];
  all.forEach(a => { if (groups[a.status]) groups[a.status].push(a); });

  let html = '';
  for (const [key, s] of Object.entries(BOOKMARK_STATUSES)) {
    if (!groups[key].length) continue;
    html += `
      <div class="bm-group">
        <div class="bm-group-header">
          <span class="bm-group-badge" style="background:${s.color}20;color:${s.color};border-color:${s.color}40">
            ${s.emoji} ${s.label}
          </span>
          <span class="bm-group-count">${groups[key].length} anime</span>
        </div>
        <div class="anime-grid">
          ${groups[key].map(a => bookmarkCard(a, s)).join('')}
        </div>
      </div>`;
  }
  c.innerHTML = html;
}

function bookmarkCard(a, s) {
  return `
    <div class="scroll-card bm-card" onclick="loadDetail('${a.url}')" style="min-width:auto;max-width:none;position:relative">
      <div class="scroll-card-img">
        <img src="${a.image}" alt="${a.title}" loading="lazy">
        <div class="ep-badge">⭐ ${a.score || '?'}</div>
        <div class="bm-status-badge" style="background:${s.color}">
          ${s.emoji}
        </div>
      </div>
      <div class="scroll-card-title">${a.title}</div>
    </div>`;
}

// ── Bookmark per Episode ──────────────────────────────────

async function bookmarkEpisode(epUrl, epTitle, image, score) {
  const uid = getUID();
  if (!uid) { showToast('Login dulu untuk bookmark episode', 'error'); return; }

  const key = urlToKey(epUrl);
  const existing = await getBookmarkDoc(epUrl);
  if (existing) {
    // sudah ada — tanya hapus atau tidak
    const ok = await deleteBookmark(epUrl);
    if (ok) {
      showToast('🗑️ Bookmark episode dihapus');
      // update icon
      document.querySelectorAll(`[data-ep-url="${epUrl}"] .ep-bm-btn svg`).forEach(svg => {
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
      });
    }
    return;
  }

  const ok = await saveBookmark(epUrl, epTitle, image, score, 'plan_to_watch');
  if (ok) {
    showToast('📌 Episode dibookmark ke Watchlist!');
    // visual feedback — fill icon
    document.querySelectorAll(`.ep-bm-btn[onclick*="${epUrl.replace(/'/g,"\\'")}"] svg`).forEach(svg => {
      svg.setAttribute('fill', 'var(--accent)');
      svg.setAttribute('stroke', 'var(--accent)');
    });
  } else {
    showToast('Gagal bookmark episode', 'error');
  }
}
