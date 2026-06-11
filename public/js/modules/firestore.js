// ─── FIRESTORE: HISTORY & FAVORITES ─────────────────────
// Semua operasi Firestore untuk data user dikumpulkan di sini.
// `auth` dan `db` didefinisikan di auth.js yang di-load lebih awal.

function getUID() {
  return (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser.uid : null;
}

// Encode URL menjadi Firestore document key yang aman
function urlToKey(url) {
  return encodeURIComponent(url).replace(/\./g, '%2E');
}

// ── Riwayat tonton ────────────────────────────────────────
async function saveHistory(animeObj) {
  const uid = getUID(); if (!uid) return;
  try {
    const key = urlToKey(animeObj.url);
    await db.collection('users').doc(uid).collection('history').doc(key)
      .set({ ...animeObj, timestamp: Date.now() });
  } catch {}
}

async function getHistory() {
  const uid = getUID(); if (!uid) return [];
  try {
    const snap = await db.collection('users').doc(uid).collection('history')
      .orderBy('timestamp', 'desc').limit(100).get();
    return snap.docs.map(d => d.data());
  } catch { return []; }
}

// ── Favorit ───────────────────────────────────────────────
async function toggleFavorite(url, title, image, score) {
  const uid = getUID(); if (!uid) return;
  try {
    const key    = urlToKey(url);
    const ref    = db.collection('users').doc(uid).collection('favorites').doc(key);
    const isFav  = await checkFavorite(url);
    const favBtn = document.getElementById('favBtn');

    if (isFav) {
      await ref.delete();
      favBtn?.classList.remove('active');
    } else {
      await ref.set({ url, title, image, score, timestamp: Date.now() });
      favBtn?.classList.add('active');
    }
  } catch {}
}

async function checkFavorite(url) {
  const uid = getUID(); if (!uid) return false;
  try {
    const key = urlToKey(url);
    const doc = await db.collection('users').doc(uid).collection('favorites').doc(key).get();
    return doc.exists;
  } catch { return false; }
}

async function getFavorites() {
  const uid = getUID(); if (!uid) return [];
  try {
    const snap = await db.collection('users').doc(uid).collection('favorites')
      .orderBy('timestamp', 'desc').get();
    return snap.docs.map(d => d.data());
  } catch { return []; }
}
