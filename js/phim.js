/* =============================================================================
   PHIM · movie hub powered by the public phimapi.com API
   Browse latest · search · filter by genre · watch (HLS via hls.js / embed)
   ========================================================================== */
(function () {
  'use strict';

  const API = 'https://phimapi.com';
  const IMG = 'https://phimimg.com/';
  const PKEY = 'nm_phim_progress';            // localStorage: tập đã xem theo slug
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="#10151c" width="200" height="300"/><text x="100" y="155" fill="#5b6573" font-size="34" font-family="sans-serif" text-anchor="middle">NM</text></svg>');

  const T = (vi, en) => (document.body.dataset.lang === 'en' ? en : vi);

  const state = { mode: 'latest', keyword: '', category: '', page: 1, loading: false, hasMore: false };

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
      <div class="film" data-slug="${m.slug}" data-cursor="Xem" data-cursor-en="Watch">
        <div class="film__poster">
          ${badge ? `<span class="film__badge">${badge}</span>` : ''}
          <img src="${posterOf(m)}" alt="${(m.name || '').replace(/"/g, '')}" loading="lazy"
               onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
          <span class="film__play">▶<em>Xem</em></span>
        </div>
        <div class="film__info">
          <div class="film__name">${m.name || ''}</div>
          <div class="film__origin">${m.origin_name || ''}${m.year ? ' · ' + m.year : ''}</div>
        </div>
      </div>`;
  }

  // Khung xương (skeleton) hiển thị trong lúc chờ tải → cảm giác nhanh hơn
  function skeletonHTML(n) {
    let s = '';
    for (let i = 0; i < n; i++)
      s += `<div class="film film--skel"><div class="film__poster"></div>
        <div class="film__info"><span class="sk-line"></span><span class="sk-line sk-line--sm"></span></div></div>`;
    return s;
  }
  const clearSkeletons = () => el.grid.querySelectorAll('.film--skel').forEach((n) => n.remove());

  // Reveal card khi cuộn vào viewport
  const revealIO = 'IntersectionObserver' in window && !reduceMotion
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -40px 0px' })
    : null;
  function revealCards() {
    if (!revealIO) return;
    el.grid.querySelectorAll('.film:not(.film--skel):not(.obs)').forEach((c) => { c.classList.add('obs'); revealIO.observe(c); });
  }

  async function loadList(reset) {
    if (state.loading) return;
    state.loading = true;
    el.status.textContent = '';
    if (reset) { state.page = 1; el.grid.innerHTML = skeletonHTML(12); }
    else el.grid.insertAdjacentHTML('beforeend', skeletonHTML(6));
    el.more.hidden = true;
    try {
      const data = await fetchAPI(listURL());
      const items = getItems(data);
      clearSkeletons();
      if (reset && !items.length) {
        state.hasMore = false;
        el.status.textContent = T('Không tìm thấy phim nào.', 'No movies found.');
      } else {
        el.grid.insertAdjacentHTML('beforeend', items.map(cardHTML).join(''));
        revealCards();
        el.status.textContent = '';
        state.hasMore = items.length >= 10;
        el.more.hidden = !state.hasMore;
      }
    } catch (e) {
      clearSkeletons();
      state.hasMore = false;
      el.status.textContent = T('Lỗi tải dữ liệu. Thử lại sau.', 'Failed to load. Try again later.');
      console.error(e);
    } finally {
      state.loading = false;
    }
  }

  // Infinite scroll: tự tải thêm khi nút "Xem thêm" lọt vào tầm nhìn (vẫn bấm được làm fallback)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.hasMore && !state.loading) { state.page++; loadList(false); }
    }, { rootMargin: '500px' });
    io.observe(el.more);
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

  // ── Player ─────────────────────────────────────────────────────────────
  const HLS_CONFIG = {
    // Đệm trước nhiều hơn để chống khựng khi mạng chập chờn
    maxBufferLength: 60,                 // giây video đệm tối thiểu (mặc định 30)
    maxMaxBufferLength: 120,             // trần đệm khi rảnh băng thông
    maxBufferSize: 120 * 1000 * 1000,    // 120 MB (mặc định 60 MB)
    backBufferLength: 30,                // giữ 30s đã xem để tua lại không tải lại
    // ABR: tự chọn chất lượng theo băng thông, đoán thận trọng lúc khởi động
    startLevel: -1,
    abrEwmaDefaultEstimate: 1000000,     // 1 Mbps ước lượng ban đầu
    // Retry mạnh hơn khi tải manifest/segment lỗi (server free hay chập)
    manifestLoadingMaxRetry: 4,
    manifestLoadingRetryDelay: 1000,
    levelLoadingMaxRetry: 4,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1000,
    fragLoadingMaxRetryTimeout: 64000,
  };
  const STALL_MS = 15000; // khựng quá 15s thì coi như server lỗi → đổi server

  let hls = null;
  let stallTimer = null;
  let activeVideo = null;   // <video> hiện tại, cho phím tắt điều khiển
  let goNextEp = null;      // hàm chuyển tập sau, cho phím tắt / tự động

  function setSpinner(on) {
    const wrap = document.getElementById('fm-player');
    if (!wrap) return;
    let sp = wrap.querySelector('.fm-spinner');
    if (on && !sp) { sp = document.createElement('div'); sp.className = 'fm-spinner'; wrap.appendChild(sp); }
    else if (!on && sp) sp.remove();
  }

  function destroyPlayer() {
    if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; }
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    activeVideo = null;
  }

  // Theo dõi khựng: nếu video kẹt buffer quá lâu, gọi onFail để đổi server
  function watchStall(video, onFail) {
    const arm = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        if (!video.paused && !video.ended && video.readyState < 3) onFail('stall');
      }, STALL_MS);
    };
    const clear = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };
    video.addEventListener('waiting', arm);
    video.addEventListener('playing', clear);
    video.addEventListener('ended', clear);
  }

  // Gắn spinner + theo dõi khựng + tự chuyển tập khi hết
  function bindVideo(video, fail, onEnded) {
    setSpinner(true);
    video.addEventListener('waiting', () => setSpinner(true));
    video.addEventListener('playing', () => setSpinner(false));
    video.addEventListener('canplay', () => setSpinner(false));
    video.addEventListener('ended', () => onEnded && onEnded());
    watchStall(video, fail);
    activeVideo = video;
  }

  // onFail(reason): nguồn này không phát được → fallback server. onEnded: hết tập → tập sau
  function playEpisode(ep, onFail, onEnded) {
    const wrap = document.getElementById('fm-player');
    if (!wrap || !ep) return;
    destroyPlayer();
    let failed = false;
    const fail = (reason) => { if (failed) return; failed = true; onFail && onFail(reason); };

    if (ep.link_m3u8 && window.Hls && Hls.isSupported()) {
      wrap.innerHTML = '<video id="fm-video" controls autoplay playsinline></video>';
      const video = document.getElementById('fm-video');
      hls = new Hls(HLS_CONFIG);
      hls.loadSource(ep.link_m3u8);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (evt, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); return; } catch (e) {}
        }
        fail(data.type); // NETWORK_ERROR hoặc lỗi không khôi phục được → đổi server
      });
      bindVideo(video, fail, onEnded);
    } else if (ep.link_m3u8 && document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) {
      wrap.innerHTML = '<video id="fm-video" controls autoplay playsinline></video>';
      const video = document.getElementById('fm-video');
      video.src = ep.link_m3u8;
      video.addEventListener('error', () => fail('native'));
      bindVideo(video, fail, onEnded);
    } else if (ep.link_embed) {
      wrap.innerHTML = `<iframe src="${ep.link_embed}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    } else {
      wrap.innerHTML = `<div class="fm-player__empty">${T('Không có nguồn phát', 'No source')}</div>`;
    }
  }

  function showFallbackToast(name) {
    const wrap = document.getElementById('fm-player');
    if (!wrap) return;
    const old = wrap.querySelector('.fm-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'fm-toast';
    toast.textContent = T('Server lỗi, đang chuyển sang ', 'Server failed, switching to ') + name + '…';
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function toggleFullscreen() {
    const wrap = document.getElementById('fm-player');
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (wrap && wrap.requestFullscreen) wrap.requestFullscreen();
    else if (activeVideo && activeVideo.webkitEnterFullscreen) activeVideo.webkitEnterFullscreen();
  }

  // ── Episodes ───────────────────────────────────────────────────────────
  const RANGE = 50; // gom tập theo dải khi danh sách quá dài

  function renderEpisodes(movie, episodes, slug) {
    let srvIdx = 0, epIdx = 0, rangeStart = 0;
    const tried = new Set();   // server đã thử trong lượt fallback hiện tại
    const box = document.getElementById('fm-eplist');
    const srvBox = document.getElementById('fm-servers');
    const rangeBox = document.getElementById('fm-ranges');
    if (!box) return;

    // Khôi phục tập đang xem dở (nếu có)
    try {
      const saved = JSON.parse(localStorage.getItem(PKEY) || '{}')[slug];
      if (saved) {
        if (episodes[saved.s]) srvIdx = saved.s;
        if (((episodes[srvIdx] || {}).server_data || [])[saved.e]) epIdx = saved.e;
      }
    } catch (e) {}

    function saveProgress() {
      try {
        const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
        all[slug] = { s: srvIdx, e: epIdx };
        localStorage.setItem(PKEY, JSON.stringify(all));
      } catch (e) {}
    }

    function nextEp() {
      const eps = (episodes[srvIdx] || {}).server_data || [];
      if (epIdx < eps.length - 1) { epIdx++; play(true); }
    }

    function draw() {
      const eps = (episodes[srvIdx] || {}).server_data || [];

      // Servers
      srvBox.innerHTML = episodes.map((s, i) =>
        `<button class="fm-server ${i === srvIdx ? 'active' : ''}" data-i="${i}">${s.server_name || 'Server ' + (i + 1)}</button>`).join('');
      srvBox.querySelectorAll('.fm-server').forEach((b) =>
        b.addEventListener('click', () => { srvIdx = +b.dataset.i; epIdx = 0; play(true); }));

      // Dải tập (chỉ hiện khi nhiều tập)
      if (rangeBox) {
        if (eps.length > RANGE) {
          let html = '';
          for (let s = 0; s < eps.length; s += RANGE) {
            const end = Math.min(s + RANGE, eps.length);
            html += `<button class="fm-range ${s === rangeStart ? 'active' : ''}" data-s="${s}">${s + 1}–${end}</button>`;
          }
          rangeBox.innerHTML = html; rangeBox.hidden = false;
          rangeBox.querySelectorAll('.fm-range').forEach((b) =>
            b.addEventListener('click', () => { rangeStart = +b.dataset.s; draw(); }));
        } else { rangeBox.innerHTML = ''; rangeBox.hidden = true; }
      }

      // Tập trong dải hiện tại
      const from = eps.length > RANGE ? rangeStart : 0;
      const to = eps.length > RANGE ? Math.min(rangeStart + RANGE, eps.length) : eps.length;
      let epHtml = '';
      for (let i = from; i < to; i++)
        epHtml += `<button class="fm-ep ${i === epIdx ? 'active' : ''}" data-i="${i}">${eps[i].name || (i + 1)}</button>`;
      box.innerHTML = epHtml;
      box.querySelectorAll('.fm-ep').forEach((b) =>
        b.addEventListener('click', () => { epIdx = +b.dataset.i; play(true); }));

      // Thanh "đang xem" + nút tập sau
      const bar = document.getElementById('fm-bar');
      const now = document.getElementById('fm-now');
      const nextBtn = document.getElementById('fm-next');
      const curEp = eps[epIdx];
      if (bar && now && curEp) {
        bar.hidden = false;
        now.textContent = T('Đang xem: ', 'Watching: ') + (curEp.name || epIdx + 1) +
          ' · ' + (episodes[srvIdx].server_name || 'Server ' + (srvIdx + 1));
        const hasNext = epIdx < eps.length - 1;
        nextBtn.hidden = !hasNext;
        nextBtn.onclick = nextEp;
      }
    }

    // Tìm server kế tiếp (chưa thử) có chứa tập đang xem
    function nextServer() {
      for (let i = 0; i < episodes.length; i++) {
        if (tried.has(i)) continue;
        if (((episodes[i] || {}).server_data || [])[epIdx]) return i;
      }
      return -1;
    }

    function fallback() {
      const next = nextServer();
      if (next < 0) {
        const wrap = document.getElementById('fm-player');
        if (wrap) wrap.innerHTML =
          `<div class="fm-player__empty">${T('Mọi server đều lỗi, thử tập hoặc phim khác.', 'All servers failed, try another episode or movie.')}</div>`;
        return;
      }
      srvIdx = next;
      showFallbackToast(episodes[srvIdx].server_name || 'Server ' + (srvIdx + 1));
      play(false);
    }

    // reset=true khi người dùng tự chọn server/tập (bắt đầu chuỗi fallback mới)
    function play(reset) {
      if (reset) tried.clear();
      tried.add(srvIdx);
      const eps = (episodes[srvIdx] || {}).server_data || [];
      rangeStart = eps.length > RANGE ? Math.floor(epIdx / RANGE) * RANGE : 0;
      draw();
      saveProgress();
      playEpisode(eps[epIdx], fallback, nextEp);
    }

    goNextEp = nextEp;
    play(true);
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  let modalHistoryActive = false;

  async function openMovie(slug) {
    if (!modalHistoryActive) { try { history.pushState({ filmModal: true }, ''); } catch (e) {} modalHistoryActive = true; }
    el.modal.classList.add('open');
    el.modal.setAttribute('aria-hidden', 'false');
    el.content.innerHTML = `<div class="phim-status">${T('Đang tải phim...', 'Loading...')}</div>`;
    document.body.style.overflow = 'hidden';
    if (window.lenis) window.lenis.stop();
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
          <div class="fm-bar" id="fm-bar" hidden>
            <span class="fm-now" id="fm-now"></span>
            <button class="fm-next" id="fm-next" data-cursor hidden>${T('Tập sau', 'Next')} ›</button>
          </div>
          <div class="fm-servers" id="fm-servers"></div>
          <div class="fm-ranges" id="fm-ranges" hidden></div>
          <div class="fm-eps" id="fm-eplist"></div>
        </div>`;
      if (episodes.length) renderEpisodes(movie, episodes, movie.slug || slug);
    } catch (e) {
      el.content.innerHTML = `<div class="phim-status">${T('Lỗi tải phim.', 'Failed to load movie.')}</div>`;
      console.error(e);
    }
  }

  function doClose() {
    destroyPlayer();
    goNextEp = null;
    el.modal.classList.remove('open');
    el.modal.setAttribute('aria-hidden', 'true');
    el.content.innerHTML = '';
    document.body.style.overflow = '';
    if (window.lenis) window.lenis.start();
  }

  function closeModal() {
    if (modalHistoryActive) { modalHistoryActive = false; history.back(); }
    doClose();
  }

  window.addEventListener('popstate', () => {
    modalHistoryActive = false;
    if (el.modal.classList.contains('open')) doClose();
  });

  // ── Bind ─────────────────────────────────────────────────────────────────
  el.grid.addEventListener('click', (e) => {
    const card = e.target.closest('.film');
    if (card && !card.classList.contains('film--skel')) openMovie(card.dataset.slug);
  });
  el.more.addEventListener('click', () => { if (state.hasMore && !state.loading) { state.page++; loadList(false); } });

  el.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const kw = el.searchInput.value.trim();
    if (!kw) { state.mode = 'latest'; }
    else { state.mode = 'search'; state.keyword = kw; }
    el.cats.querySelectorAll('.cat-chip').forEach((c) => c.classList.remove('active'));
    loadList(true);
  });

  // Tìm kiếm trực tiếp khi gõ (debounce)
  let searchTimer = null;
  el.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const kw = el.searchInput.value.trim();
      if (!kw) { if (state.mode === 'search') { state.mode = 'latest'; loadList(true); } return; }
      state.mode = 'search'; state.keyword = kw;
      el.cats.querySelectorAll('.cat-chip').forEach((c) => c.classList.remove('active'));
      loadList(true);
    }, 450);
  });

  el.close.addEventListener('click', closeModal);
  el.backdrop.addEventListener('click', closeModal);

  // Phím tắt khi đang xem
  document.addEventListener('keydown', (e) => {
    if (!el.modal.classList.contains('open')) return;
    if (e.key === 'Escape') { closeModal(); return; }
    const v = activeVideo;
    if (!v || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
      case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10); break;
      case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'n': case 'N': if (goNextEp) goNextEp(); break;
    }
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  loadCats();
  loadList(true);
})();
