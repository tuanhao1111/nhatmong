/**
 * movies.js - Trang "Bún Bò on Air" (xem phim cho bang)
 *
 * - Phim được load từ phimapi.com (không tự host)
 * - Favorites & History:
 *     · Guest    → localStorage (không sync)
 *     · Member   → Firestore /users/{uid}/movies/data + localStorage cache
 *     · Admin    → giống Member
 *
 * Page lifecycle:
 *   renderMoviesPage()  → trả về HTML string (gọi từ app.js)
 *   initMoviesPage()    → bind events, fetch data (gọi sau khi HTML đã render)
 */

// Wrap toàn bộ logic vào 1 namespace để không leak globals
window.MoviesHub = (function(){
  'use strict';

  'use strict';

  // ========== CONFIG ==========
  const API = 'https://phimapi.com';
  const STORAGE_KEY = 'nthBangHoi_movies';
  
  let state = {
    currentTab: 'latest',
    currentPage: 1,
    currentCategory: '',
    currentCountry: '',
    searchKeyword: '',
    currentMovie: null,
    currentServer: 0,
    currentEpisode: 0,
    categories: [],
    countries: [],
    favorites: loadStorage('favorites'),
    history: loadStorage('history')
  };

  // ========== STORAGE ==========
  function loadStorage(key) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return all[key] || [];
    } catch (e) { return []; }
  }

  function saveStorage(key, value) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      all[key] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) { console.warn('Storage failed:', e); }
  }

  // ========== API CALLS ==========
  async function fetchAPI(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network error');
      return await res.json();
    } catch (e) {
      console.error('API error:', e);
      return null;
    }
  }

  async function loadCategories() {
    let data = state.categories;
    if (!data || !data.length) {
      data = await fetchAPI(`${API}/the-loai`);
      if (Array.isArray(data)) state.categories = data;
    }
    if (Array.isArray(data)) {
      const sel = document.getElementById('categorySelect');
      if (!sel) return;
      data.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.slug;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    }
  }

  async function loadCountries() {
    let data = state.countries;
    if (!data || !data.length) {
      data = await fetchAPI(`${API}/quoc-gia`);
      if (Array.isArray(data)) state.countries = data;
    }
    if (Array.isArray(data)) {
      const sel = document.getElementById('countrySelect');
      if (!sel) return;
      data.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.slug;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
    }
  }

  async function loadMovies() {
    const container = document.getElementById('movieContainer');
    container.innerHTML = `<div class="loading-state">
      <div class="loading-symbol">☯</div>
      <div class="loading-text">Đang triệu hồi phim ảnh...</div>
    </div>`;

    let url, data, movies = [], totalPages = 1;

    // Local tabs
    if (state.currentTab === 'favorites') {
      renderMovies(state.favorites);
      document.getElementById('paginationContainer').innerHTML = '';
      return;
    }
    if (state.currentTab === 'history') {
      renderMovies(state.history);
      document.getElementById('paginationContainer').innerHTML = '';
      return;
    }

    // Search
    if (state.searchKeyword) {
      url = `${API}/v1/api/tim-kiem?keyword=${encodeURIComponent(state.searchKeyword)}&page=${state.currentPage}`;
      data = await fetchAPI(url);
      if (data?.data?.items) {
        movies = data.data.items;
        totalPages = data.data.params?.pagination?.totalPages || 1;
      }
    }
    // Filter by category
    else if (state.currentCategory) {
      url = `${API}/v1/api/the-loai/${state.currentCategory}?page=${state.currentPage}`;
      if (state.currentCountry) url += `&country=${state.currentCountry}`;
      data = await fetchAPI(url);
      if (data?.data?.items) {
        movies = data.data.items;
        totalPages = data.data.params?.pagination?.totalPages || 1;
      }
    }
    // Filter by country
    else if (state.currentCountry) {
      url = `${API}/v1/api/quoc-gia/${state.currentCountry}?page=${state.currentPage}`;
      data = await fetchAPI(url);
      if (data?.data?.items) {
        movies = data.data.items;
        totalPages = data.data.params?.pagination?.totalPages || 1;
      }
    }
    // Tabs
    else if (state.currentTab === 'latest') {
      url = `${API}/danh-sach/phim-moi-cap-nhat-v3?page=${state.currentPage}`;
      data = await fetchAPI(url);
      if (data?.items) {
        movies = data.items;
        totalPages = data.pagination?.totalPages || 1;
      }
    }
    else {
      url = `${API}/v1/api/danh-sach/${state.currentTab}?page=${state.currentPage}`;
      data = await fetchAPI(url);
      if (data?.data?.items) {
        movies = data.data.items;
        totalPages = data.data.params?.pagination?.totalPages || 1;
      }
    }

    renderMovies(movies);
    renderPagination(totalPages);
  }

  // ========== RENDER ==========
  function renderMovies(movies) {
    const container = document.getElementById('movieContainer');
    if (!movies || movies.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-symbol">⌘</div>
        <div class="empty-text">Không tìm thấy phim phù hợp</div>
      </div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'movie-grid';

    movies.forEach(m => {
      const card = document.createElement('div');
      card.className = 'movie-card';
      
      let posterUrl = m.poster_url || m.thumb_url || '';
      if (posterUrl && !posterUrl.startsWith('http')) {
        posterUrl = `https://phimimg.com/${posterUrl}`;
      }

      const quality = m.quality || 'HD';
      const lang = m.lang || 'Vietsub';
      const year = m.year || '';
      const epCurrent = m.episode_current || '';

      card.innerHTML = `
        <div class="movie-badges">
          <span class="badge badge-quality">${quality}</span>
          <span class="badge">${lang}</span>
        </div>
        <img class="movie-poster" src="${posterUrl}" alt="${m.name}" 
             onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 300%22><rect fill=%22%231f1a16%22 width=%22200%22 height=%22300%22/><text x=%22100%22 y=%22150%22 fill=%22%23c9a961%22 font-size=%2240%22 text-anchor=%22middle%22>影</text></svg>'">
        <div class="movie-overlay"></div>
        <div class="movie-info">
          <div class="movie-title">${m.name}</div>
          <div class="movie-origin">${m.origin_name || ''}</div>
          <div class="movie-meta">
            <span>${year}</span>
            <span>${epCurrent}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => openMovie(m.slug));
      grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
  }

  function renderPagination(totalPages) {
    const container = document.getElementById('paginationContainer');
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    const cur = state.currentPage;
    const max = Math.min(totalPages, 999);
    let html = '';

    html += `<button class="page-btn" ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">‹</button>`;

    let start = Math.max(1, cur - 2);
    let end = Math.min(max, cur + 2);
    if (start > 1) {
      html += `<button class="page-btn" data-page="1">1</button>`;
      if (start > 2) html += `<span class="page-btn" style="border:none;background:none">…</span>`;
    }
    for (let i = start; i <= end; i++) {
      html += `<button class="page-btn ${i === cur ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    if (end < max) {
      if (end < max - 1) html += `<span class="page-btn" style="border:none;background:none">…</span>`;
      html += `<button class="page-btn" data-page="${max}">${max}</button>`;
    }

    html += `<button class="page-btn" ${cur === max ? 'disabled' : ''} data-page="${cur + 1}">›</button>`;
    container.innerHTML = html;

    container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentPage = parseInt(btn.dataset.page);
        loadMovies();
        document.getElementById('movieHub').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  // ========== MOVIE DETAIL ==========
  async function openMovie(slug) {
    const modal = document.getElementById('movieModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    document.getElementById('modalInfo').innerHTML = `<div class="loading-state">
      <div class="loading-symbol">☯</div>
      <div class="loading-text">Đang tải thông tin...</div>
    </div>`;

    const data = await fetchAPI(`${API}/phim/${slug}`);
    if (!data || !data.movie) {
      document.getElementById('modalInfo').innerHTML = `<div class="empty-state">
        <div class="empty-symbol">⚠</div>
        <div class="empty-text">Không thể tải phim này</div>
      </div>`;
      return;
    }

    state.currentMovie = data;
    state.currentServer = 0;
    state.currentEpisode = 0;

    // Save to history
    const movie = data.movie;
    const histItem = {
      slug: movie.slug,
      name: movie.name,
      origin_name: movie.origin_name,
      poster_url: movie.poster_url,
      thumb_url: movie.thumb_url,
      year: movie.year,
      quality: movie.quality,
      lang: movie.lang,
      episode_current: movie.episode_current
    };
    state.history = [histItem, ...state.history.filter(h => h.slug !== movie.slug)].slice(0, 50);
    saveStorage('history', state.history);

    renderMovieDetail(data);
  }

  function renderMovieDetail(data) {
    const movie = data.movie;
    const episodes = data.episodes || [];
    const isFav = state.favorites.some(f => f.slug === movie.slug);

    let posterUrl = movie.poster_url || movie.thumb_url || '';
    if (posterUrl && !posterUrl.startsWith('http')) posterUrl = `https://phimimg.com/${posterUrl}`;

    const categoryTags = (movie.category || []).map(c => `<span class="meta-tag">${c.name}</span>`).join('');
    const countryTags = (movie.country || []).map(c => `<span class="meta-tag">${c.name}</span>`).join('');

    document.getElementById('modalInfo').innerHTML = `
      <h2 class="modal-title">${movie.name}</h2>
      <div class="modal-origin">${movie.origin_name || ''} · ${movie.year || ''}</div>
      
      <div class="modal-meta">
        <span class="meta-tag">★ ${movie.quality || 'HD'}</span>
        <span class="meta-tag">${movie.lang || 'Vietsub'}</span>
        <span class="meta-tag">⏱ ${movie.time || 'N/A'}</span>
        <span class="meta-tag">▦ ${movie.episode_current || 'Full'}</span>
        ${categoryTags}
        ${countryTags}
      </div>

      <div class="modal-description">${(movie.content || 'Chưa có mô tả').replace(/<[^>]+>/g, '')}</div>

      <div class="action-buttons">
        <button class="action-btn ${isFav ? 'active' : ''}" id="favBtn">
          ${isFav ? '♥ Đã Yêu Thích' : '♡ Yêu Thích'}
        </button>
        ${movie.director?.length ? `<span class="meta-tag">Đạo diễn: ${movie.director.join(', ')}</span>` : ''}
      </div>

      ${episodes.length > 0 ? renderEpisodes(episodes) : '<div style="margin-top:1.5rem;color:var(--paper-aged);opacity:0.6;font-style:italic;">Chưa có tập phim</div>'}
    `;

    // Bind favorite
    document.getElementById('favBtn')?.addEventListener('click', toggleFavorite);

    // Bind server tabs
    document.querySelectorAll('.server-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.currentServer = parseInt(tab.dataset.server);
        renderMovieDetail(data);
      });
    });

    // Bind episode buttons
    document.querySelectorAll('.episode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentEpisode = parseInt(btn.dataset.ep);
        playEpisode();
        renderMovieDetail(data);
      });
    });

    // Auto-play first episode
    if (episodes.length > 0 && episodes[state.currentServer]?.server_data?.length > 0 && !document.querySelector('.episode-btn.playing')) {
      // Don't auto-play, let user choose
    }
  }

  function renderEpisodes(episodes) {
    const serverTabs = episodes.map((srv, i) => 
      `<button class="server-tab ${i === state.currentServer ? 'active' : ''}" data-server="${i}">${srv.server_name}</button>`
    ).join('');

    const currentServer = episodes[state.currentServer];
    const epList = currentServer?.server_data || [];
    
    const epButtons = epList.map((ep, i) => 
      `<button class="episode-btn ${i === state.currentEpisode && document.querySelector('.player-wrapper iframe, .player-wrapper video') ? 'playing' : ''}" data-ep="${i}">${ep.name}</button>`
    ).join('');

    return `
      <div class="episode-section">
        <h3 class="section-heading">Danh Sách Tập</h3>
        <div class="server-tabs">${serverTabs}</div>
        <div class="episode-grid">${epButtons}</div>
      </div>
    `;
  }

  function playEpisode() {
    const data = state.currentMovie;
    if (!data) return;
    const episode = data.episodes?.[state.currentServer]?.server_data?.[state.currentEpisode];
    if (!episode) return;

    const wrapper = document.getElementById('playerWrapper');
    
    // Prefer embed link (less ad than direct), fallback to m3u8
    if (episode.link_embed) {
      wrapper.innerHTML = `<iframe src="${episode.link_embed}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    } else if (episode.link_m3u8) {
      wrapper.innerHTML = `<video id="hlsPlayer" controls autoplay playsinline></video>`;
      const video = document.getElementById('hlsPlayer');
      if (window.Hls && Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(episode.link_m3u8);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = episode.link_m3u8;
      }
    }

    // Update playing indicator
    document.querySelectorAll('.episode-btn').forEach((btn, i) => {
      btn.classList.toggle('playing', i === state.currentEpisode);
    });
  }

  function toggleFavorite() {
    if (!state.currentMovie) return;
    const movie = state.currentMovie.movie;
    const idx = state.favorites.findIndex(f => f.slug === movie.slug);
    
    if (idx >= 0) {
      state.favorites.splice(idx, 1);
    } else {
      state.favorites.unshift({
        slug: movie.slug,
        name: movie.name,
        origin_name: movie.origin_name,
        poster_url: movie.poster_url,
        thumb_url: movie.thumb_url,
        year: movie.year,
        quality: movie.quality,
        lang: movie.lang,
        episode_current: movie.episode_current
      });
    }
    saveStorage('favorites', state.favorites);
    renderMovieDetail(state.currentMovie);
  }

  // ========== EVENT BINDINGS ==========
  function init() {
    loadCategories();
    loadCountries();
    loadMovies();

    // Tabs
    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentTab = btn.dataset.tab;
        state.currentPage = 1;
        state.currentCategory = '';
        state.currentCountry = '';
        state.searchKeyword = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('categorySelect').value = '';
        document.getElementById('countrySelect').value = '';
        loadMovies();
      });
    });

    // Search with debounce
    let searchTimer;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.searchKeyword = e.target.value.trim();
        state.currentPage = 1;
        loadMovies();
      }, 500);
    });

    // Category filter
    document.getElementById('categorySelect').addEventListener('change', (e) => {
      state.currentCategory = e.target.value;
      state.currentPage = 1;
      loadMovies();
    });

    document.getElementById('countrySelect').addEventListener('change', (e) => {
      state.currentCountry = e.target.value;
      state.currentPage = 1;
      loadMovies();
    });

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('movieModal').addEventListener('click', (e) => {
      if (e.target.id === 'movieModal') closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function closeModal() {
    document.getElementById('movieModal').classList.remove('active');
    document.getElementById('playerWrapper').innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--gold);font-family:'Cormorant Garamond',serif;font-style:italic;letter-spacing:0.2em;">Chọn tập phim để bắt đầu xem</div>`;
    document.body.style.overflow = '';
    state.currentMovie = null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FIRESTORE SYNC for favorites/history (member/admin only)
  // Path: /users/{uid}/movies/data → { favorites: [...], history: [...] }
  // ════════════════════════════════════════════════════════════════════════

  function _movieDocRef() {
    if (typeof _db === 'undefined' || !_db) return null;
    var uid = (typeof fbCurrentUid === 'function') ? fbCurrentUid() : null;
    if (!uid) return null;
    return _db.collection('users').doc(uid).collection('movies').doc('data');
  }

  function _isLoggedInMember() {
    if (typeof getCurrentUser !== 'function') return false;
    var u = getCurrentUser();
    return u && (u.role === 'member' || u.role === 'admin') && u.id !== 'guest';
  }

  function _writeLocal(key, value) {
    try {
      var all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      all[key] = value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch(e){}
  }

  function _syncFromFirestore() {
    var ref = _movieDocRef();
    if (!ref) return Promise.resolve();
    return ref.get().then(function(snap){
      if (!snap.exists) return;
      var d = snap.data();
      var changed = false;
      if (Array.isArray(d.favorites)) {
        state.favorites = d.favorites;
        _writeLocal('favorites', d.favorites);
        changed = true;
      }
      if (Array.isArray(d.history)) {
        state.history = d.history;
        _writeLocal('history', d.history);
        changed = true;
      }
      // Re-render only if currently viewing favorites/history tab
      if (changed && (state.currentTab === 'favorites' || state.currentTab === 'history'))
        loadMovies();
    }).catch(function(e){ console.warn('[Movies] Firestore sync skip:', e.message); });
  }

  function _pushToFirestore() {
    var ref = _movieDocRef();
    if (!ref) return;
    ref.set({
      favorites: state.favorites,
      history:   state.history,
      updatedAt: Date.now()
    }, { merge: true }).catch(function(e){
      console.warn('[Movies] Firestore push fail:', e.message);
    });
  }

  // Override saveStorage để vừa ghi local vừa push Firestore (cho member/admin)
  var _origSave = saveStorage;
  saveStorage = function(key, value) {
    _origSave(key, value);
    if (_isLoggedInMember()) _pushToFirestore();
  };

  // ════════════════════════════════════════════════════════════════════════
  // PAGE LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════

  // ESC handler bind 1 lần duy nhất ở document level (không bị duplicate khi re-render)
  var _escBound = false;
  function _bindEscOnce() {
    if (_escBound) return;
    _escBound = true;
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') {
        var mm = document.getElementById('movieModal');
        if (mm && mm.classList.contains('active')) closeModal();
      }
    });
  }

  function bootstrap() {
    _bindEscOnce();
    // init() (định nghĩa ở trên) bind events lên các DOM element vừa render
    // và trigger loadCategories/loadCountries/loadMovies
    init();
    // Sync từ Firestore (data có thể đã đổi từ thiết bị khác)
    if (_isLoggedInMember()) _syncFromFirestore();
  }

  return { bootstrap: bootstrap };
})();

