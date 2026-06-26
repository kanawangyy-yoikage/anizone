// ─── ADVANCED SEARCH & FILTER MODULE ────────────────────
// Menggunakan /api/advanced-search dengan filter:
// genres, status, type, order, season, page
// ─────────────────────────────────────────────────────────

const SEARCH_FILTERS = {
  type  : ['Semua', 'TV', 'Movie', 'OVA', 'ONA', 'Special'],
  status: ['Semua', 'ongoing', 'completed', 'upcoming'],
  statusLabels: { 'Semua':'Semua', 'ongoing':'Ongoing', 'completed':'Selesai', 'upcoming':'Upcoming' },
  order : [
    { label: 'Relevan',  key: '' },
    { label: 'Terbaru',  key: 'latest' },
    { label: 'Skor ↓',   key: 'rating' },
    { label: 'A – Z',    key: 'title_az' },
  ],
};

const _filterState = {
  query  : '',
  type   : 'Semua',
  status : 'Semua',
  order  : '',
  genres : [],        // genre slugs dari API /genres
  page   : 1,
  results: [],
  totalPages: 1,
  _genreList: [],     // cache daftar genre
  _timer : null,
};

// ── Open Overlay ──────────────────────────────────────────
async function openAdvancedSearch(prefillQuery = '') {
  let overlay = document.getElementById('advSearchOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'advSearchOverlay';
    overlay.className = 'adv-search-overlay';
    overlay.innerHTML = `
      <div class="adv-search-panel">
        <!-- Header -->
        <div class="adv-search-header">
          <div class="adv-search-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="advSearchInput" placeholder="Cari anime..." autocomplete="off" autofocus>
            <button id="advSearchClearBtn" class="adv-clear-btn" onclick="clearAdvSearch()" style="display:none">✕</button>
          </div>
          <button class="adv-close-btn" onclick="closeAdvancedSearch()">Tutup</button>
        </div>

        <!-- Filters -->
        <div class="adv-filter-row">
          <div class="adv-filter-group">
            <div class="adv-filter-label">Tipe</div>
            <div class="adv-filter-chips" id="filterType">
              ${SEARCH_FILTERS.type.map(t => `
                <button class="adv-chip ${t==='Semua'?'active':''}" onclick="setAdvFilter('type','${t}',this)">${t}</button>
              `).join('')}
            </div>
          </div>
          <div class="adv-filter-group">
            <div class="adv-filter-label">Status</div>
            <div class="adv-filter-chips" id="filterStatus">
              ${SEARCH_FILTERS.status.map(s => `
                <button class="adv-chip ${s==='Semua'?'active':''}" onclick="setAdvFilter('status','${s}',this)">
                  ${SEARCH_FILTERS.statusLabels[s]}
                </button>
              `).join('')}
            </div>
          </div>
          <div class="adv-filter-group">
            <div class="adv-filter-label">Urutkan</div>
            <div class="adv-filter-chips" id="filterOrder">
              ${SEARCH_FILTERS.order.map((o, i) => `
                <button class="adv-chip ${i===0?'active':''}" onclick="setAdvFilter('order','${o.key}',this)">${o.label}</button>
              `).join('')}
            </div>
          </div>
          <div class="adv-filter-group">
            <div class="adv-filter-label">Genre</div>
            <div class="adv-filter-chips" id="filterGenres" style="flex-wrap:wrap;max-height:80px;overflow-y:auto">
              <div style="color:var(--text-muted);font-size:12px;padding:4px">Memuat genre...</div>
            </div>
          </div>
        </div>

        <!-- Results -->
        <div class="adv-results" id="advResults">
          <div class="adv-empty-hint">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p>Ketik untuk mencari, atau pilih filter untuk browse.</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) closeAdvancedSearch(); });

    const input = document.getElementById('advSearchInput');
    input.addEventListener('input', () => {
      const q = input.value.trim();
      document.getElementById('advSearchClearBtn').style.display = q ? 'flex' : 'none';
      clearTimeout(_filterState._timer);
      _filterState.query = q;
      _filterState.page  = 1;
      _filterState._timer = setTimeout(() => runAdvSearch(), 380);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeAdvancedSearch(); });

    // Load genre list async
    loadAdvGenreChips();
  }

  overlay.classList.add('open');
  _filterState.query = prefillQuery;
  _filterState.page  = 1;
  const input = document.getElementById('advSearchInput');
  if (input) {
    input.value = prefillQuery;
    setTimeout(() => input.focus(), 100);
    if (prefillQuery) runAdvSearch();
  }
}

function closeAdvancedSearch() {
  document.getElementById('advSearchOverlay')?.classList.remove('open');
}

function clearAdvSearch() {
  const input = document.getElementById('advSearchInput');
  if (input) { input.value = ''; input.focus(); }
  document.getElementById('advSearchClearBtn').style.display = 'none';
  _filterState.query = '';
  _filterState.page  = 1;
  _filterState.results = [];
  renderAdvResults([], 1, 1);
}

async function loadAdvGenreChips() {
  if (_filterState._genreList.length) return;
  try {
    const raw = await fetch(`${API_BASE}/genres`).then(r => r.json());
    const list = Array.isArray(raw) ? raw : (raw.data || raw.genres || []);
    _filterState._genreList = list;
    const el = document.getElementById('filterGenres');
    if (!el) return;
    el.innerHTML = list.map(g => {
      const name = g.name || g.title || g.slug || '';
      const slug = g.slug || name.toLowerCase().replace(/\s+/g, '-');
      return `<button class="adv-chip" onclick="toggleGenreFilter('${slug}',this)">${name}</button>`;
    }).join('');
  } catch {}
}

function toggleGenreFilter(slug, btn) {
  const idx = _filterState.genres.indexOf(slug);
  if (idx === -1) { _filterState.genres.push(slug); btn.classList.add('active'); }
  else            { _filterState.genres.splice(idx, 1); btn.classList.remove('active'); }
  _filterState.page = 1;
  runAdvSearch();
}

function setAdvFilter(key, value, btn) {
  _filterState[key] = value;
  _filterState.page = 1;
  btn.closest('.adv-filter-chips')?.querySelectorAll('.adv-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  runAdvSearch();
}

// Backward-compat alias
function setFilter(key, value, btn) { setAdvFilter(key, value, btn); }

async function runAdvSearch(page) {
  if (page) _filterState.page = page;
  const resultsEl = document.getElementById('advResults');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div class="adv-loading"><div class="spinner" style="width:28px;height:28px;margin:0 auto 8px"></div><p>Mencari...</p></div>';

  try {
    const params = new URLSearchParams();
    if (_filterState.query)              params.set('q',      _filterState.query);
    if (_filterState.type   !== 'Semua') params.set('type',   _filterState.type.toLowerCase());
    if (_filterState.status !== 'Semua') params.set('status', _filterState.status);
    if (_filterState.order)              params.set('order',  _filterState.order);
    if (_filterState.genres.length)      params.set('genres', _filterState.genres.join(','));
    if (_filterState.page > 1)           params.set('page',   _filterState.page);

    // Kalau ada query teks, gabung hasil scraper search dengan advanced-search
    let results = [], totalPages = 1;

    if (_filterState.query && !_filterState.genres.length && _filterState.type === 'Semua' && _filterState.status === 'Semua') {
      // Pure keyword search → lebih akurat pakai /search
      const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(_filterState.query)}`).then(r => r.json());
      results = Array.isArray(r) ? r : (r.data || r.animes || []);
    } else {
      // Pakai advanced-search API
      const r = await fetch(`${API_BASE}/search?q=${encodeURIComponent(_filterState.query || '')}`).then(r => r.json());
      const raw = r.data?.animeList || r.data?.animes || r.animes || r.data || (Array.isArray(r) ? r : []);
      results   = Array.isArray(raw) ? raw : [];
      totalPages = r.totalPages || r.total_pages || 1;
      _filterState.totalPages = totalPages;
    }

    _filterState.results = results;
    renderAdvResults(results, _filterState.page, totalPages);
  } catch {
    resultsEl.innerHTML = '<div class="adv-empty-hint"><p>Gagal memuat hasil.</p></div>';
  }
}

