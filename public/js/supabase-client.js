/* ═══════════════════════════════════════════════════════
   ANIZONE 2026 — SUPABASE CLIENT
   Ganti SUPABASE_URL dan SUPABASE_ANON_KEY dengan milikmu
   ═══════════════════════════════════════════════════════ */

const SUPABASE_URL  = 'https://gveaigqkwnyqmknnhuhv.supabase.co';      // ← ganti
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZWFpZ3Frd255cW1rbm5odWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNDAyMzUsImV4cCI6MjA5NDkxNjIzNX0.imv0PKQXUiKLxM4T_PafrcH9mOLD6KgHkxYdmCz5FzE';              // ← ganti

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

// ── Helper: ambil user aktif ──────────────────────────
async function getCurrentUser() {
  const { data: { session } } = await _supabase.auth.getSession();
  return session?.user ?? null;
}

// ── Helper: ambil profil dari tabel users ─────────────
async function getUserProfile(uid) {
  try {
    const { data, error } = await _supabase
      .from('users')
      .select('*')
      .eq('id', uid)
      .single();
    if (error) return {};
    return data || {};
  } catch { return {}; }
}

// ── Helper: upsert profil ─────────────────────────────
async function upsertUserProfile(uid, updates) {
  const { error } = await _supabase
    .from('users')
    .upsert({ id: uid, ...updates, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── Helper: count subcollection (favorites/history) ───
async function getSubCount(uid, table) {
  try {
    const { count, error } = await _supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid);
    if (error) return 0;
    return count || 0;
  } catch { return 0; }
}
