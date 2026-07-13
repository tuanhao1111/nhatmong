/* =============================================================================
   PHIM · movie hub — nhiều nguồn public: KKPhim (phimapi.com) · OPhim · NguonC
   Browse latest · search · filter by genre · watch (HLS via hls.js / embed)
   ========================================================================== */
(function () {
  'use strict';

  // ── Nguồn phim ────────────────────────────────────────────────────────────
  // Mỗi nguồn một adapter nhỏ: hàm dựng URL + chuẩn hóa dữ liệu về "dạng KKPhim"
  // (item: name/slug/origin_name/year/… · detail: {movie, episodes[{server_name,
  // server_data[{name, link_m3u8, link_embed}]}]}) — phần còn lại của trang
  // không cần biết đang xem nguồn nào.
  const SRC_KEY = 'nm_phim_source';           // localStorage: nguồn đang chọn

  // NguonC không có API liệt kê thể loại / quốc gia → danh sách cứng
  const NGUONC_CATS = [
    { name: 'Hành Động', slug: 'hanh-dong' }, { name: 'Phiêu Lưu', slug: 'phieu-luu' },
    { name: 'Hoạt Hình', slug: 'hoat-hinh' }, { name: 'Hài', slug: 'hai' },
    { name: 'Hình Sự', slug: 'hinh-su' }, { name: 'Chính Kịch', slug: 'chinh-kich' },
    { name: 'Gia Đình', slug: 'gia-dinh' }, { name: 'Giả Tưởng', slug: 'gia-tuong' },
    { name: 'Lịch Sử', slug: 'lich-su' }, { name: 'Kinh Dị', slug: 'kinh-di' },
    { name: 'Bí Ẩn', slug: 'bi-an' }, { name: 'Lãng Mạn', slug: 'lang-man' },
    { name: 'Tâm Lý', slug: 'tam-ly' }, { name: 'Cổ Trang', slug: 'co-trang' },
  ];
  const NGUONC_COUNTRIES = [
    { name: 'Âu Mỹ', slug: 'au-my' }, { name: 'Anh', slug: 'anh' },
    { name: 'Trung Quốc', slug: 'trung-quoc' }, { name: 'Việt Nam', slug: 'viet-nam' },
    { name: 'Pháp', slug: 'phap' }, { name: 'Hồng Kông', slug: 'hong-kong' },
    { name: 'Hàn Quốc', slug: 'han-quoc' }, { name: 'Nhật Bản', slug: 'nhat-ban' },
    { name: 'Thái Lan', slug: 'thai-lan' }, { name: 'Đài Loan', slug: 'dai-loan' },
    { name: 'Nga', slug: 'nga' }, { name: 'Ấn Độ', slug: 'an-do' },
    { name: 'Philippines', slug: 'philippines' }, { name: 'Indonesia', slug: 'indonesia' },
  ];

  const SOURCES = {
    kk: {
      name: 'KKPhim',
      latest: (page) => `https://phimapi.com/danh-sach/phim-moi-cap-nhat-v3?page=${page}`,
      search: (kw, page) => `https://phimapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}&page=${page}`,
      category: (slug, page) => `https://phimapi.com/v1/api/the-loai/${slug}?page=${page}`,
      country: (slug, page) => `https://phimapi.com/v1/api/quoc-gia/${slug}?page=${page}`,
      catsURL: 'https://phimapi.com/the-loai',
      countriesURL: 'https://phimapi.com/quoc-gia',
      detail: (slug) => `https://phimapi.com/phim/${encodeURIComponent(slug)}`,
      poster(m) {
        const p = m.poster_url || m.thumb_url || '';
        return p && !p.startsWith('http') ? 'https://phimimg.com/' + p : p;
      },
      parseDetail: (d) => ({ movie: d.movie || {}, episodes: d.episodes || [] }),
    },
    ophim: {
      name: 'OPhim',
      latest: (page) => `https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=${page}`,
      search: (kw, page) => `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(kw)}&page=${page}`,
      category: (slug, page) => `https://ophim1.com/v1/api/the-loai/${slug}?page=${page}`,
      country: (slug, page) => `https://ophim1.com/v1/api/quoc-gia/${slug}?page=${page}`,
      catsURL: 'https://ophim1.com/v1/api/the-loai',
      countriesURL: 'https://ophim1.com/v1/api/quoc-gia',
      detail: (slug) => `https://ophim1.com/phim/${encodeURIComponent(slug)}`,
      poster(m) {
        // Ảnh khi thì URL đầy đủ, khi thì "uploads/movies/x.jpg", khi thì mỗi tên file
        const p = m.poster_url || m.thumb_url || '';
        if (!p || p.startsWith('http')) return p;
        return 'https://img.ophim.live/' + (p.includes('/') ? p : 'uploads/movies/' + p);
      },
      parseDetail: (d) => ({ movie: d.movie || {}, episodes: d.episodes || [] }),
    },
    nguonc: {
      name: 'NguonC',
      latest: (page) => `https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=${page}`,
      search: (kw, page) => `https://phim.nguonc.com/api/films/search?keyword=${encodeURIComponent(kw)}&page=${page}`,
      category: (slug, page) => `https://phim.nguonc.com/api/films/the-loai/${slug}?page=${page}`,
      country: (slug, page) => `https://phim.nguonc.com/api/films/quoc-gia/${slug}?page=${page}`,
      cats: NGUONC_CATS,
      countries: NGUONC_COUNTRIES,
      detail: (slug) => `https://phim.nguonc.com/api/film/${encodeURIComponent(slug)}`,
      poster: (m) => m.thumb_url || m.poster_url || '',
      // NguonC đặt tên trường khác → đổi về tên KKPhim
      normItem: (m) => Object.assign({}, m, {
        origin_name: m.original_name || '',
        episode_current: m.current_episode || '',
      }),
      parseDetail(d) {
        const mv = d.movie || {};
        // Năm nằm trong nhóm category tên "Năm"
        let year = '';
        const cat = mv.category || {};
        Object.keys(cat).forEach((k) => {
          const g = cat[k];
          if (g && g.group && /năm/i.test(g.group.name || '') && g.list && g.list[0]) year = g.list[0].name;
        });
        return {
          movie: {
            slug: mv.slug, name: mv.name, origin_name: mv.original_name || '',
            year, time: mv.time || '', quality: mv.quality || '',
            episode_current: mv.current_episode || '', content: mv.description || '',
            thumb_url: mv.thumb_url, poster_url: mv.poster_url,
          },
          episodes: (mv.episodes || []).map((s) => ({
            server_name: s.server_name,
            server_data: (s.items || []).map((e) => ({
              name: e.name, link_m3u8: e.m3u8 || '', link_embed: e.embed || '',
            })),
          })),
        };
      },
    },
  };

  // Chế độ "Tự động" (mặc định): trang tự chọn nguồn — nguồn lỗi hoặc tìm kiếm
  // không có kết quả thì tự nhảy sang nguồn kế tiếp; xem phim mà mọi server chết
  // thì tự dò cùng phim ở nguồn khác. Chọn tay một nguồn cụ thể sẽ tắt tự động.
  let autoMode = true;
  let curSrc = 'kk';               // nguồn đang dùng thực tế (kể cả khi auto)
  try {
    const savedSrc = localStorage.getItem(SRC_KEY);
    if (SOURCES[savedSrc]) { curSrc = savedSrc; autoMode = false; }
  } catch (e) {}

  // Khóa lưu trữ (tiến độ / lịch sử / xem sau) theo nguồn — nguồn mặc định (kk)
  // giữ nguyên slug trần để không mất dữ liệu đã lưu từ trước.
  const keyOf = (src, slug) => (!src || src === 'kk' ? slug : src + ':' + slug);

  // ── Xếp hạng nguồn theo tốc độ ───────────────────────────────────────────
  // Lúc mở trang (chế độ Tự động): ping cả 3 nguồn cùng lúc — nguồn trả lời
  // trước được dùng mở màn; thứ hạng đầy đủ quyết định thứ tự failover về sau
  // (nguồn chết xuống cuối hàng).
  let srcOrder = Object.keys(SOURCES);

  function pingSources() {
    const t0 = performance.now();
    return Object.keys(SOURCES).map((id) => {
      const ctl = 'AbortController' in window ? new AbortController() : null;
      const kill = setTimeout(() => { if (ctl) ctl.abort(); }, 6000);
      return fetchAPI(SOURCES[id].latest(1), ctl && ctl.signal)
        .then(() => ({ id, ms: performance.now() - t0 }))
        .catch(() => ({ id, ms: Infinity }))
        .then((r) => { clearTimeout(kill); return r; });
    });
  }

  async function pickFastestSource() {
    const pings = pingSources();
    // Thứ hạng đầy đủ chạy nền — không chặn việc hiển thị
    Promise.all(pings).then((rs) => {
      rs.sort((a, b) => a.ms - b.ms);
      srcOrder = rs.map((r) => r.id);
    });
    // Chờ nguồn ĐẦU TIÊN trả lời (tối đa 4s) để chọn nguồn mở màn
    try {
      const winner = await Promise.race([
        new Promise((resolve, reject) => {
          let fails = 0;
          pings.forEach((p) => p.then((r) => {
            if (r.ms < Infinity) resolve(r);
            else if (++fails === pings.length) reject(new Error('all sources down'));
          }));
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 4000)),
      ]);
      curSrc = winner.id;
    } catch (e) { /* giữ nguồn mặc định — failover trong loadList lo phần còn lại */ }
  }

  const PKEY = 'nm_phim_progress';            // localStorage: tập đã xem theo slug
  const HKEY = 'nm_phim_history';             // localStorage: danh sách phim vừa xem
  const HMAX = 12;                            // số phim tối đa lưu trong "Vừa xem"
  const WKEY = 'nm_phim_watchlist';           // localStorage: danh sách "Xem sau"
  const WMAX = 30;                            // số phim tối đa trong "Xem sau"
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect fill="#10151c" width="200" height="300"/><text x="100" y="155" fill="#5b6573" font-size="34" font-family="sans-serif" text-anchor="middle">NM</text></svg>');

  const T = (vi, en) => (document.body.dataset.lang === 'en' ? en : vi);

  // Escape dữ liệu từ API trước khi chèn vào innerHTML (chống XSS —
  // tên phim/server/tập đến từ bên thứ ba, không tin tưởng được).
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  // 1514 → "25:14" · 3753 → "1:02:33" (hiện chỗ "Xem tiếp từ …")
  function fmtTime(t) {
    t = Math.max(0, Math.floor(t || 0));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    const p = (n) => String(n).padStart(2, '0');
    return (h ? h + ':' + p(m) : String(m)) + ':' + p(s);
  }

  // Tiến độ xem dở của một phim: { s: server, e: tập, t: giây } hoặc null
  function loadProgress(slug) {
    try { return JSON.parse(localStorage.getItem(PKEY) || '{}')[slug] || null; } catch (e) { return null; }
  }

  const state = { mode: 'latest', keyword: '', category: '', country: '', page: 1, loading: false, hasMore: false };

  const el = {
    grid: document.getElementById('phim-grid'),
    status: document.getElementById('phim-status'),
    more: document.getElementById('phim-more'),
    moreText: document.querySelector('#phim-more .phim-more__text'),
    cats: document.getElementById('phim-cats'),
    countries: document.getElementById('phim-countries'),
    srcBtn: document.getElementById('dd-src-btn'),
    catsBtn: document.getElementById('dd-cats-btn'),
    catsVal: document.getElementById('dd-cats-val'),
    cntBtn: document.getElementById('dd-countries-btn'),
    cntVal: document.getElementById('dd-countries-val'),
    searchForm: document.getElementById('phim-search'),
    searchInput: document.getElementById('search-input'),
    modal: document.getElementById('film-modal'),
    backdrop: document.getElementById('film-backdrop'),
    close: document.getElementById('film-close'),
    content: document.getElementById('film-content'),
    recent: document.getElementById('phim-recent'),
    recentRow: document.getElementById('phim-recent-row'),
    recentClear: document.getElementById('phim-recent-clear'),
    watch: document.getElementById('phim-watch'),
    watchRow: document.getElementById('phim-watch-row'),
    watchClear: document.getElementById('phim-watch-clear'),
    random: document.getElementById('phim-random'),
    theater: document.getElementById('film-theater'),
  };

  // ── API helpers ─────────────────────────────────────────────────────────
  async function fetchAPI(url, signal) {
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }
  const getItems = (d) => (d && (d.items || (d.data && d.data.items))) || [];
  // Tổng số trang từ API. v3 trả totalPages sẵn ở gốc; v1 (tìm kiếm / thể loại /
  // quốc gia) chỉ trả totalItems + totalItemsPerPage trong data.params → tự chia.
  function getTotalPages(d) {
    // NguonC: paginate.total_page · v3: pagination.totalPages · v1: tự chia
    const p = (d && (d.pagination || d.paginate || (d.data && d.data.params && d.data.params.pagination))) || null;
    if (!p) return 0;
    if (typeof p.totalPages === 'number') return p.totalPages;
    if (p.total_page != null) return +p.total_page || 0;
    if (typeof p.totalItems === 'number' && p.totalItemsPerPage) {
      return Math.ceil(p.totalItems / p.totalItemsPerPage);
    }
    return 0;
  }
  function posterOf(m, src) {
    return SOURCES[src || curSrc].poster(m) || PLACEHOLDER;
  }

  function listURL() {
    const s = SOURCES[curSrc];
    if (state.mode === 'search') return s.search(state.keyword, state.page);
    if (state.mode === 'category') return s.category(state.category, state.page);
    if (state.mode === 'country') return s.country(state.country, state.page);
    return s.latest(state.page);
  }

  // ── Render grid ──────────────────────────────────────────────────────────
  // Cache dữ liệu tối thiểu của các phim đã render để nút "Xem sau" dùng lại
  const movieCache = new Map();
  function entryOf(m) {
    const isrc = m.__src || curSrc;
    return {
      slug: m.slug,
      src: isrc,
      name: m.name || '',
      origin: m.origin_name || '',
      year: m.year || '',
      badge: m.episode_current || m.quality || '',
      poster: posterOf(m, isrc),
    };
  }

  // m.__src: nguồn của item (khác curSrc khi tìm kiếm gộp nhiều nguồn)
  function cardHTML(m) {
    const isrc = m.__src || curSrc;
    const badge = m.episode_current || m.quality || '';
    const wkey = keyOf(isrc, m.slug);
    movieCache.set(wkey, entryOf(m));
    const srcTag = isrc !== curSrc
      ? `<span class="film__src">${esc(SOURCES[isrc].name)}</span>` : '';
    return `
      <div class="film" data-slug="${esc(m.slug)}" data-src="${esc(isrc)}" data-cursor="" tabindex="0" role="button" aria-label="${esc(m.name)}">
        <button class="film__save ${watchSet.has(wkey) ? 'on' : ''}" data-slug="${esc(m.slug)}" data-src="${esc(isrc)}" data-cursor
                aria-label="Xem sau" title="Xem sau">${watchSet.has(wkey) ? '✓' : '＋'}</button>
        <div class="film__poster">
          ${badge ? `<span class="film__badge">${esc(badge)}</span>` : ''}
          ${srcTag}
          <img src="${esc(posterOf(m, isrc))}" alt="${esc(m.name)}" loading="lazy"
               onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
          <span class="film__play">▶</span>
        </div>
        <div class="film__info">
          <div class="film__name">${esc(m.name)}</div>
          <div class="film__origin">${esc(m.origin_name)}${m.year ? ' · ' + esc(m.year) : ''}</div>
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

  // ── Recently watched ─────────────────────────────────────────────────────
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; }
  }
  function addToHistory(movie, slug, src) {
    const k = keyOf(src, slug);
    let h = loadHistory().filter((x) => keyOf(x.src, x.slug) !== k);
    h.unshift({
      slug,
      src: src || 'kk',
      name: movie.name || '',
      origin: movie.origin_name || '',
      year: movie.year || '',
      badge: movie.episode_current || movie.quality || '',
      poster: posterOf(movie, src),
      ts: Date.now(),
    });
    h = h.slice(0, HMAX);
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) {}
    renderRecent();
  }
  function removeFromHistory(slug, src) {
    const k = keyOf(src, slug);
    const h = loadHistory().filter((x) => keyOf(x.src, x.slug) !== k);
    try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) {}
    renderRecent();
  }
  function recentCardHTML(e) {
    // Badge "⏵ 25:14" nếu phim này đang xem dở — bấm vào là xem tiếp từ đó
    const prog = loadProgress(keyOf(e.src, e.slug));
    const resume = prog && prog.t > 60
      ? `<span class="film__resume" title="${T('Xem tiếp từ ', 'Resume from ')}${fmtTime(prog.t)}">⏵ ${fmtTime(prog.t)}</span>` : '';
    const srcTag = e.src && e.src !== 'kk' ? `<span class="film__src">${esc((SOURCES[e.src] || {}).name || e.src)}</span>` : '';
    return `
      <div class="film film--recent" data-slug="${esc(e.slug)}" data-src="${esc(e.src || 'kk')}" tabindex="0" role="button" aria-label="${esc(e.name)}">
        <button class="film__remove" data-slug="${esc(e.slug)}" data-src="${esc(e.src || 'kk')}" data-cursor aria-label="Remove">✕</button>
        <div class="film__poster">
          ${e.badge ? `<span class="film__badge">${esc(e.badge)}</span>` : ''}
          ${srcTag}
          ${resume}
          <img src="${esc(e.poster || PLACEHOLDER)}" alt="${esc(e.name)}" loading="lazy"
               onerror="this.onerror=null;this.src='${PLACEHOLDER}'">
          <span class="film__play">▶</span>
        </div>
        <div class="film__info">
          <div class="film__name">${esc(e.name)}</div>
          <div class="film__origin">${esc(e.origin)}${e.year ? ' · ' + esc(e.year) : ''}</div>
        </div>
      </div>`;
  }
  function renderRecent() {
    if (!el.recent) return;
    const h = loadHistory();
    if (!h.length) { el.recent.hidden = true; el.recentRow.innerHTML = ''; return; }
    el.recent.hidden = false;
    el.recentRow.innerHTML = h.map(recentCardHTML).join('');
  }

  // ── Watchlist "Xem sau" ──────────────────────────────────────────────────
  function loadWatch() {
    try { return JSON.parse(localStorage.getItem(WKEY) || '[]'); } catch (e) { return []; }
  }
  let watchSet = new Set(loadWatch().map((x) => keyOf(x.src, x.slug)));

  function renderWatch() {
    if (!el.watch) return;
    const w = loadWatch();
    if (!w.length) { el.watch.hidden = true; el.watchRow.innerHTML = ''; return; }
    el.watch.hidden = false;
    el.watchRow.innerHTML = w.map(recentCardHTML).join('');
  }

  // Đồng bộ trạng thái nút 🔖 trên mọi card đang hiển thị của phim này —
  // so cả slug lẫn nguồn (lưới tìm kiếm gộp có thể chứa card từ nhiều nguồn).
  function syncSaveButtons(slug, src) {
    const on = watchSet.has(keyOf(src, slug));
    document.querySelectorAll('.film__save').forEach((b) => {
      if (b.dataset.slug !== slug || (b.dataset.src || 'kk') !== (src || 'kk')) return;
      b.classList.toggle('on', on);
      b.textContent = on ? '✓' : '＋';
    });
  }

  function toggleWatch(slug, src) {
    const k = keyOf(src, slug);
    let w = loadWatch();
    if (watchSet.has(k)) {
      w = w.filter((x) => keyOf(x.src, x.slug) !== k);
      watchSet.delete(k);
    } else {
      const entry = movieCache.get(k);
      if (!entry) return;
      w.unshift(Object.assign({ ts: Date.now() }, entry));
      w = w.slice(0, WMAX);
      watchSet.add(k);
    }
    try { localStorage.setItem(WKEY, JSON.stringify(w)); } catch (e) {}
    renderWatch();
    syncSaveButtons(slug, src);
  }

  function removeFromWatch(slug, src) {
    const k = keyOf(src, slug);
    const w = loadWatch().filter((x) => keyOf(x.src, x.slug) !== k);
    watchSet.delete(k);
    try { localStorage.setItem(WKEY, JSON.stringify(w)); } catch (e) {}
    renderWatch();
    syncSaveButtons(slug, src);
  }

  // Cập nhật vùng "tải thêm": spinner khi đang tải · gợi ý bấm khi còn phim · "đã hết"
  function updateMore() {
    if (!el.more) return;
    el.more.classList.remove('is-loading', 'is-more', 'is-end');
    const hasItems = !!el.grid.querySelector('.film:not(.film--skel)');
    if (state.loading && state.page > 1) {
      el.more.hidden = false; el.more.classList.add('is-loading');
      el.moreText.textContent = T('Đang tải…', 'Loading…');
    } else if (state.hasMore && hasItems) {
      el.more.hidden = false; el.more.classList.add('is-more');
      el.moreText.textContent = T('Xem thêm', 'Load more');
    } else if (hasItems) {
      el.more.hidden = false; el.more.classList.add('is-end');
      el.moreText.textContent = T('Đã hết phim', 'No more movies');
    } else {
      el.more.hidden = true; el.moreText.textContent = '';
    }
  }

  // Request đang bay — bị hủy khi có tìm kiếm / lọc mới (chống race:
  // response cũ về chậm đè lên kết quả của từ khóa mới).
  let listAbort = null;

  // Tìm kiếm ở chế độ Tự động: hỏi CẢ 3 nguồn cùng lúc rồi gộp một lưới —
  // trộn xen kẽ theo thứ hạng tốc độ (phim liên quan nhất của mỗi nguồn lên đầu),
  // bỏ trùng slug xuyên trang bằng searchSeen (reset khi đổi từ khóa).
  const searchSeen = new Set();
  async function fetchSearchAll(signal) {
    const rs = await Promise.all(srcOrder.map((id) =>
      fetchAPI(SOURCES[id].search(state.keyword, state.page), signal)
        .then((data) => ({ id, data }))
        .catch((err) => { if (signal && signal.aborted) throw err; return null; })
    ));
    const lists = rs.filter(Boolean).map(({ id, data }) => {
      let list = getItems(data);
      if (SOURCES[id].normItem) list = list.map(SOURCES[id].normItem);
      const tp = getTotalPages(data);
      return { id, list, more: tp ? state.page < tp : list.length >= 10 };
    });
    if (!lists.length) throw new Error('search failed on all sources');
    const items = [];
    const max = Math.max.apply(null, lists.map((l) => l.list.length));
    for (let i = 0; i < max; i++) {
      lists.forEach((l) => {
        const m = l.list[i];
        if (!m || !m.slug || searchSeen.has(m.slug)) return;
        searchSeen.add(m.slug);
        m.__src = l.id;
        items.push(m);
      });
    }
    return { data: null, items, from: curSrc, hasMore: lists.some((l) => l.more) };
  }

  // Tải danh sách với auto-failover: nguồn đang dùng lỗi thì lần lượt thử các
  // nguồn còn lại theo thứ hạng tốc độ. Chỉ chạy ở chế độ Tự động và khi tải
  // mới (reset) — "tải thêm" giữa chừng không đổi nguồn kẻo lưới lẫn phim.
  async function fetchList(signal, reset) {
    if (autoMode && state.mode === 'search') {
      if (reset) searchSeen.clear();
      return fetchSearchAll(signal);
    }
    const orig = curSrc;
    const order = reset && autoMode
      ? [curSrc].concat(srcOrder.filter((id) => id !== curSrc))
      : [curSrc];
    let lastErr = null;
    for (let i = 0; i < order.length; i++) {
      curSrc = order[i];
      try {
        const data = await fetchAPI(listURL(), signal);
        let items = getItems(data);
        if (SOURCES[curSrc].normItem) items = items.map(SOURCES[curSrc].normItem);
        return { data, items, from: orig };
      } catch (err) {
        if (signal && signal.aborted) throw err;
        lastErr = err;
      }
    }
    curSrc = orig;
    throw lastErr || new Error('list failed');
  }

  async function loadList(reset) {
    if (state.loading) {
      if (!reset) return;                     // "tải thêm" thì chờ lượt trước
      if (listAbort) listAbort.abort();       // tìm kiếm/lọc mới đè request cũ
    }
    const ctl = 'AbortController' in window ? new AbortController() : null;
    listAbort = ctl;
    state.loading = true;
    el.status.textContent = '';
    if (reset) { state.page = 1; el.grid.innerHTML = skeletonHTML(12); el.more.hidden = true; }
    else updateMore(); // hiện spinner ngay khi bắt đầu tải thêm
    try {
      const res = await fetchList(ctl && ctl.signal, reset);
      const items = res.items;
      clearSkeletons();
      // Auto đã nhảy nguồn → làm mới nhãn + bộ lọc theo nguồn mới, báo người xem biết
      let note = '';
      if (res.from !== curSrc) {
        renderSources();
        loadCats();
        loadCountries();
        note = T(`Nguồn ${SOURCES[res.from].name} lỗi — đã tự chuyển sang ${SOURCES[curSrc].name}.`,
                 `${SOURCES[res.from].name} failed — auto-switched to ${SOURCES[curSrc].name}.`);
      }
      if (reset && !items.length) {
        state.hasMore = false;
        el.status.textContent = T('Không tìm thấy phim nào.', 'No movies found.');
      } else {
        el.grid.insertAdjacentHTML('beforeend', items.map(cardHTML).join(''));
        revealCards();
        el.status.textContent = note;
        if (res.hasMore !== undefined) state.hasMore = res.hasMore; // tìm kiếm gộp: tự tính sẵn
        else {
          const tp = getTotalPages(res.data);
          state.hasMore = tp ? state.page < tp : items.length >= 10;
        }
      }
    } catch (e) {
      if (ctl && ctl.signal.aborted) return;  // đã có request mới thay thế → không đụng UI
      clearSkeletons();
      state.hasMore = false;
      el.status.textContent = T('Lỗi tải dữ liệu. Thử lại sau.', 'Failed to load. Try again later.');
      console.error(e);
    } finally {
      if (listAbort === ctl) {                // chỉ request mới nhất được chốt trạng thái
        state.loading = false;
        updateMore();
      }
    }
  }

  // Infinite scroll: tự tải thêm khi vùng cuối lọt vào tầm nhìn (vẫn bấm được làm fallback)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.hasMore && !state.loading) { state.page++; loadList(false); }
    }, { rootMargin: '500px' });
    io.observe(el.more);
  }

  // ── Filters (thể loại / quốc gia) ─────────────────────────────────────────
  const CATS_DEFAULT = '<span data-vi>Mới nhất</span><span data-en>Latest</span>';
  const CNT_DEFAULT = '<span data-vi>Tất cả</span><span data-en>All</span>';
  function resetCatsVal() { if (el.catsVal) el.catsVal.innerHTML = CATS_DEFAULT; }
  function resetCntVal() { if (el.cntVal) el.cntVal.innerHTML = CNT_DEFAULT; }
  function activateChip(container, slug) {
    if (!container) return;
    container.querySelectorAll('.cat-chip').forEach((c) => c.classList.toggle('active', c.dataset.slug === slug));
  }
  // Reset hiển thị 2 dropdown về mặc định (dùng khi tìm kiếm)
  function resetFilters() {
    activateChip(el.cats, ''); activateChip(el.countries, '');
    resetCatsVal(); resetCntVal();
  }
  function closeAllDD() {
    document.querySelectorAll('.phim-dd.open').forEach((d) => {
      d.classList.remove('open');
      const b = d.querySelector('.phim-dd__btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  async function loadCats() {
    try {
      const s = SOURCES[curSrc];
      let cats = s.cats;
      if (!cats) {
        const data = await fetchAPI(s.catsURL);
        cats = Array.isArray(data) ? data : (data.data && data.data.items) || [];
      }
      // Bỏ thể loại 18+
      cats = cats.filter((c) => c.slug !== 'phim-18' && !/18\+?/.test(c.name || ''));
      el.cats.innerHTML =
        `<button class="cat-chip active" data-slug=""><span data-vi>Mới nhất</span><span data-en>Latest</span></button>` +
        cats.slice(0, 14).map((c) => `<button class="cat-chip" data-slug="${c.slug}">${c.name}</button>`).join('');
      el.cats.querySelectorAll('.cat-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const slug = chip.dataset.slug;
          if (!slug) { state.mode = 'latest'; resetCatsVal(); }
          else { state.mode = 'category'; state.category = slug; el.catsVal.textContent = chip.textContent.trim(); }
          state.country = ''; state.keyword = ''; el.searchInput.value = '';
          activateChip(el.cats, slug);
          activateChip(el.countries, ''); resetCntVal();   // quốc gia về "Tất cả"
          closeAllDD();
          loadList(true);
        });
      });
    } catch (e) { console.error('cats', e); }
  }

  async function loadCountries() {
    if (!el.countries) return;
    try {
      const s = SOURCES[curSrc];
      let list = s.countries;
      if (!list) {
        const data = await fetchAPI(s.countriesURL);
        list = Array.isArray(data) ? data : (data.data && data.data.items) || [];
      }
      el.countries.innerHTML =
        `<button class="cat-chip active" data-slug=""><span data-vi>Tất cả</span><span data-en>All</span></button>` +
        list.slice(0, 16).map((c) => `<button class="cat-chip" data-slug="${c.slug}">${c.name}</button>`).join('');
      el.countries.querySelectorAll('.cat-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const slug = chip.dataset.slug;
          if (!slug) { state.mode = 'latest'; resetCntVal(); }
          else { state.mode = 'country'; state.country = slug; el.cntVal.textContent = chip.textContent.trim(); }
          state.category = ''; state.keyword = ''; el.searchInput.value = '';
          activateChip(el.countries, slug);
          activateChip(el.cats, ''); resetCatsVal();        // thể loại về "Mới nhất"
          closeAllDD();
          loadList(true);
        });
      });
    } catch (e) { console.error('countries', e); }
  }

  // ── Chọn nguồn phim ──────────────────────────────────────────────────────
  // "Tự động" (mặc định): trang tự lo — nguồn nào lỗi thì tự nhảy nguồn khác.
  // Chọn tay = khóa vào đúng nguồn đó. Đổi nguồn = về "Mới nhất" của nguồn mới
  // + nạp lại thể loại/quốc gia (slug lọc của nguồn này chưa chắc có bên kia).
  function renderSources() {
    const box = document.getElementById('phim-sources');
    const val = document.getElementById('dd-src-val');
    if (!box) return;
    if (val) val.textContent = autoMode
      ? T('Tự động', 'Auto') + ' · ' + SOURCES[curSrc].name
      : SOURCES[curSrc].name;
    box.innerHTML =
      `<button class="cat-chip ${autoMode ? 'active' : ''}" data-slug="auto"><span data-vi>Tự động</span><span data-en>Auto</span></button>` +
      Object.keys(SOURCES).map((id) =>
        `<button class="cat-chip ${!autoMode && id === curSrc ? 'active' : ''}" data-slug="${id}">${SOURCES[id].name}</button>`).join('');
    box.querySelectorAll('.cat-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.slug;
        closeAllDD();
        const wasSrc = curSrc;
        if (id === 'auto') { if (autoMode) return; autoMode = true; }
        else { if (!autoMode && id === curSrc) return; autoMode = false; curSrc = id; }
        try { localStorage.setItem(SRC_KEY, autoMode ? 'auto' : curSrc); } catch (e) {}
        renderSources();
        // Bật/tắt auto mà nguồn thực tế không đổi thì khỏi tải lại gì
        if (curSrc === wasSrc) return;
        state.mode = 'latest'; state.keyword = ''; state.category = ''; state.country = '';
        el.searchInput.value = '';
        resetFilters();
        loadCats();
        loadCountries();
        loadList(true);
      });
    });
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
  const START_MS = 20000; // không phát được trong 20s sau khi mở → coi như server lỗi → đổi server

  let hls = null;
  let stallTimer = null;
  let startTimer = null;    // watchdog khởi động: chống quay vòng vô tận khi server đứng hình
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
    if (startTimer) { clearTimeout(startTimer); startTimer = null; }
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

  // Gắn spinner + theo dõi khựng + tự chuyển tập khi hết.
  // resumeT: tua lại vị trí xem dở · onTime: báo vị trí đang xem (để lưu tiến độ)
  function bindVideo(video, fail, onEnded, resumeT, onTime) {
    setSpinner(true);
    // Watchdog khởi động: nếu chưa phát được sau START_MS thì đổi server,
    // tránh trường hợp server đứng hình → spinner quay vô tận mà không báo lỗi.
    if (startTimer) clearTimeout(startTimer);
    startTimer = setTimeout(() => {
      if (video.readyState < 3) fail('start-timeout');
    }, START_MS);
    const started = () => {
      if (startTimer) { clearTimeout(startTimer); startTimer = null; }
      setSpinner(false);
    };
    video.addEventListener('waiting', () => setSpinner(true));
    video.addEventListener('playing', started);
    video.addEventListener('canplay', started);
    video.addEventListener('ended', () => onEnded && onEnded());
    if (resumeT > 3) {
      video.addEventListener('loadedmetadata', () => {
        // lùi 3s cho dễ bắt nhịp; gần cuối tập thì thôi không tua
        if (!isFinite(video.duration) || resumeT < video.duration - 10) {
          video.currentTime = Math.max(0, resumeT - 3);
        }
      }, { once: true });
    }
    let lastSave = 0;
    video.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (onTime && now - lastSave > 5000) { lastSave = now; onTime(video.currentTime); }
    });
    watchStall(video, fail);
    activeVideo = video;
  }

  // onFail(reason): nguồn này không phát được → fallback server. onEnded: hết tập → tập sau
  function playEpisode(ep, onFail, onEnded, resumeT, onTime) {
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
      bindVideo(video, fail, onEnded, resumeT, onTime);
    } else if (ep.link_m3u8 && document.createElement('video').canPlayType('application/vnd.apple.mpegurl')) {
      wrap.innerHTML = '<video id="fm-video" controls autoplay playsinline></video>';
      const video = document.getElementById('fm-video');
      video.src = ep.link_m3u8;
      video.addEventListener('error', () => fail('native'));
      bindVideo(video, fail, onEnded, resumeT, onTime);
    } else if (ep.link_embed) {
      // sandbox chặn popup/redirect bậy từ server embed ngoài
      wrap.innerHTML = `<iframe src="${esc(ep.link_embed)}" allowfullscreen allow="autoplay; encrypted-media"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"></iframe>`;
    } else {
      wrap.innerHTML = `<div class="fm-player__empty">${T('Không có nguồn phát', 'No source')}</div>`;
    }
  }

  function showToast(msg) {
    const wrap = document.getElementById('fm-player');
    if (!wrap) return;
    const old = wrap.querySelector('.fm-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.className = 'fm-toast';
    toast.textContent = msg;
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
  const showFallbackToast = (name) =>
    showToast(T('Server lỗi, đang chuyển sang ', 'Server failed, switching to ') + name + '…');

  // Copy link "xem chung" — clipboard API, fallback textarea cho trình duyệt cũ
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true, () => copyTextFallback(text));
    }
    return Promise.resolve(copyTextFallback(text));
  }
  function copyTextFallback(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  function toggleFullscreen() {
    const wrap = document.getElementById('fm-player');
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (wrap && wrap.requestFullscreen) wrap.requestFullscreen();
    else if (activeVideo && activeVideo.webkitEnterFullscreen) activeVideo.webkitEnterFullscreen();
  }

  // ── Episodes ───────────────────────────────────────────────────────────
  const RANGE = 50; // gom tập theo dải khi danh sách quá dài
  // Nguồn đã dùng cho phim đang mở — chống nhảy vòng quanh khi nguồn nào cũng lỗi
  let srcTried = new Set();

  function renderEpisodes(movie, episodes, slug, src) {
    srcTried.add(src);
    let srvIdx = 0, epIdx = 0, rangeStart = 0;
    let resumeT = 0;           // giây xem dở của tập hiện tại (0 = xem từ đầu)
    const tried = new Set();   // server đã thử trong lượt fallback hiện tại
    const pk = keyOf(src, slug); // khóa tiến độ — kèm nguồn để slug không đụng nhau
    const box = document.getElementById('fm-eplist');
    const srvBox = document.getElementById('fm-servers');
    const rangeBox = document.getElementById('fm-ranges');
    if (!box) return;

    // Khôi phục tập + phút đang xem dở (nếu có)
    const saved = loadProgress(pk);
    if (saved) {
      if (episodes[saved.s]) srvIdx = saved.s;
      if (((episodes[srvIdx] || {}).server_data || [])[saved.e]) {
        epIdx = saved.e;
        resumeT = saved.t || 0;
      }
    }

    // Link "xem chung" (?tap=&t=) đè lên tiến độ đã lưu — cả bang mở cùng một chỗ
    if (deepLink) {
      const wantEp = deepLink.ep;
      if (wantEp >= 0) {
        if (!((episodes[srvIdx] || {}).server_data || [])[wantEp]) {
          for (let i = 0; i < episodes.length; i++) {
            if (((episodes[i] || {}).server_data || [])[wantEp]) { srvIdx = i; break; }
          }
        }
        if (((episodes[srvIdx] || {}).server_data || [])[wantEp]) epIdx = wantEp;
      }
      resumeT = deepLink.t || 0;
      deepLink = null;
    }

    function saveProgress(t) {
      try {
        const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
        all[pk] = { s: srvIdx, e: epIdx, t: Math.floor(t || 0) };
        localStorage.setItem(PKEY, JSON.stringify(all));
      } catch (e) {}
    }

    function nextEp() {
      const eps = (episodes[srvIdx] || {}).server_data || [];
      if (epIdx < eps.length - 1) { epIdx++; resumeT = 0; play(true); }
    }

    function draw() {
      const eps = (episodes[srvIdx] || {}).server_data || [];

      // Servers — đổi server giữ nguyên tập + phút đang xem (nếu server đó có tập này)
      srvBox.innerHTML = episodes.map((s, i) =>
        `<button class="fm-server ${i === srvIdx ? 'active' : ''}" data-i="${i}">${esc(s.server_name || 'Server ' + (i + 1))}</button>`).join('');
      srvBox.querySelectorAll('.fm-server').forEach((b) =>
        b.addEventListener('click', () => {
          srvIdx = +b.dataset.i;
          if (!((episodes[srvIdx] || {}).server_data || [])[epIdx]) { epIdx = 0; resumeT = 0; }
          else if (activeVideo && activeVideo.currentTime > 3) resumeT = activeVideo.currentTime;
          play(true);
        }));

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
        epHtml += `<button class="fm-ep ${i === epIdx ? 'active' : ''}" data-i="${i}">${esc(eps[i].name || (i + 1))}</button>`;
      box.innerHTML = epHtml;
      box.querySelectorAll('.fm-ep').forEach((b) =>
        b.addEventListener('click', () => { epIdx = +b.dataset.i; resumeT = 0; play(true); }));

      // Thanh "đang xem" + nút tập sau + nút rủ xem chung
      const bar = document.getElementById('fm-bar');
      const now = document.getElementById('fm-now');
      const nextBtn = document.getElementById('fm-next');
      const curEp = eps[epIdx];
      if (bar && now && curEp) {
        bar.hidden = false;
        now.textContent = T('Đang xem: ', 'Watching: ') + (curEp.name || epIdx + 1) +
          ' · ' + (episodes[srvIdx].server_name || 'Server ' + (srvIdx + 1)) +
          (resumeT > 60 ? ' · ' + T('xem tiếp từ ', 'resumed from ') + fmtTime(resumeT) : '');
        const hasNext = epIdx < eps.length - 1;
        nextBtn.hidden = !hasNext;
        nextBtn.onclick = nextEp;
      }
      // Rủ xem chung: copy link mở đúng phim + tập + thời điểm hiện tại → dán vào Discord
      const shareBtn = document.getElementById('fm-share');
      if (shareBtn) {
        shareBtn.onclick = () => {
          const t = Math.floor(activeVideo ? activeVideo.currentTime : resumeT || 0);
          let link = location.origin + location.pathname +
            '?phim=' + encodeURIComponent(slug) +
            (src && src !== 'kk' ? '&src=' + src : '') + '&tap=' + (epIdx + 1);
          if (t > 5) link += '&t=' + t;
          copyText(link).then((ok) => showToast(ok
            ? T('Đã copy link — dán vào Discord cho anh em cùng xem!', 'Link copied — paste it in Discord!')
            : link));
        };
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
      // Mang theo vị trí đang xem sang server mới, khỏi xem lại từ đầu
      if (activeVideo && activeVideo.currentTime > 3) resumeT = activeVideo.currentTime;
      const next = nextServer();
      if (next < 0) {
        // Hết server trong nguồn này → tự dò cùng phim ở nguồn khác trước khi bó tay
        crossSourceFallback();
        return;
      }
      srvIdx = next;
      showFallbackToast(episodes[srvIdx].server_name || 'Server ' + (srvIdx + 1));
      play(false);
    }

    // Mọi server của nguồn hiện tại đều lỗi → tìm đúng phim này (cùng slug) ở
    // nguồn khác, mang theo tập + phút đang xem. Không đâu có mới báo hết cách.
    async function crossSourceFallback() {
      const wrap = document.getElementById('fm-player');
      if (wrap) wrap.innerHTML =
        `<div class="fm-player__empty">${T('Đang dò nguồn khác…', 'Trying other sources…')}</div>`;
      const ids = srcOrder;
      for (let i = 0; i < ids.length; i++) {
        if (srcTried.has(ids[i])) continue;
        srcTried.add(ids[i]);
        try {
          const d = await fetchAPI(SOURCES[ids[i]].detail(slug));
          const p = SOURCES[ids[i]].parseDetail(d);
          if (!(p.episodes || []).length) continue;
          // Ghi tiến độ sang khóa của nguồn mới để mở lại đúng tập + phút đang xem
          try {
            const all = JSON.parse(localStorage.getItem(PKEY) || '{}');
            all[keyOf(ids[i], slug)] = { s: 0, e: epIdx, t: Math.floor(resumeT || 0) };
            localStorage.setItem(PKEY, JSON.stringify(all));
          } catch (e) {}
          renderEpisodes(p.movie, p.episodes, slug, ids[i]);
          showToast(T('Đã tự chuyển sang nguồn ', 'Auto-switched to source ') + SOURCES[ids[i]].name);
          return;
        } catch (e) {}
      }
      if (wrap) wrap.innerHTML =
        `<div class="fm-player__empty">${T('Mọi server đều lỗi, thử tập hoặc phim khác.', 'All servers failed, try another episode or movie.')}</div>`;
    }

    // reset=true khi người dùng tự chọn server/tập (bắt đầu chuỗi fallback mới)
    function play(reset) {
      if (reset) tried.clear();
      tried.add(srvIdx);
      const eps = (episodes[srvIdx] || {}).server_data || [];
      rangeStart = eps.length > RANGE ? Math.floor(epIdx / RANGE) * RANGE : 0;
      draw();
      saveProgress(resumeT);
      playEpisode(eps[epIdx], fallback, nextEp, resumeT, saveProgress);
      if (resumeT > 60) showToast('⏵ ' + T('Xem tiếp từ ', 'Resuming from ') + fmtTime(resumeT));
    }

    goNextEp = nextEp;
    play(true);
  }

  // ── Modal ──────────────────────────────────────────────────────────────
  // Link "xem chung": ?phim=&tap=&t= → nhảy thẳng tới tập + giây này (dùng một lần)
  let deepLink = null;
  let modalHistoryActive = false;
  let modalFromURL = false; // mở từ deep-link → đóng bằng replaceState, không back()

  async function openMovie(slug, fromURL, src) {
    src = SOURCES[src] ? src : curSrc;
    const S = SOURCES[src];
    // Deep-link: đưa slug (+ nguồn) lên URL để copy link gửi thẳng cho người khác
    const url = location.pathname + '?phim=' + encodeURIComponent(slug) +
      (src !== 'kk' ? '&src=' + src : '');
    if (!modalHistoryActive) {
      try {
        if (fromURL) history.replaceState({ filmModal: true }, '', url);
        else history.pushState({ filmModal: true }, '', url);
      } catch (e) {}
      modalHistoryActive = true;
      modalFromURL = !!fromURL;
    }
    el.modal.classList.add('open');
    el.modal.setAttribute('aria-hidden', 'false');
    el.content.innerHTML = `<div class="phim-status">${T('Đang tải phim...', 'Loading...')}</div>`;
    document.body.style.overflow = 'hidden';
    if (window.lenis) window.lenis.stop();
    el.close.focus();
    try {
      // Nguồn được yêu cầu lỗi / không có phim này → tự dò các nguồn còn lại
      // (slug phần lớn trùng nhau giữa các nguồn vì cùng gốc dữ liệu)
      const wantSrc = src;
      let parsed = null;
      try {
        const d = await fetchAPI(S.detail(slug));
        parsed = S.parseDetail(d);
      } catch (err) { /* thử nguồn khác bên dưới */ }
      if (!parsed || !(parsed.movie && parsed.movie.name) || !(parsed.episodes || []).length) {
        for (let i = 0, ids = srcOrder; i < ids.length; i++) {
          if (ids[i] === wantSrc) continue;
          try {
            const d2 = await fetchAPI(SOURCES[ids[i]].detail(slug));
            const p2 = SOURCES[ids[i]].parseDetail(d2);
            if (p2.movie && p2.movie.name && (p2.episodes || []).length) { parsed = p2; src = ids[i]; break; }
          } catch (e2) {}
        }
      }
      if (!parsed || !parsed.movie || !parsed.movie.name) throw new Error('not found on any source');
      const movie = parsed.movie;
      const episodes = parsed.episodes || [];
      el.content.innerHTML = `
        <div class="fm-player" id="fm-player"><div class="fm-player__empty">${T('Chọn tập để xem', 'Pick an episode')}</div></div>
        <div class="fm-body">
          <h2 class="fm-title">${esc(movie.name)}</h2>
          <div class="fm-meta">
            <span>${esc(movie.origin_name)}</span>
            ${movie.year ? `<span>${esc(movie.year)}</span>` : ''}
            ${movie.time ? `<span>${esc(movie.time)}</span>` : ''}
            ${movie.quality ? `<span>${esc(movie.quality)}</span>` : ''}
            ${movie.episode_current ? `<span>${esc(movie.episode_current)}</span>` : ''}
          </div>
          <p class="fm-desc">${esc((movie.content || '').replace(/<[^>]*>/g, ''))}</p>
          <div class="fm-bar" id="fm-bar" hidden>
            <span class="fm-now" id="fm-now"></span>
            <span class="fm-bar__btns">
              <button class="fm-share" id="fm-share" data-cursor
                title="${T('Copy link mở đúng tập + thời điểm này', 'Copy link to this episode + timestamp')}">🔗 ${T('Rủ xem chung', 'Watch together')}</button>
              <button class="fm-next" id="fm-next" data-cursor hidden>${T('Tập sau', 'Next')} ›</button>
            </span>
          </div>
          <div class="fm-servers" id="fm-servers"></div>
          <div class="fm-ranges" id="fm-ranges" hidden></div>
          <div class="fm-eps" id="fm-eplist"></div>
        </div>`;
      if (episodes.length) {
        srcTried = new Set();   // phim mới → làm lại danh sách nguồn đã thử
        renderEpisodes(movie, episodes, movie.slug || slug, src);
        addToHistory(movie, movie.slug || slug, src);
        if (src !== wantSrc) {
          showToast(T('Nguồn cũ không có phim này — đã tự chuyển sang ', 'Auto-switched to source ') + SOURCES[src].name);
        }
      }
    } catch (e) {
      el.content.innerHTML = `<div class="phim-status">${T('Lỗi tải phim.', 'Failed to load movie.')}</div>`;
      console.error(e);
    }
  }

  function doClose() {
    destroyPlayer();
    goNextEp = null;
    renderRecent(); // làm mới badge "⏵ xem tiếp từ …" với phút vừa xem
    renderWatch();
    el.modal.classList.remove('open', 'theater');
    el.modal.setAttribute('aria-hidden', 'true');
    el.content.innerHTML = '';
    document.body.style.overflow = '';
    if (window.lenis) window.lenis.start();
  }

  function closeModal() {
    if (modalHistoryActive) {
      modalHistoryActive = false;
      if (modalFromURL) {
        // Vào bằng deep-link: back() sẽ rời trang, nên chỉ dọn URL tại chỗ
        modalFromURL = false;
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      } else {
        history.back();
      }
    }
    doClose();
  }

  window.addEventListener('popstate', () => {
    modalHistoryActive = false;
    if (el.modal.classList.contains('open')) doClose();
  });

  // ── Bind ─────────────────────────────────────────────────────────────────
  el.grid.addEventListener('click', (e) => {
    const save = e.target.closest('.film__save');
    if (save) { e.stopPropagation(); toggleWatch(save.dataset.slug, save.dataset.src); return; }
    const card = e.target.closest('.film');
    if (card && !card.classList.contains('film--skel')) openMovie(card.dataset.slug, false, card.dataset.src);
  });
  // Mở phim bằng bàn phím (Enter / Space trên card đang focus)
  const cardKeyOpen = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.film');
    if (card && !card.classList.contains('film--skel')) { e.preventDefault(); openMovie(card.dataset.slug, false, card.dataset.src); }
  };
  el.grid.addEventListener('keydown', cardKeyOpen);
  if (el.recentRow) el.recentRow.addEventListener('keydown', cardKeyOpen);
  el.more.addEventListener('click', () => { if (state.hasMore && !state.loading) { state.page++; loadList(false); } });

  el.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const kw = el.searchInput.value.trim();
    if (!kw) { state.mode = 'latest'; }
    else { state.mode = 'search'; state.keyword = kw; }
    state.category = ''; state.country = '';
    resetFilters();
    loadList(true);
  });

  // Tìm kiếm trực tiếp khi gõ (debounce)
  let searchTimer = null;
  el.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const kw = el.searchInput.value.trim();
      if (!kw) { if (state.mode === 'search') { state.mode = 'latest'; resetFilters(); loadList(true); } return; }
      state.mode = 'search'; state.keyword = kw;
      state.category = ''; state.country = '';
      resetFilters();
      loadList(true);
    }, 450);
  });

  // Hàng "Vừa xem": bấm card để mở lại, bấm ✕ để xóa khỏi lịch sử
  if (el.recentRow) {
    el.recentRow.addEventListener('click', (e) => {
      const rm = e.target.closest('.film__remove');
      if (rm) { e.stopPropagation(); removeFromHistory(rm.dataset.slug, rm.dataset.src); return; }
      const card = e.target.closest('.film--recent');
      if (card) openMovie(card.dataset.slug, false, card.dataset.src);
    });
  }
  if (el.recentClear) el.recentClear.addEventListener('click', () => {
    try { localStorage.removeItem(HKEY); } catch (e) {}
    renderRecent();
  });

  // Hàng "Xem sau": bấm card để mở, ✕ để bỏ khỏi danh sách
  if (el.watchRow) {
    el.watchRow.addEventListener('click', (e) => {
      const rm = e.target.closest('.film__remove');
      if (rm) { e.stopPropagation(); removeFromWatch(rm.dataset.slug, rm.dataset.src); return; }
      const card = e.target.closest('.film--recent');
      if (card) openMovie(card.dataset.slug, false, card.dataset.src);
    });
    el.watchRow.addEventListener('keydown', cardKeyOpen);
  }
  if (el.watchClear) el.watchClear.addEventListener('click', () => {
    try { localStorage.removeItem(WKEY); } catch (e) {}
    watchSet = new Set();
    renderWatch();
    document.querySelectorAll('.film__save.on').forEach((b) => { b.classList.remove('on'); b.textContent = '＋'; });
  });

  // "Hôm nay xem gì?": bốc ngẫu nhiên một phim từ kho mới cập nhật
  const RANDOM_PAGES = 50; // bốc trong ~50 trang mới nhất (~1200 phim gần đây)
  let rolling = false;
  if (el.random) el.random.addEventListener('click', async () => {
    if (rolling) return;
    rolling = true;
    el.random.classList.add('rolling');
    try {
      const src = SOURCES[curSrc];
      const page = 1 + Math.floor(Math.random() * RANDOM_PAGES);
      const data = await fetchAPI(src.latest(page));
      let items = getItems(data);
      if (src.normItem) items = items.map(src.normItem);
      if (items.length) {
        const pick = items[Math.floor(Math.random() * items.length)];
        movieCache.set(keyOf(curSrc, pick.slug), entryOf(pick));
        await new Promise((r) => setTimeout(r, 500)); // nhịp "lắc xúc xắc" ngắn
        openMovie(pick.slug);
      } else {
        el.status.textContent = T('Xui quá, thử lại nhé!', 'Bad luck, try again!');
      }
    } catch (e) {
      el.status.textContent = T('Lỗi tải dữ liệu. Thử lại sau.', 'Failed to load. Try again later.');
    } finally {
      rolling = false;
      el.random.classList.remove('rolling');
    }
  });

  // Dropdown lọc: bấm để xổ, click ra ngoài / Escape để đóng
  [el.srcBtn, el.catsBtn, el.cntBtn].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parent = btn.closest('.phim-dd');
      const isOpen = parent.classList.contains('open');
      closeAllDD();
      if (!isOpen) { parent.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.phim-dd')) closeAllDD(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDD(); });

  el.close.addEventListener('click', closeModal);
  el.backdrop.addEventListener('click', closeModal);

  // Chế độ rạp: làm tối mọi thứ quanh player (phím T)
  const toggleTheater = () => el.modal.classList.toggle('theater');
  if (el.theater) el.theater.addEventListener('click', toggleTheater);

  // Phím tắt khi đang xem
  document.addEventListener('keydown', (e) => {
    if (!el.modal.classList.contains('open')) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    // Chế độ rạp bật/tắt được cả khi chưa phát video
    if (e.key === 't' || e.key === 'T') { toggleTheater(); return; }
    const v = activeVideo;
    if (!v) return;
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
      case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10); break;
      case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'n': case 'N': if (goNextEp) goNextEp(); break;
    }
  });

  // ── Init ─────────────────────────────────────────────────────────────────
  renderSources();
  renderWatch();
  renderRecent();
  (async () => {
    if (autoMode) {
      // Skeleton hiện ngay trong lúc đua ping (nguồn nào trả lời trước dùng nguồn đó)
      el.grid.innerHTML = skeletonHTML(12);
      await pickFastestSource();
      renderSources();   // cập nhật nhãn "Tự động · <nguồn thắng>"
    }
    loadCats();
    loadCountries();
    loadList(true);
  })();

  // Deep-link: mở thẳng phim nếu URL có ?phim=<slug> (&src=<nguồn> nếu khác mặc định)
  // Kèm ?tap=<số tập>&t=<giây> (link "xem chung") thì nhảy đúng tập + thời điểm đó
  const qs = new URLSearchParams(location.search);
  const startSlug = qs.get('phim');
  if (startSlug) {
    const tap = parseInt(qs.get('tap'), 10);
    const t = parseInt(qs.get('t'), 10);
    if (tap > 0 || t > 0) deepLink = { ep: tap > 0 ? tap - 1 : -1, t: t > 0 ? t : 0 };
    openMovie(startSlug, true, qs.get('src'));
  }
})();
