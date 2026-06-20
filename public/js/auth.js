/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — AUTH & PROFILE MODULE
   ═══════════════════════════════════════════════════════ */

// ── FIREBASE CONFIG ──────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyATmomNycKIQXHuwnLxkfQVUu77KkHdE4g",
  authDomain: "anizone-b48ce.firebaseapp.com",
  projectId: "anizone-b48ce",
  storageBucket: "anizone-b48ce.firebasestorage.app",
  messagingSenderId: "375436276826",
  appId: "1:375436276826:web:49683a8e7e4587e305d463",
  measurementId: "G-B4YBQMT23R"
};

if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── EDIT STATE ─────────────────────────────────────────
let editState = {
  avatarFile: null,
  bannerFile: null,
  bannerColor: 'linear-gradient(135deg,#2e1065,#7C3AED,#ec4899)',
  bannerIsImage: false,
};

// ── AUTH GUARD ─────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.replace('/login'); return; }
  await syncUserToFirestore(user);
  await loadUserProfile(user);
});

// ── SYNC USER BARU KE FIRESTORE ───────────────────────
// Dipanggil setiap login — kalau user belum ada di Firestore,
// otomatis dibuatkan dengan role 'user' dan data dasarnya.
async function syncUserToFirestore(user) {
  try {
    const ref = db.collection('users').doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) {
      // User baru: buat dokumen lengkap
      await ref.set({
        email:       user.email || '',
        displayName: user.displayName || 'Pengguna AniZone',
        photoURL:    user.photoURL || '',
        role:        'user',
        createdAt:   new Date().toISOString(),
        provider:    user.providerData?.[0]?.providerId || 'unknown',
      });
    } else {
      // User lama: update email/nama kalau berubah (misal ganti nama Google)
      const data = doc.data();
      const updates = {};
      if (user.email && data.email !== user.email) updates.email = user.email;
      if (user.displayName && !data.displayName) updates.displayName = user.displayName;
      if (user.photoURL && !data.photoURL) updates.photoURL = user.photoURL;
      if (Object.keys(updates).length) await ref.update(updates);
    }
  } catch (e) {
    console.warn('syncUserToFirestore error:', e);
  }
}

// ── FIRESTORE HELPERS ──────────────────────────────────
async function getFirestoreUser(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : {};
  } catch { return {}; }
}

async function getIDBCount(storeName) {
  const user = auth.currentUser;
  if (!user) return 0;
  try {
    const snap = await db.collection('users').doc(user.uid).collection(storeName).get();
    return snap.size;
  } catch { return 0; }
}

// ── AVATAR UI ─────────────────────────────────────────
function setAvatarUI(photoURL, name) {
  const initial = (name || '?').charAt(0).toUpperCase();
  [
    ['sidebarAvatarImg','sidebarAvatarInitial'],
    ['topAvatarImg','topAvatarInitial'],
    ['profileAvatarImg','profileAvatarInitial'],
  ].forEach(([imgId, initId]) => {
    const img  = document.getElementById(imgId);
    const init = document.getElementById(initId);
    if (!img || !init) return;
    if (photoURL) {
      // Reset dulu ke initial, baru load foto
      img.style.display = 'none';
      init.style.display = '';
      init.textContent = initial;
      img.onload = () => {
        img.style.display = 'block';
        init.style.display = 'none';
      };
      img.onerror = () => {
        img.style.display = 'none';
        init.style.display = '';
        init.textContent = initial;
      };
      img.src = photoURL;
    } else {
      img.style.display = 'none'; init.style.display = ''; init.textContent = initial;
    }
  });
}

// ── BANNER UI ─────────────────────────────────────────
function setBannerUI(bannerURL, bannerColor) {
  const bannerImg = document.getElementById('profileBannerImg');
  const bannerPat = document.getElementById('profileBannerPattern');
  const banner    = document.getElementById('profileBanner');
  if (!banner) return;
  if (bannerURL) {
    bannerImg.src = bannerURL; bannerImg.style.display = 'block';
    if (bannerPat) bannerPat.style.display = 'none';
    banner.style.background = 'transparent';
  } else {
    if (bannerImg) bannerImg.style.display = 'none';
    if (bannerPat) bannerPat.style.display = 'block';
    banner.style.background = bannerColor || editState.bannerColor;
  }
}

