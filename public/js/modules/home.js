// ─── HOME MODULE ─────────────────────────────────────────
// Mengelola tab Beranda (slider + section), Trending, Jadwal, Berita.

let sliderInterval = null;

// ── Entry point ───────────────────────────────────────────
async function loadHome() {
  const homeEl = document.getElementById('home-view');
  homeEl.innerHTML = `
    <div class="home-tab-bar">
      <button class="home-tab active" onclick="switchHomeTab('beranda', this)">Beranda</button>
      <button class="home-tab" onclick="switchHomeTab('trending', this)">Trending</button>
      <button class="home-tab" onclick="switchHomeTab('jadwal', this)">Jadwal Rilis</button>
      <button class="home-tab" onclick="switchHomeTab('berita', this)">Berita</button>
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

  if (name === 'trending' && !content.innerHTML.trim()) loadTrending();
  if (name === 'jadwal'   && !content.innerHTML.trim()) loadSchedule();
  if (name === 'berita'   && !content.innerHTML.trim()) loadNews();
}

// ── Tab Beranda ───────────────────────────────────────────
async function loadLatestTab() {
  loader(true);
  const container = document.getElementById('tab-beranda');
  try {
    let sliderData = [];
    try {
      const r = await fetch(`${API_BASE}/latest`);
      sliderData = await r.json();
    } catch {}

    if (sliderData?.length > 0) {
      const top10 = sliderData.slice(0, 10);
      renderHeroSlider(top10, container);
      loader(false);

      // Continue Watching strip (di bawah hero slider)
      if (typeof CW !== 'undefined') CW.renderContinueWatchingStrip(container);

      // Async enrich slider dengan score & info detail
      top10.forEach(async (item) => {
        try {
          const r = await fetch(`${API_BASE}/anime/${encodeURIComponent(item.url)}`);
          const d = await r.json();
          if (d?.info) {
            const score  = d.info.skor || d.info.score || 'N/A';
            const type   = d.info.tipe || d.info.type  || 'Anime';
            const musim  = d.info.musim  || d.info.season   || '';
            const rilis  = d.info.dirilis || d.info.released || '';
            const year   = `${musim} ${rilis}`.trim() || 'Unknown';
            document.querySelectorAll(`.hero-meta[data-url="${item.url}"]`).forEach(el => {
              el.innerHTML = `<span>⭐ ${score}</span> • <span>${type}</span> • <span>${year}</span>`;
            });
          }
        } catch {}
      });
    } else {
      loader(false);
    }

    // Muat section-section beranda secara paralel (selain "Sedang Hangat")
    for (let i = 1; i < HOME_SECTIONS.length; i++) {
      const sec = HOME_SECTIONS[i];
      (async () => {
        try {
          let combined = [];
          if (sec.genreSlug) {
            const r = await fetch(`${API_BASE}/genre/${encodeURIComponent(sec.genreSlug)}?page=1`);
            const data = await r.json();
            const animes = data.animes || data || [];
            combined = animes.map(a => ({
              title:   a.title   || '',
              image:   a.poster  || a.image || '',
              url:     a.slug    || a.url   || '',
              score:   a.score   || '?',
              episode: a.episode || '',
              type:    a.type    || 'TV',
            }));
          }
          if (combined.length > 0) {
            if (combined.length < 6) combined = [...combined, ...combined, ...combined];
            renderSection(sec.title, combined.slice(0, 15), container, sec.genreSlug);
          }
        } catch {}
      })();
    }
  } catch { loader(false); }
}

// ── Tab Trending ──────────────────────────────────────────
async function loadTrending() {
  const container = document.getElementById('tab-trending');
  container.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
  try {
    const data = await fetch(`${API_BASE}/trending`).then(r => r.json());
    if (!data?.length) {
      container.innerHTML = '<div class="empty-state"><h2>Data trending tidak tersedia</h2></div>';
      return;
    }
    container.innerHTML = `
      <div class="section-header mt-large" style="padding:14px 16px 10px">
        <div class="bar-accent"></div><h2>Anime Trending</h2>
      </div>
      <div class="trending-list">
        ${data.map((a, i) => `
          <div class="trending-item" onclick="handleSearch('${(a.title || '').replace(/'/g, "\\'")}')">
            <div class="trending-rank ${i < 3 ? 'top3' : ''}">${a.rank || i + 1}</div>
            <div class="trending-img">
              ${a.image
                ? `<img src="${a.image}" alt="${a.title}" loading="lazy">`
                : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">○</div>'}
            </div>
            <div class="trending-info">
              <div class="trending-title">${a.title}</div>
              <div class="trending-meta">
                ${a.score    ? `<span class="trending-score">${a.score}</span>` : ''}
                ${a.genres?.length ? `<span>${a.genres.join(', ')}</span>` : ''}
                ${a.episodes  ? `<span>${a.episodes} eps</span>` : ''}
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch {
    container.innerHTML = '<div class="empty-state"><h2>Gagal memuat trending</h2></div>';
  }
}

// ── Tab Jadwal ────────────────────────────────────────────
async function loadSchedule() {
  const container = document.getElementById('tab-jadwal');
  container.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
  try {
    const data = await fetch(`${API_BASE}/schedule`).then(r => r.json());
    if (!data?.length) {
      container.innerHTML = '<div class="empty-state"><h2>Jadwal tidak tersedia saat ini</h2></div>';
      return;
    }

    const dayMap = {
      monday:'Senin', tuesday:'Selasa', wednesday:'Rabu',
      thursday:'Kamis', friday:'Jumat', saturday:'Sabtu', sunday:'Minggu',
    };
    const dayOrder = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
    const grouped  = {};
    const ungrouped = [];

    data.forEach(a => {
      const day = dayMap[a.broadcast?.day_of_the_week];
      if (day) {
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(a);
      } else {
        ungrouped.push(a);
      }
    });

    let html = `<div class="section-header mt-large" style="padding:14px 16px 10px">
      <div class="bar-accent"></div><h2>Jadwal Rilis Anime</h2>
    </div>`;

    if (Object.keys(grouped).length > 0) {
      dayOrder.forEach(day => {
        const items = grouped[day] || [];
        if (!items.length) return;
        html += `<div style="padding:10px 16px 8px"><span class="schedule-day-badge">${day}</span></div>`;
        html += `<div class="schedule-grid">${items.map(scheduleCard).join('')}</div>`;
      });
      if (ungrouped.length) {
        html += `<div style="padding:10px 16px 8px"><span class="schedule-day-badge">Lainnya</span></div>`;
        html += `<div class="schedule-grid">${ungrouped.map(scheduleCard).join('')}</div>`;
      }
    } else {
      html += `<div class="schedule-grid">${data.map(scheduleCard).join('')}</div>`;
    }

    container.innerHTML = html;
  } catch {
    container.innerHTML = '<div class="empty-state"><h2>Gagal memuat jadwal</h2></div>';
  }
}

function scheduleCard(a) {
  const title   = a.title?.length > 40 ? a.title.substring(0, 38) + '...' : (a.title || '');
  const onclick = a.url
    ? `loadDetailBySlug('${a.url}')`
    : `handleSearch('${(a.title || '').replace(/'/g, "\\'")}')`;
  return `
    <div class="schedule-card" onclick="${onclick}">
      <div class="schedule-card-img">
        ${a.image
          ? `<img src="${a.image}" alt="${a.title}" loading="lazy">`
          : '<div style="width:100%;height:100%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:32px;">○</div>'}
      </div>
      <div class="schedule-card-body">
        <div class="schedule-card-title">${title}</div>
        <div class="schedule-card-meta">
          ${a.score && a.score !== 'N/A' ? `${a.score}` : ''}
          ${a.episodes ? ` · ${a.episodes} eps` : ''}
        </div>
      </div>
    </div>`;
}

// ── Tab Berita ────────────────────────────────────────────
async function loadNews() {
  const container = document.getElementById('tab-berita');
  container.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
  try {
    const data = await fetch(`${API_BASE}/news`).then(r => r.json());
    if (!data?.length) {
      container.innerHTML = '<div class="empty-state"><h2>Berita tidak tersedia</h2></div>';
      return;
    }
    container.innerHTML = `
      <div class="section-header mt-large" style="padding:14px 16px 10px">
        <div class="bar-accent"></div><h2>Berita Anime Terbaru</h2>
      </div>
      <div class="news-list" style="padding-bottom:80px">
        ${data.map((n, i) => `
          <div class="news-card" style="animation-delay:${i * 0.05}s"
            onclick="${n.url && n.url !== '#' ? `window.open('${n.url}','_blank')` : ''}">
            <div class="news-img">
              ${n.image
                ? `<img src="${n.image}" alt="${n.title}" loading="lazy">`
                : '<div class="news-img-placeholder"></div>'}
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

// ── Hero Slider ───────────────────────────────────────────
function renderHeroSlider(data, container) {
  const loopData = [...data, data[0]]; // tambah satu item untuk efek loop mulus

  const slidesHtml = loopData.map((a, i) => {
    const eps = a.episode ? `Ep ${(a.episode.match(/\d+(\.\d+)?/) || [''])[0]}` : '';
    return `
      <div class="hero-slide">
        <img src="${a.image}" class="hero-bg" alt="${a.title}" loading="${i === 0 ? 'eager' : 'lazy'}">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          ${eps ? `<div class="hero-badge">${eps}</div>` : ''}
          <h2 class="hero-title">${a.title}</h2>
          <div class="hero-meta" data-url="${a.url}">
            <span>⭐ ${a.score || 'N/A'}</span> • <span>${a.type || 'Anime'}</span>
          </div>
          <button onclick="loadDetailBySlug('${a.url}')" class="hero-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            Nonton Sekarang
          </button>
        </div>
      </div>`;
  }).join('');

  const dotsHtml = data.map((_, i) =>
    `<div class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></div>`
  ).join('');

  const section = document.createElement('div');
  section.className = 'hero-section-container';
  section.innerHTML = `
    <div class="hero-slider">
      <div class="hero-wrapper" id="heroWrapper">${slidesHtml}</div>
      <div class="hero-dots" id="heroDots">${dotsHtml}</div>
      <button class="hero-arrow hero-arrow-left" onclick="heroArrow(-1)" aria-label="Sebelumnya">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="hero-arrow hero-arrow-right" onclick="heroArrow(1)" aria-label="Berikutnya">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>`;

  if (container.firstChild) container.insertBefore(section, container.firstChild);
  else container.appendChild(section);

  const wrapper = document.getElementById('heroWrapper');
  const total   = loopData.length;
  window._heroCur   = 0;
  window._heroTotal = total;

  function slideTo(index) {
    const cur = ((index % (total - 1)) + (total - 1)) % (total - 1);
    window._heroCur = cur;
    wrapper.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
    wrapper.style.transform  = `translateX(-${cur * 100}%)`;
    updateHeroDots(cur);
  }

  if (sliderInterval) clearInterval(sliderInterval);
  sliderInterval = setInterval(() => {
    if (!wrapper || document.getElementById('home-view')?.classList.contains('hidden')) return;
    const next = (window._heroCur || 0) + 1;
    if (next === total - 1) {
      wrapper.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
      wrapper.style.transform  = `translateX(-${(total - 1) * 100}%)`;
      updateHeroDots(0);
      setTimeout(() => {
        wrapper.style.transition = 'none';
        wrapper.style.transform  = 'translateX(0)';
        window._heroCur          = 0;
      }, 600);
    } else {
      slideTo(next);
    }
  }, 5000);

  window._heroSlideTo = slideTo;
}

window.goToSlide = (index) => { window._heroSlideTo?.(index); };
window.heroArrow  = (dir)   => { window._heroSlideTo?.((window._heroCur || 0) + dir); };

function updateHeroDots(index) {
  document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === index));
}

// ── Section horizontal scroll ─────────────────────────────
function renderSection(title, data, container, genreSlug) {
  const div = document.createElement('div');
  div.className = 'category-section';
  const moreOnclick = genreSlug
    ? `switchTab('anime');setTimeout(()=>goToGenre('${genreSlug}'),100);return false;`
    : `handleSearch('${title.split(' ')[0]}');return false;`;
  div.innerHTML = `
    <div class="header-flex">
      <div class="section-header"><div class="bar-accent"></div><h2>${title}</h2></div>
      <a href="#" class="more-link" onclick="${moreOnclick}">Lainnya →</a>
    </div>
    <div class="horizontal-scroll">
      ${data.map((a, i) => {
        const epNum  = a.episode ? (a.episode.match(/\d+(\.\d+)?/) || [''])[0] : '';
        const epText = epNum ? `EP ${epNum}` : '';
        const typeText = a.type || 'TV';
        const badgeText = [epText, typeText].filter(Boolean).join(' · ');
        const shortTitle = a.title.length > 35 ? a.title.substring(0, 35) + '...' : a.title;
        const score = a.score && a.score !== 'N/A' && a.score !== '?' ? a.score : null;
        const status   = a.status   || '';
        const genres   = a.genres   ? (Array.isArray(a.genres) ? a.genres.slice(0,2).join(', ') : String(a.genres).split(',').slice(0,2).map(g=>g.trim()).join(', ')) : '';
        const season   = [a.musim || a.season || '', a.dirilis || a.released || a.year || ''].filter(Boolean).join(' ').trim();
        const statusLabel = status.toLowerCase().includes('ongoing') || status.toLowerCase().includes('tayang')
          ? 'Ongoing' : status.toLowerCase().includes('complete') || status.toLowerCase().includes('tamat')
          ? 'Tamat' : status || '';

        return `
        <div class="scroll-card-wrapper"
          data-title="${a.title}"
          data-score="${score || ''}"
          data-type="${typeText}"
          data-url="${a.url}"
          data-status="${statusLabel}"
          data-genres="${genres}"
          data-season="${season}">
          <div class="scroll-card"
            onclick="loadDetailBySlug('${a.url}')"
            style="animation-delay:${i * 0.04}s">
            <div class="scroll-card-outer">
              <div class="scroll-card-img">
                <img src="${a.image}" alt="${a.title}" loading="lazy">
                <div class="ep-badge" data-mal-title="${(a.title || '').replace(/"/g, '')}">${badgeText}</div>
              </div>
            </div>
            <div class="scroll-card-title">${shortTitle}</div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  container.appendChild(div);
  lazyLoadScores(div);
}

