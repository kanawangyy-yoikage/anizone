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
  const icons = { clock: '○', heart: '♡' };
  return `<div class="empty-state">
    <div style="font-size:32px;margin-bottom:12px;opacity:0.3">${icons[icon] || '○'}</div>
    <h2>${title}</h2>
    <p>${desc}</p>
  </div>`;
}

// Template kartu anime (digunakan di favorit & riwayat)
function animeCard(a) {
  const title = a.title||'';
  const shortTitle = title.length > 35 ? title.substring(0,35)+'...' : title;
  return `
    <div class="scroll-card-wrapper" onclick="loadDetail('${a.url}')">
      <div class="scroll-card">
        <div class="scroll-card-outer">
          <div class="scroll-card-img">
            <img src="${a.image}" alt="${title}" loading="lazy">
            <div class="ep-badge" data-mal-title="${title.replace(/"/g,'')}">⭐ ${a.score||'?'}</div>
          </div>
        </div>
        <div class="scroll-card-title">${shortTitle}</div>
      </div>
    </div>`;
}
