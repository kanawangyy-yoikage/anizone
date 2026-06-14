// ─── NAVIGATION MODULE ───────────────────────────────────
// Mengelola perpindahan tab dan inisialisasi halaman.

function switchTab(tabName) {
  ALL_VIEWS.forEach(v => hide(v));
  show('bottomNav');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  setSidebarActive(tabName);

  switch (tabName) {
    case 'home':
      show('home-view');
      document.getElementById('tab-home')?.classList.add('active');
      if (!document.getElementById('home-view').innerHTML.trim()) loadHome();
      break;

    case 'anime':
      show('anime-view');
      document.getElementById('tab-anime')?.classList.add('active');
      renderCategoryPage();
      break;

    case 'recent':
      show('recent-view');
      document.getElementById('tab-recent')?.classList.add('active');
      loadRecentHistory();
      break;

    case 'favorite':
      show('favorite-view');
      document.getElementById('tab-favorite')?.classList.add('active');
      loadFavorites();
      break;

    case 'bookmark':
      show('bookmark-view');
      document.getElementById('tab-bookmark')?.classList.add('active');
      loadBookmarks();
      break;

    case 'developer':
      show('developer-view');
      fetchWAFollowers();
      break;

    case 'profile':
      show('profile-view');
      document.getElementById('tab-profile')?.classList.add('active');
      // Profile sudah di-load oleh onAuthStateChanged di auth.js
      if (typeof loadWaifuFromFirestore    === 'function') loadWaifuFromFirestore();
      if (typeof loadAnimeFavFromFirestore === 'function') loadAnimeFavFromFirestore();
      if (typeof loadAnimeStats            === 'function') loadAnimeStats();
      break;
  }
}

// ── Inisialisasi aplikasi ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Terapkan tema yang tersimpan
  const isLight = localStorage.getItem('theme') === 'light';
  updateThemeUI(isLight);

  // Register Service Worker untuk PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Mulai di tab Beranda
  switchTab('home');

  // Enter key di search input
  document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
});

// Redirect ke login jika belum auth
firebase.auth().onAuthStateChanged((user) => {
  if (!user) window.location.href = '/login';
});