// ── LOAD PROFILE ───────────────────────────────────────
async function loadUserProfile(user) {
  const fsData     = await getFirestoreUser(user.uid);
  const name       = fsData.displayName || user.displayName || 'Pengguna AniZone';
  const email      = user.email || user.phoneNumber || '—';
  const photoURL   = fsData.photoURL || user.photoURL || null;
  const bannerURL  = fsData.bannerURL || null;
  const bannerColor = fsData.bannerColor || editState.bannerColor;
  const bio        = fsData.bio || '';
  const role       = fsData.role || 'user';

  setAvatarUI(photoURL, name);
  const su = document.getElementById('sidebarUsername');
  if (su) su.textContent = name;

  // Profile fields
  setEl('profileName', name);
  setEl('profileEmail', email);
  setEl('profileBioDisplay', bio);
  setEl('infoName', name);
  setEl('infoEmail', user.email || '—');
  setEl('infoPhone', user.phoneNumber || '—');
  setEl('infoRole', role === 'admin' ? '🛡️ Administrator' : '👤 User');

  setBannerUI(bannerURL, bannerColor);

  // Badges
  const badgesEl = document.getElementById('profileBadges');
  if (badgesEl) {
    const badges = [];
    badges.push(`<span class="profile-badge ${role==='admin'?'badge-role-admin':'badge-role-user'}">${role==='admin'?'🛡️ Admin':'👤 User'}</span>`);
    if (user.email) badges.push('<span class="profile-badge badge-method">📧 Email</span>');
    if (user.phoneNumber) badges.push('<span class="profile-badge badge-method">📱 Nomor HP</span>');
    if (user.providerData?.some(p=>p.providerId==='google.com')) badges.push('<span class="profile-badge badge-method">🟢 Google</span>');
    badgesEl.innerHTML = badges.join('');
  }

  // Verified badge for admin
  const nameRow = document.querySelector('.profile-name-row');
  if (nameRow) {
    nameRow.querySelector('.verified-badge')?.remove();
    if (role === 'admin') {
      nameRow.insertAdjacentHTML('beforeend', `<svg class="verified-badge" width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><circle cx="12" cy="12" r="12" fill="#3b82f6"/><path d="M9.5 16.5l-4-4 1.41-1.41L9.5 13.67l7.59-7.59L18.5 7.5z" fill="white"/></svg>`);
    }
  }

  // Metadata
  const createdAt = user.metadata?.creationTime ? new Date(user.metadata.creationTime) : null;
  const lastLogin  = user.metadata?.lastSignInTime ? new Date(user.metadata.lastSignInTime) : null;
  if (createdAt) {
    setEl('profileStatDays', Math.floor((Date.now()-createdAt.getTime())/86400000));
    setEl('infoJoined', createdAt.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}));
  }
  if (lastLogin) setEl('infoLastLogin', lastLogin.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}));

  // Stats
  try {
    setEl('profileStatFav', await getIDBCount('favorites'));
    setEl('profileStatHistory', await getIDBCount('history'));
  } catch {
    setEl('profileStatFav', '—'); setEl('profileStatHistory', '—');
  }

  editState.bannerColor = bannerColor;
  editState.bannerIsImage = !!bannerURL;

  // Show admin panel link if admin
  const adminLinkEl = document.getElementById('adminPanelLink');
  if (adminLinkEl) adminLinkEl.style.display = role === 'admin' ? '' : 'none';
  const adminBtnEl = document.getElementById('adminPanelLinkBtn');
  if (adminBtnEl) adminBtnEl.style.display = role === 'admin' ? '' : 'none';
}

