/* =============================================================================
   GACHA · standalone pull mechanic (no backend, localStorage only)
   Rarities: R 79% · SR 18% · SSR 3%  ·  Pity: guaranteed SSR at 90
   Edit the POOL below to change the prizes.
   ========================================================================== */
(function () {
  'use strict';

  // ── Prize pool — EDIT HERE ────────────────────────────────────────────
  const POOL = [
    // R
    { id: 'r1', icon: '🪙', vi: 'Đồng xu',     en: 'Coin',        rarity: 'R' },
    { id: 'r2', icon: '🍙', vi: 'Cơm nắm',     en: 'Rice ball',   rarity: 'R' },
    { id: 'r3', icon: '🧪', vi: 'Lọ thuốc',    en: 'Potion',      rarity: 'R' },
    { id: 'r4', icon: '🪶', vi: 'Lông vũ',     en: 'Feather',     rarity: 'R' },
    { id: 'r5', icon: '🍂', vi: 'Lá phong',    en: 'Maple leaf',  rarity: 'R' },
    // SR
    { id: 's1', icon: '⚔️', vi: 'Bảo kiếm',    en: 'Sword',       rarity: 'SR' },
    { id: 's2', icon: '🛡️', vi: 'Khiên thép',  en: 'Shield',      rarity: 'SR' },
    { id: 's3', icon: '🏹', vi: 'Cung thần',   en: 'Bow',         rarity: 'SR' },
    { id: 's4', icon: '🔮', vi: 'Pha lê',      en: 'Crystal',     rarity: 'SR' },
    // SSR
    { id: 'x1', icon: '🐉', vi: 'Thần Long',   en: 'Dragon',      rarity: 'SSR' },
    { id: 'x2', icon: '👑', vi: 'Vương Miện',  en: 'Crown',       rarity: 'SSR' },
    { id: 'x3', icon: '🦄', vi: 'Kỳ Lân',      en: 'Unicorn',     rarity: 'SSR' },
  ];

  const RATE = { SSR: 3, SR: 18 }; // R = remainder
  const PITY = 90;
  const KEY = 'gacha_state_v1';
  const RANK = { R: 0, SR: 1, SSR: 2 };

  const hasGSAP = typeof window.gsap !== 'undefined';

  // ── State ─────────────────────────────────────────────────────────────
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.collection) return s;
    } catch (e) {}
    return { total: 0, ssr: 0, pity: 0, collection: {} };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  let state = load();

  // ── Roll ──────────────────────────────────────────────────────────────
  function pick(rarity) {
    const list = POOL.filter((p) => p.rarity === rarity);
    return list[Math.floor(Math.random() * list.length)];
  }
  function rollOne() {
    state.pity++;
    let rarity;
    if (state.pity >= PITY) rarity = 'SSR';
    else {
      const r = Math.random() * 100;
      if (r < RATE.SSR) rarity = 'SSR';
      else if (r < RATE.SSR + RATE.SR) rarity = 'SR';
      else rarity = 'R';
    }
    if (rarity === 'SSR') { state.pity = 0; state.ssr++; }
    const item = pick(rarity);
    state.total++;
    state.collection[item.id] = (state.collection[item.id] || 0) + 1;
    return item;
  }
  function pullMany(n) {
    const results = [];
    for (let i = 0; i < n; i++) results.push(rollOne());
    // 10-pull SR+ guarantee
    if (n >= 10 && !results.some((r) => RANK[r.rarity] >= 1)) {
      const sr = pick('SR');
      results[results.length - 1] = sr;
      state.collection[sr.id] = (state.collection[sr.id] || 0) + 1;
    }
    save(state);
    return results;
  }

  // ── DOM ───────────────────────────────────────────────────────────────
  const el = {
    orb: document.getElementById('gacha-orb'),
    total: document.getElementById('stat-total'),
    ssr: document.getElementById('stat-ssr'),
    pity: document.getElementById('stat-pity'),
    grid: document.getElementById('gacha-grid'),
    reveal: document.getElementById('reveal'),
    revealInner: document.getElementById('reveal-inner'),
    revealClose: document.getElementById('reveal-close'),
    pull1: document.getElementById('pull-1'),
    pull10: document.getElementById('pull-10'),
    reset: document.getElementById('reset'),
  };

  function nameSpans(item) {
    return `<span data-vi>${item.vi}</span><span data-en>${item.en}</span>`;
  }

  function updateStats() {
    el.total.textContent = state.total;
    el.ssr.textContent = state.ssr;
    el.pity.textContent = state.pity;
  }

  function renderCollection() {
    const ids = Object.keys(state.collection);
    if (!ids.length) {
      el.grid.innerHTML = '<p class="gacha-empty"><span data-vi>Chưa có gì — quay thử ngay!</span><span data-en>Nothing yet — try a pull!</span></p>';
      return;
    }
    const items = ids
      .map((id) => ({ item: POOL.find((p) => p.id === id), count: state.collection[id] }))
      .filter((x) => x.item)
      .sort((a, b) => RANK[b.item.rarity] - RANK[a.item.rarity]);
    el.grid.innerHTML = items.map(({ item, count }) => `
      <div class="gitem" data-rarity="${item.rarity}">
        <span class="gitem__count">×${count}</span>
        <span class="gitem__icon">${item.icon}</span>
        <span class="gitem__name">${nameSpans(item)}</span>
        <span class="gitem__tag">${item.rarity}</span>
      </div>`).join('');
  }

  function showReveal(results) {
    el.revealInner.innerHTML = results.map((item) => `
      <div class="rcard" data-rarity="${item.rarity}">
        <span class="rcard__icon">${item.icon}</span>
        <span class="rcard__name">${nameSpans(item)}</span>
        <span class="rcard__tag">${item.rarity}</span>
      </div>`).join('');
    el.reveal.classList.add('open');
    el.reveal.setAttribute('aria-hidden', 'false');
    const cards = el.revealInner.querySelectorAll('.rcard');
    if (hasGSAP) {
      gsap.to(cards, {
        scale: 1, rotateY: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.7)',
        stagger: 0.08,
        onComplete: () => el.reveal.classList.add('show-close'),
      });
      cards.forEach((c) => {
        if (c.dataset.rarity === 'SSR') {
          gsap.fromTo(c, { boxShadow: '0 0 0 rgba(244,183,64,0)' },
            { boxShadow: '0 0 40px rgba(244,183,64,0.8)', duration: 0.6, yoyo: true, repeat: 3, delay: 0.5 });
        }
      });
    } else {
      cards.forEach((c) => { c.style.transform = 'none'; c.style.opacity = '1'; });
      el.reveal.classList.add('show-close');
    }
  }

  function closeReveal() {
    el.reveal.classList.remove('open', 'show-close');
    el.reveal.setAttribute('aria-hidden', 'true');
    updateStats();
    renderCollection();
  }

  let busy = false;
  function doPull(n) {
    if (busy) return;
    busy = true;
    el.pull1.disabled = el.pull10.disabled = true;
    el.orb.classList.add('charging');
    const results = pullMany(n);
    setTimeout(() => {
      el.orb.classList.remove('charging');
      showReveal(results);
      busy = false;
      el.pull1.disabled = el.pull10.disabled = false;
    }, 850);
  }

  // ── Bind ──────────────────────────────────────────────────────────────
  el.pull1.addEventListener('click', () => doPull(1));
  el.pull10.addEventListener('click', () => doPull(10));
  el.revealClose.addEventListener('click', closeReveal);
  el.reveal.addEventListener('click', (e) => { if (e.target === el.reveal) closeReveal(); });
  el.reset.addEventListener('click', () => {
    const msg = document.body.dataset.lang === 'en'
      ? 'Reset all pulls and collection?' : 'Đặt lại toàn bộ lượt quay và bộ sưu tập?';
    if (confirm(msg)) {
      state = { total: 0, ssr: 0, pity: 0, collection: {} };
      save(state);
      updateStats();
      renderCollection();
    }
  });

  updateStats();
  renderCollection();
})();
