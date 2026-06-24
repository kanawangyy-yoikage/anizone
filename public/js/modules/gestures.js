// ─── MOBILE GESTURES MODULE ──────────────────────────────
// Fitur:
//   - Swipe left/right di watch-view → ganti episode
//   - Swipe up di bottom nav → quick search
//   - Long press kartu anime → quick bookmark
//   - Double tap player area → fullscreen toggle
// ─────────────────────────────────────────────────────────

const GESTURES = {
  // ── Swipe Episode ──────────────────────────────────────
  // State untuk navigasi episode via swipe
  _episodes    : [],
  _currentIndex: -1,

  setEpisodeList(episodes, currentUrl) {
    this._episodes     = episodes || [];
    this._currentIndex = episodes.findIndex(ep => ep.url === currentUrl);
  },

  getPrevEpisode() {
    // Episodes array is newest-first; "prev" = higher index (older)
    const idx = this._currentIndex + 1;
    return idx < this._episodes.length ? this._episodes[idx] : null;
  },

  getNextEpisode() {
    // "next" = lower index (newer episode)
    const idx = this._currentIndex - 1;
    return idx >= 0 ? this._episodes[idx] : null;
  },

  // ── Init all gestures ──────────────────────────────────
  init() {
    this._initSwipeEpisode();
    this._initLongPressBookmark();
    this._initDoubleTapFullscreen();
    this._initSwipeNav();
  },

  // ── 1. Swipe left/right on watch-view ─────────────────
  _initSwipeEpisode() {
    const el = document.getElementById('watch-view');
    if (!el) return;

    let startX = 0, startY = 0, startT = 0;
    el.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
    }, { passive: true });

    el.addEventListener('touchend', e => {
      const dx   = e.changedTouches[0].clientX - startX;
      const dy   = e.changedTouches[0].clientY - startY;
      const dt   = Date.now() - startT;
      if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 60 || dt > 400) return;

      if (dx < 0) {
        // Swipe left → next episode (newer)
        const ep = GESTURES.getNextEpisode();
        if (ep) { GESTURES._showSwipeHint('→ Episode Selanjutnya'); loadVideo(ep.url); }
        else     GESTURES._showSwipeHint('Sudah episode terbaru');
      } else {
        // Swipe right → prev episode (older)
        const ep = GESTURES.getPrevEpisode();
        if (ep) { GESTURES._showSwipeHint('← Episode Sebelumnya'); loadVideo(ep.url); }
        else     GESTURES._showSwipeHint('Ini episode pertama');
      }
    }, { passive: true });
  },

  _showSwipeHint(msg) {
    let el = document.getElementById('swipeHint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'swipeHint';
      el.className = 'swipe-hint';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  },

  // ── 3. Long press anime card → quick bookmark ─────────
  _initLongPressBookmark() {
    let pressTimer;

    document.addEventListener('touchstart', e => {
      const card = e.target.closest('.scroll-card, .bm-card');
      if (!card) return;
      pressTimer = setTimeout(() => {
        // Extract url from onclick
        const onclick = card.getAttribute('onclick') || '';
        const m = onclick.match(/loadDetail\('([^']+)'\)/);
        if (!m) return;
        const url = m[1];
        // Vibrate on supported devices
        if (navigator.vibrate) navigator.vibrate(50);
        // Show quick bookmark menu
        GESTURES._showQuickBookmark(url, card);
      }, 600);
    }, { passive: true });

    document.addEventListener('touchend',  () => clearTimeout(pressTimer), { passive: true });
    document.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
  },

  _showQuickBookmark(url, anchor) {
    // Use the existing bookmark module
    if (typeof openAdvancedSearch !== 'undefined') {
      // fallback: just show toast asking to open detail
      showToast('Buka detail untuk tambah ke watchlist');
    }
  },

  // ── 4. Double-tap player → fullscreen ─────────────────
  _initDoubleTapFullscreen() {
    const wrapper = document.querySelector('.video-wrapper');
    if (!wrapper) return;
    let lastTap = 0;
    wrapper.addEventListener('touchend', () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        const iframe = document.getElementById('video-player');
        if (!document.fullscreenElement) {
          (iframe.requestFullscreen || iframe.webkitRequestFullscreen || (() => {})).call(iframe);
        } else {
          (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
        }
      }
      lastTap = now;
    }, { passive: true });
  },

  // ── 5. Swipe up on bottom area → open search ──────────
  _initSwipeNav() {
    const nav = document.getElementById('bottomNav');
    if (!nav) return;
    let startY = 0;
    nav.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    nav.addEventListener('touchend', e => {
      const dy = startY - e.changedTouches[0].clientY;
      if (dy > 50) {
        // Swipe up on bottom nav → open search
        if (typeof openAdvancedSearch !== 'undefined') openAdvancedSearch();
      }
    }, { passive: true });
  },
};

// Auto-init after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GESTURES.init());
} else {
  GESTURES.init();
}
