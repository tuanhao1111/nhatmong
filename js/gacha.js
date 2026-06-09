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

  // ── State ─────────────────────────────────────────────────────────────
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.members)) {
        return {
          members: s.members,
          prizes: [2, 3, 4].includes(s.prizes) ? s.prizes : 3,
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
    slotName: document.getElementById('slot-name'),
    slotSub: document.getElementById('slot-sub'),
    statMembers: document.getElementById('stat-members'),
    statPrizes: document.getElementById('stat-prizes'),
    statDraws: document.getElementById('stat-draws'),
    prizes: document.getElementById('raffle-prizes'),
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

  // ── Render ────────────────────────────────────────────────────────────
  function renderStats() {
    el.statMembers.textContent = state.members.length;
    el.statPrizes.textContent = state.prizes;
    el.statDraws.textContent = state.draws;
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
    el.prizes.querySelectorAll('.pchip').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.prize) === state.prizes);
    });
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
    el.revealInner.innerHTML = winners.map((w) => `
      <div class="wcard">
        <span class="wcard__crown">🏆</span>
        <span class="wcard__name">${escapeHTML(w)}</span>
        <span class="wcard__tag">${t('Thẻ tháng', 'Monthly card')}</span>
      </div>`).join('');
    el.reveal.classList.add('open');
    el.reveal.setAttribute('aria-hidden', 'false');
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
      el.slotName.textContent = t('Chưa có thành viên!', 'No members!');
      el.slotSub.innerHTML = t(
        '<span>Thêm tên ở ô bên dưới đã nhé.</span>',
        '<span>Add some names below first.</span>'
      );
      return;
    }
    busy = true;
    el.spin.disabled = true;

    const winners = pickWinners(state.prizes);

    // Slot shuffle animation
    const names = state.members;
    const start = performance.now();
    const duration = 2600; // ms
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      // ease-out: interval grows toward the end
      el.slotName.textContent = names[Math.floor(Math.random() * names.length)];
      if (p < 1) {
        const delay = 40 + p * p * 220; // 40ms -> 260ms
        setTimeout(() => requestAnimationFrame(frame), delay);
      } else {
        finish(winners);
      }
    }
    el.slotSub.innerHTML = '<span>' + t('Đang quay…', 'Spinning…') + '</span>';
    requestAnimationFrame(frame);
  }

  function finish(winners) {
    el.slotName.textContent = winners[0];
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
    }, 450);
  }

  // ── Bind ──────────────────────────────────────────────────────────────
  el.saveMembers.addEventListener('click', () => {
    state.members = parseMembers(el.input.value);
    save();
    renderMembers();
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

  el.spin.addEventListener('click', spin);

  el.clearWinners.addEventListener('click', () => {
    el.slotName.textContent = '—';
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
