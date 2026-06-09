/* =============================================================================
   PHIM · movie hub powered by the public phimapi.com API
   Browse latest · search · filter by genre · watch (HLS via hls.js / embed)
   ========================================================================== */
(function () {
  'use strict';

  const API = 'https://phimapi.com';
  const IMG = 'https://phimimg.com/';
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="#10151c" width="200" height="300"/><text x="100" y="155" fill="#5b6573" font-size="34" font-family="sans-serif" text-anchor="middle">NM</text></svg>');

  const T = (vi, en) => (document.body.dataset.lang === 'en' ? en : vi);

  const state = { mode: 'latest', keyword: '', category: '', page: 1, loading: false };

  const el = {
    grid: document.getElementById('phim-grid'),
    status: document.getElementById('phim-status'),
    more: document.getElementById('phim-more'),
    cats: document.getElementById('phim-cats'),
    searchForm: document.getElementById('phim-search'),
    searchInput: document.getElementById('search-input'),
    modal: document.getElementById('film-modal'),
    backdrop: document.getElementById('film-backdrop'),
    close: document.getElementById('film-close'),
    content: document.getElementById('film-content'),
  };

  // ── API helpers ─────────────────────────────────────────────────────────
  async function fetchAPI(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  const getItems = (d) => (d && (d.items || (d.data && d.data.items))) || [];
  function posterOf(m) {
    let p = m.poster_url || m.thumb_url || '';
    if (p && !p.startsWith('http')) p = IMG + p;
    return p || PLACEHOLDER;
  }

  function listURL() {
    if (state.mode === 'search')
      return `${API}/v1/api/tim-kiem?keyword=${encodeURIComponent(state.keyword)}&page=${state.page}`;
    if (state.mode === 'category')
      return `${API}/v1/api/the-loai/${state.category}?page=${state.page}`;
    return `${API}/danh-sach/phim-moi-cap-nhat-v3?page=${state.page}`;
  }

  // ── Render grid ──────────────────────────────────────────────────────────
  function cardHTML(m) {
    const badge = m.episode_current || m.quality || '';
    return `
      <div class="film" data-slug="${m.slug}" data-cursor>
        <div class="film__poster">
          ${badge ? `<span class="film__badge">${badge}</span>` : ''}
          <img src="${posterOf(m)}" alt="${(m.name || '').replace(/"/g, '')}" loading="lazy"
               onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
          <span class="film__play">▶</span>
        </div>
        <div class="film__info">
          <div class="film__name">${m.name || ''}</div>
          <div class="film__origin">${m.origin_name || ''}${m.year ? ' · ' + m.year : ''}</div>
        </div>
      </div>`;
  }

  async function loadList(reset) {
    if (state.loading) return;
    state.loading = true;
    if (reset) { state.page = 1; el.grid.innerHTML = ''; }
    el.status.textContent = T('Đang tải...', 'Loading...');
    el.more.hidden = true;
    try {
      const data = await fetchAPI(listURL());
      const items = getItems(data);
      if (reset && !items.length) {
        el.status.textContent = T('Không tìm thấy phim nào.', 'No movies found.');
      } else {
        el.grid.insertAdjacentHTML('beforeend', items.map(cardHTML).join(''));
        el.status.textContent = '';
        el.more.hidden = items.length < 10;
      }
    } catch (e) {
      el.status.textContent = T('Lỗi tải dữ liệu. Thử lại sau.', 'Failed to load. Try again later.');
      console.error(e);
    } finally {
      state.loading = false;
    }
  }

  // ── Categories ───────────────────────────────────────────────────────────
  async function loadCats() {
    try {
      const data = await fetchAPI(`${API}/the-loai`);
      let cats = Array.isArray(data) ? data : (data.data && data.data.items) || [];
      // Bỏ thể loại 18+
      cats = cats.filter((c) => c.slug !== 'phim-18' && !/18\+?/.test(c.name || ''));
      el.cats.innerHTML =
        `<button class="cat-chip active" data-slug=""><span data-vi>Mới nhất</span><span data-en>Latest</span></button>` +
        cats.slice(0, 14).map((c) => `<button class="cat-chip" data-slug="${c.slug}">${c.name}</button>`).join('');
      el.cats.querySelectorAll('.cat-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          el.cats.querySelectorAll('.cat-chip').forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          const slug = chip.dataset.slug;
          if (!slug) { state.mode = 'latest'; }
          else { state.mode = 'category'; state.category = slug; }
          state.keyword = ''; el.searchInput.value = '';
          loadList(true);
        });
      });
    } catch (e) { console.error('cats', e); }
  }

  // ── Modal / player ───────────────────────────────────────────────────────
  let hls = null;
  function destroyPlayer() { if (hls) { try { hls.destroy(); } catch (e) {} hls = null; } }

  function playEpisode(ep) {
    const wrap = document.getElementById('fm-player');
    if (!wrap || !ep) return;
    destroyPlayer();
    if (ep.link_m3u8 && window.Hls) {
      wrap.innerHTML = '<video id="fm-video" controls autoplay playsinline></video>';
      const video = document.getElementById('fm-video');
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(ep.link_m3u8);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = ep.link_m3u8;
      } else if (ep.link_embed) {
        wrap.innerHTML = `<iframe src="${ep.link_embed}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
      }
    } else if (ep.link_embed) {
      wrap.innerHTML = `<iframe src="${ep.link_embed}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    } else {
      wrap.innerHTML = `<div class="fm-player__empty">${T('Không có nguồn phát', 'No source')}</div>`;
    }
  }

  function renderEpisodes(movie, episodes) {
    let srvIdx = 0, epIdx = 0;
    const box = document.getElementById('fm-eplist');
    const srvBox = document.getElementById('fm-servers');
    if (!box) return;

    function draw() {
      const server = episodes[srvIdx] || {};
      const eps = server.server_data || [];
      srvBox.innerHTML = episodes.map((s, i) =>
        `<button class="fm-server ${i === srvIdx ? 'active' : ''}" data-i="${i}">${s.server_name || 'Server ' + (i + 1)}</button>`).join('');
      box.innerHTML = eps.map((e, i) =>
        `<button class="fm-ep ${i === epIdx ? 'active' : ''}" data-i="${i}">${e.name || (i + 1)}</button>`).join('');
      srvBox.querySelectorAll('.fm-server').forEach((b) =>
        b.addEventListener('click', () => { srvIdx = +b.dataset.i; epIdx = 0; draw(); play(); }));
      box.querySelectorAll('.fm-ep').forEach((b) =>
        b.addEventListener('click', () => { epIdx = +b.dataset.i; draw(); play(); }));
    }
    function play() { playEpisode((episodes[srvIdx] || {}).server_data?.[epIdx]); }

    draw();
    play();
  }

  async function openMovie(slug) {
    el.modal.classList.add('open');
    el.modal.setAttribute('aria-hidden', 'false');
    el.content.innerHTML = `<div class="phim-status">${T('Đang tải phim...', 'Loading...')}</div>`;
    document.body.style.overflow = 'hidden';
    try {
      const data = await fetchAPI(`${API}/phim/${slug}`);
      const movie = data.movie || {};
      const episodes = data.episodes || [];
      el.content.innerHTML = `
        <div class="fm-player" id="fm-player"><div class="fm-player__empty">${T('Chọn tập để xem', 'Pick an episode')}</div></div>
        <div class="fm-body">
          <h2 class="fm-title">${movie.name || ''}</h2>
          <div class="fm-meta">
            <span>${movie.origin_name || ''}</span>
            ${movie.year ? `<span>${movie.year}</span>` : ''}
            ${movie.time ? `<span>${movie.time}</span>` : ''}
            ${movie.quality ? `<span>${movie.quality}</span>` : ''}
            ${movie.episode_current ? `<span>${movie.episode_current}</span>` : ''}
          </div>
          <p class="fm-desc">${(movie.content || '').replace(/<[^>]*>/g, '')}</p>
          <div class="fm-servers" id="fm-servers"></div>
          <div class="fm-eps" id="fm-eplist"></div>
        </div>`;
      if (episodes.length) renderEpisodes(movie, episodes);
    } catch (e) {
      el.content.innerHTML = `<div class="phim-status">${T('Lỗi tải phim.', 'Failed to load movie.')}</div>`;
      console.error(e);
    }
  }

  function closeModal() {
    destroyPlayer();
    el.modal.classList.remove('open');
    el.modal.setAttribute('aria-hidden', 'true');
    el.content.innerHTML = '';
    document.body.style.overflow = '';
  }

  // ── Bind ─────────────────────────────────────────────────────────────────
  el.grid.addEventListener('click', (e) => {
    const card = e.target.closest('.film');
    if (card) openMovie(card.dataset.slug);
  });
  el.more.addEventListener('click', () => { state.page++; loadList(false); });
  el.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const kw = el.searchInput.value.trim();
    if (!kw) { state.mode = 'latest'; }
    else { state.mode = 'search'; state.keyword = kw; }
    el.cats.querySelectorAll('.cat-chip').forEach((c) => c.classList.remove('active'));
    loadList(true);
  });
  el.close.addEventListener('click', closeModal);
  el.backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.modal.classList.contains('open')) closeModal(); });

  // ── Init ─────────────────────────────────────────────────────────────────
  loadCats();
  loadList(true);
})();
