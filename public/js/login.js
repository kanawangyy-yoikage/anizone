/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — LOGIN MODULE
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
let activeTab    = 'login';
let confirmResult = null;
let otpTimer     = null;
let resendCountdown = 60;
let showingPass  = false;

// ── AUTH REDIRECT ──────────────────────────────────────
auth.onAuthStateChanged(user => {
  if (user) window.location.replace('/');
});

// ── TAB SWITCH ────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.form-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('btn-' + tab)?.classList.add('active');
  document.getElementById('panel-' + tab)?.classList.add('active');
  clearStatus();
}

// ── PASSWORD TOGGLE ───────────────────────────────────
function togglePass(inputId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById('eye-' + inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.innerHTML = eyeOffSvg();
  } else {
    input.type = 'password';
    if (icon) icon.innerHTML = eyeSvg();
  }
}

function eyeSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}
function eyeOffSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
}

// ── STATUS ─────────────────────────────────────────────
function setStatus(msg, type = 'error') {
  const el = document.getElementById('status-msg');
  if (el) { el.textContent = msg; el.className = 'status-msg ' + type; }
}
function clearStatus() {
  const el = document.getElementById('status-msg');
  if (el) { el.textContent = ''; el.className = 'status-msg'; }
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const spinner = btn.querySelector('.btn-spinner');
  const text    = btn.querySelector('.btn-text');
  if (spinner) spinner.style.display = loading ? 'block' : 'none';
  if (text)    text.style.display    = loading ? 'none'  : 'flex';
}

// ── SYNC USER KE FIRESTORE ────────────────────────────
async function syncUserOnLogin(user) {
  try {
    const ref = db.collection('users').doc(user.uid);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({
        displayName: user.displayName || 'Pengguna AniZone',
        email:       user.email || '',
        photoURL:    user.photoURL || '',
        role:        'user',
        createdAt:   Date.now(),
        provider:    user.providerData?.[0]?.providerId || 'password',
      });
    }
  } catch(e) {
    console.warn('syncUserOnLogin error:', e);
  }
}

// ── EMAIL LOGIN ───────────────────────────────────────
async function loginWithEmail() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { setStatus('Email dan password wajib diisi.'); return; }

  setLoading('loginEmailBtn', true); clearStatus();
  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    await syncUserOnLogin(cred.user);
  } catch (e) {
    setStatus(friendlyError(e.code));
  } finally {
    setLoading('loginEmailBtn', false);
  }
}

// ── EMAIL REGISTER ────────────────────────────────────
async function registerWithEmail() {
  const name  = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass  = document.getElementById('regPass').value;
  const conf  = document.getElementById('regConfPass').value;

  if (!name || !email || !pass)   { setStatus('Semua kolom wajib diisi.'); return; }
  if (pass.length < 6)             { setStatus('Password minimal 6 karakter.'); return; }
  if (pass !== conf)               { setStatus('Konfirmasi password tidak cocok.'); return; }

  setLoading('registerEmailBtn', true); clearStatus();
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await db.collection('users').doc(cred.user.uid).set({
      displayName: name, email, role: 'user', createdAt: Date.now()
    });
  } catch (e) {
    setStatus(friendlyError(e.code));
  } finally {
    setLoading('registerEmailBtn', false);
  }
}

// ── GOOGLE ────────────────────────────────────────────
async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const res = await auth.signInWithPopup(provider);
    const uid = res.user.uid;

    // Cek dokumen yang sudah ada — jangan overwrite role/photoURL yang sudah di-set manual
    const existingDoc = await db.collection('users').doc(uid).get();
    const existingData = existingDoc.exists ? existingDoc.data() : {};

    const updates = {
      displayName: existingData.displayName || res.user.displayName,
      email: res.user.email,
      // Pertahankan role yang sudah ada; hanya set 'user' jika belum ada role
      role: existingData.role || 'user',
      googleLinked: true,
    };

    // Hanya update photoURL jika belum ada foto custom (base64) yang tersimpan
    if (!existingData.photoURL || existingData.photoURL.startsWith('http')) {
      // Foto dari Google bisa berubah/expire, jadi hanya simpan jika belum ada foto custom
      if (!existingData.photoURL) {
        updates.photoURL = res.user.photoURL || null;
      }
      // Jika sudah ada URL Google sebelumnya, biarkan tetap (tidak perlu update)
    }

    if (!existingDoc.exists) {
      updates.createdAt = Date.now();
    }

    await db.collection('users').doc(uid).set(updates, { merge: true });
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') setStatus(friendlyError(e.code));
  }
}

