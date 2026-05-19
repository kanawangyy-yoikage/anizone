/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — ADMIN MODULE
   ═══════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyATmomNycKIQXHuwnLxkfQVUu77KkHdE4g",
  authDomain: "anizone-b48ce.firebaseapp.com",
  projectId: "anizone-b48ce",
  storageBucket: "anizone-b48ce.firebasestorage.app",
  messagingSenderId: "375436276826",
  appId: "1:375436276826:web:49683a8e7e4587e305d463"
};

if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── STATE ──────────────────────────────────────────────
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let selectedUser = null;
let currentAdminUser = null;

// ── AUTH GUARD ─────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.replace('login.html'); return; }
  const fsData = await getFirestoreUser(user.uid);
  if (fsData.role !== 'admin') {
    showToast('Akses ditolak. Hanya admin yang dapat mengakses panel ini.', 'error');
    setTimeout(() => window.location.replace('index.html'), 2000);
    return;
  }
  currentAdminUser = { ...user, ...fsData };
  initAdmin(user, fsData);
});

// ── INIT ───────────────────────────────────────────────
async function initAdmin(user, fsData) {
  const name   = fsData.displayName || user.displayName || 'Admin';
  const initEl = document.getElementById('adminInitial');
  const nameEl = document.getElementById('adminName');
  const imgEl  = document.getElementById('adminAvatarImg');

  if (nameEl) nameEl.textContent = name;
  if (initEl) initEl.textContent = name.charAt(0).toUpperCase();
  if (imgEl && (fsData.photoURL || user.photoURL)) {
    imgEl.src = fsData.photoURL || user.photoURL;
    imgEl.style.display = 'block';
    if (initEl) initEl.style.display = 'none';
  }

  switchAdminTab('dashboard');
}

// ── FIRESTORE HELPERS ──────────────────────────────────
async function getFirestoreUser(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists ? doc.data() : {};
  } catch { return {}; }
}

async function getAllUsers() {
  try {
    const snap = await db.collection('users').get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch { return []; }
}

// ── ADMIN TAB SWITCH ──────────────────────────────────
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-' + tab)?.classList.add('active');

  const views = ['dashboard','users','activity','settings'];
  views.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = v === tab ? 'block' : 'none';
  });

  if (tab === 'dashboard') loadDashboard();
  if (tab === 'users')     loadUsersTable();
  if (tab === 'activity')  loadActivityLog();
  if (tab === 'settings')  loadSettings();
}

