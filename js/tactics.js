/**
 * tactics.js - Bản đồ chiến thuật tương tác
 * - Drag & drop markers (team + custom)  
 * - Panel đội hình đầy đủ slot tích hợp
 * - Sẵn sàng migrate sang Firebase
 */

/* ═══════════════════════════════════════════════════════════════
   GLOBAL DRAG STATE — nằm ngoài mọi function, persist qua renders
═══════════════════════════════════════════════════════════════ */
var _TM = [];          // team markers  [{teamIndex, x, y, color}]
var _CM = [];          // custom markers [{id, type, icon, label, x, y}]
var _tmAdmin = false;
var _tmDrag = null;    // null | {kind:'tm'|'cm', idx, el, delEl}

/* ── Drag helpers ── */
function _tmClient(e) {
  var t = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0];
  return t ? {x:t.clientX, y:t.clientY} : {x:e.clientX, y:e.clientY};
}
function _tmPct(cx, cy) {
  var w = document.getElementById('tmap-wrap');
  if (!w) return {x:50,y:50};
  var r = w.getBoundingClientRect();
  return {
    x: Math.max(1, Math.min(99, +((cx-r.left)/r.width *100).toFixed(2))),
    y: Math.max(1, Math.min(99, +((cy-r.top) /r.height*100).toFixed(2)))
  };
}

function _tmPointerDown(e, kind, idx, el, delEl) {
  if (!_tmAdmin) return;
  e.preventDefault(); e.stopPropagation();
  _tmDrag = {kind:kind, idx:idx, el:el, delEl:delEl||null, moved:false, ox:_tmClient(e).x, oy:_tmClient(e).y};
  el.style.cursor  = 'grabbing';
  el.style.zIndex  = '100';
}

function _tmPointerMove(e) {
  if (!_tmDrag) return;
  e.preventDefault();
  var c = _tmClient(e);
  if (Math.abs(c.x-_tmDrag.ox)>2 || Math.abs(c.y-_tmDrag.oy)>2) _tmDrag.moved = true;
  var p = _tmPct(c.x, c.y);
  var el = _tmDrag.el;
  el.style.left = p.x+'%'; el.style.top = p.y+'%';
  if (_tmDrag.kind === 'tm') {
    _TM[_tmDrag.idx].x = p.x; _TM[_tmDrag.idx].y = p.y;
  } else {
    _CM[_tmDrag.idx].x = p.x; _CM[_tmDrag.idx].y = p.y;
    if (_tmDrag.delEl) {
      _tmDrag.delEl.style.left = 'calc('+p.x+'% + 13px)';
      _tmDrag.delEl.style.top  = 'calc('+p.y+'% - 13px)';
    }
  }
}

function _tmPointerUp() {
  if (!_tmDrag) return;
  var el = _tmDrag.el;
  el.style.cursor = _tmAdmin ? 'grab' : 'default';
  el.style.zIndex = '';
  _tmDrag = null;
  _tmSave();
}

/* ── Attach once ── */
document.addEventListener('mousemove', _tmPointerMove, {passive:false});
document.addEventListener('mouseup',   _tmPointerUp);
document.addEventListener('touchmove', _tmPointerMove, {passive:false});
document.addEventListener('touchend',  _tmPointerUp);

function _tmSave() {
  var cur = Sessions.getCurrent(); if (!cur) return;
  Sessions.updateCurrent({
    tactics: Object.assign({}, cur.tactics||{}, {markers:_TM, customMarkers:_CM})
  });
}

