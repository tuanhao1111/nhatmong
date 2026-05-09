/**
 * khopov.js — Kho POV Bang Chiến (admin-only)
 *
 * Lưu trữ video/ảnh POV trận bang chiến (link Google Drive). Chỉ admin được
 * xem & quản lý. Dùng chung Firebase project `nhatmongdata` với hệ auth của
 * Nhất Mộng (username/password → role admin/member/guest trong /users/{uid}).
 *
 * Firestore:
 *   /guild_war_matches/{auto-id}
 *     - date: "YYYY-MM-DD"
 *     - opponent: string
 *     - result: "win" | "loss" | "draw"
 *     - note: string
 *     - links: array<{ name, url, type:"video"|"image" }>
 *     - createdAt, updatedAt: serverTimestamp
 *     - createdBy, updatedBy: uid
 *     - createdByName, updatedByName: hiển thị
 *
 * Anti-leak: chỉ kích hoạt khi đang ở page này (gắn/gỡ listener khi
 * vào/rời page). Toàn site vẫn dùng bình thường.
 */

// ── State ────────────────────────────────────────────────────────────────────
var KP_COLLECTION = 'guild_war_matches';
var _kpMatches    = [];
var _kpUnsub      = null;        // unsubscribe Firestore listener
var _kpEditingId  = null;
var _kpSearch     = '';
var _kpFilter     = 'all';       // all | win | loss | draw
var _kpAntiLeakOn = false;       // listener gắn vào document hay chưa
var _kpStylesInjected = false;