// ── EDIT MODAL ────────────────────────────────────────
function openEditModal() {
  const user = auth.currentUser;
  if (!user) return;
  document.getElementById('editName').value = document.getElementById('profileName')?.textContent || '';
  document.getElementById('editBio').value  = document.getElementById('profileBioDisplay')?.textContent || '';
  updateBioCount(document.getElementById('editBio'));
  setEditStatus('');
  editState.avatarFile = null; editState.bannerFile = null;

  const curImg = document.getElementById('profileAvatarImg');
  const prevImg = document.getElementById('editAvatarPreviewImg');
  const prevInit = document.getElementById('editAvatarPreviewInitial');
  if (prevImg && curImg?.style.display !== 'none' && curImg.src) {
    prevImg.src = curImg.src; prevImg.style.display = 'block'; if (prevInit) prevInit.style.display = 'none';
  } else {
    if (prevImg) prevImg.style.display = 'none';
    if (prevInit) { prevInit.style.display = ''; prevInit.textContent = document.getElementById('profileAvatarInitial')?.textContent; }
  }

  const profBannerImg = document.getElementById('profileBannerImg');
  const editBannerImg = document.getElementById('editBannerPreviewImg');
  const editPat = document.getElementById('editBannerPattern');
  const editBannerPrev = document.getElementById('editBannerPreview');
  if (profBannerImg?.style.display !== 'none' && profBannerImg?.src) {
    if (editBannerImg) { editBannerImg.src = profBannerImg.src; editBannerImg.style.display = 'block'; }
    if (editPat) editPat.style.display = 'none';
    if (editBannerPrev) editBannerPrev.style.background = 'transparent';
  } else {
    if (editBannerImg) editBannerImg.style.display = 'none';
    if (editPat) editPat.style.display = 'block';
    if (editBannerPrev) editBannerPrev.style.background = editState.bannerColor;
  }

  document.querySelectorAll('.color-preset').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick')?.includes(editState.bannerColor));
  });
  document.getElementById('editModal')?.classList.add('show');
}

function closeEditModal() {
  document.getElementById('editModal')?.classList.remove('show');
  document.getElementById('inputAvatar').value = '';
  document.getElementById('inputBanner').value = '';
}

function updateBioCount(el) {
  const cnt = document.getElementById('bioCount');
  if (cnt) cnt.textContent = el.value.length;
}

function selectBannerColor(btn, color) {
  document.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  editState.bannerColor = color; editState.bannerFile = null;
  const preview = document.getElementById('editBannerPreview');
  const img = document.getElementById('editBannerPreviewImg');
  const pat = document.getElementById('editBannerPattern');
  if (img) img.style.display = 'none';
  if (pat) pat.style.display = 'block';
  if (preview) preview.style.background = color;
}

async function previewAvatar(input) {
  if (!input.files[0]) return;
  editState.avatarFile = input.files[0];
  const b64 = await fileToBase64(input.files[0]);
  const img = document.getElementById('editAvatarPreviewImg');
  if (img) { img.src = b64; img.style.display = 'block'; }
  const init = document.getElementById('editAvatarPreviewInitial');
  if (init) init.style.display = 'none';
}

async function previewBanner(input) {
  if (!input.files[0]) return;
  editState.bannerFile = input.files[0];
  const b64 = await fileToBase64(input.files[0]);
  const img = document.getElementById('editBannerPreviewImg');
  if (img) { img.src = b64; img.style.display = 'block'; }
  document.getElementById('editBannerPattern')?.style && (document.getElementById('editBannerPattern').style.display = 'none');
  const prev = document.getElementById('editBannerPreview');
  if (prev) prev.style.background = 'transparent';
  document.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
}

function setEditStatus(msg, type='') {
  const el = document.getElementById('editStatus');
  if (el) { el.textContent = msg; el.className = 'edit-status' + (type ? ' '+type : ''); }
}

