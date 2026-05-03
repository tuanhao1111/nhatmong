/**
 * firebase.js - nhatmongdata
 * KHÔNG dùng window.location.reload() - tránh redirect loop
 */

var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBszK09g8sHvufGNrFwDDgcw6rolV37KSA",
  authDomain:        "nhatmongdata.firebaseapp.com",
  projectId:         "nhatmongdata",
  storageBucket:     "nhatmongdata.firebasestorage.app",
  messagingSenderId: "814787062547",
  appId:             "1:814787062547:web:c4ca571227c5a5555688e6"
};

var _db = null, _guildRef = null, _usersRef = null;
var _unsubGuild = null, _unsubUsers = null;
var _fbOk = false;
var _isSyncing = false;

function fbInit() {
  if (typeof firebase === 'undefined') { setTimeout(fbInit, 800); return; }
  try {
    var app = firebase.apps.length ? firebase.apps[0] : firebase.initializeApp(FIREBASE_CONFIG);
    _db       = firebase.firestore(app);
    _guildRef = _db.collection('guilds').doc('guild_main');
    _usersRef = _db.collection('users');
    _fbOk     = true;
    _badge(true, 'OK');
    console.log('[FB] Connected. Role=' + _getRole());
    _listenGuild();
    _listenUsers();
    if (_isAdmin()) {
      _guildRef.get().then(function(s) {
        if (!s.exists) { console.log('[FB] Empty - auto push'); _rawPush(); }
      });
    }
  } catch(e) {
    _fbOk = false;
    _badge(false, e.message);
    console.error('[FB] Init error:', e);
  }
}

function _listenGuild() {
  if (_unsubGuild) _unsubGuild();
  _unsubGuild = _guildRef.onSnapshot(function(snap) {
    if (!snap.exists) return;
    if (_isSyncing) return; // skip khi đang push local lên
    var remote = snap.data();
    var localTs = 0;
    try { localTs = (JSON.parse(localStorage.getItem(DB_KEY))||{}).updatedAt||0; } catch(e){}
    if ((remote.updatedAt||0) > localTs) {
      try { localStorage.setItem(DB_KEY, JSON.stringify(remote)); } catch(e){}
      _badge(true, _t(remote.updatedAt));
      console.log('[FB] Guild data updated from server');
      if (window.currentPage && typeof renderPage === 'function' && !document.querySelector('.modal-overlay')) {
        setTimeout(function(){ renderPage(window.currentPage); }, 200);
      }
    } else {
      _badge(true, 'Synced');
    }
  }, function(e){ _badge(false, 'Error'); console.error('[FB] Guild listen error:', e); });
}

function _listenUsers() {
  if (_unsubUsers) _unsubUsers();
  _unsubUsers = _usersRef.onSnapshot(function(snap) {
    var users = [];
    snap.forEach(function(d){ users.push(d.data()); });
    if (!users.length) return;

    try { localStorage.setItem('nth_users', JSON.stringify(users)); } catch(e){}
    console.log('[FB] Users synced:', users.length);

    // Check role change - KHÔNG reload, chỉ cập nhật session + re-render sidebar
    var sessRaw = sessionStorage.getItem('nth_session') || localStorage.getItem('nth_session');
    if (!sessRaw) return;
    try {
      var sess = JSON.parse(sessRaw);
      if (sess.id === 'admin' || sess.id === 'guest') return;
      var me = users.find(function(u){ return u.id === sess.id; });
      if (me && me.role !== sess.role) {
        console.log('[FB] Role changed:', sess.role, '->', me.role);
        // Cập nhật session với role mới
        var newSess = Object.assign({}, sess, { role: me.role });
        if (sessionStorage.getItem('nth_session'))
          sessionStorage.setItem('nth_session', JSON.stringify(newSess));
        else
          localStorage.setItem('nth_session', JSON.stringify(newSess));

        // Cập nhật UI mà KHÔNG reload trang - tránh redirect loop
        _updateRoleUI(me.role);
      }
    } catch(e){ console.error('[FB] Session update error:', e); }
  }, function(e){ console.error('[FB] Users listen error:', e); });
}

// Cập nhật UI khi role thay đổi - KHÔNG reload trang
function _updateRoleUI(newRole) {
  // Hiện thông báo
  if (typeof showToast === 'function')
    showToast('Quyền đã cập nhật: ' + newRole);

  // Cập nhật badge role trong sidebar footer
  var roleEl = document.querySelector('.user-role');
  if (roleEl) {
    var RLABELS = { admin:'👑 Admin', member:'👤 Member', guest:'🚪 Khách' };
    var rColors  = { admin:'var(--accent-gold)', member:'var(--accent-cyan)', guest:'var(--text-muted)' };
    roleEl.textContent = RLABELS[newRole] || newRole;
    roleEl.style.color = rColors[newRole] || 'var(--text-secondary)';
  }

  // Rebuild sidebar để hiện/ẩn menu admin
  if (typeof buildSidebar === 'function' && typeof initApp === 'function') {
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) {
      // Re-render chỉ phần sidebar nav
      var nav = sidebarEl.querySelector('.sidebar-nav');
      if (nav && typeof PAGES !== 'undefined') {
        var admin = newRole === 'admin';
        nav.innerHTML = Object.entries(PAGES)
          .filter(function(e){ return !e[1].adminOnly || admin; })
          .map(function(e){ 
            return '<a class="nav-item" data-page="'+e[0]+'" href="#" onclick="renderPage(\''+e[0]+'\');return false;"><span class="nav-icon">'+e[1].icon+'</span><span>'+e[1].label+'</span></a>';
          }).join('');
        // Re-highlight active page
        nav.querySelectorAll('.nav-item').forEach(function(el){
          el.classList.toggle('active', el.dataset.page === window.currentPage);
        });
      }
    }
  }

  // Re-render trang hiện tại để áp dụng permission mới
  if (window.currentPage && typeof renderPage === 'function')
    setTimeout(function(){ renderPage(window.currentPage); }, 300);
}

