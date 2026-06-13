// ─── CONTINUE WATCHING MODULE ────────────────────────────
// Track progress tiap episode: posisi detik & durasi
// Simpan di Firestore: users/{uid}/watch_progress/{episodeKey}
// ─────────────────────────────────────────────────────────

const CW = {
  _saveTimer : null,
  _currentUrl: null,
  _currentTitle: null,
  _animeUrl  : null,
  _animeTitle: null,
  _animeImage: null,

  // ── Firestore helpers ───────────────────────────────────
  _uid() { return (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null; },
  _key(url) { return encodeURIComponent(url).replace(/\./g, '%2E'); },

  async saveProgress(episodeUrl, secondsWatched, duration, extra = {}) {
    const uid = this._uid(); if (!uid || !episodeUrl) return;
    try {
      const pct = duration > 0 ? Math.round((secondsWatched / duration) * 100) : 0;
      await db.collection('users').doc(uid)
        .collection('watch_progress').doc(this._key(episodeUrl))
        .set({
          episodeUrl,
          secondsWatched,
          duration,
          percent: pct,
          updatedAt: Date.now(),
          ...extra,
        }, { merge: true });
    } catch {}
  },

  async getProgress(episodeUrl) {
    const uid = this._uid(); if (!uid) return null;
    try {
      const doc = await db.collection('users').doc(uid)
        .collection('watch_progress').doc(this._key(episodeUrl)).get();
      return doc.exists ? doc.data() : null;
    } catch { return null; }
  },

  async getAllProgress() {
    const uid = this._uid(); if (!uid) return [];
    try {
      const snap = await db.collection('users').doc(uid)
        .collection('watch_progress')
        .orderBy('updatedAt', 'desc').limit(30).get();
      return snap.docs.map(d => d.data()).filter(d => d.percent < 90);
    } catch { return []; }
  },

  // ── Attach to iframe via postMessage ───────────────────
  // NOTE: Most embed players expose time via window.postMessage or
  //  window.focus blur heuristics. We use a 10-second interval
  //  approach since cross-origin iframes block direct access.
  attachToPlayer(episodeUrl, episodeTitle, animeUrl, animeTitle, animeImage) {
    this._currentUrl   = episodeUrl;
    this._currentTitle = episodeTitle;
    this._animeUrl     = animeUrl;
    this._animeTitle   = animeTitle;
    this._animeImage   = animeImage;

    this.detach(); // clear old timer

    // Save an initial "started" entry
    this.saveProgress(episodeUrl, 0, 0, {
      episodeTitle: episodeTitle,
      animeUrl,
      animeTitle,
      animeImage,
      percent: 1,
    });

    // We track time via a heuristic: assume the user is watching
    // as long as watch-view is visible. Increment every 10s.
    let fakeSeconds = 0;
    const TICK = 10;
    this._saveTimer = setInterval(() => {
      if (!document.getElementById('watch-view')?.classList.contains('hidden') === false) return;
      // Check if watch-view is shown
      const wv = document.getElementById('watch-view');
      if (!wv || wv.classList.contains('hidden')) return;

      fakeSeconds += TICK;
      // Assume episode is ~24 minutes = 1440s by default
      const estimatedDuration = 1440;
      const pct = Math.min(Math.round((fakeSeconds / estimatedDuration) * 100), 99);

      this.saveProgress(episodeUrl, fakeSeconds, estimatedDuration, {
        episodeTitle: episodeTitle,
        animeUrl,
        animeTitle,
        animeImage,
        percent: pct,
      });

      // Update progress bar in UI
      const bar = document.getElementById('cwProgressBar');
      if (bar) bar.style.width = pct + '%';

    }, TICK * 1000);
  },

  detach() {
    if (this._saveTimer) { clearInterval(this._saveTimer); this._saveTimer = null; }
  },

  // Called when user clicks back from watch view
  markCompleted(episodeUrl) {
    this.detach();
    this.saveProgress(episodeUrl, 1440, 1440, {
      episodeTitle: this._currentTitle,
      animeUrl   : this._animeUrl,
      animeTitle : this._animeTitle,
      animeImage : this._animeImage,
      percent    : 100,
    });
  },

  // ── Render progress indicator on episode boxes ─────────
  async renderEpisodeProgress(episodes, animeUrl) {
    const uid = this._uid(); if (!uid || !episodes?.length) return;
    try {
      const snap = await db.collection('users').doc(uid)
        .collection('watch_progress').get();
      const progressMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        progressMap[data.episodeUrl] = data.percent;
      });

      document.querySelectorAll('.ep-box').forEach(box => {
        const onclick = box.getAttribute('onclick') || '';
        const m = onclick.match(/loadVideo\('([^']+)'\)/);
        if (!m) return;
        const epUrl = m[1];
        const pct = progressMap[epUrl];
        if (!pct || pct <= 1) return;

        // Add progress line at bottom of ep-box
        box.style.position = 'relative';
        box.style.overflow = 'hidden';
        const bar = document.createElement('div');
        bar.className = 'ep-progress-bar';
        bar.style.width = Math.min(pct, 100) + '%';
        if (pct >= 90) box.classList.add('ep-watched');
        box.appendChild(bar);
      });
    } catch {}
  },

  // ── Continue Watching strip (Home page) ────────────────
  async renderContinueWatchingStrip(container) {
    const items = await this.getAllProgress();
    if (!items.length) return;

    const strip = document.createElement('div');
    strip.className = 'cw-strip';
    strip.innerHTML = `
      <div class="section-header" style="padding:14px 16px 10px">
        <div class="bar-accent"></div>
        <h2>▶️ Lanjutkan Nonton</h2>
      </div>
      <div class="horizontal-scroll" id="cwScrollRow" >
        ${items.map(item => `
          <div class="cw-card" onclick="loadVideo('${item.episodeUrl}')">
            <div class="cw-thumb">
              <img src="${item.animeImage || ''}" alt="${item.animeTitle || ''}" loading="lazy">
              <div class="cw-overlay">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              </div>
              <div class="cw-progress-track">
                <div class="cw-progress-fill" style="width:${item.percent}%"></div>
              </div>
              <div class="cw-pct">${item.percent}%</div>
            </div>
            <div class="cw-info">
              <div class="cw-anime-title">${item.animeTitle || 'Anime'}</div>
              <div class="cw-ep-title">${item.episodeTitle || 'Episode'}</div>
            </div>
          </div>`).join('')}
      </div>`;
    // Prepend to container
    container.insertBefore(strip, container.firstChild);
  },
};