/* ── Render team markers ── */
function _tmRenderTeam() {
  var wrap = document.getElementById('tmap-wrap'); if (!wrap) return;
  wrap.querySelectorAll('.tm-mk').forEach(function(e){e.remove();});
  _TM.forEach(function(mk, ti) {
    var el = document.createElement('div');
    el.className = 'tm-mk'; el.id = 'tmk-'+ti;
    el.textContent = 'T'+(ti+1);
    el.style.cssText =
      'position:absolute;width:36px;height:36px;border-radius:50%;'+
      'display:flex;align-items:center;justify-content:center;'+
      'font-weight:800;font-size:13px;font-family:var(--font-display);color:#111;'+
      'border:2px solid rgba(255,255,255,0.35);'+
      'box-shadow:0 2px 10px rgba(0,0,0,0.8);'+
      'transform:translate(-50%,-50%);'+
      'cursor:'+(_tmAdmin?'grab':'pointer')+';'+
      'z-index:10;touch-action:none;user-select:none;'+
      'background:'+mk.color+';left:'+mk.x+'%;top:'+mk.y+'%;'+
      'transition:box-shadow 0.15s;';
    (function(i, elem){
      elem.addEventListener('mousedown',  function(e){ _tmPointerDown(e,'tm',i,elem,null); });
      elem.addEventListener('touchstart', function(e){ _tmPointerDown(e,'tm',i,elem,null); },{passive:false});
      elem.addEventListener('click', function(){
        if (!(_tmDrag && _tmDrag.moved)) _tmFocusTeam(i);
      });
    })(ti, el);
    wrap.appendChild(el);
  });
}

/* ── Render custom markers ── */
function _tmRenderCustom() {
  var wrap = document.getElementById('tmap-wrap'); if (!wrap) return;
  wrap.querySelectorAll('.cm-mk,.cm-del').forEach(function(e){e.remove();});
  _CM.forEach(function(mk, ci) {
    var el = document.createElement('div');
    el.className = 'cm-mk'; el.id = 'cmk-'+ci;
    el.textContent = mk.icon;
    el.style.cssText =
      'position:absolute;font-size:26px;line-height:1;'+
      'transform:translate(-50%,-50%);'+
      'cursor:'+(_tmAdmin?'grab':'default')+';'+
      'z-index:11;touch-action:none;user-select:none;'+
      'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.9));'+
      'left:'+mk.x+'%;top:'+mk.y+'%;';
    var delEl = null;
    if (_tmAdmin) {
      delEl = document.createElement('div');
      delEl.className = 'cm-del'; delEl.id = 'cmd-'+ci;
      delEl.textContent = '×';
      delEl.style.cssText =
        'position:absolute;width:18px;height:18px;border-radius:50%;'+
        'background:#dc2626;border:2px solid white;color:white;'+
        'font-size:11px;font-weight:900;display:flex;align-items:center;'+
        'justify-content:center;cursor:pointer;z-index:20;'+
        'transform:translate(-50%,-50%);'+
        'left:calc('+mk.x+'% + 13px);top:calc('+mk.y+'% - 13px);';
      (function(i){ delEl.addEventListener('click',function(e){
        e.stopPropagation(); _CM.splice(i,1); _tmRenderCustom(); _tmSave();
      }); })(ci);
    }
    (function(i,e2,d2){
      e2.addEventListener('mousedown',  function(e){ _tmPointerDown(e,'cm',i,e2,d2); });
      e2.addEventListener('touchstart', function(e){ _tmPointerDown(e,'cm',i,e2,d2); },{passive:false});
    })(ci, el, delEl);
    wrap.appendChild(el);
    if (delEl) wrap.appendChild(delEl);
  });
}