// ── PHONE OTP ─────────────────────────────────────────
let recaptchaVerifier = null;
let otpStep = 1;

function initRecaptcha() {
  if (recaptchaVerifier) return;
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size: 'normal',
    callback: () => {},
    'expired-callback': () => { recaptchaVerifier.reset(); }
  });
  recaptchaVerifier.render();
}

async function sendOTP() {
  const code  = document.getElementById('countryCode').value;
  const phone = document.getElementById('phoneNumber').value.trim().replace(/\D/g, '');
  if (!phone) { setStatus('Masukkan nomor HP yang valid.'); return; }

  const fullPhone = '+' + code + phone;
  initRecaptcha();
  setLoading('sendOtpBtn', true); clearStatus();
  try {
    confirmResult = await auth.signInWithPhoneNumber(fullPhone, recaptchaVerifier);
    otpStep = 2;
    showOtpStep();
    startResendTimer();
  } catch (e) {
    setStatus(friendlyError(e.code));
    recaptchaVerifier?.reset();
  } finally {
    setLoading('sendOtpBtn', false);
  }
}

function showOtpStep() {
  document.getElementById('phone-step-1')?.classList.add('hidden');
  document.getElementById('phone-step-2')?.classList.remove('hidden');
  // Update step dots
  document.querySelectorAll('#panel-phone .step-dot').forEach((d, i) => {
    d.classList.toggle('active', i === 1);
    d.classList.toggle('done', i === 0);
  });
  document.getElementById('otp-0')?.focus();
}

async function verifyOTP() {
  const otp = Array.from({length:6}, (_,i) => document.getElementById('otp-' + i)?.value || '').join('');
  if (otp.length < 6) { setStatus('Masukkan 6 digit kode OTP.'); return; }
  if (!confirmResult) { setStatus('Sesi OTP kadaluarsa. Minta ulang.'); return; }

  setLoading('verifyOtpBtn', true); clearStatus();
  try {
    const res = await confirmResult.confirm(otp);
    const uid = res.user.uid;

    // Cek dokumen yang sudah ada — jangan overwrite role yang ada
    const existingDoc = await db.collection('users').doc(uid).get();
    const existingData = existingDoc.exists ? existingDoc.data() : {};

    const updates = {
      displayName: existingData.displayName || res.user.displayName || 'Pengguna AniZone',
      phoneNumber: res.user.phoneNumber,
      // Pertahankan role yang sudah ada
      role: existingData.role || 'user',
    };

    if (!existingDoc.exists) {
      updates.createdAt = Date.now();
    }

    await db.collection('users').doc(uid).set(updates, { merge: true });
  } catch (e) {
    setStatus(friendlyError(e.code));
  } finally {
    setLoading('verifyOtpBtn', false);
  }
}

function backToPhone() {
  document.getElementById('phone-step-1')?.classList.remove('hidden');
  document.getElementById('phone-step-2')?.classList.add('hidden');
  document.querySelectorAll('#panel-phone .step-dot').forEach((d,i) => {
    d.classList.toggle('active', i === 0);
    d.classList.remove('done');
  });
  clearOtp();
  if (otpTimer) { clearInterval(otpTimer); otpTimer = null; }
}

function clearOtp() {
  for (let i = 0; i < 6; i++) {
    const el = document.getElementById('otp-' + i);
    if (el) { el.value = ''; el.classList.remove('filled'); }
  }
}

