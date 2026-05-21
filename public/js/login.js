/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — LOGIN MODULE (Supabase)
   ═══════════════════════════════════════════════════════ */

// ── STATE ──────────────────────────────────────────────
let activeTab       = 'login';
let otpTimer        = null;
let resendCountdown = 60;
let phoneForOtp     = '';

// ── AUTH REDIRECT ──────────────────────────────────────
(async () => {
  const user = await getCurrentUser();
  if (user) window.location.replace('index.html');
})();

_supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) window.location.replace('index.html');
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

// ── EMAIL LOGIN ───────────────────────────────────────
async function loginWithEmail() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  if (!email || !pass) { setStatus('Email dan password wajib diisi.'); return; }

  setLoading('loginEmailBtn', true); clearStatus();
  try {
    const { error } = await _supabase.auth.signInWithPassword({ email, password: pass });
    if (error) setStatus(friendlyError(error));
  } catch (e) {
    setStatus('Terjadi kesalahan. Coba lagi.');
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

  if (!name || !email || !pass)  { setStatus('Semua kolom wajib diisi.'); return; }
  if (pass.length < 6)            { setStatus('Password minimal 6 karakter.'); return; }
  if (pass !== conf)              { setStatus('Konfirmasi password tidak cocok.'); return; }

  setLoading('registerEmailBtn', true); clearStatus();
  try {
    const { data, error } = await _supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { display_name: name } }
    });
    if (error) { setStatus(friendlyError(error)); return; }

    if (data.user) {
      await upsertUserProfile(data.user.id, {
        display_name: name,
        email,
        role: 'user',
        created_at: new Date().toISOString()
      });
    }
    setStatus('Registrasi berhasil! Cek email untuk verifikasi.', 'success');
  } catch (e) {
    setStatus('Terjadi kesalahan. Coba lagi.');
  } finally {
    setLoading('registerEmailBtn', false);
  }
}

// ── GOOGLE ────────────────────────────────────────────
async function loginWithGoogle() {
  try {
    const { error } = await _supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/index.html' }
    });
    if (error) setStatus(friendlyError(error));
  } catch (e) {
    setStatus('Gagal login dengan Google.');
  }
}

// ── PHONE OTP ─────────────────────────────────────────
let otpStep = 1;

async function sendOTP() {
  const code  = document.getElementById('countryCode').value;
  const phone = document.getElementById('phoneNumber').value.trim().replace(/\D/g, '');
  if (!phone) { setStatus('Masukkan nomor HP yang valid.'); return; }

  phoneForOtp = '+' + code + phone;
  setLoading('sendOtpBtn', true); clearStatus();
  try {
    const { error } = await _supabase.auth.signInWithOtp({ phone: phoneForOtp });
    if (error) { setStatus(friendlyError(error)); return; }
    otpStep = 2;
    showOtpStep();
    startResendTimer();
  } catch (e) {
    setStatus('Gagal mengirim OTP. Coba lagi.');
  } finally {
    setLoading('sendOtpBtn', false);
  }
}

function showOtpStep() {
  document.getElementById('phone-step-1')?.classList.add('hidden');
  document.getElementById('phone-step-2')?.classList.remove('hidden');
  document.querySelectorAll('#panel-phone .step-dot').forEach((d, i) => {
    d.classList.toggle('active', i === 1);
    d.classList.toggle('done', i === 0);
  });
  document.getElementById('otp-0')?.focus();
}

async function verifyOTP() {
  const otp = Array.from({length:6}, (_,i) => document.getElementById('otp-' + i)?.value || '').join('');
  if (otp.length < 6) { setStatus('Masukkan 6 digit kode OTP.'); return; }
  if (!phoneForOtp)   { setStatus('Sesi OTP kadaluarsa. Minta ulang.'); return; }

  setLoading('verifyOtpBtn', true); clearStatus();
  try {
    const { data, error } = await _supabase.auth.verifyOtp({
      phone: phoneForOtp,
      token: otp,
      type: 'sms'
    });
    if (error) { setStatus(friendlyError(error)); return; }

    if (data.user) {
      await upsertUserProfile(data.user.id, {
        phone: phoneForOtp,
        display_name: data.user.user_metadata?.display_name || 'Pengguna AniZone',
        role: 'user',
        created_at: new Date().toISOString()
      });
    }
  } catch (e) {
    setStatus('Terjadi kesalahan. Coba lagi.');
  } finally {
    setLoading('verifyOtpBtn', false);
  }
}

function backToPhone() {
  document.getElementById('phone-step-1')?.classList.remove('hidden');
  document.getElementById('phone-step-2')?.classList.add('hidden');
  document.querySelectorAll('#panel-phone .step-dot').forEach((d, i) => {
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
      const wrap = document.getElementById('resend-timer-wrap');
      if (wrap) wrap.style.display = 'none';
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
  if (val && index < 5) document.getElementById('otp-' + (index + 1))?.focus();
  if (e.key === 'Backspace' && !val && index > 0) document.getElementById('otp-' + (index - 1))?.focus();
}

function handleOtpPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
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
    const { error } = await _supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/index.html'
    });
    if (error) { setStatus(friendlyError(error)); return; }
    setStatus('Link reset password dikirim ke ' + email, 'success');
  } catch (e) {
    setStatus('Gagal mengirim email reset.');
  }
}

// ── ENTER KEY ─────────────────────────────────────────
function handleEnterLogin(e)    { if (e.key === 'Enter') loginWithEmail(); }
function handleEnterRegister(e) { if (e.key === 'Enter') registerWithEmail(); }

// ── ERROR MESSAGES ────────────────────────────────────
function friendlyError(error) {
  const msg = error?.message || '';
  if (msg.includes('Invalid login credentials'))   return 'Email atau password salah.';
  if (msg.includes('Email not confirmed'))          return 'Email belum diverifikasi. Cek inbox kamu.';
  if (msg.includes('User already registered'))      return 'Email sudah digunakan.';
  if (msg.includes('Password should be'))           return 'Password minimal 6 karakter.';
  if (msg.includes('rate limit'))                   return 'Terlalu banyak percobaan. Coba lagi nanti.';
  if (msg.includes('Network'))                      return 'Tidak ada koneksi internet.';
  if (msg.includes('Token has expired'))            return 'Kode OTP kadaluarsa. Minta ulang.';
  if (msg.includes('Invalid OTP') || msg.includes('otp')) return 'Kode OTP salah atau kadaluarsa.';
  if (msg.includes('phone'))                        return 'Nomor HP tidak valid.';
  return msg || 'Terjadi kesalahan. Coba lagi.';
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
  ['loginPass','regPass','regConfPass'].forEach(id => {
    const btn = document.getElementById('eye-' + id);
    if (btn) btn.innerHTML = eyeSvg();
  });
});