// ── Helpers ──────────────────────────────────────────────────────────────────
function _kpFmtDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('vi-VN', {
      weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch (e) { return d; }
}

function _kpDriveFileId(url) {
  if (!url) return null;
  var m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function _kpDrivePreviewUrl(url) {
  var id = _kpDriveFileId(url);
  return id ? ('https://drive.google.com/file/d/' + id + '/preview') : url;
}

// ── YouTube helpers ──────────────────────────────────────────────────────────
// Hỗ trợ các format:
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://youtu.be/VIDEO_ID
//   https://www.youtube.com/embed/VIDEO_ID
//   https://www.youtube.com/shorts/VIDEO_ID
//   https://m.youtube.com/watch?v=VIDEO_ID
function _kpYoutubeId(url) {
  if (!url) return null;
  var m;
  // youtu.be/VIDEO_ID
  m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // youtube.com/embed/VIDEO_ID
  m = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // youtube.com/shorts/VIDEO_ID
  m = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  // youtube.com/watch?v=VIDEO_ID (kể cả có thêm tham số)
  m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

function _kpYoutubeEmbedUrl(url) {
  var id = _kpYoutubeId(url);
  if (!id) return url;
  // rel=0: hạn chế video gợi ý (nhưng YouTube giờ chỉ giới hạn cùng channel)
  // modestbranding=1: bớt logo YouTube (deprecated nhưng vẫn vô hại)
  // playsinline=1: cho phép play inline trên iOS thay vì auto fullscreen
  return 'https://www.youtube.com/embed/' + id + '?rel=0&modestbranding=1&playsinline=1';
}

function _kpGetDb() {
  // firebase compat v9 — đã init trong firebase.js
  if (typeof firebase === 'undefined' || !firebase.apps.length) return null;
  try { return firebase.firestore(); } catch (e) { return null; }
}

function _kpGetMyName() {
  var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  return (u && (u.name || u.username)) || '?';
}
function _kpGetMyUid() {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    var fa = firebase.auth().currentUser;
    if (fa) return fa.uid;
  }
  var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  return (u && u.id) || '';
}

// ── Anti-leak (chỉ active khi đang ở page Kho POV) ───────────────────────────
function _kpAntiLeakHandler(e) {
  if (e.type === 'contextmenu') {
    if (e.target && e.target.closest && !e.target.closest('input, textarea')) {
      e.preventDefault();
    }
    return;
  }
  if (e.type === 'keydown') {
    var k = e.key;
    if ((e.ctrlKey && (k === 's' || k === 'S' || k === 'u' || k === 'U')) ||
        k === 'F12' ||
        (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'J' || k === 'C'))) {
      e.preventDefault();
    }
  }
}
function _kpEnableAntiLeak() {
  if (_kpAntiLeakOn) return;
  document.addEventListener('contextmenu', _kpAntiLeakHandler);
  document.addEventListener('keydown',     _kpAntiLeakHandler);
  _kpAntiLeakOn = true;
}
function _kpDisableAntiLeak() {
  if (!_kpAntiLeakOn) return;
  document.removeEventListener('contextmenu', _kpAntiLeakHandler);
  document.removeEventListener('keydown',     _kpAntiLeakHandler);
  _kpAntiLeakOn = false;
}

// Tự gỡ anti-leak khi user chuyển sang page khác
(function _kpHookPageLeave(){
  if (typeof window === 'undefined') return;
  // Hook khi hash đổi (router dùng hash)
  window.addEventListener('hashchange', function(){
    var p = (window.location.hash || '').replace('#','');
    if (p !== 'khopov') {
      _kpDisableAntiLeak();
      _kpUnsubscribe();
      _kpCloseViewer();
    }
  });
})();

// ── Styles ───────────────────────────────────────────────────────────────────
function _kpInjectStyles() {
  if (_kpStylesInjected) return;
  _kpStylesInjected = true;
  var css = `
    .kp-wrap { padding: 4px 0 60px; }
    .kp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 18px; }
    .kp-stat { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px 16px; }
    .kp-stat .kp-stat-label { font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; }
    .kp-stat .kp-stat-val { font-size: 24px; font-weight: 700; font-family: var(--font-display); }
    .kp-stat.win  .kp-stat-val { color: var(--accent-green, #4ade80); }
    .kp-stat.loss .kp-stat-val { color: var(--accent-red, #f87171); }
    .kp-stat.rate .kp-stat-val { color: var(--accent-gold-text, #f0c040); }

    .kp-toolbar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .kp-toolbar input.kp-search { flex: 1; min-width: 180px; }
    .kp-toolbar input, .kp-toolbar select, .kp-toolbar button {
      background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary);
      padding: 8px 12px; border-radius: 6px; font-size: 14px; font-family: inherit;
    }
    .kp-toolbar button { cursor: pointer; transition: all 0.15s; font-weight: 500; }
    .kp-toolbar button:hover { border-color: var(--accent-gold-text); color: var(--accent-gold-text); }
    .kp-toolbar button.kp-primary {
      background: var(--accent-gold, #d4a64a); border-color: var(--accent-gold, #d4a64a); color: #1a1408;
    }
    .kp-toolbar button.kp-primary:hover {
      background: var(--accent-gold-hover, #e6b85c); color: #1a1408;
    }

    .kp-form { display: none; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px; margin-bottom: 18px; }
    .kp-form.open { display: block; }
    .kp-form h3 { margin: 0 0 14px; font-size: 15px; font-weight: 600; }
    .kp-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    @media (max-width: 600px) { .kp-form-row { grid-template-columns: 1fr; } }
    .kp-fg { margin-bottom: 12px; }
    .kp-fg label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 5px; }
    .kp-fg input, .kp-fg select, .kp-fg textarea {
      width: 100%; background: var(--sand-2); border: 1px solid var(--border-color);
      color: var(--text-primary); padding: 8px 12px; border-radius: 6px;
      font-size: 14px; font-family: inherit; outline: none;
    }
    .kp-fg input:focus, .kp-fg select:focus, .kp-fg textarea:focus { border-color: var(--accent-gold-text); }
    .kp-fg textarea { min-height: 70px; resize: vertical; }
    .kp-hint { font-size: 11px; color: var(--text-muted); margin-top: 6px; line-height: 1.5; }

    .kp-result-radios { display: flex; gap: 6px; }
    .kp-result-radios label {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 9px; border: 1px solid var(--border-color); border-radius: 6px;
      cursor: pointer; font-size: 13px; transition: all 0.15s;
    }
    .kp-result-radios label:hover { border-color: var(--accent-gold-text); }
    .kp-result-radios input { display: none; }
    .kp-result-radios label.checked { border-color: var(--accent-gold-text); background: var(--amber-a3); color: var(--accent-gold-text); }

    .kp-links { display: flex; flex-direction: column; gap: 8px; margin-bottom: 6px; }
    .kp-link-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .kp-link-row .kp-ln { flex: 1; min-width: 120px; }
    .kp-link-row .kp-lu { flex: 2; min-width: 180px; }
    .kp-link-row select { min-width: 90px; }
    .kp-link-row .kp-rm { padding: 6px 10px; font-size: 12px; cursor: pointer; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; }
    .kp-link-row .kp-rm:hover { border-color: var(--accent-red, #f87171); color: var(--accent-red, #f87171); }
    .kp-add-link { padding: 6px 12px; font-size: 12px; cursor: pointer; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 6px; }

    .kp-form-actions { display: flex; gap: 8px; margin-top: 8px; }
    .kp-form-actions button { flex: 1; padding: 9px 16px; cursor: pointer; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .kp-btn-save { background: var(--accent-gold, #d4a64a); border: 1px solid var(--accent-gold, #d4a64a); color: #1a1408; }
    .kp-btn-save:hover { background: var(--accent-gold-hover, #e6b85c); }
    .kp-btn-cancel { background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); }

    .kp-list { display: flex; flex-direction: column; gap: 12px; }
    .kp-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 14px 16px; }
    .kp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
    .kp-head-left { flex: 1; min-width: 0; }
    .kp-title-line { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .kp-title { font-size: 15px; font-weight: 600; margin: 0; }
    .kp-date { font-size: 12px; color: var(--text-secondary); margin: 0; }
    .kp-actions { display: flex; gap: 6px; }
    .kp-actions button {
      padding: 6px 12px; font-size: 12px; cursor: pointer; border-radius: 6px;
      background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary);
    }
    .kp-actions button:hover { border-color: var(--accent-gold-text); color: var(--accent-gold-text); }
    .kp-actions button.kp-del:hover { border-color: var(--accent-red, #f87171); color: var(--accent-red, #f87171); }

    .kp-badge { font-size: 11px; padding: 2px 9px; border-radius: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    .kp-badge.win  { background: rgba(74,222,128,0.12);  color: var(--accent-green, #4ade80); }
    .kp-badge.loss { background: rgba(248,113,113,0.12); color: var(--accent-red, #f87171); }
    .kp-badge.draw { background: var(--sand-3); color: var(--text-muted); }

    .kp-note { font-size: 13px; margin: 8px 0; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; -webkit-user-select: text; user-select: text; }
    .kp-files { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; }
    .kp-file { background: var(--sand-2); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; gap: 10px; font-size: 12px; cursor: pointer; transition: background 0.15s; border: 1px solid transparent; }
    .kp-file:hover { background: var(--sand-3); border-color: var(--border-color); }
    .kp-file-icon { width: 28px; height: 28px; background: var(--bg-primary); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--accent-gold-text); font-size: 13px; flex-shrink: 0; }
    .kp-file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; -webkit-user-select: text; user-select: text; }
    .kp-file-type { color: var(--text-muted); font-size: 11px; }
    .kp-no-files { font-size: 11px; color: var(--text-muted); margin: 8px 0 0; font-style: italic; }
    .kp-meta { font-size: 11px; color: var(--text-muted); margin-top: 8px; }

    .kp-empty { text-align: center; padding: 60px 20px; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 10px; }
    .kp-empty h3 { margin: 0 0 6px; font-size: 16px; color: var(--text-primary); }
    .kp-empty p { margin: 0; font-size: 13px; }

    .kp-loading { text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px; }

    /* Modal viewer with anti-leak — fullscreen */
    .kp-modal {
      position: fixed; inset: 0; background: rgba(0,0,0,0.95); z-index: 9000;
      padding: 0; overflow: hidden; display: none;
    }
    .kp-modal.open { display: flex; align-items: stretch; justify-content: stretch; }
    .kp-modal-inner {
      background: var(--bg-card);
      width: 100%; height: 100vh;
      max-width: none; max-height: none;
      border-radius: 0;
      overflow: hidden; display: flex; flex-direction: column;
    }
    .kp-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--border-color); gap: 8px; flex-wrap: wrap; flex-shrink: 0; }
    .kp-modal-title { font-size: 14px; font-weight: 600; margin: 0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kp-modal-body { padding: 0; overflow: hidden; background: #000; flex: 1; min-height: 0; position: relative; }
    .kp-iframe-wrap { position: relative; width: 100%; height: 100%; }
    .kp-iframe-wrap iframe { width: 100%; height: 100%; border: 0; display: block; }
    /* Cover Drive's "Open in new tab" button */
    .kp-drive-overlay {
      position: absolute; top: 0; right: 0; width: 90px; height: 50px;
      background: var(--bg-card); z-index: 5; pointer-events: auto; cursor: not-allowed;
    }
    .kp-watermark {
      position: absolute; bottom: 16px; right: 16px;
      color: rgba(255,255,255,0.45); font-size: 11px; z-index: 6;
      pointer-events: none; background: rgba(0,0,0,0.5);
      padding: 4px 8px; border-radius: 4px;
    }
    .kp-modal-close {
      padding: 6px 14px; cursor: pointer; border-radius: 6px;
      background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary);
    }
    .kp-modal-close:hover { border-color: var(--accent-gold-text); color: var(--accent-gold-text); }

    @media (max-width: 600px) {
      .kp-iframe-wrap iframe { height: 100%; }
      .kp-modal-head { padding: 8px 12px; }
      .kp-modal-title { font-size: 13px; }
    }
  `;
  var s = document.createElement('style');
  s.id = 'kp-styles';
  s.textContent = css;
  document.head.appendChild(s);
}

// ── Subscribe Firestore ──────────────────────────────────────────────────────
function _kpUnsubscribe() {
  if (_kpUnsub) { try { _kpUnsub(); } catch(e){} _kpUnsub = null; }
}

function _kpSubscribe() {
  var db = _kpGetDb();
  if (!db) {
    setTimeout(_kpSubscribe, 600);
    return;
  }
  _kpUnsubscribe();
  _kpUnsub = db.collection(KP_COLLECTION).orderBy('date', 'desc').onSnapshot(
    function(snap) {
      _kpMatches = [];
      snap.forEach(function(d){
        var data = d.data() || {};
        data.id = d.id;
        _kpMatches.push(data);
      });
      _kpRender();
    },
    function(err) {
      console.error('[KP] Listen error:', err);
      if (typeof showToast === 'function') {
        var msg = err && err.code === 'permission-denied'
          ? '🔒 Firestore Rules chưa cho phép. Xem FIRESTORE_RULES.txt và publish lại.'
          : '❌ Lỗi đồng bộ Kho POV: ' + (err.message || err.code);
        showToast(msg, 'error', 5000);
      }
      _kpMatches = [];
      _kpRender();
    }
  );
}

// ── Page renderer ────────────────────────────────────────────────────────────
function renderKhoPovPage() {
  // Guard: chỉ admin
  if (typeof isAdmin !== 'function' || !isAdmin()) {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px">' +
      '<div style="font-size:48px">🔒</div>' +
      '<div style="font-size:18px;font-weight:600;color:var(--text-secondary)">Chỉ Admin được xem Kho POV</div>' +
      '<div style="font-size:13px;color:var(--text-muted);text-align:center;max-width:340px;line-height:1.7">POV bang chiến chứa thông tin chiến thuật nhạy cảm. Liên hệ trưởng bang để được cấp quyền Admin.</div>' +
      '</div>';
  }

  _kpInjectStyles();
  _kpEnableAntiLeak();
  _kpSubscribe();

  // Khung HTML — content sẽ được _kpRender() điền vào sau khi data về
  setTimeout(function(){
    _kpRender();
    _kpBindToolbar();
  }, 50);

  return `
    <div class="page-header">
      <div class="page-title">Kho POV Bang Chiến</div>
      <div class="page-subtitle">Lưu trữ video/ảnh các trận, rút kinh nghiệm</div>
    </div>

    <div class="kp-wrap">
      <div class="kp-stats" id="kp-stats">
        <div class="kp-stat"><div class="kp-stat-label">Tổng trận</div><div class="kp-stat-val" id="kp-total">—</div></div>
        <div class="kp-stat win"><div class="kp-stat-label">Thắng</div><div class="kp-stat-val" id="kp-win">—</div></div>
        <div class="kp-stat loss"><div class="kp-stat-label">Thua</div><div class="kp-stat-val" id="kp-loss">—</div></div>
        <div class="kp-stat rate"><div class="kp-stat-label">Tỷ lệ thắng</div><div class="kp-stat-val" id="kp-rate">—</div></div>
      </div>

      <div class="kp-toolbar">
        <input type="text" id="kp-search" class="kp-search" placeholder="Tìm theo đối thủ hoặc ghi chú...">
        <select id="kp-filter">
          <option value="all">Tất cả kết quả</option>
          <option value="win">Thắng</option>
          <option value="loss">Thua</option>
          <option value="draw">Hòa</option>
        </select>
        <button class="kp-primary" id="kp-add-btn">+ Thêm trận</button>
      </div>

      <div id="kp-form" class="kp-form">
        <h3 id="kp-form-title">Thêm trận bang chiến mới</h3>
        <div class="kp-form-row">
          <div class="kp-fg" style="margin:0"><label>Ngày đánh</label><input type="date" id="kp-f-date"></div>
          <div class="kp-fg" style="margin:0"><label>Đối thủ</label><input type="text" id="kp-f-opp" placeholder="Tên bang đối thủ"></div>
        </div>
        <div class="kp-fg">
          <label>Kết quả</label>
          <div class="kp-result-radios" id="kp-f-result">
            <label data-val="win"><input type="radio" name="kp-f-result" value="win"> Thắng</label>
            <label data-val="loss"><input type="radio" name="kp-f-result" value="loss"> Thua</label>
            <label data-val="draw"><input type="radio" name="kp-f-result" value="draw"> Hòa</label>
          </div>
        </div>
        <div class="kp-fg">
          <label>Ghi chú</label>
          <textarea id="kp-f-note" placeholder="Chiến thuật, người chơi nổi bật, bài học rút ra..."></textarea>
        </div>
        <div class="kp-fg">
          <label>Link POV (Google Drive)</label>
          <div id="kp-links" class="kp-links"></div>
          <button type="button" class="kp-add-link" id="kp-add-link-btn">+ Thêm link</button>
          <div class="kp-hint">
            <strong>Drive:</strong> Upload video/ảnh lên folder Google Drive của bang, share riêng cho email các admin, rồi paste link "Xem chung" vào đây.<br>
            <strong>YouTube:</strong> Upload video lên YouTube ở chế độ <strong>Unlisted</strong> (Không công khai - có link mới xem được), bật "Allow embedding" trong Settings, rồi paste link. Lưu ý: bất kỳ ai có link YouTube đều xem được — không share link ra ngoài bang.
          </div>
        </div>
        <div class="kp-form-actions">
          <button class="kp-btn-save"   id="kp-save-btn">Lưu trận</button>
          <button class="kp-btn-cancel" id="kp-cancel-btn">Hủy</button>
        </div>
      </div>

      <div id="kp-list" class="kp-list"></div>
      <div id="kp-loading" class="kp-loading">Đang tải dữ liệu...</div>
      <div id="kp-empty" class="kp-empty" style="display:none">
        <h3>Chưa có trận nào</h3>
        <p>Bấm "+ Thêm trận" để upload POV trận đầu tiên.</p>
      </div>
    </div>

    <!-- Modal viewer -->
    <div id="kp-modal" class="kp-modal">
      <div class="kp-modal-inner">
        <div class="kp-modal-head">
          <div class="kp-modal-title" id="kp-modal-title"></div>
          <button class="kp-modal-close" id="kp-modal-close" title="Đóng (ESC)">Đóng</button>
        </div>
        <div class="kp-modal-body">
          <div class="kp-iframe-wrap">
            <div id="kp-modal-content"></div>
            <div class="kp-drive-overlay"></div>
            <div class="kp-watermark" id="kp-watermark"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Render list ──────────────────────────────────────────────────────────────
function _kpRender() {
  var listEl    = document.getElementById('kp-list');
  var emptyEl   = document.getElementById('kp-empty');
  var loadingEl = document.getElementById('kp-loading');
  if (!listEl) return;     // page chưa render xong

  if (loadingEl) loadingEl.style.display = 'none';

  // Stats (luôn tính trên toàn bộ)
  var total = _kpMatches.length;
  var wins  = _kpMatches.filter(function(m){ return m.result === 'win';  }).length;
  var loss  = _kpMatches.filter(function(m){ return m.result === 'loss'; }).length;
  var totalEl = document.getElementById('kp-total');
  var winEl   = document.getElementById('kp-win');
  var lossEl  = document.getElementById('kp-loss');
  var rateEl  = document.getElementById('kp-rate');
  if (totalEl) totalEl.textContent = total;
  if (winEl)   winEl.textContent   = wins;
  if (lossEl)  lossEl.textContent  = loss;
  if (rateEl)  rateEl.textContent  = total > 0 ? Math.round((wins/total)*100) + '%' : '—';

  // Filter + search
  var q = (_kpSearch || '').toLowerCase().trim();
  var fr = _kpFilter || 'all';
  var filtered = _kpMatches.filter(function(m){
    if (fr !== 'all' && m.result !== fr) return false;
    if (q && !((m.opponent||'').toLowerCase().includes(q) || (m.note||'').toLowerCase().includes(q))) return false;
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) {
      emptyEl.style.display = 'block';
      var h = emptyEl.querySelector('h3');
      var p = emptyEl.querySelector('p');
      if (total === 0) {
        if (h) h.textContent = 'Chưa có trận nào';
        if (p) p.textContent = 'Bấm "+ Thêm trận" để upload POV trận đầu tiên.';
      } else {
        if (h) h.textContent = 'Không có trận nào khớp';
        if (p) p.textContent = 'Thử thay đổi từ khóa hoặc bộ lọc kết quả.';
      }
    }
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var labels = { win: 'Thắng', loss: 'Thua', draw: 'Hòa' };
  // Mapping cho 3 loại file: icon + label hiển thị
  var typeMeta = {
    video:   { icon: '▶', label: 'video Drive', iconColor: '' },
    image:   { icon: '◇', label: 'ảnh',         iconColor: '' },
    youtube: { icon: '▶', label: 'YouTube',     iconColor: '#ff0000' }
  };
  listEl.innerHTML = filtered.map(function(m){
    var links = m.links || [];
    var filesHtml = links.length > 0
      ? '<div class="kp-files">' + links.map(function(l, i){
          var meta = typeMeta[l.type] || typeMeta.video;
          var iconStyle = meta.iconColor ? ' style="color:' + meta.iconColor + '"' : '';
          return '<div class="kp-file" data-mid="' + escHtml(m.id) + '" data-idx="' + i + '">' +
            '<div class="kp-file-icon"' + iconStyle + '>' + meta.icon + '</div>' +
            '<div class="kp-file-name">' + escHtml(l.name || ('POV ' + (i+1))) + '</div>' +
            '<div class="kp-file-type">' + meta.label + '</div>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="kp-no-files">Chưa có POV upload</div>';

    var noteHtml = m.note ? '<div class="kp-note">' + escHtml(m.note) + '</div>' : '';
    var meta = '';
    if (m.createdByName || m.updatedByName) {
      meta = '<div class="kp-meta">' +
        (m.updatedByName ? 'Cập nhật bởi ' + escHtml(m.updatedByName) :
         m.createdByName ? 'Tạo bởi ' + escHtml(m.createdByName) : '') +
      '</div>';
    }

    return '<div class="kp-card">' +
      '<div class="kp-head">' +
        '<div class="kp-head-left">' +
          '<div class="kp-title-line">' +
            '<h3 class="kp-title">vs ' + escHtml(m.opponent || '?') + '</h3>' +
            '<span class="kp-badge ' + escHtml(m.result || 'draw') + '">' + (labels[m.result] || '?') + '</span>' +
          '</div>' +
          '<p class="kp-date">' + _kpFmtDate(m.date) + '</p>' +
        '</div>' +
        '<div class="kp-actions">' +
          '<button data-act="edit" data-mid="' + escHtml(m.id) + '">Sửa</button>' +
          '<button class="kp-del" data-act="del"  data-mid="' + escHtml(m.id) + '">Xóa</button>' +
        '</div>' +
      '</div>' +
      noteHtml +
      filesHtml +
      meta +
    '</div>';
  }).join('');

  // Bind click cho list (delegated mỗi lần render)
  listEl.onclick = function(ev){
    var t = ev.target.closest('[data-act], .kp-file');
    if (!t) return;
    if (t.classList.contains('kp-file')) {
      _kpViewFile(t.dataset.mid, parseInt(t.dataset.idx, 10));
      return;
    }
    var act = t.dataset.act;
    var mid = t.dataset.mid;
    if (act === 'edit') _kpStartEdit(mid);
    else if (act === 'del') _kpDelete(mid);
  };
}

// ── Bind toolbar (chỉ bind 1 lần khi page mount) ─────────────────────────────
function _kpBindToolbar() {
  var search = document.getElementById('kp-search');
  var filter = document.getElementById('kp-filter');
  var addBtn = document.getElementById('kp-add-btn');
  var saveBtn = document.getElementById('kp-save-btn');
  var cancelBtn = document.getElementById('kp-cancel-btn');
  var addLinkBtn = document.getElementById('kp-add-link-btn');
  var modalClose = document.getElementById('kp-modal-close');
  var modal = document.getElementById('kp-modal');
  var resultRadios = document.getElementById('kp-f-result');

  if (search) {
    search.value = _kpSearch;
    search.oninput = function(){ _kpSearch = search.value; _kpRender(); };
  }
  if (filter) {
    filter.value = _kpFilter;
    filter.onchange = function(){ _kpFilter = filter.value; _kpRender(); };
  }
  if (addBtn)    addBtn.onclick    = _kpStartAdd;
  if (saveBtn)   saveBtn.onclick   = _kpSave;
  if (cancelBtn) cancelBtn.onclick = _kpCancelForm;
  if (addLinkBtn) addLinkBtn.onclick = function(){ _kpAddLinkRow(); };
  if (modalClose) modalClose.onclick = _kpCloseViewer;
  if (modal) modal.onclick = function(ev){ if (ev.target === modal) _kpCloseViewer(); };

  // Style cho radio "checked"
  if (resultRadios) {
    resultRadios.addEventListener('change', function(){
      resultRadios.querySelectorAll('label').forEach(function(lb){
        var inp = lb.querySelector('input');
        lb.classList.toggle('checked', !!(inp && inp.checked));
      });
    });
  }
}

// ── Form ─────────────────────────────────────────────────────────────────────
function _kpAddLinkRow(data) {
  var wrap = document.getElementById('kp-links');
  if (!wrap) return;
  var row = document.createElement('div');
  row.className = 'kp-link-row';
  var t = (data && data.type) || 'video';
  row.innerHTML =
    '<input type="text" class="kp-ln" placeholder="Tên (vd: Trận 1 - tướng X)" value="' + escHtml((data && data.name) || '') + '">' +
    '<input type="url"  class="kp-lu" placeholder="Link Drive hoặc YouTube..." value="' + escHtml((data && data.url) || '') + '">' +
    '<select class="kp-lt">' +
      '<option value="video"'   + (t === 'video'   ? ' selected' : '') + '>Video (Drive)</option>' +
      '<option value="image"'   + (t === 'image'   ? ' selected' : '') + '>Ảnh (Drive)</option>' +
      '<option value="youtube"' + (t === 'youtube' ? ' selected' : '') + '>YouTube</option>' +
    '</select>' +
    '<button type="button" class="kp-rm">×</button>';
  row.querySelector('.kp-rm').onclick = function(){ row.remove(); };

  // Auto-detect type khi user paste link YouTube → tự đổi select sang "youtube"
  var urlInput = row.querySelector('.kp-lu');
  var typeSelect = row.querySelector('.kp-lt');
  urlInput.addEventListener('input', function(){
    var v = urlInput.value.trim();
    if (!v) return;
    if (_kpYoutubeId(v) && typeSelect.value !== 'youtube') {
      typeSelect.value = 'youtube';
    }
  });

  wrap.appendChild(row);
}

function _kpResetForm(links) {
  var fDate = document.getElementById('kp-f-date');
  var fOpp  = document.getElementById('kp-f-opp');
  var fNote = document.getElementById('kp-f-note');
  var radios = document.querySelectorAll('input[name="kp-f-result"]');
  var resultLabels = document.querySelectorAll('#kp-f-result label');
  var wrap = document.getElementById('kp-links');
  if (fDate) fDate.value = new Date().toISOString().slice(0,10);
  if (fOpp)  fOpp.value  = '';
  if (fNote) fNote.value = '';
  radios.forEach(function(r){ r.checked = false; });
  resultLabels.forEach(function(l){ l.classList.remove('checked'); });
  if (wrap) wrap.innerHTML = '';
  (links || []).forEach(function(l){ _kpAddLinkRow(l); });
  if (!links || links.length === 0) _kpAddLinkRow();
}

function _kpStartAdd() {
  if (typeof isAdmin !== 'function' || !isAdmin()) { denyEdit(); return; }
  _kpEditingId = null;
  document.getElementById('kp-form-title').textContent = 'Thêm trận bang chiến mới';
  _kpResetForm([]);
  document.getElementById('kp-form').classList.add('open');
  document.getElementById('kp-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _kpStartEdit(id) {
  if (typeof isAdmin !== 'function' || !isAdmin()) { denyEdit(); return; }
  var m = _kpMatches.find(function(x){ return x.id === id; });
  if (!m) return;
  _kpEditingId = id;
  document.getElementById('kp-form-title').textContent = 'Sửa trận vs ' + (m.opponent || '?');
  document.getElementById('kp-f-date').value = m.date || '';
  document.getElementById('kp-f-opp').value  = m.opponent || '';
  document.getElementById('kp-f-note').value = m.note || '';
  document.querySelectorAll('input[name="kp-f-result"]').forEach(function(r){
    r.checked = (r.value === m.result);
    var lb = r.closest('label');
    if (lb) lb.classList.toggle('checked', r.checked);
  });
  var wrap = document.getElementById('kp-links');
  if (wrap) wrap.innerHTML = '';
  (m.links || []).forEach(function(l){ _kpAddLinkRow(l); });
  if (!m.links || m.links.length === 0) _kpAddLinkRow();
  document.getElementById('kp-form').classList.add('open');
  document.getElementById('kp-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _kpCancelForm() {
  document.getElementById('kp-form').classList.remove('open');
  _kpEditingId = null;
}

function _kpSave() {
  if (typeof isAdmin !== 'function' || !isAdmin()) { denyEdit(); return; }
  var db = _kpGetDb();
  if (!db) { showToast('❌ Firebase chưa kết nối', 'error'); return; }

  var date = document.getElementById('kp-f-date').value;
  var opp  = document.getElementById('kp-f-opp').value.trim();
  var note = document.getElementById('kp-f-note').value.trim();
  var resultRadio = document.querySelector('input[name="kp-f-result"]:checked');

  if (!date) { showToast('Vui lòng chọn ngày.', 'error'); return; }
  if (!opp)  { showToast('Vui lòng nhập tên đối thủ.', 'error'); return; }
  if (!resultRadio) { showToast('Vui lòng chọn kết quả.', 'error'); return; }

  // Sanitize text — chống Firestore Rules từ chối bởi ký tự cấm
  function _clean(s, max) {
    return String(s||'').replace(/[<>"'`\\\u0000-\u001F\u007F]/g, '').trim().slice(0, max||120);
  }

  var links = [];
  var linkError = null;
  document.querySelectorAll('#kp-links .kp-link-row').forEach(function(row){
    if (linkError) return;
    var url = row.querySelector('.kp-lu').value.trim();
    if (!url) return;
    var linkType = row.querySelector('.kp-lt').value;
    var name = _clean(row.querySelector('.kp-ln').value, 80) || 'POV';

    // Validate URL khớp với type đã chọn
    if (linkType === 'youtube') {
      if (!_kpYoutubeId(url)) {
        linkError = 'Link "' + name + '" không phải YouTube hợp lệ. Đổi type sang Drive hoặc paste link YouTube đúng.';
        return;
      }
    } else if (linkType === 'video' || linkType === 'image') {
      // Drive link cần có file ID extract được
      if (!_kpDriveFileId(url)) {
        // Cho phép link không phải Drive nhưng cảnh báo (vd. user paste link khác)
        // — nếu là YouTube thì gợi ý đổi type
        if (_kpYoutubeId(url)) {
          linkError = 'Link "' + name + '" là YouTube — đổi type sang YouTube thay vì ' + (linkType === 'video' ? 'Video Drive' : 'Ảnh Drive') + '.';
          return;
        }
        // Link lạ: không chặn nhưng iframe có thể không load — chỉ log
        console.warn('[KP] Link không phải Drive cũng không phải YouTube:', url);
      }
    }

    links.push({
      name: name,
      url:  url.slice(0, 500),
      type: linkType
    });
  });

  if (linkError) {
    showToast('❌ ' + linkError, 'error', 5000);
    return;
  }

  var saveBtn = document.getElementById('kp-save-btn');
  if (saveBtn) { saveBtn.textContent = 'Đang lưu...'; saveBtn.disabled = true; }

  var uid = _kpGetMyUid();
  var name = _kpGetMyName();
  var ts = firebase.firestore.FieldValue.serverTimestamp();
  var payload = {
    date: date,
    opponent: _clean(opp, 80),
    result: resultRadio.value,
    note: _clean(note, 4000),
    links: links,
    updatedAt: ts,
    updatedBy: uid,
    updatedByName: _clean(name, 60)
  };

  var p;
  if (_kpEditingId) {
    p = db.collection(KP_COLLECTION).doc(_kpEditingId).update(payload);
  } else {
    payload.createdAt = ts;
    payload.createdBy = uid;
    payload.createdByName = _clean(name, 60);
    p = db.collection(KP_COLLECTION).add(payload);
  }

  p.then(function(){
    showToast(_kpEditingId ? 'Đã cập nhật trận.' : 'Đã lưu trận thành công.', 'success');
    document.getElementById('kp-form').classList.remove('open');
    _kpEditingId = null;
  }).catch(function(e){
    console.error('[KP] Save error:', e);
    var msg = e && e.code === 'permission-denied'
      ? '🔒 Firestore Rules từ chối ghi. Đảm bảo bạn là admin và đã publish rules mới.'
      : '❌ Lỗi lưu: ' + (e.message || e.code);
    showToast(msg, 'error', 5000);
  }).finally(function(){
    if (saveBtn) { saveBtn.textContent = 'Lưu trận'; saveBtn.disabled = false; }
  });
}

