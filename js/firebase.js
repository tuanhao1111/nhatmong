/**
 * firebase.js - nhatmongdata
 * 
 * KIẾN TRÚC MỚI:
 *   - Firebase Auth (email giả {username}@nhatmong.local) là source of truth cho login
 *   - /users/{uid}              → profile + role (admin/member/guest)
 *   - /guilds/guild_main        → settings, currentSession, sessions (admin-only write)
 *   - /guilds/guild_main/members/{uid} → 1 doc cho mỗi member của bang
 *
 * REALTIME: onSnapshot trên cả 3 → cập nhật localStorage cache → re-render UI
 */

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBszK09g8sHvufGNrFwDDgcw6rolV37KSA",
  authDomain:        "nhatmongdata.firebaseapp.com",
  projectId:         "nhatmongdata",
  storageBucket:     "nhatmongdata.firebasestorage.app",
  messagingSenderId: "814787062547",
  appId:             "1:814787062547:web:c4ca571227c5a5555688e6"
};

// Domain dùng cho email giả của Firebase Auth
var FAKE_EMAIL_DOMAIN = '@nhatmong.local';

// ── Globals ──────────────────────────────────────────────────────────────────
var _db = null;
var _auth = null;
var _guildRef = null;       // /guilds/guild_main
var _usersRef = null;       // /users
var _membersRef = null;     // /guilds/guild_main/members
var _unsubGuild = null, _unsubUsers = null, _unsubMembers = null;
var _fbOk = false;
var _isSyncingGuild = false;

