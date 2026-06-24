/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — MAINTENANCE MODULE
   ═══════════════════════════════════════════════════════ */

const MAINTENANCE_BYPASS_KEY = 'anizone_maintenance_bypass';

async function checkMaintenance() {
  try {
    const doc = await db.collection('config').doc('maintenance').get();
    if (!doc.exists) return;

    const data = doc.data();
    if (!data.active) return;

    // Cek apakah user sudah bypass sebelumnya di sesi ini
    if (sessionStorage.getItem(MAINTENANCE_BYPASS_KEY) === 'true') return;

    showMaintenanceOverlay(data.message || null);
  } catch (e) {
    console.warn('[Maintenance] Gagal cek status:', e.message);
  }
}

function showMaintenanceOverlay(customMessage) {
  // Hapus overlay lama jika ada
  document.getElementById('maintenance-overlay')?.remove();

  const msg = customMessage || 'Situs sedang dalam perbaikan. Mohon tunggu sebentar.';

  const overlay = document.createElement('div');
  overlay.id = 'maintenance-overlay';
  overlay.innerHTML = `
    <div class="mnt-backdrop"></div>
    <div class="mnt-box">
      <div class="mnt-neon-ring"></div>

      <div class="mnt-icon-wrap">
        <svg class="mnt-danger-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>

      <div class="mnt-title">MAINTENANCE</div>
      <div class="mnt-subtitle">Sedang dalam pemeliharaan</div>
      <div class="mnt-message">${msg}</div>

      <div class="mnt-divider"></div>

      <div class="mnt-info">
        <span class="mnt-info-dot"></span>
        Tim kami sedang bekerja keras untuk memperbaiki situs ini.
      </div>

      <button class="mnt-bypass-btn" onclick="confirmMaintenanceBypass()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Tetap Lanjut
      </button>
    </div>

    <!-- Dialog konfirmasi -->
    <div id="mnt-confirm-dialog" class="mnt-confirm-dialog" style="display:none">
      <div class="mnt-confirm-box">
        <div class="mnt-confirm-icon">!</div>
        <div class="mnt-confirm-title">Yakin ingin melanjutkan?</div>
        <div class="mnt-confirm-text">
          Situs sedang dalam mode maintenance. Dengan melanjutkan, kamu mungkin akan mengalami:
          <ul>
            <li>Beberapa fitur tidak bekerja normal</li>
            <li>Error atau tampilan yang tidak sempurna</li>
            <li>Kehilangan data yang belum tersimpan</li>
          </ul>
        </div>
        <div class="mnt-confirm-actions">
          <button class="mnt-btn-cancel" onclick="closeMaintenanceConfirm()">Kembali</button>
          <button class="mnt-btn-proceed" onclick="proceedMaintenanceBypass()">Ya, Tetap Lanjut</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Inject styles
  injectMaintenanceStyles();

  // Animasi masuk
  requestAnimationFrame(() => overlay.classList.add('mnt-visible'));
}

function confirmMaintenanceBypass() {
  const dialog = document.getElementById('mnt-confirm-dialog');
  if (dialog) {
    dialog.style.display = 'flex';
    requestAnimationFrame(() => dialog.classList.add('mnt-dialog-visible'));
  }
}

function closeMaintenanceConfirm() {
  const dialog = document.getElementById('mnt-confirm-dialog');
  if (dialog) {
    dialog.classList.remove('mnt-dialog-visible');
    setTimeout(() => { dialog.style.display = 'none'; }, 300);
  }
}

function proceedMaintenanceBypass() {
  sessionStorage.setItem(MAINTENANCE_BYPASS_KEY, 'true');
  const overlay = document.getElementById('maintenance-overlay');
  if (overlay) {
    overlay.classList.add('mnt-fade-out');
    setTimeout(() => overlay.remove(), 500);
  }
}

function injectMaintenanceStyles() {
  if (document.getElementById('maintenance-styles')) return;
  const style = document.createElement('style');
  style.id = 'maintenance-styles';
  style.textContent = `
    /* ── MAINTENANCE OVERLAY ── */
    #maintenance-overlay {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.4s ease;
    }
    #maintenance-overlay.mnt-visible { opacity: 1; }
    #maintenance-overlay.mnt-fade-out { opacity: 0; pointer-events: none; }

    .mnt-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.92);
      backdrop-filter: blur(8px);
    }

    /* ── BOX UTAMA ── */
    .mnt-box {
      position: relative; z-index: 2;
      background: linear-gradient(145deg, #1a0000 0%, #0d0000 60%, #1a0505 100%);
      border: 1px solid rgba(255,30,30,0.4);
      border-radius: 20px;
      padding: 48px 40px 36px;
      max-width: 460px; width: 90%;
      text-align: center;
      box-shadow:
        0 0 0 1px rgba(255,30,30,0.15),
        0 0 40px rgba(255,0,0,0.2),
        0 0 80px rgba(255,0,0,0.08),
        inset 0 1px 0 rgba(255,80,80,0.1);
      animation: mntPulse 3s ease-in-out infinite;
    }

    @keyframes mntPulse {
      0%, 100% { box-shadow: 0 0 0 1px rgba(255,30,30,0.15), 0 0 40px rgba(255,0,0,0.2), 0 0 80px rgba(255,0,0,0.08), inset 0 1px 0 rgba(255,80,80,0.1); }
      50%       { box-shadow: 0 0 0 1px rgba(255,30,30,0.3),  0 0 60px rgba(255,0,0,0.35), 0 0 120px rgba(255,0,0,0.15), inset 0 1px 0 rgba(255,80,80,0.15); }
    }

    /* ── NEON RING ── */
    .mnt-neon-ring {
      position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
      width: 180px; height: 2px;
      background: linear-gradient(90deg, transparent, #ff2020, #ff6060, #ff2020, transparent);
      border-radius: 2px;
      filter: blur(1px);
    }

    /* ── ICON DANGER ── */
    .mnt-icon-wrap {
      margin-bottom: 20px;
      display: flex; justify-content: center;
    }
    .mnt-danger-icon {
      width: 68px; height: 68px;
      color: #ff3030;
      filter: drop-shadow(0 0 8px rgba(255,40,40,0.6)) drop-shadow(0 0 20px rgba(255,40,40,0.3));
      animation: mntIconPulse 2s ease-in-out infinite;
    }
    @keyframes mntIconPulse {
      0%, 100% { filter: drop-shadow(0 0 8px rgba(255,40,40,0.6)) drop-shadow(0 0 20px rgba(255,40,40,0.3)); transform: scale(1); }
      50%       { filter: drop-shadow(0 0 14px rgba(255,40,40,0.9)) drop-shadow(0 0 35px rgba(255,40,40,0.5)); transform: scale(1.05); }
    }

    /* ── TEXT ── */
    .mnt-title {
      font-size: 28px; font-weight: 800; letter-spacing: 6px;
      color: #ff3333;
      text-shadow: 0 0 10px rgba(255,50,50,0.7), 0 0 30px rgba(255,50,50,0.4);
      margin-bottom: 6px;
    }
    .mnt-subtitle {
      font-size: 13px; letter-spacing: 2px;
      color: rgba(255,100,100,0.7);
      text-transform: uppercase; margin-bottom: 18px;
    }
    .mnt-message {
      font-size: 14px; line-height: 1.7;
      color: rgba(255,200,200,0.85);
      background: rgba(255,30,30,0.06);
      border: 1px solid rgba(255,30,30,0.15);
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }

    /* ── DIVIDER ── */
    .mnt-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,30,30,0.25), transparent);
      margin-bottom: 16px;
    }

    /* ── INFO ROW ── */
    .mnt-info {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      font-size: 12px; color: rgba(255,150,150,0.6);
      margin-bottom: 28px;
    }
    .mnt-info-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #ff4040;
      box-shadow: 0 0 6px #ff4040;
      flex-shrink: 0;
      animation: mntDotBlink 1.5s ease-in-out infinite;
    }
    @keyframes mntDotBlink {
      0%, 100% { opacity: 1; } 50% { opacity: 0.2; }
    }

    /* ── BYPASS BUTTON ── */
    .mnt-bypass-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: transparent;
      border: 1px solid rgba(255,60,60,0.4);
      color: rgba(255,150,150,0.7);
      font-size: 12px; padding: 10px 20px;
      border-radius: 8px; cursor: pointer;
      transition: all 0.2s ease;
      letter-spacing: 0.5px;
    }
    .mnt-bypass-btn:hover {
      border-color: rgba(255,60,60,0.8);
      color: rgba(255,180,180,0.95);
      background: rgba(255,30,30,0.08);
      box-shadow: 0 0 12px rgba(255,30,30,0.15);
    }

    /* ── CONFIRM DIALOG ── */
    .mnt-confirm-dialog {
      position: absolute; inset: 0; z-index: 10;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.6);
      border-radius: 20px;
      opacity: 0; transition: opacity 0.3s ease;
    }
    .mnt-confirm-dialog.mnt-dialog-visible { opacity: 1; }

    .mnt-confirm-box {
      background: #0f0f0f;
      border: 1px solid rgba(255,60,60,0.3);
      border-radius: 14px;
      padding: 28px 24px;
      max-width: 340px; width: 90%;
      text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    }
    .mnt-confirm-icon { font-size: 36px; margin-bottom: 12px; }
    .mnt-confirm-title {
      font-size: 16px; font-weight: 700;
      color: #fff; margin-bottom: 12px;
    }
    .mnt-confirm-text {
      font-size: 13px; color: rgba(255,255,255,0.6);
      line-height: 1.6; text-align: left; margin-bottom: 20px;
    }
    .mnt-confirm-text ul {
      margin: 8px 0 0 16px; padding: 0;
    }
    .mnt-confirm-text li { margin-bottom: 4px; }
    .mnt-confirm-actions {
      display: flex; gap: 10px; justify-content: center;
    }
    .mnt-btn-cancel {
      flex: 1; padding: 10px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.7);
      border-radius: 8px; cursor: pointer; font-size: 13px;
      transition: all 0.2s ease;
    }
    .mnt-btn-cancel:hover { background: rgba(255,255,255,0.1); }
    .mnt-btn-proceed {
      flex: 1; padding: 10px;
      background: rgba(255,30,30,0.15);
      border: 1px solid rgba(255,30,30,0.4);
      color: #ff6060;
      border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;
      transition: all 0.2s ease;
    }
    .mnt-btn-proceed:hover {
      background: rgba(255,30,30,0.28);
      color: #ff9090;
      box-shadow: 0 0 10px rgba(255,30,30,0.2);
    }
  `;
  document.head.appendChild(style);
}

// ── AUTO INIT: jalankan setelah auth state diketahui ──
firebase.auth().onAuthStateChanged(async (user) => {
  try {
    // Skip kalau admin
    if (user) {
      const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
      if (userDoc.exists && userDoc.data().role === 'admin') return;
    }

    const doc = await firebase.firestore().collection('config').doc('maintenance').get();
    if (!doc.exists) return;

    const data = doc.data();
    if (!data.active) return;

    if (sessionStorage.getItem(MAINTENANCE_BYPASS_KEY) === 'true') return;

    showMaintenanceOverlay(data.message || null);
  } catch (e) {
    console.warn('[Maintenance] Gagal cek status:', e.message);
  }
});
console.log('[Maintenance] module loaded');
