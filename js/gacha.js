/* =============================================================================
   QUAY THƯỞNG BANG CHIẾN · random member raffle (no backend, localStorage only)
   - Quản lý danh sách thành viên
   - Quay ngẫu nhiên N người trúng thẻ tháng
   - Lưu lịch sử các lần quay
   ========================================================================== */
(function () {
  'use strict';

  const KEY = 'guild_raffle_v1';
  const hasGSAP = typeof window.gsap !== 'undefined';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── State ─────────────────────────────────────────────────────────────
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.members)) {
        return {
          members: s.members,
          prizes: Number.isInteger(s.prizes) && s.prizes >= 1 ? s.prizes : 3,
          history: Array.isArray(s.history) ? s.history : [],
          draws: typeof s.draws === 'number' ? s.draws : (s.history ? s.history.length : 0),
        };
      }
    } catch (e) {}
    return { members: [], prizes: 3, history: [], draws: 0 };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  let state = load();

  // ── DOM ───────────────────────────────────────────────────────────────
  const el = {
    slot: document.getElementById('raffle-slot'),
    reel: document.getElementById('reel'),
    strip: document.getElementById('reel-strip'),
    slotSub: document.getElementById('slot-sub'),
    statMembers: document.getElementById('stat-members'),
    statPrizes: document.getElementById('stat-prizes'),
    statDraws: document.getElementById('stat-draws'),
    prizes: document.getElementById('raffle-prizes'),
    prizesCustom: document.getElementById('raffle-prizes-custom'),
    spin: document.getElementById('spin'),
    clearWinners: document.getElementById('clear-winners'),
    input: document.getElementById('member-input'),
    saveMembers: document.getElementById('save-members'),
    memberCount: document.getElementById('member-count'),
    chips: document.getElementById('member-chips'),
    history: document.getElementById('raffle-history'),
    resetHistory: document.getElementById('reset-history'),
    reveal: document.getElementById('reveal'),
    revealInner: document.getElementById('reveal-inner'),
    revealClose: document.getElementById('reveal-close'),
  };

  const isEN = () => document.body.dataset.lang === 'en';
  const t = (vi, en) => (isEN() ? en : vi);

  function parseMembers(text) {
    const seen = new Set();
    return text.split('\n')
      .map((s) => s.trim())
      .filter((s) => {
        if (!s) return false;
        const k = s.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // ── Animation helpers ─────────────────────────────────────────────────
  // Show a single static name in the reel (idle / fallback / reset).
  function setName(text) {
    if (hasGSAP) gsap.set(el.strip, { y: 0 });
    else el.strip.style.transform = 'none';
    el.strip.innerHTML = '<div class="raffle-reel__item">' + escapeHTML(text) + '</div>';
  }

  // Animate a number from its current value up to `to`.
  function countTo(node, to) {
    if (!hasGSAP || reduceMotion) { node.textContent = to; return; }
    const obj = { v: parseInt(node.textContent, 10) || 0 };
    gsap.to(obj, { v: to, duration: 0.6, ease: 'power2.out',
      onUpdate: () => { node.textContent = Math.round(obj.v); } });
  }

  // Particle burst inside the reveal modal.
  function burstConfetti() {
    if (!hasGSAP || reduceMotion) return;
    const colors = ['#f4b740', '#1e9be0', '#ffffff', '#ff5d8f', '#7CFC98'];
    const box = document.createElement('div');
    box.className = 'confetti';
    el.reveal.appendChild(box);
    for (let i = 0; i < 48; i++) {
      const d = document.createElement('i');
      d.style.background = colors[i % colors.length];
      box.appendChild(d);
      const angle = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 280;
      gsap.set(d, { x: 0, y: 0, opacity: 1 });
      gsap.to(d, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist + 140, // gravity bias
        rotation: Math.random() * 720 - 360,
        opacity: 0,
        duration: 1.1 + Math.random() * 0.7,
        ease: 'power2.out',
      });
    }
    gsap.delayedCall(2.2, () => box.remove());
  }

  // ── Render ────────────────────────────────────────────────────────────
  function renderStats() {
    countTo(el.statMembers, state.members.length);
    el.statPrizes.textContent = state.prizes;
    countTo(el.statDraws, state.draws);
  }

  function renderMembers() {
    el.input.value = state.members.join('\n');
    el.memberCount.textContent = t(
      state.members.length + ' thành viên',
      state.members.length + ' members'
    );
    if (!state.members.length) {
      el.chips.innerHTML = '';
      return;
    }
    el.chips.innerHTML = state.members.map((m) =>
      `<span class="mchip">${escapeHTML(m)}</span>`
    ).join('');
  }

  function renderPrizes() {
    let isPreset = false;
    el.prizes.querySelectorAll('.pchip').forEach((b) => {
      const on = Number(b.dataset.prize) === state.prizes;
      b.classList.toggle('active', on);
      if (on) isPreset = true;
    });
    // Custom input is "active" only when the current value isn't one of the presets.
    el.prizesCustom.classList.toggle('active', !isPreset);
    el.prizesCustom.value = isPreset ? '' : state.prizes;
    el.prizesCustom.max = Math.max(1, state.members.length) || '';
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function renderHistory() {
    if (!state.history.length) {
      el.history.innerHTML = '<p class="gacha-empty"><span data-vi>Chưa có lần quay nào.</span><span data-en>No draws yet.</span></p>';
      return;
    }
    el.history.innerHTML = state.history.map((h) => `
      <div class="hrow">
        <span class="hrow__date">${fmtDate(h.ts)}</span>
        <span class="hrow__winners">${h.winners.map((w) => `<b>${escapeHTML(w)}</b>`).join(', ')}</span>
      </div>`).join('');
  }

  // ── Draw logic ────────────────────────────────────────────────────────
  function pickWinners(n) {
    const pool = state.members.slice();
    const winners = [];
    n = Math.min(n, pool.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(idx, 1)[0]);
    }
    return winners;
  }

  function showReveal(winners) {
    el.revealInner.innerHTML = winners.map((w, i) => `
      <div class="wcard">
        <span class="wcard__rank">#${i + 1}</span>
        <span class="wcard__medal">✦</span>
        <span class="wcard__name">${escapeHTML(w)}</span>
        <span class="wcard__tag">${t('Thẻ tháng', 'Monthly card')}</span>
      </div>`).join('');
    el.reveal.classList.add('open');
    el.reveal.setAttribute('aria-hidden', 'false');
    burstConfetti();
    const cards = el.revealInner.querySelectorAll('.wcard');
    if (hasGSAP) {
      gsap.fromTo(cards,
        { scale: 0.3, rotateY: 90, opacity: 0 },
        { scale: 1, rotateY: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)', stagger: 0.12,
          onComplete: () => el.reveal.classList.add('show-close') });
    } else {
      cards.forEach((c) => { c.style.transform = 'none'; c.style.opacity = '1'; });
      el.reveal.classList.add('show-close');
    }
  }

  function closeReveal() {
    el.reveal.classList.remove('open', 'show-close');
    el.reveal.setAttribute('aria-hidden', 'true');
  }

  let busy = false;
  function spin() {
    if (busy) return;
    if (state.members.length < 1) {
      setName(t('Chưa có thành viên!', 'No members!'));
      el.slotSub.innerHTML = t(
        '<span>Thêm tên ở ô bên dưới đã nhé.</span>',
        '<span>Add some names below first.</span>'
      );
      return;
    }
    busy = true;
    el.spin.disabled = true;
    el.slotSub.innerHTML = '<span>' + t('Đang quay…', 'Spinning…') + '</span>';

    const winners = pickWinners(state.prizes);

    // No GSAP / reduced motion → land instantly.
    if (!hasGSAP || reduceMotion) {
      setName(winners[0]);
      finish(winners);
      return;
    }

    // Build a long reel strip of random names ending on the real winner.
    const names = state.members;
    const reelLen = Math.max(24, names.length * 3);
    const items = [];
    for (let i = 0; i < reelLen; i++) items.push(names[Math.floor(Math.random() * names.length)]);
    items.push(winners[0]); // landing row
    el.strip.innerHTML = items.map((n) => '<div class="raffle-reel__item">' + escapeHTML(n) + '</div>').join('');

    const rowH = el.strip.children[0].offsetHeight;
    const dist = (items.length - 1) * rowH;
    gsap.set(el.strip, { y: 0 });

    // Charge glow on the slot while the reel spins.
    gsap.fromTo(el.slot,
      { boxShadow: '0 30px 80px -30px rgba(30,155,224,0.5)' },
      { boxShadow: '0 30px 120px -16px rgba(30,155,224,0.95)', duration: 0.5, repeat: 4, yoyo: true,
        onComplete: () => gsap.set(el.slot, { clearProps: 'boxShadow' }) });

    // Motion blur that sharpens before the reel settles.
    gsap.fromTo(el.strip, { filter: 'blur(5px)' }, { filter: 'blur(0px)', duration: 2.0, ease: 'power2.out' });

    // The reel itself: long fast travel, decelerating into the winner.
    gsap.to(el.strip, {
      y: -dist, duration: 2.9, ease: 'power4.out',
      onComplete: () => {
        // tiny elastic settle (bounce) on the landing row
        gsap.fromTo(el.strip, { y: -dist + 10 }, { y: -dist, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
        finish(winners);
      },
    });
  }

  function finish(winners) {
    el.slotSub.innerHTML = '<span>' + (winners.length > 1
      ? t('+ ' + (winners.length - 1) + ' người khác', '+ ' + (winners.length - 1) + ' more')
      : t('Chúc mừng!', 'Congrats!')) + '</span>';

    state.draws++;
    state.history.unshift({ ts: Date.now(), winners: winners });
    if (state.history.length > 30) state.history.length = 30;
    save();
    renderStats();
    renderHistory();

    setTimeout(() => {
      showReveal(winners);
      busy = false;
      el.spin.disabled = false;
    }, 550);
  }

  // ── Bind ──────────────────────────────────────────────────────────────
  el.saveMembers.addEventListener('click', () => {
    state.members = parseMembers(el.input.value);
    // Keep the winner count within the (new) member count.
    if (state.members.length) state.prizes = Math.min(state.prizes, state.members.length);
    save();
    renderMembers();
    renderPrizes();
    renderStats();
    el.memberCount.classList.add('saved');
    setTimeout(() => el.memberCount.classList.remove('saved'), 1200);
  });

  el.prizes.addEventListener('click', (e) => {
    const btn = e.target.closest('.pchip');
    if (!btn) return;
    state.prizes = Number(btn.dataset.prize);
    save();
    renderPrizes();
    renderStats();
  });

  function applyCustomPrizes() {
    const raw = parseInt(el.prizesCustom.value, 10);
    if (!Number.isFinite(raw)) { renderPrizes(); return; } // empty/invalid → keep current
    const max = Math.max(1, state.members.length);
    state.prizes = Math.min(Math.max(raw, 1), max);
    save();
    renderPrizes();
    renderStats();
  }
  el.prizesCustom.addEventListener('change', applyCustomPrizes);
  el.prizesCustom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyCustomPrizes(); el.prizesCustom.blur(); }
  });

  el.spin.addEventListener('click', spin);

  el.clearWinners.addEventListener('click', () => {
    setName('—');
    el.slotSub.innerHTML = '<span data-vi>Nhấn “Quay” để bắt đầu</span><span data-en>Press “Spin” to start</span>';
  });

  el.revealClose.addEventListener('click', closeReveal);
  el.reveal.addEventListener('click', (e) => { if (e.target === el.reveal) closeReveal(); });

  el.resetHistory.addEventListener('click', () => {
    const msg = t('Xoá toàn bộ lịch sử quay?', 'Clear all draw history?');
    if (confirm(msg)) {
      state.history = [];
      state.draws = 0;
      save();
      renderStats();
      renderHistory();
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────
  renderStats();
  renderMembers();
  renderPrizes();
  renderHistory();
})();