function fbInit() {
  if (typeof firebase === 'undefined') { setTimeout(fbInit, 800); return; }
  try {
    var app = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    _db         = firebase.firestore(app);
    _auth       = firebase.auth(app);
    _guildRef   = _db.collection('guilds').doc('guild_main');
    _usersRef   = _db.collection('users');
    _membersRef = _guildRef.collection('members');
    _fbOk       = true;
    _badge(true, 'OK');
    console.log('[FB] Connected. Auth state:', _auth.currentUser ? _auth.currentUser.email : 'not signed in');

    _auth.onAuthStateChanged(function(fbUser){
      if (fbUser) {
        console.log('[FB] Auth: signed in as', fbUser.email, fbUser.uid);
        // Re-listen sau khi sign in để Firestore Rules cho qua
        _listenGuild();
        _listenUsers();
        _listenMembers();
      } else {
        console.log('[FB] Auth: signed out');
      }
    });

    // Cũng listen ngay (cho case đã có user từ trước - cached auth)
    _listenGuild();
    _listenUsers();
    _listenMembers();
  } catch(e) {
    _fbOk = false;
    _badge(false, e.message);
    console.error('[FB] Init error:', e);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH HELPERS
// ════════════════════════════════════════════════════════════════════════════

function _usernameToFakeEmail(username) {
  var u = String(username || '').trim().toLowerCase();
  u = u.replace(/[^a-z0-9._-]/g, '_');
  if (!u) throw new Error('Username không hợp lệ');
  return u + FAKE_EMAIL_DOMAIN;
}

function _emailToUsername(email) {
  if (!email) return '';
  var idx = email.indexOf('@');
  return idx === -1 ? email : email.substring(0, idx);
}

/**
 * Đăng ký account mới.
 * profile = { name, inGameName, inGameId, discordId, class }
 * Trả về Promise<userDoc>
 */
function fbRegister(username, password, profile) {
  if (!_fbOk || !_auth) return Promise.reject(new Error('Firebase chưa kết nối'));
  var email = _usernameToFakeEmail(username);
  return _auth.createUserWithEmailAndPassword(email, password)
    .then(function(cred){
      var uid = cred.user.uid;
      var userDoc = {
        id: uid,
        username: username,
        name: profile.name || username,
        role: 'member',
        createdAt: new Date().toISOString()
      };
      var memberDoc = {
        id: uid,
        name: profile.name || username,
        inGameName: profile.inGameName || '',
        inGameId:   profile.inGameId   || '',
        discordId:  profile.discordId  || '',
        class:      profile.class      || '',
        power: 0, combatRole: '', skill: '', tasks: [], group: '', note: '',
        role: 'member',
        joinDate: new Date().toISOString().split('T')[0]
      };
      return Promise.all([
        _usersRef.doc(uid).set(userDoc),
        _membersRef.doc(uid).set(memberDoc)
      ]).then(function(){ return userDoc; });
    });
}

function fbLogin(username, password) {
  if (!_fbOk || !_auth) return Promise.reject(new Error('Firebase chưa kết nối'));
  var email = _usernameToFakeEmail(username);
  return _auth.signInWithEmailAndPassword(email, password)
    .then(function(cred){
      return _usersRef.doc(cred.user.uid).get();
    })
    .then(function(snap){
      if (!snap.exists) throw new Error('Tài khoản không tồn tại trong /users');
      return snap.data();
    });
}

function fbLogout() {
  if (_auth) return _auth.signOut();
  return Promise.resolve();
}

function fbCurrentUid() {
  return _auth && _auth.currentUser ? _auth.currentUser.uid : null;
}

// ════════════════════════════════════════════════════════════════════════════
// LISTENERS
// ════════════════════════════════════════════════════════════════════════════

function _listenGuild() {
  if (_unsubGuild) _unsubGuild();
  _unsubGuild = _guildRef.onSnapshot(function(snap) {
    if (!snap.exists) {
      console.log('[FB] /guilds/guild_main chưa tồn tại - bootstrap nếu admin');
      _bootstrapGuildIfEmpty();
      return;
    }
    if (_isSyncingGuild) return;
    var remote = snap.data();
    var hasMapImg = !!(remote.settings && Array.isArray(remote.settings.maps) && remote.settings.maps.some(function(m){return !!m.imageData;}));
    console.log('[FB] Guild synced. updatedAt=', remote.updatedAt, 'hasMapImg=', hasMapImg);

    var cache = null;
    try { cache = JSON.parse(localStorage.getItem(DB_KEY)); } catch(e){}
    var merged = Object.assign({}, remote, {
      members: (cache && cache.members) || []
    });

    // Update RAM cache với data đầy đủ (imageData còn nguyên)
    if (typeof _updateRamData === 'function') _updateRamData(merged);

    // localStorage cache: strip imageData để tránh quota
    try {
      var slim = (typeof _stripBigData === 'function') ? _stripBigData(merged) : merged;
      localStorage.setItem(DB_KEY, JSON.stringify(slim));
    } catch(e) {
      console.warn('[FB onSnapshot] localStorage write failed:', e.message);
    }

    _badge(true, _t(remote.updatedAt));
    if (window.currentPage && !document.querySelector('.modal-overlay'))
      setTimeout(function(){
        if (typeof renderPage === 'function') renderPage(window.currentPage);
      }, 200);
  }, function(e){ _badge(false, 'Error'); console.error('[FB] Guild listen error:', e.code, e.message); });
}

function _listenMembers() {
  if (_unsubMembers) _unsubMembers();
  _unsubMembers = _membersRef.onSnapshot(function(snap) {
    var members = [];
    snap.forEach(function(d){ members.push(d.data()); });
    console.log('[FB] Members synced:', members.length);

    // Update RAM cache (giữ imageData nếu có trong settings)
    var ram = (typeof _ramData !== 'undefined' && _ramData) ? _ramData : null;
    if (ram) {
      ram.members = members;
      if (typeof _updateRamData === 'function') _updateRamData(ram);
    }

    var cache = null;
    try { cache = JSON.parse(localStorage.getItem(DB_KEY)); } catch(e){}
    if (!cache) cache = (typeof DEFAULT_DATA !== 'undefined') ? JSON.parse(JSON.stringify(DEFAULT_DATA)) : {};
    cache.members = members;
    try {
      // localStorage: cache đã được strip từ trước nên không cần strip lại
      localStorage.setItem(DB_KEY, JSON.stringify(cache));
    } catch(e) {
      console.warn('[FB Members] localStorage write failed:', e.message);
    }

    if (window.currentPage && !document.querySelector('.modal-overlay')) {
      var p = window.currentPage;
      if (p === 'members' || p === 'dashboard' || p === 'tactics') {
        setTimeout(function(){
          if (typeof renderPage === 'function') renderPage(p);
        }, 100);
      }
    }
  }, function(e){ console.error('[FB] Members listen error:', e); });
}

function _listenUsers() {
  if (_unsubUsers) _unsubUsers();
  _unsubUsers = _usersRef.onSnapshot(function(snap) {
    var users = [];
    snap.forEach(function(d){ users.push(d.data()); });
    try { localStorage.setItem('nth_users', JSON.stringify(users)); } catch(e){}
    console.log('[FB] Users synced:', users.length);

    var sessRaw = sessionStorage.getItem('nth_session') || localStorage.getItem('nth_session');
    if (!sessRaw) return;
    try {
      var sess = JSON.parse(sessRaw);
      if (sess.id === 'admin' || sess.id === 'guest') return;
      var me = users.find(function(u){ return u.id === sess.id; });
      if (me && me.role !== sess.role) {
        console.log('[FB] Role changed:', sess.role, '→', me.role);
        var newSess = Object.assign({}, sess, { role: me.role });
        if (sessionStorage.getItem('nth_session'))
          sessionStorage.setItem('nth_session', JSON.stringify(newSess));
        else
          localStorage.setItem('nth_session', JSON.stringify(newSess));
        _updateRoleUI(me.role);
      }
      if (window.currentPage === 'accounts' && !document.querySelector('.modal-overlay'))
        setTimeout(function(){ if (typeof renderPage === 'function') renderPage('accounts'); }, 100);
    } catch(e){ console.error('[FB] Session update error:', e); }
  }, function(e){ console.error('[FB] Users listen error:', e); });
}

function _updateRoleUI(newRole) {
  if (typeof showToast === 'function') showToast('Quyền đã cập nhật: ' + newRole);
  var roleEl = document.querySelector('.user-role');
  if (roleEl) {
    var RLABELS = { admin:'👑 Admin', member:'👤 Member', guest:'🚪 Khách' };
    var rColors = { admin:'var(--accent-gold)', member:'var(--accent-cyan)', guest:'var(--text-muted)' };
    roleEl.textContent = RLABELS[newRole] || newRole;
    roleEl.style.color = rColors[newRole] || 'var(--text-secondary)';
  }
  if (typeof buildSidebar === 'function') {
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) {
      var nav = sidebarEl.querySelector('.sidebar-nav');
      if (nav && typeof PAGES !== 'undefined') {
        var admin = newRole === 'admin';
        nav.innerHTML = Object.entries(PAGES)
          .filter(function(e){ return !e[1].adminOnly || admin; })
          .map(function(e){
            return '<a class="nav-item" data-page="'+e[0]+'" href="#" onclick="renderPage(\''+e[0]+'\');return false;"><span class="nav-icon">'+e[1].icon+'</span><span>'+e[1].label+'</span></a>';
          }).join('');
        nav.querySelectorAll('.nav-item').forEach(function(el){
          el.classList.toggle('active', el.dataset.page === window.currentPage);
        });
      }
    }
  }
  if (window.currentPage && typeof renderPage === 'function')
    setTimeout(function(){ renderPage(window.currentPage); }, 300);
}

// ════════════════════════════════════════════════════════════════════════════
// MEMBERS WRITE API
// ════════════════════════════════════════════════════════════════════════════

window.MembersFB = {
  add: function(member) {
    if (!_fbOk || !_membersRef) return Promise.reject(new Error('Firebase chưa kết nối'));
    var doc = Object.assign({}, member);
    if (!doc.id) doc.id = _membersRef.doc().id;
    return _membersRef.doc(doc.id).set(doc).then(function(){ return doc; });
  },
  update: function(id, patch) {
    if (!_fbOk || !_membersRef) return Promise.reject(new Error('Firebase chưa kết nối'));
    return _membersRef.doc(id).set(patch, { merge: true });
  },
  delete: function(id) {
    if (!_fbOk || !_membersRef) return Promise.reject(new Error('Firebase chưa kết nối'));
    return _membersRef.doc(id).delete();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// USERS WRITE API (admin cấp quyền / xóa)
// ════════════════════════════════════════════════════════════════════════════

window.UsersFB = {
  setRole: function(userId, role) {
    if (!_fbOk || !_usersRef) return Promise.reject(new Error('Firebase chưa kết nối'));
    return _usersRef.doc(userId).set({ role: role }, { merge: true });
  },
  delete: function(userId) {
    if (!_fbOk || !_usersRef) return Promise.reject(new Error('Firebase chưa kết nối'));
    // Xóa user doc + member doc cùng UID (nếu có)
    return Promise.all([
      _usersRef.doc(userId).delete(),
      _membersRef.doc(userId).delete().catch(function(){})
    ]);
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GUILD DOC SAVE - settings, currentSession, sessions (KHÔNG có members)
// ════════════════════════════════════════════════════════════════════════════

window.saveData = function(data) {
  // Update RAM cache (chứa imageData đầy đủ)
  if (typeof _updateRamData === 'function') _updateRamData(data);

  var dataNoMembers = Object.assign({}, data);
  delete dataNoMembers.members;
  dataNoMembers.updatedAt = Date.now();

  // Debug: check imageData trước khi push
  var hasImg = !!(dataNoMembers.settings && Array.isArray(dataNoMembers.settings.maps) && dataNoMembers.settings.maps.some(function(m){return !!m.imageData;}));
  var docSize = JSON.stringify(dataNoMembers).length;
  console.log('[saveData] hasImg=', hasImg, 'docSize=', Math.round(docSize/1024), 'KB', 'isAdmin=', _isAdmin(), 'fbOk=', _fbOk);

  // Cache local cho reload — strip imageData để không bị quota
  try {
    var slim = (typeof _stripBigData === 'function') ? _stripBigData(data) : data;
    var slimWithUpdated = Object.assign({}, slim, { updatedAt: dataNoMembers.updatedAt });
    localStorage.setItem(DB_KEY, JSON.stringify(slimWithUpdated));
  } catch(e) {
    console.warn('[saveData] localStorage write failed:', e.message);
  }

  if (_fbOk && _guildRef && _isAdmin()) {
    _isSyncingGuild = true;
    _guildRef.set(dataNoMembers, { merge: true })
      .then(function(){
        _isSyncingGuild = false;
        _badge(true, _t(dataNoMembers.updatedAt));
        console.log('[saveData] ✅ Firebase write OK');
      })
      .catch(function(e){
        _isSyncingGuild = false;
        console.error('[saveData] ❌ Firebase write FAILED:', e.code, e.message);
        if (typeof showToast === 'function')
          showToast('❌ Lỗi push Firebase: ' + (e.code || e.message), 'error', 5000);
      });
  } else {
    console.warn('[saveData] ⚠ Skipped Firebase push. _fbOk=', _fbOk, '_guildRef=', !!_guildRef, '_isAdmin=', _isAdmin());
  }
  return true;
};

// ════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP + ADMIN PUSH
// ════════════════════════════════════════════════════════════════════════════

function _bootstrapGuildIfEmpty() {
  if (!_fbOk || !_guildRef) return;
  if (!_isAdmin()) return;
  _guildRef.get().then(function(s){
    if (s.exists) return;
    console.log('[FB] Bootstrap: pushing initial data');
    var data = (typeof loadData === 'function') ? loadData() : null;
    if (!data) return;
    var d = Object.assign({}, data); delete d.members;
    d.updatedAt = Date.now();
    _guildRef.set(d).catch(function(e){ console.error('[FB] Bootstrap error:', e); });
  });
}

window.fbPushNow = function() {
  var btn = document.querySelector('button[onclick="fbPushNow()"]');
  function setBtn(t,d){ if(btn){btn.textContent=t;btn.disabled=d;} }
  function done(msg, ok){ setBtn('🔥 Push Firebase',false); if(typeof showToast==='function') showToast(msg, ok?'success':'error', 5000); }

  if (!_isAdmin()) { done('❌ Chỉ admin mới push được', false); return; }
  if (!_fbOk || !_guildRef) { done('❌ Firebase chưa kết nối', false); return; }

  setBtn('⏳ Đang push...', true);
  var data = loadData();
  var dataNoMembers = Object.assign({}, data); delete dataNoMembers.members;
  dataNoMembers.updatedAt = Date.now();

  _guildRef.set(dataNoMembers, { merge: true })
    .then(function(){
      var batch = _db.batch();
      (data.members || []).forEach(function(m){
        if (m && m.id) batch.set(_membersRef.doc(m.id), m, { merge: true });
      });
      return batch.commit();
    })
    .then(function(){
      done('✅ Đã push '+(data.members||[]).length+' thành viên + settings lên Firebase', true);
    })
    .catch(function(e){
      done(e.code==='permission-denied'
        ? '❌ Firestore Rules chặn ghi! Vào Firebase Console → Rules'
        : '❌ Lỗi: '+e.message, false);
    });
};

// ════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════════════════

function _isAdmin() {
  try {
    var s = sessionStorage.getItem('nth_session') || localStorage.getItem('nth_session');
    return !!(s && JSON.parse(s).role === 'admin');
  } catch(e){ return false; }
}
function _getRole() {
  try {
    var s = sessionStorage.getItem('nth_session') || localStorage.getItem('nth_session');
    return s ? JSON.parse(s).role : '?';
  } catch(e){ return '?'; }
}
function _t(ts){ return ts ? new Date(ts).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : ''; }

function _badge(ok, msg) {
  setTimeout(function(){
    var el = document.getElementById('fb-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fb-badge';
      el.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:12px;cursor:pointer;white-space:nowrap';
      el.onclick = function(){
        if (_fbOk && _guildRef) _guildRef.get().then(function(s){
          if (typeof showToast === 'function')
            showToast(s.exists ? '✅ Firebase OK — '+_t(s.data().updatedAt) : '⚠️ Chưa có data — bấm Push Firebase');
        });
      };
      var bar = document.querySelector('.topbar-actions');
      if (bar) bar.insertBefore(el, bar.firstChild);
    }
    el.style.background = ok ? '#052e16' : '#1c1400';
    el.style.border = '1px solid '+(ok ? '#16a34a' : '#d97706');
    el.style.color = ok ? '#4ade80' : '#fbbf24';
    el.textContent = ok ? '🔥 Firebase' : '🟡 '+(msg || 'Local');
  }, 400);
}

function renderFirebaseConfigUI() {
  return '<div class="cfg-section" style="border-color:'+(_fbOk?'#16a34a44':'#dc262644')+'">' +
    '<div class="section-header"><span class="section-title">🔥 Firebase</span>' +
    '<span style="font-size:12px;padding:3px 12px;border-radius:20px;'+(_fbOk?'background:#052e16;border:1px solid #16a34a;color:#4ade80':'background:#1c1400;border:1px solid #d97706;color:#fbbf24')+'">' +
    (_fbOk ? '🔥 nhatmongdata' : '🟡 Chưa kết nối')+'</span></div>' +
    '<div style="color:var(--text-secondary);font-size:13px;margin-top:8px">Role hiện tại: <strong>'+_getRole()+'</strong></div>' +
    '</div>';
}

setTimeout(fbInit, 800);