// ── DASHBOARD ─────────────────────────────────────────
async function loadDashboard() {
  const view = document.getElementById('view-dashboard');
  view.innerHTML = `
    <div class="admin-topbar">
      <div><div class="admin-page-title">Dashboard</div><div class="admin-page-subtitle">Ringkasan data AniZone</div></div>
      <div class="admin-topbar-actions">
        <button class="admin-btn admin-btn-outline" onclick="loadDashboard()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.98"/></svg>
          Refresh
        </button>
      </div>
    </div>
    <div id="stats-grid" class="stats-grid">
      ${[1,2,3,4].map(i => `<div class="stat-card skeleton" style="height:86px;animation-delay:${i*0.08}s"></div>`).join('')}
    </div>
    <div class="admin-charts-grid" id="charts-grid">
      <div class="chart-card skeleton" style="height:200px"></div>
      <div class="chart-card skeleton" style="height:200px"></div>
    </div>
    <div class="admin-table-container">
      <div class="admin-table-header"><div class="admin-table-title">Pengguna Terbaru</div></div>
      <div id="recent-users-list" style="padding:20px;color:var(--text-muted);text-align:center">Memuat...</div>
    </div>`;

  try {
    const users = await getAllUsers();
    allUsers = users;

    const totalUsers  = users.length;
    const adminCount  = users.filter(u => u.role === 'admin').length;
    const bannedCount = users.filter(u => u.role === 'banned').length;
    const activeUsers = users.filter(u => u.role !== 'banned').length;

    document.getElementById('stats-grid').innerHTML = `
      ${statCard('👥', 'blue',  'Total Pengguna',   totalUsers,  '+' + Math.round(totalUsers*0.05) + ' bulan ini', 'up')}
      ${statCard('✅', 'green', 'Pengguna Aktif',   activeUsers, 'Tidak diblokir', '')}
      ${statCard('🛡️', 'yellow','Administrator',    adminCount,  'Akses penuh', '')}
      ${statCard('🚫', 'red',   'Diblokir',         bannedCount, bannedCount > 0 ? 'Perlu perhatian' : 'Aman', bannedCount > 0 ? 'down' : 'up')}`;

    // Charts
    const roleData = [
      { label: 'User', val: users.filter(u => u.role === 'user' || !u.role).length, max: totalUsers, color: '' },
      { label: 'Admin', val: adminCount, max: totalUsers, color: 'green' },
      { label: 'Banned', val: bannedCount, max: totalUsers, color: 'red' },
    ];
    const authData = [
      { label: 'Email/Password', val: users.filter(u => u.email && !u.googleLinked).length, max: totalUsers, color: '' },
      { label: 'Google', val: users.filter(u => u.googleLinked || u.provider === 'google').length, max: totalUsers, color: 'green' },
      { label: 'Lainnya', val: users.filter(u => !u.email && !u.googleLinked).length, max: totalUsers, color: '' },
    ];

    document.getElementById('charts-grid').innerHTML = `
      ${chartCard('Distribusi Role', 'Berdasarkan role pengguna', roleData, totalUsers)}
      ${chartCard('Metode Autentikasi', 'Cara login pengguna', authData, totalUsers)}`;

    // Recent users
    const recent = [...users].sort((a,b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 5);
    document.getElementById('recent-users-list').innerHTML = `
      <table style="width:100%">
        <thead><tr><th>Pengguna</th><th>Role</th><th>Email</th></tr></thead>
        <tbody>${recent.map(u => userTableRow(u, true)).join('')}</tbody>
      </table>`;

  } catch(e) {
    document.getElementById('stats-grid').innerHTML = `<div style="color:var(--danger);padding:20px">Error: ${e.message}</div>`;
  }
}

function statCard(icon, color, label, value, change, dir) {
  return `
    <div class="stat-card">
      <div class="stat-icon ${color}">${icon}</div>
      <div class="stat-info">
        <div class="stat-num">${value.toLocaleString()}</div>
        <div class="stat-label">${label}</div>
        ${change ? `<div class="stat-change ${dir}">${change}</div>` : ''}
      </div>
    </div>`;
}

function chartCard(title, subtitle, data, total) {
  const bars = data.map(d => `
    <div class="chart-bar-item">
      <div class="chart-bar-label"><span>${d.label}</span><span>${d.val}</span></div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${d.color}" style="width:${total>0?Math.round(d.val/total*100):0}%"></div>
      </div>
    </div>`).join('');
  return `
    <div class="chart-card">
      <div class="chart-title">${title}</div>
      <div class="chart-subtitle">${subtitle}</div>
      <div class="chart-bar-list">${bars}</div>
    </div>`;
}

// ── USERS TABLE ───────────────────────────────────────
async function loadUsersTable() {
  const view = document.getElementById('view-users');
  view.innerHTML = `
    <div class="admin-topbar">
      <div><div class="admin-page-title">Manajemen Pengguna</div><div class="admin-page-subtitle">Kelola semua akun pengguna</div></div>
      <div class="admin-topbar-actions">
        <button class="admin-btn admin-btn-outline" onclick="loadUsersTable()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.98"/></svg> Refresh
        </button>
      </div>
    </div>
    <div class="admin-table-container">
      <div class="admin-table-header">
        <div class="admin-table-title">Semua Pengguna</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <select class="form-select" style="width:auto;padding:8px 12px;font-size:13px" onchange="filterByRole(this.value)" id="roleFilter">
            <option value="">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="banned">Banned</option>
          </select>
          <div class="admin-search-input">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Cari nama / email..." oninput="filterUsers(this.value)" id="userSearchInput">
          </div>
        </div>
      </div>
      <div class="admin-table-wrapper">
        <table>
          <thead><tr><th>Pengguna</th><th>Email</th><th>Role</th><th>Bergabung</th><th>Aksi</th></tr></thead>
          <tbody id="users-tbody"><tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">Memuat data...</td></tr></tbody>
        </table>
      </div>
      <div class="pagination" id="users-pagination"></div>
    </div>`;

  try {
    if (!allUsers.length) allUsers = await getAllUsers();
    filteredUsers = [...allUsers];
    currentPage = 1;
    renderUsersTable();
  } catch(e) {
    document.getElementById('users-tbody').innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:30px">Gagal memuat: ${e.message}</td></tr>`;
  }
}

function userTableRow(u, compact = false) {
  const name  = u.displayName || 'Tanpa Nama';
  const email = u.email || u.phoneNumber || '—';
  const role  = u.role || 'user';
  const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const initial = name.charAt(0).toUpperCase();

  if (compact) {
    return `<tr>
      <td><div class="user-cell">
        <div class="user-mini-avatar">${u.photoURL?`<img src="${u.photoURL}" alt="">`:''}${initial}</div>
        <div class="user-cell-name">${name}</div>
      </div></td>
      <td><span class="role-badge role-${role}">${roleLabel(role)}</span></td>
      <td style="color:var(--text-muted);font-size:12px">${email}</td>
    </tr>`;
  }

  return `<tr>
    <td><div class="user-cell">
      <div class="user-mini-avatar">${u.photoURL?`<img src="${u.photoURL}" alt="">`:''}${initial}</div>
      <div class="user-cell-info">
        <div class="user-cell-name">${name}</div>
        <div class="user-cell-uid">${(u.uid||'').substring(0,12)}...</div>
      </div>
    </div></td>
    <td style="color:var(--text-muted);font-size:13px">${email}</td>
    <td><span class="role-badge role-${role}">${roleLabel(role)}</span></td>
    <td style="color:var(--text-muted);font-size:12px">${joined}</td>
    <td><div class="table-actions">
      <button class="icon-btn info" onclick="openUserModal('${u.uid}')" title="Detail">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </button>
      ${role !== 'admin' ? `
      <button class="icon-btn" onclick="toggleBan('${u.uid}','${role}')" title="${role==='banned'?'Unban':'Ban'}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      </button>` : ''}
      ${role !== 'admin' ? `
      <button class="icon-btn" onclick="toggleAdmin('${u.uid}','${role}')" title="Jadikan Admin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </button>` : ''}
      <button class="icon-btn danger" onclick="confirmDeleteUser('${u.uid}','${name.replace(/'/g,"\\'")}')'" title="Hapus">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
      </button>
    </div></td>
  </tr>`;
}

function roleLabel(role) {
  const map = { admin: '🛡️ Admin', user: '👤 User', banned: '🚫 Banned' };
  return map[role] || role;
}

function renderUsersTable() {
  const tbody  = document.getElementById('users-tbody');
  const pagDiv = document.getElementById('users-pagination');
  if (!tbody) return;
  const total  = filteredUsers.length;
  const pages  = Math.ceil(total / PAGE_SIZE);
  const slice  = filteredUsers.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);

  tbody.innerHTML = slice.length
    ? slice.map(u => userTableRow(u)).join('')
    : `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">Tidak ada pengguna ditemukan.</td></tr>`;

  if (pagDiv) {
    pagDiv.innerHTML = `
      <span>${total} pengguna · Halaman ${currentPage} dari ${pages||1}</span>
      <div class="page-btns">
        <button class="page-btn" onclick="changePage(${currentPage-1})" ${currentPage<=1?'disabled':''}>‹</button>
        ${Array.from({length:Math.min(pages,5)},(_,i)=>i+1).map(p=>
          `<button class="page-btn ${p===currentPage?'active':''}" onclick="changePage(${p})">${p}</button>`
        ).join('')}
        <button class="page-btn" onclick="changePage(${currentPage+1})" ${currentPage>=pages?'disabled':''}>›</button>
      </div>`;
  }
}

