// ─── ADVANCED SEARCH & FILTER MODULE ────────────────────
// Fitur: filter genre, type, status, sort, search instant
// ─────────────────────────────────────────────────────────

const SEARCH_FILTERS = {
  type  : ['Semua', 'TV', 'Movie', 'OVA', 'ONA', 'Special'],
  status: ['Semua', 'Ongoing', 'Completed', 'Upcoming'],
  sort  : [
    { label: 'Relevan',     key: 'relevant'  },
    { label: 'Skor ↓',      key: 'score_desc'},
    { label: 'A–Z',         key: 'alpha_asc' },
    { label: 'Z–A',         key: 'alpha_desc'},
    { label: 'Terbaru',     key: 'newest'    },
  ],
};

// Current filter state
const _filterState = {
  query  : '',
  type   : 'Semua',
  status : 'Semua',
  sort   : 'relevant',
  results: [],
};

// ── Open Search Overlay ───────────────────────────────────
function openAdvancedSearch(prefillQuery = '') {
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
                <button class="adv-chip ${t === 'Semua' ? 'active' : ''}"
                  onclick="setFilter('type','${t}',this)">${t}</button>
              `).join('')}
            </div>
          </div>
          <div class="adv-filter-group">
            <div class="adv-filter-label">Status</div>
            <div class="adv-filter-chips" id="filterStatus">
              ${SEARCH_FILTERS.status.map(s => `
                <button class="adv-chip ${s === 'Semua' ? 'active' : ''}"
                  onclick="setFilter('status','${s}',this)">${s}</button>
              `).join('')}
            </div>
          </div>
          <div class="adv-filter-group">
            <div class="adv-filter-label">Urutkan</div>
            <div class="adv-filter-chips" id="filterSort">
              ${SEARCH_FILTERS.sort.map((s, i) => `
                <button class="adv-chip ${i === 0 ? 'active' : ''}"
                  onclick="setFilter('sort','${s.key}',this)">${s.label}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Results -->
        <div class="adv-results" id="advResults">
          <div class="adv-empty-hint">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p>Ketik untuk mencari anime...</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAdvancedSearch();
    });

    // Input listener with debounce
    const input = document.getElementById('advSearchInput');
    let debounceTimer;
    input.addEventListener('input', () => {
      const q = input.value.trim();
      document.getElementById('advSearchClearBtn').style.display = q ? 'flex' : 'none';
      clearTimeout(debounceTimer);
      if (!q) {
        _filterState.query = '';
        _filterState.results = [];
        renderAdvResults([]);
        return;
      }
      debounceTimer = setTimeout(() => runAdvSearch(q), 350);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeAdvancedSearch();
    });
  }

  overlay.classList.add('open');
  _filterState.query = prefillQuery;
  const input = document.getElementById('advSearchInput');
  if (input) {
    input.value = prefillQuery;
    setTimeout(() => input.focus(), 100);
    if (prefillQuery) runAdvSearch(prefillQuery);
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
  _filterState.results = [];
  renderAdvResults([]);
}

function setFilter(key, value, btn) {
  _filterState[key] = value;
  // Update active chip
  btn.closest('.adv-filter-chips')?.querySelectorAll('.adv-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  // Re-render with existing results
  if (_filterState.results.length) renderAdvResults(_filterState.results);
}

async function runAdvSearch(query) {
  _filterState.query = query;
  const resultsEl = document.getElementById('advResults');
  if (!resultsEl) return;
  resultsEl.innerHTML = '<div class="adv-loading"><div class="spinner" style="width:28px;height:28px;margin:0 auto 8px"></div><p>Mencari...</p></div>';

  try {
    const [scraperRes, malRes] = await Promise.allSettled([
      fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`).then(r => r.json()),
      fetch(`${API_BASE}/mal/anime?title=${encodeURIComponent(query)}`).then(r => r.json()),
    ]);

    let results = scraperRes.status === 'fulfilled' && Array.isArray(scraperRes.value)
      ? scraperRes.value : [];

    // Enrich first result with MAL data if available
    if (malRes.status === 'fulfilled' && malRes.value?.mean) {
      const malAnime = malRes.value;
      if (results[0]) results[0].score = String(malAnime.mean);
    }

    _filterState.results = results;
    renderAdvResults(results);
  } catch {
    resultsEl.innerHTML = '<div class="adv-empty-hint"><p>Gagal memuat hasil.</p></div>';
  }
}

function applyFilters(results) {
  let filtered = [...results];

  if (_filterState.type !== 'Semua') {
    filtered = filtered.filter(a => (a.type || '').toLowerCase().includes(_filterState.type.toLowerCase()));
  }
  if (_filterState.status !== 'Semua') {
    // Status dari scraper tidak selalu ada — filter best-effort
    filtered = filtered.filter(a => {
      const s = (a.status || a.info?.status || '').toLowerCase();
      return s.includes(_filterState.status.toLowerCase()) || !s;
    });
  }

  // Sort
  switch (_filterState.sort) {
    case 'score_desc':
      filtered.sort((a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0));
      break;
    case 'alpha_asc':
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'alpha_desc':
      filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      break;
    // relevant & newest: keep original order
  }
  return filtered;
}

function renderAdvResults(results) {
  const el = document.getElementById('advResults');
  if (!el) return;

  const filtered = applyFilters(results);

  if (!filtered.length && _filterState.query) {
    el.innerHTML = `
      <div class="adv-empty-hint">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>Tidak ada hasil untuk "<strong>${_filterState.query}</strong>"</p>
      </div>`;
    return;
  }
  if (!filtered.length) {
    el.innerHTML = `<div class="adv-empty-hint"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><p>Ketik untuk mencari anime...</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="adv-result-count">${filtered.length} hasil ditemukan</div>
    <div class="adv-result-grid">
      ${filtered.map(a => `
        <div class="adv-result-card" onclick="closeAdvancedSearch();loadDetail('${a.url}')">
          <div class="adv-result-thumb">
            <img src="${a.image || ''}" alt="${a.title}" loading="lazy">
            <div class="adv-score-badge">⭐ ${a.score || '?'}</div>
            ${a.type ? `<div class="adv-type-badge">${a.type}</div>` : ''}
          </div>
          <div class="adv-result-title">${a.title}</div>
        </div>`).join('')}
    </div>`;
}

// ── Hook ke search input utama ────────────────────────────
// Replace handleSearch agar menggunakan advanced search overlay
function initAdvancedSearchHook() {
  const inp = document.getElementById('searchInput');
  if (!inp) return;
  inp.addEventListener('focus', () => {
    openAdvancedSearch(inp.value.trim());
    inp.blur(); // prevent double-keyboard on mobile
  });
}