function startResendTimer() {
  resendCountdown = 60;
  const timerEl = document.getElementById('resend-timer');
  const btnEl   = document.getElementById('resendBtn');
  if (timerEl) timerEl.textContent = resendCountdown;
  if (btnEl) btnEl.style.display = 'none';

  otpTimer = setInterval(() => {
    resendCountdown--;
    if (timerEl) timerEl.textContent = resendCountdown;
    if (resendCountdown <= 0) {
      clearInterval(otpTimer);
      if (document.getElementById('resend-timer-wrap')) document.getElementById('resend-timer-wrap').style.display = 'none';
      if (btnEl) btnEl.style.display = 'inline';
    }
  }, 1000);
}

async function resendOTP() {
  backToPhone();
  await sendOTP();
}

// ── OTP INPUT HANDLING ────────────────────────────────
function handleOtpInput(e, index) {
  const val = e.target.value;
  e.target.classList.toggle('filled', val.length > 0);
  if (val && index < 5) document.getElementById('otp-' + (index+1))?.focus();
  if (e.key === 'Backspace' && !val && index > 0) document.getElementById('otp-' + (index-1))?.focus();
}

function handleOtpPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
  if (text.length >= 6) {
    e.preventDefault();
    for (let i = 0; i < 6; i++) {
      const el = document.getElementById('otp-' + i);
      if (el) { el.value = text[i] || ''; el.classList.toggle('filled', !!text[i]); }
    }
    document.getElementById('otp-5')?.focus();
  }
}

// ── FORGOT PASSWORD ───────────────────────────────────
async function forgotPassword() {
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { setStatus('Masukkan email terlebih dahulu.'); return; }
  try {
    await auth.sendPasswordResetEmail(email);
    setStatus('Link reset password dikirim ke ' + email, 'success');
  } catch (e) {
    setStatus(friendlyError(e.code));
  }
}

// ── ENTER KEY ────────────────────────────────────────
function handleEnterLogin(e) { if (e.key === 'Enter') loginWithEmail(); }
function handleEnterRegister(e) { if (e.key === 'Enter') registerWithEmail(); }

// ── ERROR MESSAGES ────────────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'Akun tidak ditemukan.',
    'auth/wrong-password':       'Password salah.',
    'auth/email-already-in-use': 'Email sudah digunakan.',
    'auth/weak-password':        'Password terlalu lemah (min. 6 karakter).',
    'auth/invalid-email':        'Format email tidak valid.',
    'auth/too-many-requests':    'Terlalu banyak percobaan. Coba lagi nanti.',
    'auth/network-request-failed':'Tidak ada koneksi internet.',
    'auth/invalid-verification-code':'Kode OTP salah atau kadaluarsa.',
    'auth/invalid-phone-number': 'Nomor HP tidak valid.',
    'auth/popup-blocked':        'Popup diblokir browser. Izinkan popup untuk login Google.',
    'auth/operation-not-allowed':'Metode login ini tidak diaktifkan.',
    'auth/code-expired':         'Kode OTP kadaluarsa. Minta ulang.',
    'auth/missing-phone-number': 'Masukkan nomor HP.',
    'auth/captcha-check-failed': 'Verifikasi reCAPTCHA gagal. Coba refresh.',
  };
  return map[code] || 'Terjadi kesalahan. Coba lagi. (' + code + ')';
}

// ── PARTICLES ─────────────────────────────────────────
function createParticles() {
  const container = document.querySelector('.bg-particles');
  if (!container) return;
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 60 + 20;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      animation-duration:${Math.random()*15+10}s;
      animation-delay:${Math.random()*10}s;
    `;
    container.appendChild(p);
  }
}

// ── INIT ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  // Init eye icons
  ['loginPass','regPass','regConfPass'].forEach(id => {
    const btn = document.getElementById('eye-' + id);
    if (btn) btn.innerHTML = eyeSvg();
  });
});