function changePage(p) { currentPage = p; renderUsersTable(); }

function filterUsers(query) {
  const q = query.toLowerCase().trim();
  const roleVal = document.getElementById('roleFilter')?.value || '';
  filteredUsers = allUsers.filter(u => {
    const matchQuery = !q || (u.displayName||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.uid||'').toLowerCase().includes(q);
    const matchRole  = !roleVal || (u.role||'user') === roleVal;
    return matchQuery && matchRole;
  });
  currentPage = 1;
  renderUsersTable();
}

function filterByRole(role) {
  const q = document.getElementById('userSearchInput')?.value || '';
  filteredUsers = allUsers.filter(u => {
    const matchQuery = !q || (u.displayName||'').toLowerCase().includes(q.toLowerCase()) || (u.email||'').toLowerCase().includes(q.toLowerCase());
    const matchRole  = !role || (u.role||'user') === role;
    return matchQuery && matchRole;
  });
  currentPage = 1;
  renderUsersTable();
}

// ── USER MODAL ────────────────────────────────────────
function openUserModal(uid) {
  const u = allUsers.find(u => u.uid === uid);
  if (!u) return;
  selectedUser = u;
  const name    = u.displayName || 'Tanpa Nama';
  const email   = u.email || u.phoneNumber || '—';
  const role    = u.role || 'user';
  const initial = name.charAt(0).toUpperCase();
  const joined  = u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '—';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-user-header">
      <div class="modal-avatar">${u.photoURL?`<img src="${u.photoURL}" alt="">`:''}${initial}</div>
      <div>
        <div class="modal-user-name">${name}</div>
        <div class="modal-user-email">${email}</div>
        <span class="role-badge role-${role}" style="margin-top:6px;display:inline-flex">${roleLabel(role)}</span>
      </div>
    </div>
    <div class="modal-info-grid">
      <div class="modal-info-item"><div class="modal-info-label">UID</div><div class="modal-info-value" style="font-size:11px;font-family:monospace">${u.uid||'—'}</div></div>
      <div class="modal-info-item"><div class="modal-info-label">Bergabung</div><div class="modal-info-value">${joined}</div></div>
      <div class="modal-info-item"><div class="modal-info-label">Bio</div><div class="modal-info-value">${u.bio||'—'}</div></div>
      <div class="modal-info-item"><div class="modal-info-label">Provider</div><div class="modal-info-value">${u.email?'Email':u.phoneNumber?'Phone':'—'}</div></div>
    </div>
    <div class="modal-section-title">Aksi Cepat</div>
    <div class="modal-actions">
      ${role !== 'admin' ? `<button class="admin-btn admin-btn-primary" onclick="toggleAdmin('${uid}','${role}');closeModal()">🛡️ Jadikan Admin</button>` : ''}
      ${role !== 'banned' ? `<button class="admin-btn admin-btn-danger" onclick="toggleBan('${uid}','${role}');closeModal()">🚫 Ban Pengguna</button>` : `<button class="admin-btn admin-btn-outline" onclick="toggleBan('${uid}','${role}');closeModal()">✅ Unban</button>`}
      <button class="admin-btn admin-btn-danger" onclick="confirmDeleteUser('${uid}','${name.replace(/'/g,"\\'")}');closeModal()">🗑️ Hapus Akun</button>
    </div>`;

  document.getElementById('user-modal').classList.add('show');
}

function closeModal() {
  document.getElementById('user-modal')?.classList.remove('show');
  selectedUser = null;
}

// ── USER ACTIONS ──────────────────────────────────────
async function toggleBan(uid, currentRole) {
  if (!confirm(currentRole === 'banned' ? 'Unban pengguna ini?' : 'Ban pengguna ini?')) return;
  try {
    const newRole = currentRole === 'banned' ? 'user' : 'banned';
    await db.collection('users').doc(uid).update({ role: newRole });
    const u = allUsers.find(u => u.uid === uid);
    if (u) u.role = newRole;
    filteredUsers = [...allUsers];
    renderUsersTable();
    showToast(newRole === 'banned' ? 'Pengguna berhasil dibanned' : 'Pengguna berhasil diunban', newRole === 'banned' ? 'error' : 'success');
    logActivity(newRole === 'banned' ? 'ban' : 'admin', `${newRole === 'banned' ? 'Ban' : 'Unban'}: ${u?.displayName || uid}`);
  } catch(e) { showToast('Gagal: ' + e.message, 'error'); }
}

async function toggleAdmin(uid, currentRole) {
  if (uid === auth.currentUser?.uid) { showToast('Tidak bisa mengubah role diri sendiri', 'error'); return; }
  if (!confirm(currentRole === 'admin' ? 'Cabut hak admin pengguna ini?' : 'Jadikan pengguna ini admin?')) return;
  try {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await db.collection('users').doc(uid).update({ role: newRole });
    const u = allUsers.find(u => u.uid === uid);
    if (u) u.role = newRole;
    filteredUsers = [...allUsers];
    renderUsersTable();
    showToast(newRole === 'admin' ? 'Pengguna dijadikan admin' : 'Hak admin dicabut', 'success');
    logActivity('admin', `Role diubah ke ${newRole}: ${u?.displayName || uid}`);
  } catch(e) { showToast('Gagal: ' + e.message, 'error'); }
}

function confirmDeleteUser(uid, name) {
  if (!confirm(`Hapus akun "${name}"? Tindakan ini tidak dapat dibatalkan!`)) return;
  deleteUser(uid, name);
}

async function deleteUser(uid, name) {
  if (uid === auth.currentUser?.uid) { showToast('Tidak bisa menghapus akun sendiri', 'error'); return; }
  try {
    await db.collection('users').doc(uid).delete();
    allUsers = allUsers.filter(u => u.uid !== uid);
    filteredUsers = filteredUsers.filter(u => u.uid !== uid);
    renderUsersTable();
    showToast(`Akun "${name}" berhasil dihapus`, 'success');
    logActivity('ban', `Hapus akun: ${name}`);
  } catch(e) { showToast('Gagal menghapus: ' + e.message, 'error'); }
}

// ── ACTIVITY LOG ──────────────────────────────────────
const activityLog = [];

function logActivity(type, desc) {
  activityLog.unshift({ type, desc, time: new Date() });
  if (activityLog.length > 50) activityLog.pop();
}

function loadActivityLog() {
  const view = document.getElementById('view-activity');
  view.innerHTML = `
    <div class="admin-topbar">
      <div><div class="admin-page-title">Log Aktivitas</div><div class="admin-page-subtitle">Riwayat tindakan admin</div></div>
    </div>
    <div class="admin-table-container">
      <div class="admin-table-header"><div class="admin-table-title">Aktivitas Terbaru</div></div>
      <div style="padding:20px">
        ${activityLog.length ? `
          <div class="activity-list">
            ${activityLog.map(a => `
              <div class="activity-item">
                <div class="activity-icon ${a.type}">${activityIcon(a.type)}</div>
                <div class="activity-text">
                  <div class="activity-desc">${a.desc}</div>
                  <div class="activity-time">${a.time.toLocaleString('id-ID')}</div>
                </div>
              </div>`).join('')}
          </div>` : `<div style="text-align:center;color:var(--text-muted);padding:40px">Belum ada aktivitas dalam sesi ini.</div>`}
      </div>
    </div>`;
}

function activityIcon(type) {
  const icons = { login: '🔑', register: '✨', admin: '🛡️', ban: '🚫' };
  return icons[type] || '📋';
}

// ── SETTINGS ──────────────────────────────────────────
function loadSettings() {
  const view = document.getElementById('view-settings');
  view.innerHTML = `
    <div class="admin-topbar">
      <div><div class="admin-page-title">Pengaturan</div><div class="admin-page-subtitle">Konfigurasi AniZone</div></div>
    </div>
    <div style="max-width:520px">
      <div class="admin-table-container" style="margin-bottom:16px">
        <div class="admin-table-header"><div class="admin-table-title">MAL API</div></div>
        <div style="padding:20px">
          <div class="form-group">
            <label class="form-label">MyAnimeList Client ID</label>
            <input type="text" class="form-input" id="malClientId" placeholder="Masukkan MAL Client ID..." value="${localStorage.getItem('mal_client_id')||''}">
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px">Daftarkan app di <a href="https://myanimelist.net/apiconfig" target="_blank" style="color:var(--accent)">myanimelist.net/apiconfig</a> untuk mendapatkan Client ID.</div>
          </div>
          <button class="admin-btn admin-btn-primary" onclick="saveMalSettings()">Simpan</button>
        </div>
      </div>
      <div class="admin-table-container" style="margin-bottom:16px">
        <div class="admin-table-header"><div class="admin-table-title">Tampilan</div></div>
        <div style="padding:20px">
          <div class="form-group">
            <label class="form-label">Tema</label>
            <select class="form-select" onchange="toggleAdminTheme(this.value)">
              <option value="dark" ${document.documentElement.getAttribute('data-theme')!=='light'?'selected':''}>🌙 Dark Mode</option>
              <option value="light" ${document.documentElement.getAttribute('data-theme')==='light'?'selected':''}>☀️ Light Mode</option>
            </select>
          </div>
        </div>
      </div>
      <div class="admin-table-container">
        <div class="admin-table-header"><div class="admin-table-title">Info Sistem</div></div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:12px">
          ${infoRow('Versi App', 'AniZone 2026 v2.0.0')}
          ${infoRow('Firebase Project', 'anizone-b48ce')}
          ${infoRow('Admin UID', auth.currentUser?.uid?.substring(0,16)+'...'||'—')}
          ${infoRow('Build', new Date().toLocaleDateString('id-ID'))}
        </div>
      </div>
    </div>`;
}

function infoRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color)">
    <span style="font-size:13px;color:var(--text-muted)">${label}</span>
    <span style="font-size:13px;font-weight:600">${value}</span>
  </div>`;
}

function saveMalSettings() {
  const val = document.getElementById('malClientId')?.value?.trim();
  if (val) { localStorage.setItem('mal_client_id', val); showToast('MAL Client ID disimpan!', 'success'); }
  else { showToast('Client ID tidak boleh kosong', 'error'); }
}

function toggleAdminTheme(val) {
  if (val === 'light') { document.documentElement.setAttribute('data-theme','light'); localStorage.setItem('theme','light'); }
  else { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('theme','dark'); }
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container'; el.className = 'toast-container';
    document.body.appendChild(el); return el;
  })();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── LOGOUT ────────────────────────────────────────────
async function adminLogout() {
  if (!confirm('Keluar dari panel admin?')) return;
  try { await auth.signOut(); } catch {}
  window.location.replace('login.html');
}

// ── MODAL CLOSE ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('user-modal')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });
  if (localStorage.getItem('theme') === 'light') document.documentElement.setAttribute('data-theme','light');
});
