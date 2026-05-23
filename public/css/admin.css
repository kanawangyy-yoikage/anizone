/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — ADMIN STYLESHEET
   ═══════════════════════════════════════════════════════ */

:root {
  --bg-main: #0d0f14;
  --bg-card: #161920;
  --bg-input: #1e2129;
  --surface-high: #1e2129;
  --border-color: #2a2d37;
  --text-main: #E2E2E9;
  --text-muted: #9aa0b4;
  --accent: #4285F4;
  --accent-light: #A8C7FA;
  --accent-glow: rgba(66,133,244,0.3);
  --danger: #f87171;
  --success: #4ade80;
  --warning: #fbbf24;
  --radius: 14px;
  --radius-sm: 8px;
  --radius-lg: 20px;
  --transition: 0.2s ease;
  --sidebar-w: 240px;
}

[data-theme="light"] {
  --bg-main: #f1f3f8;
  --bg-card: #ffffff;
  --bg-input: #f0f2f7;
  --surface-high: #e8eaf0;
  --border-color: #dde0ea;
  --text-main: #1a1d2e;
  --text-muted: #6b7280;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Outfit', system-ui, sans-serif; background: var(--bg-main); color: var(--text-main); min-height: 100vh; }
a { text-decoration: none; color: inherit; }
button { font-family: inherit; border: none; cursor: pointer; background: none; }
::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 99px; }

/* ── ADMIN LAYOUT ── */
.admin-wrapper { display: flex; min-height: 100vh; }
.admin-sidebar {
  width: var(--sidebar-w); background: var(--bg-card);
  border-right: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  position: fixed; inset-block: 0; left: 0;
  z-index: 100; overflow-y: auto;
  padding: 0;
}
.admin-sidebar-header {
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border-color);
}
.admin-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.admin-logo-icon {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 16px; color: #fff;
}
.admin-logo-text { font-size: 16px; font-weight: 800; }
.admin-logo-sub { font-size: 11px; color: var(--text-muted); font-weight: 600; }
.admin-user-chip {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface-high); border-radius: var(--radius-sm);
  padding: 10px 12px;
}
.admin-user-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-light));
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 14px; color: #fff;
  overflow: hidden; position: relative; flex-shrink: 0;
}
.admin-user-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.admin-user-info { flex: 1; min-width: 0; }
.admin-user-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.admin-user-role { font-size: 11px; color: var(--accent); font-weight: 600; }

.admin-nav { flex: 1; padding: 12px 12px; display: flex; flex-direction: column; gap: 2px; }
.admin-nav-section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); padding: 8px 8px 6px; margin-top: 6px; }
.admin-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500; color: var(--text-muted);
  cursor: pointer; transition: all var(--transition);
}
.admin-nav-item:hover { background: var(--surface-high); color: var(--text-main); }
.admin-nav-item.active { background: rgba(66,133,244,0.12); color: var(--accent); font-weight: 600; }
.admin-nav-item svg { flex-shrink: 0; }
.admin-nav-badge { margin-left: auto; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 99px; display: flex; align-items: center; justify-content: center; padding: 0 6px; }
.admin-nav-footer { padding: 12px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 2px; }
.admin-back-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; color: var(--text-muted); cursor: pointer; transition: all var(--transition); }
.admin-back-btn:hover { background: var(--surface-high); color: var(--text-main); }
.admin-logout-btn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); font-size: 14px; font-weight: 500; color: var(--danger); cursor: pointer; transition: all var(--transition); }
.admin-logout-btn:hover { background: rgba(248,113,113,0.1); }

/* ── ADMIN MAIN ── */
.admin-main { flex: 1; margin-left: var(--sidebar-w); padding: 24px; max-width: 100%; overflow-x: hidden; }
@media (max-width: 899px) { .admin-sidebar { display: none; } .admin-main { margin-left: 0; padding: 16px; } }

