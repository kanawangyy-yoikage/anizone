/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — AUTH & PROFILE MODULE (Supabase)
   ═══════════════════════════════════════════════════════ */

// ── EDIT STATE ─────────────────────────────────────────
let editState = {
  avatarFile: null,
  bannerFile: null,
  bannerColor: 'linear-gradient(135deg,#1a237e,#4285F4,#A8C7FA)',
  bannerIsImage: false,
};

let _currentUser = null;

// ── AUTH GUARD ─────────────────────────────────────────
_supabase.auth.onAuthStateChange(async (event, session) => {
  if (!session?.user) { window.location.replace('login.html'); return; }
  _currentUser = session.user;
  await loadUserProfile(session.user);
});

(async () => {
  const user = await getCurrentUser();
  if (!user) { window.location.replace('login.html'); return; }
  _currentUser = user;
  await loadUserProfile(user);
})();

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
      img.src = photoURL; img.style.display = 'block'; init.style.display = 'none';
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
  const profile   = await getUserProfile(user.id);
  const meta      = user.user_metadata || {};

  const name      = profile.display_name || meta.display_name || meta.full_name || 'Pengguna AniZone';
  const email     = user.email || user.phone || '—';
  const photoURL  = profile.photo_url || meta.avatar_url || null;
  const bannerURL = profile.banner_url || null;
  const bannerColor = profile.banner_color || editState.bannerColor;
  const bio       = profile.bio || '';
  const role      = profile.role || 'user';

  setAvatarUI(photoURL, name);
  const su = document.getElementById('sidebarUsername');
  if (su) su.textContent = name;

  setEl('profileName', name);
  setEl('profileEmail', email);
  setEl('profileBioDisplay', bio);
  setEl('infoName', name);
  setEl('infoEmail', user.email || '—');
  setEl('infoPhone', user.phone || '—');
  setEl('infoRole', role === 'admin' ? '🛡️ Administrator' : '👤 User');

  setBannerUI(bannerURL, bannerColor);

  // Badges
  const badgesEl = document.getElementById('profileBadges');
  if (badgesEl) {
    const badges = [];
    const providers = user.app_metadata?.providers || [];
    badges.push(`<span class="profile-badge ${role==='admin'?'badge-role-admin':'badge-role-user'}">${role==='admin'?'🛡️ Admin':'👤 User'}</span>`);
    if (user.email)  badges.push('<span class="profile-badge badge-method">📧 Email</span>');
    if (user.phone)  badges.push('<span class="profile-badge badge-method">📱 Nomor HP</span>');
    if (providers.includes('google')) badges.push('<span class="profile-badge badge-method">🟢 Google</span>');
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
  const createdAt = profile.created_at ? new Date(profile.created_at) : null;
  if (createdAt) {
    setEl('profileStatDays', Math.floor((Date.now() - createdAt.getTime()) / 86400000));
    setEl('infoJoined', createdAt.toLocaleDateString('id-ID', {day:'2-digit',month:'long',year:'numeric'}));
  }
  const lastLogin = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  if (lastLogin) setEl('infoLastLogin', lastLogin.toLocaleDateString('id-ID', {day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}));

  // Stats
  try {
    setEl('profileStatFav',     await getSubCount(user.id, 'favorites'));
    setEl('profileStatHistory', await getSubCount(user.id, 'history'));
  } catch {
    setEl('profileStatFav', '—'); setEl('profileStatHistory', '—');
  }

  editState.bannerColor  = bannerColor;
  editState.bannerIsImage = !!bannerURL;

  // Admin panel link
  const adminLinkEl = document.getElementById('adminPanelLink');
  if (adminLinkEl) adminLinkEl.style.display = role === 'admin' ? '' : 'none';
}

// ── EDIT MODAL ─────────────────────────────────────────
function openEditModal() {
  const user = _currentUser;
  if (!user) return;
  document.getElementById('editName').value = document.getElementById('profileName')?.textContent || '';
  document.getElementById('editBio').value  = document.getElementById('profileBioDisplay')?.textContent || '';
  updateBioCount(document.getElementById('editBio'));
  setEditStatus('');
  editState.avatarFile = null; editState.bannerFile = null;

  const curImg  = document.getElementById('profileAvatarImg');
  const prevImg  = document.getElementById('editAvatarPreviewImg');
  const prevInit = document.getElementById('editAvatarPreviewInitial');
  if (prevImg && curImg?.style.display !== 'none' && curImg.src) {
    prevImg.src = curImg.src; prevImg.style.display = 'block'; if (prevInit) prevInit.style.display = 'none';
  } else {
    if (prevImg) prevImg.style.display = 'none';
    if (prevInit) { prevInit.style.display = ''; prevInit.textContent = document.getElementById('profileAvatarInitial')?.textContent; }
  }

  const profBannerImg  = document.getElementById('profileBannerImg');
  const editBannerImg  = document.getElementById('editBannerPreviewImg');
  const editPat        = document.getElementById('editBannerPattern');
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
  if (document.getElementById('editBannerPattern')) document.getElementById('editBannerPattern').style.display = 'none';
  const prev = document.getElementById('editBannerPreview');
  if (prev) prev.style.background = 'transparent';
  document.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
}

function setEditStatus(msg, type = '') {
  const el = document.getElementById('editStatus');
  if (el) { el.textContent = msg; el.className = 'edit-status' + (type ? ' ' + type : ''); }
}

async function saveProfile() {
  const user = _currentUser;
  if (!user) return;
  const newName = document.getElementById('editName').value.trim();
  const newBio  = document.getElementById('editBio').value.trim();
  if (!newName) { setEditStatus('Nama tidak boleh kosong', 'error'); return; }

  const btn     = document.getElementById('editSaveBtn');
  const btnText = document.getElementById('editSaveBtnText');
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Menyimpan...';
  setEditStatus('');

  try {
    const updates = { display_name: newName, bio: newBio };

    if (editState.avatarFile) {
      setEditStatus('Memproses foto profil...');
      updates.photo_url = await compressToBase64(editState.avatarFile, 300, 0.7);
    }
    if (editState.bannerFile) {
      setEditStatus('Memproses banner...');
      updates.banner_url = await compressToBase64(editState.bannerFile, 800, 0.7);
    } else {
      updates.banner_url = null;
    }
    updates.banner_color = editState.bannerColor;

    await upsertUserProfile(user.id, updates);

    // Update auth metadata
    await _supabase.auth.updateUser({ data: { display_name: newName } });

    setEditStatus('✅ Profil berhasil disimpan!', 'success');
    await loadUserProfile(user);
    setTimeout(() => closeEditModal(), 1200);
  } catch (e) {
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
  try { await _supabase.auth.signOut(); } catch {}
  window.location.replace('login.html');
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