// Lazy-load MAL data (score + genres + status + season) untuk semua card
async function lazyLoadScores(container) {
  const badges = container.querySelectorAll('.ep-badge[data-mal-title]');
  for (const badge of badges) {
    const title   = badge.getAttribute('data-mal-title');
    if (!title) continue;
    const wrapper = badge.closest('.scroll-card-wrapper');
    try {
      let mal;
      if (MAL_DATA_CACHE.has(title)) {
        mal = MAL_DATA_CACHE.get(title);
      } else {
        const res = await fetch(`${API_BASE}/mal/anime?title=${encodeURIComponent(title)}`);
        mal = await res.json();
        if (mal) {
          MAL_DATA_CACHE.set(title, mal);
          if (mal.mean) MAL_SCORE_CACHE.set(title, mal.mean);
        }
      }
      if (!mal || !wrapper) continue;

      // Update data attributes agar bubble bisa baca
      if (mal.mean)    wrapper.dataset.score  = mal.mean;

      // status: "finished_airing" | "currently_airing" | "not_yet_aired"
      if (mal.status) {
        const s = mal.status;
        wrapper.dataset.status =
          s === 'currently_airing'  ? 'Ongoing' :
          s === 'finished_airing'   ? 'Tamat'   :
          s === 'not_yet_aired'     ? 'Segera'  : s;
      }

      // genres: array of {id, name}
      if (mal.genres && Array.isArray(mal.genres)) {
        wrapper.dataset.genres = mal.genres.slice(0, 3).map(g => g.name || g).join(', ');
      }

      // season: {year, season} e.g. {year:2024, season:"spring"}
      if (mal.start_season) {
        const seasonMap = { winter:'Winter', spring:'Spring', summer:'Summer', fall:'Fall' };
        const s = mal.start_season;
        wrapper.dataset.season = `${seasonMap[s.season] || s.season} ${s.year}`.trim();
      } else if (mal.start_date) {
        wrapper.dataset.season = mal.start_date.slice(0, 7); // "2024-04"
      }

      // rating: pg_13 | r | g | pg | r+ | rx
      if (mal.rating) {
        const rMap = { g:'G', pg:'PG', pg_13:'PG-13', r:'R-17+', 'r+':'R+', rx:'Rx' };
        wrapper.dataset.rating = rMap[mal.rating] || mal.rating.toUpperCase();
      }

      // studios
      if (mal.studios && Array.isArray(mal.studios) && mal.studios.length) {
        wrapper.dataset.studios = mal.studios.slice(0, 2).map(s => s.name || s).join(', ');
      }

      // num_episodes
      if (mal.num_episodes) {
        wrapper.dataset.episodes = mal.num_episodes;
      }

    } catch {}
  }
}