async function saveProfile() {
  const user = auth.currentUser;
  if (!user) return;
  const newName = document.getElementById('editName').value.trim();
  const newBio  = document.getElementById('editBio').value.trim();
  if (!newName) { setEditStatus('Nama tidak boleh kosong', 'error'); return; }

  const btn = document.getElementById('editSaveBtn');
  const btnText = document.getElementById('editSaveBtnText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Menyimpan...';
  setEditStatus('');

  try {
    const updates = { displayName: newName, bio: newBio };
    if (editState.avatarFile) {
      setEditStatus('Memproses foto profil...');
      updates.photoURL = await compressToBase64(editState.avatarFile, 300, 0.7);
      try { await user.updateProfile({ photoURL: '' }); } catch {}
    }
    if (editState.bannerFile) {
      setEditStatus('Memproses banner...');
      updates.bannerURL = await compressToBase64(editState.bannerFile, 800, 0.7);
    } else {
      updates.bannerURL = null;
    }
    updates.bannerColor = editState.bannerColor;

    await user.updateProfile({ displayName: newName });
    await db.collection('users').doc(user.uid).set(updates, { merge: true });

    setEditStatus('✅ Profil berhasil disimpan!', 'success');
    await loadUserProfile(auth.currentUser);
    setTimeout(() => closeEditModal(), 1200);
  } catch(e) {
    setEditStatus('Gagal menyimpan: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Simpan Perubahan';
  }
}

// ── LOGOUT ────────────────────────────────────────────
function doLogout() { document.getElementById('logoutModal')?.classList.add('show'); }
function closeLogoutModal() { document.getElementById('logoutModal')?.classList.remove('show'); }
async function confirmLogout() {
  try { await auth.signOut(); } catch {}
  window.location.replace('/login');
}

// ── UTILS ─────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function compressToBase64(file, maxWidth = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const b64 = canvas.toDataURL('image/jpeg', quality);
        resolve(b64.length > 900000 ? canvas.toDataURL('image/jpeg', 0.4) : b64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── MODAL CLOSE ON OVERLAY CLICK ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoutModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeLogoutModal();
  });
  document.getElementById('editModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
  });
});

// ═══════════════════════════════════════════════════
// WAIFU LIST & ANIME FAVORIT — FanBias Style
// ═══════════════════════════════════════════════════

// ── STATE ──────────────────────────────────────────
const waifuState = { list: [] };
const animeFavState = { list: [] };
let waifuSearchTimer = null;
let animeFavSearchTimer = null;

// ── FIRESTORE WAIFU ────────────────────────────────
async function loadWaifuFromFirestore() {
  const uid = auth.currentUser?.uid; if (!uid) return;
  try {
    const doc = await db.collection('users').doc(uid).get();
    waifuState.list = doc.data()?.waifuList || [];
    renderWaifuGrid();
  } catch {}
}

async function saveWaifuToFirestore() {
  const uid = auth.currentUser?.uid; if (!uid) return;
  try {
    await db.collection('users').doc(uid).set({ waifuList: waifuState.list }, { merge: true });
  } catch {}
}

async function loadAnimeFavFromFirestore() {
  const uid = auth.currentUser?.uid; if (!uid) return;
  try {
    const doc = await db.collection('users').doc(uid).get();
    animeFavState.list = doc.data()?.animeFavList || [];
    renderAnimeFavList();
  } catch {}
}

async function saveAnimeFavToFirestore() {
  const uid = auth.currentUser?.uid; if (!uid) return;
  try {
    await db.collection('users').doc(uid).set({ animeFavList: animeFavState.list }, { merge: true });
  } catch {}
}

