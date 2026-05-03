/**
 * firebase.js - nhatmongdata
 * Fix: fbPushNow hoạt động, role sync realtime
 */

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBszK09g8sHvufGNrFwDDgcw6rolV37KSA",
  authDomain:        "nhatmongdata.firebaseapp.com",
  projectId:         "nhatmongdata",
  storageBucket:     "nhatmongdata.firebasestorage.app",
  messagingSenderId: "814787062547",
  appId:             "1:814787062547:web:c4ca571227c5a5555688e6"
};

var _db         = null;
var _guildRef   = null;
var _usersRef   = null;
var _unsubGuild = null;
var _unsubUsers = null;
var _fbOk       = false;

/* ── Init ── */
function fbInit() {
  if (typeof firebase === 'undefined') {
    setTimeout(fbInit, 1000);
    return;
  }
  try {
    var app   = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    _db       = firebase.firestore(app);
    _guildRef = _db.collection('guilds').doc('guild_main');
    _usersRef = _db.collection('users');
    _fbOk     = true;
    _badge(true, 'Kết nối OK');
    console.log('[FB] ✅ Connected. Role:', _getRole());
    _listenGuild();
    _listenUsers();
    // Admin: push data local lên nếu Firebase trống
    if (_isAdmin()) {
      _guildRef.get().then(function(snap) {
        if (!snap.exists) {
          console.log('[FB] Firebase trống → auto push');
          _doPush();
        }
      });
    }
  } catch(e) {
    _fbOk = false;
    _badge(false, 'Lỗi: ' + e.message);
    console.error('[FB] Init lỗi:', e);
  }
}

/* ── Listen guild data ── */
function _listenGuild() {
  if (_unsubGuild) _unsubGuild();
  _unsubGuild = _guildRef.onSnapshot(function(snap) {
    if (!snap.exists) return;
    var remote  = snap.data();
    var localTs = 0;
    try { localTs = (JSON.parse(localStorage.getItem(DB_KEY)) || {}).updatedAt || 0; } catch(e) {}
    if ((remote.updatedAt || 0) > localTs) {
      try { localStorage.setItem(DB_KEY, JSON.stringify(remote)); } catch(e) {}
      _badge(true, 'Sync ' + _t(remote.updatedAt));
      console.log('[FB] ⬇ Data mới từ server');
      if (window.currentPage && !document.querySelector('.modal-overlay'))
        setTimeout(function() { renderPage(window.currentPage); }, 150);
    } else {
      _badge(true, 'Đã sync');
    }
  }, function(e) { _badge(false, 'Lỗi đọc'); console.error('[FB] Listen lỗi:', e); });
}

/* ── Listen users → detect role change ── */
function _listenUsers() {
  if (_unsubUsers) _unsubUsers();
  _unsubUsers = _usersRef.onSnapshot(function(snap) {
    var remote = [];
    snap.forEach(function(d) { remote.push(d.data()); });
    if (!remote.length) return;
    try { localStorage.setItem('nth_users', JSON.stringify(remote)); } catch(e) {}
    console.log('[FB] 👥 Users:', remote.length);

    // Check nếu role hiện tại bị thay đổi
    var sessRaw = sessionStorage.getItem('nth_session') || localStorage.getItem('nth_session');
    if (!sessRaw) return;
    try {
      var sess = JSON.parse(sessRaw);
      if (sess.id === 'admin' || sess.id === 'guest') return; // tài khoản cứng, bỏ qua
      var me = remote.find(function(u) { return u.id === sess.id; });
      if (me && me.role !== sess.role) {
        console.log('[FB] 🔄 Role:', sess.role, '→', me.role);
        var newSess = Object.assign({}, sess, { role: me.role });
        if (sessionStorage.getItem('nth_session'))
          sessionStorage.setItem('nth_session', JSON.stringify(newSess));
        else
          localStorage.setItem('nth_session', JSON.stringify(newSess));
        // Guard: chỉ reload 1 lần, tránh vòng lặp vô tận
        if (!sessionStorage.getItem('_role_reloading')) {
          sessionStorage.setItem('_role_reloading', '1');
          if (typeof showToast === 'function')
            showToast('🔄 Quyền đã cập nhật: ' + me.role + ' — Đang tải lại...');
          setTimeout(function() {
            sessionStorage.removeItem('_role_reloading');
            window.location.reload();
          }, 1500);
        }
      }
    } catch(e) { console.error('[FB] Session check lỗi:', e); }
  }, function(e) { console.error('[FB] Listen users lỗi:', e); });
}

/* ── Patch saveData ── */
var _origSave = window.saveData;
window.saveData = function(data) {
  var ok = false;
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); ok = true; } catch(e) {}
  if (_fbOk && _guildRef && _isAdmin()) {
    _guildRef.set(Object.assign({}, data, { updatedAt: Date.now() }))
      .then(function() { _badge(true, 'Lưu ' + _t(Date.now())); })
      .catch(function(e) { console.error('[FB] Save lỗi:', e); });
  }
  return ok;
};