// ══════════════════════════════════════════════════════════════════════════
// Page entry points (gọi từ app.js)
// ══════════════════════════════════════════════════════════════════════════

function renderMoviesPage() {
  return `
    <div class="movie-hub" id="movieHub">
      <header class="hub-header">
        <h1 class="hub-title">Bún Bò on Air</h1>
        <p class="hub-subtitle">Bang Hội Nhất Mộng</p>
        <p class="hub-chinese">一 夢 江 湖 · 影 視 殿 堂</p>
      </header>

      <div class="control-bar">
        <div class="search-wrapper">
          <span class="search-icon">⚲</span>
          <input type="text" id="searchInput" class="search-input" placeholder="Tìm kiếm phim, kiếm hiệp, tiên hiệp...">
        </div>
        <select id="categorySelect" class="category-select">
          <option value="">— Tất cả thể loại —</option>
        </select>
        <select id="countrySelect" class="category-select">
          <option value="">— Quốc gia —</option>
        </select>
      </div>

      <nav class="nav-tabs">
        <button class="nav-button active" data-tab="latest">★ Phim Mới</button>
        <button class="nav-button" data-tab="phim-bo">Phim Bộ</button>
        <button class="nav-button" data-tab="phim-le">Phim Lẻ</button>
        <button class="nav-button" data-tab="hoat-hinh">Hoạt Hình</button>
        <button class="nav-button" data-tab="tv-shows">TV Shows</button>
        <button class="nav-button" data-tab="favorites">♥ Yêu Thích</button>
        <button class="nav-button" data-tab="history">⟳ Lịch Sử</button>
      </nav>

      <div id="movieContainer">
        <div class="loading-state">
          <div class="loading-symbol">☯</div>
          <div class="loading-text">Đang triệu hồi phim ảnh...</div>
        </div>
      </div>

      <div id="paginationContainer" class="pagination"></div>
    </div>

    <div class="modal-backdrop" id="movieModal">
      <div class="modal-content">
        <button class="modal-close" id="modalClose">×</button>
        <div class="player-wrapper" id="playerWrapper">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--gold);font-family:'Cormorant Garamond',serif;font-style:italic;letter-spacing:0.2em;">
            Chọn tập phim để bắt đầu xem
          </div>
        </div>
        <div class="modal-info" id="modalInfo"></div>
      </div>
    </div>
  `;
}

function initMoviesPage() {
  // Defer 1 tick để DOM render xong trước khi bind events
  setTimeout(function(){ window.MoviesHub.bootstrap(); }, 30);
}