// ── RENDER WAIFU GRID ──────────────────────────────
function renderWaifuGrid() {
  const grid = document.getElementById('waifuGrid');
  const countEl = document.getElementById('waifuCount');
  if (!grid) return;
  if (countEl) countEl.textContent = waifuState.list.length + ' waifu';
  grid.innerHTML = '';
  waifuState.list.forEach(w => {
    const card = document.createElement('div');
    card.className = 'waifu-card';
    card.innerHTML = `
      <button class="waifu-del-btn" onclick="removeWaifu(${w.id})" title="Hapus">×</button>
      <img class="waifu-card-img" src="${w.img}" alt="${w.name}" loading="lazy" onerror="this.src=''">
      <div class="waifu-card-name">${w.name}</div>
      <div class="waifu-card-from">${w.from}</div>`;
    grid.appendChild(card);
  });
  if (waifuState.list.length < 12) {
    const add = document.createElement('div');
    add.className = 'waifu-add-card';
    add.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Tambah</span>`;
    add.onclick = openWaifuModal;
    grid.appendChild(add);
  }
}

async function removeWaifu(id) {
  waifuState.list = waifuState.list.filter(w => w.id !== id);
  renderWaifuGrid();
  await saveWaifuToFirestore();
}

// ── RENDER ANIME FAV ───────────────────────────────
function renderAnimeFavList() {
  const el = document.getElementById('animeFavList');
  if (!el) return;
  if (!animeFavState.list.length) {
    el.innerHTML = '<div class="animefav-empty">Belum ada anime favorit ditambahkan.</div>';
    return;
  }
  el.innerHTML = animeFavState.list.map(a => `
    <div class="animefav-item">
      <img class="animefav-poster" src="${a.poster}" alt="${a.title}" loading="lazy" onerror="this.src=''">
      <div class="animefav-info">
        <div class="animefav-title">${a.title}</div>
        <div class="animefav-meta">${a.year ? a.year + ' · ' : ''}${a.ep || ''}</div>
      </div>
      <span class="animefav-score">★ ${a.score || '?'}</span>
      <button class="animefav-del" onclick="removeAnimeFav(${a.id})" title="Hapus">×</button>
    </div>`).join('');
}

async function removeAnimeFav(id) {
  animeFavState.list = animeFavState.list.filter(a => a.id !== id);
  renderAnimeFavList();
  await saveAnimeFavToFirestore();
}

// ── WAIFU MODAL ────────────────────────────────────
function openWaifuModal() {
  document.getElementById('waifuModal').classList.add('open');
  document.getElementById('waifuSearchInput').value = '';
  loadPopularWaifu();
}
function closeWaifuModal() {
  document.getElementById('waifuModal').classList.remove('open');
}

function switchWaifuTab(tab, btn) {
  document.querySelectorAll('.pfb-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'popular') { document.getElementById('waifuSearchInput').value = ''; loadPopularWaifu(); }
  else document.getElementById('waifuSearchInput').focus();
}

function debounceWaifuSearch(val) {
  clearTimeout(waifuSearchTimer);
  if (!val.trim()) { loadPopularWaifu(); return; }
  waifuSearchTimer = setTimeout(() => searchWaifu(val), 600);
}

async function loadPopularWaifu() {
  const status = document.getElementById('waifuSearchStatus');
  const results = document.getElementById('waifuSearchResults');
  status.style.display = 'block'; status.textContent = 'Memuat karakter populer...';
  results.innerHTML = '';
  try {
    const r = await fetch('https://api.jikan.moe/v4/characters?order_by=favorites&sort=desc&limit=18');
    const d = await r.json();
    status.style.display = 'none';
    renderWaifuSearchResults(d.data || []);
  } catch { status.textContent = 'Gagal memuat. Coba lagi.'; }
}

async function searchWaifu(q) {
  const status = document.getElementById('waifuSearchStatus');
  const results = document.getElementById('waifuSearchResults');
  status.style.display = 'block'; status.textContent = 'Mencari...';
  results.innerHTML = '';
  try {
    const r = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=18`);
    const d = await r.json();
    status.style.display = 'none';
    renderWaifuSearchResults(d.data || []);
  } catch { status.textContent = 'Gagal mencari.'; }
}

function renderWaifuSearchResults(chars) {
  const el = document.getElementById('waifuSearchResults');
  if (!chars.length) { el.innerHTML = '<div class="pfb-loading">Tidak ditemukan</div>'; return; }
  el.innerHTML = '';
  chars.forEach(c => {
    const img = c.images?.jpg?.image_url || '';
    const name = c.name || 'Unknown';
    const from = c.anime?.[0]?.anime?.title || c.manga?.[0]?.manga?.title || '?';
    const div = document.createElement('div');
    div.className = 'waifu-search-item';
    const already = waifuState.list.find(w => w.id === c.mal_id);
    div.innerHTML = `
      <img src="${img}" alt="${name}" loading="lazy" onerror="this.src=''">
      <div class="waifu-search-item-info">
        <div class="waifu-search-item-name">${name}</div>
        <div class="waifu-search-item-from">${from}</div>
        ${already ? '<div style="font-size:9px;color:var(--accent)">✓ Ditambahkan</div>' : ''}
      </div>`;
    if (!already) div.onclick = () => addWaifu({ id: c.mal_id, name, from, img });
    el.appendChild(div);
  });
}