/* ── ADMIN TOPBAR ── */
.admin-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
.admin-page-title { font-size: 22px; font-weight: 800; }
.admin-page-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.admin-topbar-actions { display: flex; gap: 10px; align-items: center; }
.admin-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all var(--transition);
}
.admin-btn-primary { background: var(--accent); color: #fff; border: 1px solid transparent; }
.admin-btn-primary:hover { background: #5a95f5; }
.admin-btn-outline { background: transparent; color: var(--text-muted); border: 1px solid var(--border-color); }
.admin-btn-outline:hover { color: var(--text-main); background: var(--surface-high); }
.admin-btn-danger { background: rgba(248,113,113,0.1); color: var(--danger); border: 1px solid rgba(248,113,113,0.3); }
.admin-btn-danger:hover { background: rgba(248,113,113,0.2); }

/* ── STATS GRID ── */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
.stat-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 18px 20px; display: flex; align-items: center; gap: 16px; animation: fadeInUp 0.4s ease both; }
.stat-icon { width: 48px; height: 48px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.stat-icon.blue { background: rgba(66,133,244,0.12); }
.stat-icon.green { background: rgba(74,222,128,0.12); }
.stat-icon.yellow { background: rgba(251,191,36,0.12); }
.stat-icon.red { background: rgba(248,113,113,0.12); }
.stat-info { flex: 1; }
.stat-num { font-size: 24px; font-weight: 800; }
.stat-label { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.stat-change { font-size: 11px; font-weight: 700; margin-top: 2px; }
.stat-change.up { color: var(--success); }
.stat-change.down { color: var(--danger); }

/* ── TABLE ── */
.admin-table-container { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
.admin-table-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border-color); flex-wrap: wrap; gap: 10px; }
.admin-table-title { font-size: 15px; font-weight: 700; }
.admin-search-input {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-input); border: 1px solid var(--border-color);
  border-radius: var(--radius-sm); padding: 8px 14px;
  transition: border-color var(--transition);
}
.admin-search-input:focus-within { border-color: var(--accent); }
.admin-search-input input { background: none; border: none; outline: none; color: var(--text-main); font-family: inherit; font-size: 13px; width: 180px; }
.admin-table-wrapper { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
thead { background: var(--surface-high); }
thead th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); white-space: nowrap; }
tbody tr { border-top: 1px solid var(--border-color); transition: background var(--transition); }
tbody tr:hover { background: var(--surface-high); }
tbody td { padding: 14px 16px; font-size: 13px; vertical-align: middle; }
.user-cell { display: flex; align-items: center; gap: 10px; }
.user-mini-avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-light)); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: #fff; overflow: hidden; position: relative; flex-shrink: 0; }
.user-mini-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.user-cell-info { }
.user-cell-name { font-weight: 700; font-size: 13px; }
.user-cell-uid { font-size: 11px; color: var(--text-muted); font-family: monospace; }
.role-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
.role-admin { background: rgba(66,133,244,0.15); color: #7BAEF8; border: 1px solid rgba(66,133,244,0.3); }
.role-user { background: rgba(154,160,180,0.1); color: var(--text-muted); border: 1px solid var(--border-color); }
.role-banned { background: rgba(248,113,113,0.12); color: var(--danger); border: 1px solid rgba(248,113,113,0.3); }
.table-actions { display: flex; gap: 6px; }
.icon-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition); border: 1px solid transparent; }
.icon-btn:hover { background: var(--surface-high); border-color: var(--border-color); }
.icon-btn.danger:hover { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.3); color: var(--danger); }
.icon-btn.info:hover { background: rgba(66,133,244,0.1); border-color: rgba(66,133,244,0.3); color: var(--accent); }
.pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid var(--border-color); font-size: 13px; color: var(--text-muted); flex-wrap: wrap; gap: 10px; }
.page-btns { display: flex; gap: 4px; }
.page-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; cursor: pointer; transition: all var(--transition); border: 1px solid var(--border-color); color: var(--text-muted); background: none; }
.page-btn:hover, .page-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── USER DETAIL MODAL ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.25s; padding: 20px; }
.modal-overlay.show { opacity: 1; pointer-events: all; }
.modal { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-lg); width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; transform: scale(0.93); transition: transform 0.3s cubic-bezier(0.34,1.2,0.64,1); }
.modal-overlay.show .modal { transform: scale(1); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid var(--border-color); position: sticky; top: 0; background: var(--bg-card); z-index: 1; }
.modal-title { font-size: 16px; font-weight: 700; }
.modal-close { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-input); color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.modal-body { padding: 20px; }
.modal-user-header { display: flex; gap: 14px; align-items: center; margin-bottom: 20px; }
.modal-avatar { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--accent-light)); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; color: #fff; overflow: hidden; position: relative; flex-shrink: 0; }
.modal-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.modal-user-name { font-size: 18px; font-weight: 800; margin-bottom: 3px; }
.modal-user-email { font-size: 13px; color: var(--text-muted); }
.modal-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.modal-info-item { background: var(--surface-high); border-radius: var(--radius-sm); padding: 12px 14px; }
.modal-info-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 5px; }
.modal-info-value { font-size: 13px; font-weight: 600; word-break: break-all; }
.modal-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 10px; }
.modal-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.modal-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--border-color); }