/* ── Patch localStorage để sync users ── */
(function() {
  var orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    orig(key, value);
    if (key === 'nth_users' && _fbOk && _usersRef) {
      try {
        JSON.parse(value).forEach(function(u) {
          if (u && u.id) _usersRef.doc(u.id).set(u).catch(function() {});
        });
      } catch(e) {}
    }
  };
})();

/* ── fbPushNow: nút bấm trên topbar ── */
window.fbPushNow = function() {
  var btn = document.querySelector('button[onclick="fbPushNow()"]');

  function setBtnState(text, disabled) {
    if (btn) { btn.textContent = text; btn.disabled = disabled; }
  }

  function done(msg, ok) {
    setBtnState('🔥 Push Firebase', false);
    if (typeof showToast === 'function')
      showToast(msg, ok ? 'success' : 'error', 5000);
  }

  function doPush() {
    if (!_fbOk || !_guildRef) {
      done('❌ Firebase chưa kết nối! Kiểm tra F12 Console', false);
      return;
    }
    setBtnState('⏳ Đang push...', true);
    _doPush(function(err) {
      if (err) {
        if (err.code === 'permission-denied')
          done('❌ Firestore Rules chặn ghi! Kiểm tra Rules trong Firebase Console', false);
        else
          done('❌ Lỗi: ' + err.message, false);
      } else {
        var data = loadData();
        var mc   = data.members ? data.members.length : 0;
        done('✅ Đã push ' + mc + ' thành viên lên Firebase!', true);
        // Push users
        _pushUsers();
      }
    });
  }

  // Chờ Firebase init nếu chưa xong (tối đa 5s)
  if (!_fbOk) {
    setBtnState('⏳ Chờ Firebase...', true);
    var waited = 0;
    var w = setInterval(function() {
      waited += 300;
      if (_fbOk || waited >= 5000) { clearInterval(w); doPush(); }
    }, 300);
  } else {
    doPush();
  }
};

function _doPush(cb) {
  if (!_guildRef) { if (cb) cb(new Error('no ref')); return; }
  var data    = loadData();
  var payload = Object.assign({}, data, { updatedAt: Date.now() });
  _guildRef.set(payload)
    .then(function() { console.log('[FB] ⬆ Push OK'); if (cb) cb(null); })
    .catch(function(e) { console.error('[FB] Push lỗi:', e); if (cb) cb(e); });
}

function _pushUsers() {
  if (!_usersRef) return;
  var users = [];
  try { users = JSON.parse(localStorage.getItem('nth_users')) || []; } catch(e) {}
  users.forEach(function(u) {
    if (u && u.id) _usersRef.doc(u.id).set(u).catch(function() {});
  });
  console.log('[FB] 👥 Pushed', users.length, 'users');
}

/* ── Helpers ── */
function _isAdmin() {
  try {
    var s = sessionStorage.getItem('nth_session') || localStorage.getItem('nth_session');
    return s && JSON.parse(s).role === 'admin';
  } catch(e) { return false; }
}
function _getRole() {
  try {
    var s = sessionStorage.getItem('nth_session') || localStorage.getItem('nth_session');
    return s ? JSON.parse(s).role : '?';
  } catch(e) { return '?'; }
}
function _t(ts) {
  return ts ? new Date(ts).toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' }) : '';
}

/* ── Badge ── */
function _badge(ok, msg) {
  setTimeout(function() {
    var el = document.getElementById('fb-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fb-badge';
      el.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:12px;cursor:pointer;white-space:nowrap';
      el.onclick = function() {
        if (!_fbOk) { showToast('Firebase chưa kết nối'); return; }
        _guildRef.get().then(function(s) {
          showToast(s.exists ? '✅ Firebase OK — data: ' + _t(s.data().updatedAt) : '⚠️ Firebase trống — bấm Push Firebase');
        });
      };
      var bar = document.querySelector('.topbar-actions');
      if (bar) bar.insertBefore(el, bar.firstChild);
    }
    el.style.background = ok ? '#052e16' : '#1c1400';
    el.style.border     = '1px solid ' + (ok ? '#16a34a' : '#d97706');
    el.style.color      = ok ? '#4ade80' : '#fbbf24';
    el.textContent      = ok ? '🔥 Firebase' : '🟡 ' + (msg || 'Local');
  }, 400);
}

function renderFirebaseConfigUI() {
  return '<div class="cfg-section" style="border-color:' + (_fbOk?'#16a34a44':'#dc262644') + '">' +
    '<div class="section-header"><span class="section-title">🔥 Firebase</span>' +
    '<span style="font-size:12px;padding:3px 12px;border-radius:20px;' +
    (_fbOk?'background:#052e16;border:1px solid #16a34a;color:#4ade80':'background:#1c1400;border:1px solid #d97706;color:#fbbf24') + '">' +
    (_fbOk?'🔥 Kết nối — nhatmongdata':'🟡 Chưa kết nối') + '</span></div>' +
    '<p style="color:var(--text-secondary);font-size:13px">Project: nhatmongdata | Role: ' + _getRole() + '</p>' +
    '</div>';
}

setTimeout(fbInit, 800);