window.saveData = function(data) {
  var ts = Date.now();
  var dataWithTs = Object.assign({}, data, { updatedAt: ts });
  var ok = false;
  try { localStorage.setItem(DB_KEY, JSON.stringify(dataWithTs)); ok = true; } catch(e){}
  if (_fbOk && _guildRef && _isAdmin()) {
    _isSyncing = true;
    _guildRef.set(dataWithTs)
      .then(function(){ _isSyncing = false; _badge(true, _t(ts)); })
      .catch(function(e){ _isSyncing = false; console.error('[FB] Save error:', e); });
  }
  return ok;
};

(function(){
  var orig = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    orig(key, value);
    if (key === 'nth_users' && _fbOk && _usersRef) {
      try {
        JSON.parse(value).forEach(function(u){
          if (u && u.id) _usersRef.doc(u.id).set(u).catch(function(){});
        });
      } catch(e){}
    }
  };
})();

function _rawPush(cb) {
  if (!_guildRef) { if(cb) cb(new Error('no ref')); return; }
  var data = loadData();
  _guildRef.set(Object.assign({}, data, { updatedAt: Date.now() }))
    .then(function(){ if(cb) cb(null); })
    .catch(function(e){ if(cb) cb(e); });
}

window.fbPushNow = function() {
  var btn = document.querySelector('button[onclick="fbPushNow()"]');
  function setBtn(t,d){ if(btn){btn.textContent=t;btn.disabled=d;} }
  function done(msg, ok){ setBtn('🔥 Push Firebase',false); if(typeof showToast==='function') showToast(msg, ok?'success':'error', 5000); }

  function go() {
    if (!_fbOk || !_guildRef) { done('❌ Firebase chưa kết nối — mở F12 xem Console',false); return; }
    setBtn('⏳ Đang push...',true);
    _rawPush(function(err){
      if (err) {
        done(err.code==='permission-denied'
          ? '❌ Firestore Rules chặn ghi! Vào Firebase Console → Rules → sửa'
          : '❌ Lỗi: '+err.message, false);
      } else {
        // Push users
        var users=[];
        try{users=JSON.parse(localStorage.getItem('nth_users'))||[];}catch(e){}
        users.forEach(function(u){ if(u&&u.id) _usersRef.doc(u.id).set(u).catch(function(){}); });
        done('✅ Đã push '+(loadData().members||[]).length+' thành viên lên Firebase!', true);
      }
    });
  }

  if (!_fbOk) {
    setBtn('⏳ Chờ Firebase...',true);
    var w=0, iv=setInterval(function(){ w+=300; if(_fbOk||w>=6000){clearInterval(iv);go();} },300);
  } else { go(); }
};

function _isAdmin() {
  try { var s=sessionStorage.getItem('nth_session')||localStorage.getItem('nth_session'); return !!(s&&JSON.parse(s).role==='admin'); } catch(e){return false;}
}
function _getRole() {
  try { var s=sessionStorage.getItem('nth_session')||localStorage.getItem('nth_session'); return s?JSON.parse(s).role:'?'; } catch(e){return '?';}
}
function _t(ts){ return ts?new Date(ts).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):''; }

function _badge(ok, msg) {
  setTimeout(function(){
    var el=document.getElementById('fb-badge');
    if (!el) {
      el=document.createElement('div');
      el.id='fb-badge';
      el.style.cssText='font-size:11px;padding:3px 10px;border-radius:12px;cursor:pointer;white-space:nowrap';
      el.onclick=function(){ if(_fbOk&&_guildRef) _guildRef.get().then(function(s){ if(typeof showToast==='function') showToast(s.exists?'✅ Firebase OK — '+_t(s.data().updatedAt):'⚠️ Chưa có data — bấm Push Firebase'); }); };
      var bar=document.querySelector('.topbar-actions');
      if(bar) bar.insertBefore(el,bar.firstChild);
    }
    el.style.background=ok?'#052e16':'#1c1400';
    el.style.border='1px solid '+(ok?'#16a34a':'#d97706');
    el.style.color=ok?'#4ade80':'#fbbf24';
    el.textContent=ok?'🔥 Firebase':'🟡 '+(msg||'Local');
  },400);
}

function renderFirebaseConfigUI() {
  return '<div class="cfg-section" style="border-color:'+(_fbOk?'#16a34a44':'#dc262644')+'">' +
    '<div class="section-header"><span class="section-title">🔥 Firebase</span>' +
    '<span style="font-size:12px;padding:3px 12px;border-radius:20px;'+(_fbOk?'background:#052e16;border:1px solid #16a34a;color:#4ade80':'background:#1c1400;border:1px solid #d97706;color:#fbbf24')+'">' +
    (_fbOk?'🔥 nhatmongdata':'🟡 Chưa kết nối')+'</span></div>' +
    '<div style="color:var(--text-secondary);font-size:13px;margin-top:8px">Role hiện tại: <strong>'+_getRole()+'</strong></div>' +
    '</div>';
}

setTimeout(fbInit, 800);