/* ── CHARTS ── */
.admin-charts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; margin-bottom: 24px; }
.chart-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 18px 20px; }
.chart-title { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.chart-subtitle { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
.chart-bar-list { display: flex; flex-direction: column; gap: 10px; }
.chart-bar-item { }
.chart-bar-label { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
.chart-bar-label span:first-child { color: var(--text-muted); }
.chart-bar-label span:last-child { font-weight: 700; }
.chart-bar-track { background: var(--surface-high); border-radius: 99px; height: 7px; overflow: hidden; }
.chart-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--accent-light)); transition: width 1s cubic-bezier(0.22,1,0.36,1); }
.chart-bar-fill.green { background: linear-gradient(90deg, #10b981, #4ade80); }
.chart-bar-fill.red { background: linear-gradient(90deg, #ef4444, #f87171); }

/* ── ACTIVITY LOG ── */
.activity-list { display: flex; flex-direction: column; gap: 12px; }
.activity-item { display: flex; gap: 12px; align-items: flex-start; }
.activity-icon { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 15px; }
.activity-icon.login { background: rgba(74,222,128,0.12); }
.activity-icon.register { background: rgba(66,133,244,0.12); }
.activity-icon.admin { background: rgba(251,191,36,0.12); }
.activity-icon.ban { background: rgba(248,113,113,0.12); }
.activity-text { flex: 1; }
.activity-desc { font-size: 13px; }
.activity-time { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

/* ── FORMS ── */
.form-group { margin-bottom: 16px; }
.form-label { display: block; font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 7px; }
.form-input { width: 100%; padding: 11px 14px; background: var(--bg-input); border: 1.5px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-main); font-family: inherit; font-size: 14px; outline: none; transition: border-color var(--transition); }
.form-input:focus { border-color: var(--accent); }
.form-select { width: 100%; padding: 11px 14px; background: var(--bg-input); border: 1.5px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-main); font-family: inherit; font-size: 14px; outline: none; cursor: pointer; }

/* ── TOASTS ── */
.toast-container { position: fixed; top: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.toast { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px 18px; min-width: 260px; max-width: 360px; display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 24px rgba(0,0,0,0.3); animation: toastIn 0.3s cubic-bezier(0.34,1.2,0.64,1); pointer-events: all; }
.toast.success { border-color: rgba(74,222,128,0.3); }
.toast.error { border-color: rgba(248,113,113,0.3); }
.toast.info { border-color: rgba(66,133,244,0.3); }
.toast-icon { font-size: 18px; flex-shrink: 0; }
@keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes toastOut { to { opacity: 0; transform: translateX(40px); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
.hidden { display: none !important; }
