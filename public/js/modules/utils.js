// ─── UTILS ───────────────────────────────────────────────
// Fungsi-fungsi helper kecil yang digunakan di banyak tempat.

// Show/hide elemen berdasarkan ID
const show   = (id) => document.getElementById(id)?.classList.remove('hidden');
const hide   = (id) => {
  document.getElementById(id)?.classList.add('hidden');
  // Stop slider jika home disembunyikan
  if (id === 'home-view' && typeof sliderInterval !== 'undefined' && sliderInterval) {
    clearInterval(sliderInterval);
    sliderInterval = null;
  }
};

// Tampilkan/sembunyikan loading overlay
const loader = (state) => state ? show('loading') : hide('loading');

// Hapus duplikat array berdasarkan key tertentu
function removeDuplicates(arr, key) {
  return [...new Map(arr.map(i => [i[key], i])).values()];
}

// Aktifkan item sidebar sesuai tab
function setSidebarActive(tabName) {
  document.querySelectorAll('.sidebar-item[id^="stab-"]').forEach(el => el.classList.remove('active'));
  document.getElementById('stab-' + tabName)?.classList.add('active');
}

// Template kosong untuk state tidak ada data
function emptyState(icon, title, desc) {
  const icons = { clock: '⏱️', heart: '❤️' };
  return `<div class="empty-state">
    <div style="font-size:48px;margin-bottom:12px">${icons[icon] || '📦'}</div>
    <h2>${title}</h2>
    <p>${desc}</p>
  </div>`;
}

// Template kartu anime (digunakan di favorit & riwayat)
function animeCard(a) {
  return `
    <div class="scroll-card" onclick="loadDetail('${a.url}')" style="min-width:auto;max-width:none">
      <div class="scroll-card-img">
        <img src="${a.image}" alt="${a.title}" loading="lazy">
        <div class="ep-badge">⭐ ${a.score || '?'}</div>
      </div>
      <div class="scroll-card-title">${a.title}</div>
    </div>`;
}

// Ganti tab di halaman Profil (Informasi / Keamanan / Notifikasi / Langganan / Aktivitas)
function switchProfileTab(tabName, btn) {
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');

  const panels = ['info', 'security', 'notif', 'sub', 'activity'];
  panels.forEach(p => {
    const el = document.getElementById('profile-tab-' + p);
    if (el) el.style.display = (p === tabName) ? '' : 'none';
  });
}
