// ─── DEVELOPER TAB MODULE ────────────────────────────────
// Semua logika halaman Developer (tab, follow, WA followers).

function switchDevTab(el, index) {
  document.querySelectorAll('.social-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('[id^="dev-tab-"]').forEach(t => { t.style.display = 'none'; });

  const target = document.getElementById('dev-tab-' + index);
  if (target) {
    target.style.display = 'block';
    // Re-trigger animasi kartu
    target.querySelectorAll('.doc-card').forEach((c, i) => {
      c.style.animation = 'none';
      c.offsetHeight; // force reflow
      c.style.animation = '';
      c.style.animationDelay = (i * 0.08) + 's';
    });
  }
}

async function fetchWAFollowers() {
  const el = document.getElementById('wa-follower-count');
  if (!el) return;
  try {
    const res  = await fetch('https://cors.caliph.my.id/https://whatsapp.com/channel/0029VbB3bZLAO7RPl6shiI2C');
    const html = await res.text();
    const m    = html.match(/([\d.,]+(?:K|M)?)\s+followers/i)
               || html.match(/([\d.,]+(?:K|M)?)\s+pengikut/i);
    el.textContent = m?.[1] || '22.2K';
  } catch {
    el.textContent = '22.2K';
  }
}

function toggleDevFollow(btn) {
  const isFollowing = btn.dataset.following === 'true';
  const checkIcon   = document.getElementById('devFollowCheck');
  const textEl      = document.getElementById('devFollowText');

  if (isFollowing) {
    btn.dataset.following = 'false';
    btn.className = btn.className.replace('following', '').trim();
    if (checkIcon) checkIcon.style.display = 'none';
    if (textEl)    textEl.textContent = 'Follow';
  } else {
    btn.dataset.following = 'true';
    btn.classList.add('following');
    if (checkIcon) checkIcon.style.display = 'inline-block';
    if (textEl)    textEl.textContent = 'Following';
    window.open('https://github.com/kanawangyy-yoikage', '_blank');
  }
}