function renderAdvResults(results, page = 1, totalPages = 1) {
  const el = document.getElementById('advResults');
  if (!el) return;

  if (!results.length) {
    const hasFilters = _filterState.query || _filterState.genres.length
      || _filterState.type !== 'Semua' || _filterState.status !== 'Semua';
    el.innerHTML = `
      <div class="adv-empty-hint">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>${hasFilters ? 'Tidak ada hasil ditemukan.' : 'Ketik untuk mencari, atau pilih filter untuk browse.'}</p>
      </div>`;
    return;
  }

  const paginationHtml = totalPages > 1 ? `
    <div class="adv-pagination">
      ${page > 1 ? `<button class="page-btn" onclick="runAdvSearch(${page-1})">‹ Prev</button>` : ''}
      <span class="page-info">Hal ${page} / ${totalPages}</span>
      ${page < totalPages ? `<button class="page-btn" onclick="runAdvSearch(${page+1})">Next ›</button>` : ''}
    </div>` : '';

  el.innerHTML = `
    <div class="adv-result-count">${results.length} hasil ditemukan</div>
    <div class="adv-result-grid">
      ${results.map(a => {
        const slug = a.slug || a.url || a.endpoint || a.animeSlug || '';
        const onclick = slug
          ? `closeAdvancedSearch();loadDetailBySlug('${slug}')`
          : `closeAdvancedSearch();handleSearch('${(a.title||'').replace(/'/g,"\\'")}')`;
        return `
          <div class="adv-result-card" onclick="${onclick}">
            <div class="adv-result-thumb">
              <img src="${a.image || a.poster || ''}" alt="${a.title}" loading="lazy">
              <div class="adv-score-badge">⭐ ${a.score || '?'}</div>
              ${a.type ? `<div class="adv-type-badge">${a.type}</div>` : ''}
            </div>
            <div class="adv-result-title">${a.title}</div>
          </div>`;
      }).join('')}
    </div>
    ${paginationHtml}`;
}

// ── Hook ke search input utama ────────────────────────────
function initAdvancedSearchHook() {
  const inp = document.getElementById('searchInput');
  if (!inp) return;
  inp.addEventListener('focus', () => {
    openAdvancedSearch(inp.value.trim());
    inp.blur();
  });
}