/* ── Focus team ── */
function _tmFocusTeam(ti) {
  document.querySelectorAll('.tm-mk').forEach(function(m){
    m.style.boxShadow='0 2px 10px rgba(0,0,0,0.8)';
  });
  document.querySelectorAll('.team-panel').forEach(function(p){
    p.style.outline='none';
  });
  var mk = document.getElementById('tmk-'+ti);
  if (mk) mk.style.boxShadow = '0 0 0 3px #fff, 0 0 0 5px gold';
  var panel = document.getElementById('tpanel-'+ti);
  if (panel) { panel.style.outline='2px solid gold'; panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}

/* ═══════════════════════════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════════════════════════ */
function renderTacticsPage() {
  var session  = Sessions.getCurrent();
  var settings = Settings.get();
  var admin    = isAdmin();
  var maps     = settings.maps || [];
  var mapId    = (session&&session.map) || settings.currentMap || (maps[0]&&maps[0].id) || '';
  var mapObj   = maps.find(function(m){return m.id===mapId;}) || maps[0];
  var mapImg   = mapObj ? getMapImage(mapObj.id) : '';
  var numTeams = settings.numTeams || 10;

  var FALLBACK = ['#22c55e','#40c0e0','#f0c040','#f59e0b','#f28e99','#e05050','#9060e0','#f97316','#ec4899','#14b8a6'];
  var ROLE_COLOR_MAP = { luong:'#f0c040', cong:'#e05050', thu:'#5090e0', tro:'#50d0a0' };

  /* Màu team — theo vai trò admin chọn (team.role) */
  function teamColor(ti) {
    var team = session&&session.teams&&session.teams[ti];
    if (!team) return FALLBACK[ti%FALLBACK.length];
    if (team.role && ROLE_COLOR_MAP[team.role]) return ROLE_COLOR_MAP[team.role];
    return FALLBACK[ti%FALLBACK.length];
  }

  /* Init global state */
  _tmAdmin = admin;
  var savedMarkers = session&&session.tactics&&session.tactics.markers;
  _TM = buildDefaultMarkers(numTeams).map(function(def,i){
    var saved = savedMarkers&&savedMarkers.find(function(m){return m.teamIndex===i;});
    return { teamIndex:i, x: saved?saved.x:def.x, y: saved?saved.y:def.y, color: teamColor(i) };
  });
  _CM = (session&&session.tactics&&session.tactics.customMarkers||[]).map(function(m){return Object.assign({},m);});

  /* Map dropdown */
  var mapOpts = maps.map(function(m){
    return '<option value="'+m.id+'"'+(m.id===mapId?' selected':'')+'>'+escHtml(m.name)+'</option>';
  }).join('');

  /* Custom marker types */
  var CTYPES = [
    {id:'flag',  icon:'🚩',label:'Cờ'},       {id:'target',icon:'🎯',label:'Mục tiêu'},
    {id:'danger',icon:'⚠', label:'Nguy hiểm'},{id:'rally', icon:'⚔', label:'Tập kết'},
    {id:'defend',icon:'🛡', label:'Phòng thủ'},{id:'star',  icon:'⭐',label:'Điểm chính'}
  ];
  var toolbarHtml = '';
  if (admin) {
    toolbarHtml = '<div style="display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;align-items:center;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px">'+
      '<span style="font-size:12px;color:var(--text-secondary);font-weight:600;white-space:nowrap">➕ Thêm marker:</span>'+
      CTYPES.map(function(t){
        return '<button class="btn btn-outline" style="padding:5px 11px;font-size:12px;display:flex;align-items:center;gap:4px"'+
          ' onclick="tacticsAddCustom(\''+t.id+'\',\''+t.icon+'\',\''+t.label+'\')">'+t.icon+' '+t.label+'</button>';
      }).join('')+
      '</div>';
  }

  /* ── Team panels ───────────────────────────────────────────── */
  var ROLE = {
    luong:{icon:'🌾',color:'#f0c040',name:'Lương'},
    cong: {icon:'⚔', color:'#e05050',name:'Công'},
    thu:  {icon:'🛡', color:'#5090e0',name:'Thủ'},
    tro:  {icon:'💠', color:'#50d0a0',name:'Trợ'}
  };

  var panelsHtml = '';
  if (!session) {
    panelsHtml = '<div style="color:var(--text-muted);text-align:center;padding:20px;font-size:13px">Chưa có đợt bang chiến</div>';
  } else {
    for (var ti=0; ti<session.teams.length; ti++) {
      var team   = session.teams[ti];
      var tc     = teamColor(ti);
      // Tên hiển thị: vai trò team (admin chọn)
      var ROLE_NAMES = { luong:'🌾 Lương', cong:'⚔ Công', thu:'🛡 Thủ', tro:'💠 Trợ' };
      var tgName = (team.role && ROLE_NAMES[team.role]) ? ROLE_NAMES[team.role] : 'Chưa xếp';
      var filled = 0; for(var x=0;x<team.slots.length;x++){if(team.slots[x])filled++;}

      /* ── Slots ── */
      var slotsHtml = '';
      for (var si=0; si<team.slots.length; si++) {
        var slot = team.slots[si];
        if (!slot) {
          if (admin) {
            slotsHtml +=
              '<div class="tp-slot tp-empty" onclick="openAssignModal('+ti+','+si+',false)">'+
                '<span class="tp-slotnum">'+'\u2015'+'&nbsp;Slot '+(si+1)+'</span>'+
                '<span class="tp-plus">+</span>'+
              '</div>';
          } else {
            slotsHtml +=
              '<div class="tp-slot tp-empty" style="cursor:default">'+
                '<span class="tp-slotnum">'+'\u2015'+'&nbsp;Slot '+(si+1)+'</span>'+
              '</div>';
          }
        } else {
          var rm  = ROLE[slot.combatRole]||null;
          var cls = settings.classes.find(function(c){return c.id===slot.class;});
          var cc  = cls?cls.color:'#888';
          var cn  = cls?cls.name:'';
          var ski = slot.skill?loadImageFromStorage('skill_'+slot.skill):'';
          var fn  = admin?('openSlotMenu('+ti+','+si+',false)'):('tacticsViewSlot('+JSON.stringify({ti:ti,si:si})+')');
          slotsHtml +=
            '<div class="tp-slot tp-filled" onclick="'+fn+'" style="border-left:3px solid '+(rm?rm.color:cc)+'">'+
              '<div style="display:flex;align-items:center;gap:5px;min-width:0">'+
                '<span style="font-size:13px;flex-shrink:0">'+(rm?rm.icon:'·')+'</span>'+
                '<span style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">'+escHtml(slot.inGameName||slot.name)+'</span>'+
                (ski?'<img src="'+ski+'" style="width:14px;height:14px;border-radius:2px;object-fit:cover;flex-shrink:0">':'')+
              '</div>'+
              '<div style="font-size:10px;color:'+cc+';margin-top:2px">'+escHtml(cn)+(rm?' &middot; <span style="color:'+rm.color+'">'+rm.name+'</span>':'')+'</div>'+
            '</div>';
        }
      }

      panelsHtml +=
        '<div class="team-panel" id="tpanel-'+ti+'" style="border-top:3px solid '+tc+';background:var(--bg-card);border-radius:8px;overflow:hidden">'+
          '<div class="tp-header" onclick="_tmFocusTeam('+ti+')" style="padding:8px 10px;background:#0c0c1c;display:flex;align-items:center;gap:7px;cursor:pointer">'+
            '<span style="background:'+tc+';color:#111;padding:2px 9px;border-radius:12px;font-size:12px;font-weight:800;font-family:var(--font-display);flex-shrink:0">T'+(ti+1)+'</span>'+
            '<span style="font-size:10px;color:'+tc+';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+escHtml(tgName)+'</span>'+
            '<span style="font-size:11px;color:var(--text-muted);flex-shrink:0">'+filled+'/'+team.slots.length+'</span>'+
          '</div>'+
          '<div class="tp-slots-list">'+slotsHtml+'</div>'+
        '</div>';
    }
  }

  /* ── Legend (theo vai trò) ── */
  var legendHtml='';
  var ROLE_LEGEND = [
    { id:'luong', name:'🌾 Lương', color:'#f0c040' },
    { id:'cong',  name:'⚔ Công',   color:'#e05050' },
    { id:'thu',   name:'🛡 Thủ',   color:'#5090e0' },
    { id:'tro',   name:'💠 Trợ',   color:'#50d0a0' }
  ];
  ROLE_LEGEND.forEach(function(r){
    legendHtml+='<span style="padding:4px 10px;background:'+r.color+'18;border:1px solid '+r.color+'44;border-radius:14px;font-size:11px;font-weight:600;color:'+r.color+'">'+r.name+'</span>';
  });

  /* ── Notes ── */
  var notes = (session&&session.tactics&&session.tactics.notes)||'';
  var notesHtml = admin
    ? '<textarea id="tactics-notes" rows="3" style="width:100%;background:#0f0f1e;resize:vertical;font-size:14px;border-radius:6px;padding:10px" placeholder="Ghi chép chiến thuật..." onblur="tacticsSaveNotes()">'+escHtml(notes)+'</textarea>'
    : '<div style="background:#0f0f1e;border-radius:6px;padding:12px;white-space:pre-wrap;min-height:44px;font-size:14px;line-height:1.7;color:var(--text-'+(notes?'primary':'muted')+')">'+( escHtml(notes)||'<em>Chưa có ghi chú</em>' )+'</div>';

  /* ── Map image or placeholder ── */
  var mapHtml = mapImg
    ? '<img id="tmap-img" src="'+mapImg+'" style="display:block;width:100%;height:auto;border-radius:9px;pointer-events:none;-webkit-user-drag:none">'
    : '<div style="width:100%;aspect-ratio:16/7;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#111120;color:var(--text-muted);font-size:14px;gap:10px;border-radius:9px">'+
        '<div style="font-size:40px">🗺</div><div>Chưa có ảnh bản đồ</div>'+
        (admin?'<button class="btn btn-outline" onclick="renderPage(\'settings\')">Upload ảnh ở Cấu Hình</button>':'')+
      '</div>';

  return (
    /* ── CSS ── */
    '<style>'+
    '#tmap-wrap{position:relative;border-radius:10px;border:1px solid var(--border-color);background:#1a1510;user-select:none;-webkit-user-select:none;overflow:visible}'+
    '#tct-layout{display:grid;grid-template-columns:1fr 270px;gap:14px;align-items:start}'+
    '@media(max-width:920px){#tct-layout{grid-template-columns:1fr}}'+
    '.tp-panel-wrap{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 210px);overflow-y:auto;padding-right:4px}'+
    '.team-panel{transition:outline 0.15s}'+
    '.tp-slots-list{padding:6px;display:flex;flex-direction:column;gap:4px}'+
    '.tp-slot{padding:6px 9px;border-radius:5px;font-size:11px;transition:background 0.1s}'+
    '.tp-empty{background:#0c0c1c;border:1px dashed #2a2a40;display:flex;justify-content:space-between;align-items:center;'+(admin?'cursor:pointer':'cursor:default')+'}'+
    (admin?'.tp-empty:hover{border-color:var(--accent-gold)}':'')+
    '.tp-filled{background:#111124;cursor:pointer;border-left:3px solid transparent}'+
    '.tp-filled:hover{background:#1a1a35}'+
    '.tp-slotnum{font-size:10px;color:var(--text-muted)}'+
    '.tp-plus{color:var(--text-muted);font-size:14px}'+
    '</style>'+

    /* ── Header ── */
    '<div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">'+
      '<div><div class="page-title">Chỉ Đạo Chiến Thuật</div>'+
      '<div class="page-subtitle">Kéo thả marker để phân công vị trí '+(admin?'':'(chế độ xem)')+'</div></div>'+
      '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">'+
        (maps.length>0?'<div><label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px">BẢN ĐỒ</label><select onchange="tacticsChangeMap(this.value)" style="min-width:150px">'+mapOpts+'</select></div>':'')+
        (admin?'<button class="btn btn-gold" onclick="tacticsReset()">↺ Reset vị trí</button><button class="btn btn-green" onclick="tacticsAutoGrid()">⚡ Tự căn chỉnh</button>':'')+
      '</div>'+
    '</div>'+

    toolbarHtml+

    /* ── Main layout ── */
    '<div id="tct-layout">'+

      /* Left: map */
      '<div>'+
        (legendHtml?'<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">'+legendHtml+'</div>':'')+
        '<div id="tmap-wrap">'+mapHtml+'</div>'+
        '<div class="card" style="margin-top:12px;padding:14px">'+
          '<div class="section-header" style="margin-bottom:8px"><span class="section-title">📜 Ghi Chú Chiến Thuật</span></div>'+
          notesHtml+
        '</div>'+
      '</div>'+

      /* Right: team panels */
      '<div>'+
        '<div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700">'+
          'Đội Hình — '+numTeams+' team'+
        '</div>'+
        '<div class="tp-panel-wrap">'+panelsHtml+'</div>'+
      '</div>'+

    '</div>'+

    /* ── Init script ── */
    '<script>(function(){'+
      'setTimeout(function(){_tmRenderTeam();_tmRenderCustom();},60);'+
    '})();<\/script>'
  );
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL FUNCTIONS (called from HTML onclick)
═══════════════════════════════════════════════════════════════ */
window.tacticsAddCustom = function(typeId, icon, label) {
  _CM.push({id:'cm_'+Date.now(), type:typeId, icon:icon, label:label, x:50, y:50});
  _tmRenderCustom(); _tmSave();
  showToast('Đã thêm "'+label+'" — kéo để di chuyển!');
};

window.tacticsReset = function() {
  var n=Settings.get().numTeams||10, s=Sessions.getCurrent();
  var FALL=['#22c55e','#40c0e0','#f0c040','#f59e0b','#f28e99','#e05050','#9060e0','#f97316','#ec4899','#14b8a6'];
  var RC = { luong:'#f0c040', cong:'#e05050', thu:'#5090e0', tro:'#50d0a0' };
  _TM = buildDefaultMarkers(n).map(function(m,i){
    var team=s&&s.teams&&s.teams[i];
    var color = FALL[i%FALL.length];
    if (team && team.role && RC[team.role]) color = RC[team.role];
    return Object.assign({},m,{color:color});
  });
  _tmRenderTeam(); _tmSave(); showToast('Đã reset!');
};

window.tacticsAutoGrid = function() {
  var n=_TM.length, cols=Math.ceil(Math.sqrt(n)), rows=Math.ceil(n/cols);
  _TM.forEach(function(mk,i){
    mk.x = +(10+(i%cols)*(80/Math.max(cols-1,1))).toFixed(1);
    mk.y = +(20+Math.floor(i/cols)*(60/Math.max(rows-1,1))).toFixed(1);
  });
  _tmRenderTeam(); _tmSave(); showToast('Đã căn chỉnh!');
};

window.tacticsChangeMap = function(id) {
  Sessions.updateCurrent({map:id}); renderPage('tactics');
};

window.tacticsSaveNotes = function() {
  var el=document.getElementById('tactics-notes'); if(!el) return;
  var cur=Sessions.getCurrent();
  Sessions.updateCurrent({tactics:Object.assign({},cur&&cur.tactics||{},{notes:el.value,markers:_TM,customMarkers:_CM})});
};

window.tacticsViewSlot = function(args) {
  var session=Sessions.getCurrent(); if(!session) return;
  var slot=session.teams&&session.teams[args.ti]&&session.teams[args.ti].slots&&session.teams[args.ti].slots[args.si];
  if(!slot) return;
  var ROLE={luong:{icon:'🌾',color:'#f0c040',name:'Lương'},cong:{icon:'⚔',color:'#e05050',name:'Công'},thu:{icon:'🛡',color:'#5090e0',name:'Thủ'},tro:{icon:'💠',color:'#50d0a0',name:'Trợ'}};
  var rm=ROLE[slot.combatRole];
  var skImg=slot.skill?loadImageFromStorage('skill_'+slot.skill):'';
  openModal(
    '<h3>'+escHtml(slot.inGameName||slot.name)+'</h3>'+
    '<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">'+
    (rm?'<div style="padding:9px 12px;background:#0f0f1e;border-radius:7px;display:flex;align-items:center;gap:8px"><span style="font-size:18px">'+rm.icon+'</span><div><div style="font-size:11px;color:var(--text-secondary)">Vai trò</div><div style="font-weight:700;color:'+rm.color+'">'+rm.name+'</div></div></div>':'')+
    (skImg?'<div style="padding:9px 12px;background:#0f0f1e;border-radius:7px;display:flex;align-items:center;gap:8px"><img src="'+skImg+'" style="width:28px;height:28px;border-radius:5px;object-fit:cover"><div><div style="font-size:11px;color:var(--text-secondary)">Skill</div></div></div>':'')+
    '</div>'+
    '<div class="modal-actions"><button class="btn btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Đóng</button></div>'
  );
};

// no-op cleanup (listeners are global and safe to keep)
window._tacticsCleanup = null;