async function addWaifu(char) {
  if (waifuState.list.find(w => w.id === char.id)) { closeWaifuModal(); return; }
  if (waifuState.list.length >= 12) { alert('Maksimal 12 waifu!'); return; }
  waifuState.list.push(char);
  renderWaifuGrid();
  closeWaifuModal();
  await saveWaifuToFirestore();
}

// ── ANIME FAV MODAL ────────────────────────────────
function openAnimeFavModal() {
  document.getElementById('animeFavModal').classList.add('open');
  document.getElementById('animeFavSearchInput').value = '';
  document.getElementById('animeFavSearchResults').innerHTML = '';
}
function closeAnimeFavModal() {
  document.getElementById('animeFavModal').classList.remove('open');
}

function debounceAnimeFavSearch(val) {
  clearTimeout(animeFavSearchTimer);
  if (!val.trim()) { document.getElementById('animeFavSearchResults').innerHTML = ''; return; }
  animeFavSearchTimer = setTimeout(() => searchAnimeFav(val), 600);
}

async function searchAnimeFav(q) {
  const status = document.getElementById('animeFavSearchStatus');
  const results = document.getElementById('animeFavSearchResults');
  status.style.display = 'block'; status.textContent = 'Mencari...';
  results.innerHTML = '';
  try {
    const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10&sfw=true`);
    const d = await r.json();
    status.style.display = 'none';
    renderAnimeFavSearchResults(d.data || []);
  } catch { status.textContent = 'Gagal mencari.'; }
}

function renderAnimeFavSearchResults(animes) {
  const el = document.getElementById('animeFavSearchResults');
  if (!animes.length) { el.innerHTML = '<div class="pfb-loading">Tidak ditemukan</div>'; return; }
  el.innerHTML = '';
  animes.forEach(a => {
    const poster = a.images?.jpg?.small_image_url || a.images?.jpg?.image_url || '';
    const title = a.title || '?';
    const ep = a.episodes ? a.episodes + ' ep' : '?';
    const score = a.score || '?';
    const year = a.year || '';
    const already = animeFavState.list.find(f => f.id === a.mal_id);
    const div = document.createElement('div');
    div.className = 'animefav-search-item';
    div.innerHTML = `
      <img class="animefav-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.src=''">
      <div class="animefav-info">
        <div class="animefav-title">${title}</div>
        <div class="animefav-meta">${year ? year + ' · ' : ''}${ep}</div>
        ${already ? '<div style="font-size:11px;color:var(--accent)">✓ Sudah ditambahkan</div>' : ''}
      </div>
      <span class="animefav-score">★ ${score}</span>`;
    if (!already) div.onclick = () => addAnimeFav({ id: a.mal_id, title, poster, ep, score, year });
    el.appendChild(div);
  });
}

async function addAnimeFav(anime) {
  if (animeFavState.list.find(f => f.id === anime.id)) { closeAnimeFavModal(); return; }
  if (animeFavState.list.length >= 10) { alert('Maksimal 10 anime favorit!'); return; }
  animeFavState.list.push(anime);
  renderAnimeFavList();
  closeAnimeFavModal();
  await saveAnimeFavToFirestore();
}

// ── CLOSE ON OVERLAY CLICK ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('waifuModal')?.addEventListener('click', e => { if (e.target.id === 'waifuModal') closeWaifuModal(); });
  document.getElementById('animeFavModal')?.addEventListener('click', e => { if (e.target.id === 'animeFavModal') closeAnimeFavModal(); });
});