function _kpDelete(id) {
  if (typeof isAdmin !== 'function' || !isAdmin()) { denyEdit(); return; }
  var db = _kpGetDb();
  if (!db) { showToast('❌ Firebase chưa kết nối', 'error'); return; }
  var m = _kpMatches.find(function(x){ return x.id === id; });
  if (!m) return;
  if (!confirmDelete('Xóa trận vs ' + (m.opponent || '?') + ' ngày ' + _kpFmtDate(m.date) + '?\nLưu ý: file POV trên Google Drive KHÔNG bị xóa, chỉ xóa entry trong kho.')) return;
  db.collection(KP_COLLECTION).doc(id).delete()
    .then(function(){ showToast('Đã xóa trận.', 'success'); })
    .catch(function(e){
      console.error('[KP] Delete error:', e);
      showToast('❌ Lỗi xóa: ' + (e.message || e.code), 'error', 5000);
    });
}

// ── Modal viewer ─────────────────────────────────────────────────────────────
// Handler riêng để có thể remove đúng reference khi đóng modal
function _kpEscHandler(e) {
  if (e.key === 'Escape') _kpCloseViewer();
}

function _kpViewFile(matchId, idx) {
  var m = _kpMatches.find(function(x){ return x.id === matchId; });
  if (!m || !m.links || !m.links[idx]) return;
  var link = m.links[idx];
  var titleEl = document.getElementById('kp-modal-title');
  var contentEl = document.getElementById('kp-modal-content');
  var watermarkEl = document.getElementById('kp-watermark');
  var modalEl = document.getElementById('kp-modal');
  var driveOverlay = modalEl ? modalEl.querySelector('.kp-drive-overlay') : null;
  if (!titleEl || !contentEl || !modalEl) return;

  titleEl.textContent = 'vs ' + (m.opponent || '?') + ' — ' + (link.name || 'POV');

  var embedUrl, isYoutube = (link.type === 'youtube');
  if (isYoutube) {
    embedUrl = _kpYoutubeEmbedUrl(link.url);
  } else {
    embedUrl = _kpDrivePreviewUrl(link.url);
  }

  // Drive overlay (che nút "Open in new tab" góc phải) chỉ cần cho Drive,
  // YouTube không có nút đó nên ẩn đi (đỡ che mất thanh điều khiển video).
  if (driveOverlay) {
    driveOverlay.style.display = isYoutube ? 'none' : 'block';
  }

  // Sandbox iframe — chặn navigation/popups/downloads từ trong iframe
  // YouTube và Drive đều OK với set sandbox này
  contentEl.innerHTML = '<iframe src="' + escHtml(embedUrl) + '" sandbox="allow-scripts allow-same-origin allow-presentation" allow="autoplay; fullscreen; encrypted-media" referrerpolicy="no-referrer"></iframe>';
  if (watermarkEl) {
    var u = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
    watermarkEl.textContent = (u && (u.username || u.name)) || '';
  }
  modalEl.classList.add('open');

  // Bind ESC để đóng (gỡ khi đóng để không leak)
  document.addEventListener('keydown', _kpEscHandler);
}

function _kpCloseViewer() {
  var modalEl = document.getElementById('kp-modal');
  var contentEl = document.getElementById('kp-modal-content');
  if (modalEl) modalEl.classList.remove('open');
  if (contentEl) contentEl.innerHTML = '';
  document.removeEventListener('keydown', _kpEscHandler);
}
