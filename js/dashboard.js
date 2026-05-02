/**
 * dashboard.js - Chiến lượt / Đội hình bang chiến
 * 
 * Cải tiến hiển thị:
 * - Thẻ thành viên lớn hơn, rõ tên + vai trò + class
 * - Màu viền theo vai trò chiến đấu (Lương/Công/Thủ/Trợ)
 * - Số slot hiện rõ bên góc
 * - Admin: click để assign/gỡ | Viewer: chỉ xem
 */

function renderDashboardPage() {
  const session   = Sessions.getCurrent();
  const guild     = Guild.get();
  const settings  = Settings.get();
  const admin     = isAdmin();

  if (!session) {
    return `
      <div style="text-align:center;padding:80px 20px">
        <div style="font-size:52px;margin-bottom:16px">⚔</div>
        <div class="page-title" style="margin-bottom:10px">Chưa có đợt bang chiến</div>
        <div style="color:var(--text-secondary);margin-bottom:24px">
          ${admin ? 'Tạo đợt mới để bắt đầu sắp xếp đội hình' : 'Chờ Admin tạo đợt mới'}
        </div>
        ${admin ? `<button class="btn btn-gold" style="font-size:15px;padding:12px 28px" onclick="createNewSession()">🗡 Tạo Đợt Mới</button>` : ''}
      </div>`;
  }

  // ── Thống kê ──────────────────────────────────────────────────────────────
  let filledMain = 0;
  session.teams.forEach(t => t.slots.forEach(s => { if (s) filledMain++; }));
  const filledReserve = session.reserve.filter(Boolean).length;
  const totalMain = session.teams.reduce((a, t) => a + t.slots.length, 0);

  // class counts
  const classCounts = {};
  settings.classes.forEach(c => { classCounts[c.id] = 0; });
  [...session.teams.flatMap(t => t.slots), ...session.reserve]
    .filter(Boolean)
    .forEach(s => { if (s.class && classCounts[s.class] !== undefined) classCounts[s.class]++; });

  // combat role counts
  const roleCounts = { luong:0, cong:0, thu:0, tro:0 };
  [...session.teams.flatMap(t => t.slots), ...session.reserve]
    .filter(Boolean)
    .forEach(s => { if (s.combatRole && roleCounts[s.combatRole] !== undefined) roleCounts[s.combatRole]++; });

  const classStatsHtml = settings.classes.map(c => `
    <div class="stat-item">
      <div class="stat-label" style="color:${c.color}">${c.name}</div>
      <div class="stat-value" style="color:${c.color};font-size:18px">${classCounts[c.id]||0}</div>
    </div>`).join('');

  // ── Header ────────────────────────────────────────────────────────────────
  const headerHtml = `
    <div style="text-align:center;margin-bottom:20px">
      ${admin ? '<div class="admin-badge" style="margin-bottom:8px">⚙ ADMIN MODE</div>' : '<div class="badge" style="background:rgba(64,192,224,0.1);color:var(--accent-cyan);border:1px solid rgba(64,192,224,0.3);padding:4px 14px;margin-bottom:8px">👁 CHẾ ĐỘ XEM</div>'}
      <div style="color:var(--text-secondary);font-size:11px;letter-spacing:3px">${escHtml(session.name.toUpperCase())}</div>
      <div class="page-title" style="font-size:24px;margin:6px 0">${escHtml(guild.name.toUpperCase())}</div>
      ${admin ? `<button class="btn btn-gold" style="margin-top:4px" onclick="createNewSession()">📋 Tạo Đợt Mới</button>` : ''}
    </div>`;

  // ── Role summary bar ──────────────────────────────────────────────────────
  const ROLE_META = { luong:{icon:'🌾',color:'#f0c040',name:'Lương'}, cong:{icon:'⚔',color:'#e05050',name:'Công'}, thu:{icon:'🛡',color:'#5090e0',name:'Thủ'}, tro:{icon:'💠',color:'#50d0a0',name:'Trợ'} };
  const roleSummaryHtml = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      ${Object.entries(ROLE_META).map(([k,r]) => `
        <div style="display:flex;align-items:center;gap:6px;padding:6px 14px;background:${r.color}11;border:1px solid ${r.color}33;border-radius:20px">
          <span>${r.icon}</span>
          <span style="font-weight:700;color:${r.color}">${r.name}</span>
          <span style="color:var(--text-primary);font-weight:700;font-size:16px">${roleCounts[k]}</span>
        </div>`).join('')}
      <div style="margin-left:auto;display:flex;align-items:center;gap:6px;padding:6px 16px;background:rgba(240,192,64,0.1);border:1px solid rgba(240,192,64,0.3);border-radius:20px">
        <span style="color:var(--accent-gold);font-weight:700">Quân số</span>
        <span style="font-weight:700;font-size:16px;color:var(--accent-gold)">${filledMain+filledReserve}<span style="font-size:12px;color:var(--text-secondary)"> / ${totalMain+session.reserve.length}</span></span>
      </div>
    </div>`;

  // ── Teams grid ────────────────────────────────────────────────────────────
  const teamsHtml = session.teams.map((team, ti) => {
    const filledCount = team.slots.filter(Boolean).length;
    const groupColor  = getGroupColor(team.group);
    const groupName   = getGroupName(team.group);

    const slotsHtml = team.slots.map((slot, si) => {
      if (slot) {
        const classColor = getClassColor(slot.class);
        const roleMeta   = ROLE_META[slot.combatRole] || null;
        const roleColor  = roleMeta ? roleMeta.color : classColor;
        const roleIcon   = roleMeta ? roleMeta.icon : '·';
        const roleName   = roleMeta ? roleMeta.name : '';
        const clickAttr  = admin ? `onclick="openSlotMenu(${ti}, ${si}, false)"` : `onclick="viewSlotInfo(${JSON.stringify(slot).replace(/"/g,'&quot;')})"`;
        return `
          <div class="slot filled" ${clickAttr} style="border-left:4px solid ${roleColor}">
            <div class="slot-top">
              <span class="slot-role-icon" style="color:${roleColor}">${roleIcon}</span>
              <span class="slot-num" style="color:var(--text-muted)">#${si+1}</span>
            </div>
            <div class="slot-name">${escHtml(slot.inGameName || slot.name)}</div>
            <div class="slot-meta">
              <span style="color:${classColor};font-size:10px">${getClassName(slot.class)}</span>
              ${roleName ? `<span style="color:${roleColor};font-size:10px">${roleName}</span>` : ''}
            </div>
          </div>`;
      }
      // Empty slot
      const clickAttr = admin ? `onclick="openAssignModal(${ti}, ${si}, false)"` : '';
      return `<div class="slot empty" ${clickAttr} style="${admin?'cursor:pointer':'cursor:default'}">
        <span style="font-size:10px;color:var(--text-muted)">SLOT ${si+1}</span>
        ${admin ? `<span class="slot-plus">+</span>` : ''}
      </div>`;
    }).join('');

    // Group select (admin only)
    const groupControl = admin
      ? `<select class="team-group-select" onchange="setTeamGroup(${ti}, this.value)">
           <option value="">Chưa nhóm</option>
           ${settings.groups.map(g => `<option value="${g.id}" ${team.group===g.id?'selected':''}>${g.name}</option>`).join('')}
         </select>`
      : (groupName ? `<span style="font-size:11px;color:${groupColor};font-weight:600">${groupName}</span>` : '');

    return `
      <div class="team-card" style="${team.group?`border-top:3px solid ${groupColor}`:''}">
        <div class="team-header">
          <div class="team-label" style="${team.group?`color:${groupColor}`:''}">
            <span style="font-family:'Cinzel',serif;font-weight:700">T${ti+1}</span>
          </div>
          ${groupControl}
          <span class="team-count" style="color:var(--text-muted);font-size:11px;margin-left:auto">${filledCount}/${team.slots.length}</span>
        </div>
        <div class="slots-list">${slotsHtml}</div>
      </div>`;
  }).join('');

  // ── Reserve ───────────────────────────────────────────────────────────────
  const reserveHtml = session.reserve.map((slot, si) => {
    if (slot) {
      const classColor = getClassColor(slot.class);
      const roleMeta   = ROLE_META[slot.combatRole] || null;
      const roleColor  = roleMeta ? roleMeta.color : classColor;
      const clickAttr  = admin ? `onclick="openSlotMenu(-1, ${si}, true)"` : '';
      return `
        <div class="reserve-slot filled" ${clickAttr} style="border-left:3px solid ${roleColor}">
          <div style="display:flex;align-items:center;gap:6px">
            ${roleMeta ? `<span style="color:${roleColor}">${roleMeta.icon}</span>` : ''}
            <span style="font-weight:600;font-size:12px">${escHtml(slot.inGameName||slot.name)}</span>
          </div>
          <div style="display:flex;gap:6px;margin-top:2px">
            <span style="color:${classColor};font-size:10px">${getClassName(slot.class)}</span>
          </div>
        </div>`;
    }
    const clickAttr = admin ? `onclick="openAssignModal(-1, ${si}, true)"` : '';
    return `<div class="reserve-slot empty" ${clickAttr} style="${admin?'cursor:pointer':'cursor:default'}">
      <span style="font-size:10px">DỰ BỊ ${si+1}</span>
      ${admin ? `<span style="font-size:14px;color:var(--text-muted)">+</span>` : ''}
    </div>`;
  }).join('');

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendHtml = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:8px;font-size:12px">
      <span style="color:var(--text-secondary);font-weight:600">Màu viền:</span>
      ${Object.values(ROLE_META).map(r => `<span style="color:${r.color}">${r.icon} ${r.name}</span>`).join(' · ')}
    </div>`;

  return `
    ${headerHtml}
    ${roleSummaryHtml}

    <!-- Class stats -->
    <div class="stats-row" style="margin-bottom:16px">${classStatsHtml}</div>

    ${legendHtml}

    <!-- Teams -->
    <div class="teams-grid">${teamsHtml}</div>

    <!-- Reserve -->
    <div class="card" style="margin-top:20px">
      <div class="section-header">
        <span class="section-title">🛡 Dự Bị</span>
        <span style="color:var(--text-secondary);font-size:13px">${filledReserve} / ${session.reserve.length}</span>
      </div>
      <div class="reserve-grid">${reserveHtml}</div>
    </div>

    <!-- Chiến thuật tích hợp -->
    <div class="card" style="margin-top:20px">
      <div class="section-header">
        <span class="section-title">🗺 Chỉ Đạo Chiến Thuật</span>
        ${admin ? '<div style="display:flex;gap:8px" id="dash-marker-btns"></div>' : ''}
      </div>
      <div id="dash-map-wrap" style="position:relative;border-radius:8px;overflow:visible;border:1px solid var(--border-color);background:#1a1510;min-height:60px">
      </div>
      ${admin
        ? '<div id="dash-marker-toolbar" style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"></div><textarea id="tactics-notes" rows="3" style="width:100%;background:#0f0f1e;resize:vertical;margin-top:8px;border-radius:6px;padding:10px;font-size:14px" placeholder="Ghi chép chiến thuật..." onblur="saveTacticsNotes()">' + escHtml(session.tactics?.notes||'') + '</textarea>'
        : '<div style=\"background:#0f0f1e;border-radius:6px;padding:12px;margin-top:8px;min-height:40px;font-size:14px;color:var(--text-secondary)\">' + (escHtml(session.tactics?.notes||'') || '<em style=\"color:var(--text-muted)\">Chưa có ghi chú</em>') + '</div>'
      }
    </div>
  `;
}
/* ═══════════════════════════════════════════════════
   Bản đồ chiến thuật tích hợp trong Dashboard
═══════════════════════════════════════════════════ */
function initDashMap() {
  var wrap   = document.getElementById('dash-map-wrap');
  if (!wrap) return;

  var settings = Settings.get();
  var session  = Sessions.getCurrent();
  var admin    = isAdmin();
  var maps     = settings.maps || [];
  var mapId    = (session && session.map) || settings.currentMap || (maps[0] && maps[0].id) || '';
  var mapObj   = maps.find(function(m){ return m.id === mapId; });
  var mapImg   = mapObj ? loadImageFromStorage('map_' + mapObj.id) : '';

  // Render bản đồ
  if (mapImg) {
    var img = document.createElement('img');
    img.src = mapImg;
    img.style.cssText = 'display:block;width:100%;height:auto;border-radius:7px;pointer-events:none;-webkit-user-drag:none';
    wrap.appendChild(img);
  } else {
    wrap.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-muted)"><div style="font-size:28px;margin-bottom:6px">🗺</div><div>Chưa có ảnh bản đồ' +
      (admin ? ' — <a onclick="renderPage(\'settings\')" style="color:var(--accent-cyan);cursor:pointer">Upload ở Cấu Hình</a>' : '') + '</div></div>';
    return; // Không cần render markers nếu không có bản đồ
  }

  // Toolbar markers (admin)
  var toolbar = document.getElementById('dash-marker-toolbar');
  if (admin && toolbar) {
    var CTYPES = [
      {id:'flag',icon:'🚩',label:'Cờ'},{id:'target',icon:'🎯',label:'Mục tiêu'},
      {id:'danger',icon:'⚠',label:'Nguy hiểm'},{id:'rally',icon:'⚔',label:'Tập kết'},
      {id:'defend',icon:'🛡',label:'Phòng thủ'},{id:'star',icon:'⭐',label:'Chính'},
    ];
    toolbar.innerHTML = '<span style="font-size:11px;color:var(--text-secondary);font-weight:600;align-self:center">Thêm:</span>' +
      CTYPES.map(function(t){
        return '<button class="btn btn-outline" style="padding:4px 9px;font-size:12px" onclick="dashAddMarker(\'' + t.id + '\',\'' + t.icon + '\',\'' + t.label + '\')">' + t.icon + ' ' + t.label + '</button>';
      }).join('') +
      '<button class="btn btn-outline" style="padding:4px 9px;font-size:12px;margin-left:auto" onclick="dashResetMarkers()">↺ Reset</button>';
  }

  // Marker state
  var numTeams = settings.numTeams || 10;
  var groups   = settings.groups || [];
  var FALL     = ['#22c55e','#40c0e0','#f0c040','#f59e0b','#f28e99','#e05050','#9060e0','#f97316','#ec4899','#14b8a6'];

  function tColor(ti) {
    var t = session && session.teams && session.teams[ti];
    var gid = t && t.group;
    var g = gid && groups.find(function(x){ return x.id === gid; });
    return g ? g.color : FALL[ti % FALL.length];
  }

  var savedMarkers = session && session.tactics && session.tactics.markers;
  var defMarkers   = buildDefaultMarkers(numTeams);
  var _TM = defMarkers.map(function(def, i) {
    var saved = savedMarkers && savedMarkers.find(function(m){ return m.teamIndex === i; });
    return { teamIndex: i, x: saved ? saved.x : def.x, y: saved ? saved.y : def.y, color: tColor(i) };
  });
  var _CM = (session && session.tactics && session.tactics.customMarkers || []).map(function(m){ return Object.assign({}, m); });

  var _drag = null;

  function client(e) {
    var t = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0];
    return t ? {x: t.clientX, y: t.clientY} : {x: e.clientX, y: e.clientY};
  }
  function pct(cx, cy) {
    var r = wrap.getBoundingClientRect();
    return {
      x: Math.max(1, Math.min(99, +((cx - r.left) / r.width  * 100).toFixed(2))),
      y: Math.max(1, Math.min(99, +((cy - r.top)  / r.height * 100).toFixed(2)))
    };
  }

  function renderMarkers() {
    wrap.querySelectorAll('.dm,.dm-del').forEach(function(e){ e.remove(); });
    _TM.forEach(function(mk, ti) {
      var el = document.createElement('div');
      el.className = 'dm'; el.id = 'dm-' + ti;
      el.textContent = 'T' + (ti + 1);
      el.style.cssText = 'position:absolute;width:32px;height:32px;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-weight:800;font-size:12px;font-family:Cinzel,serif;color:#111;' +
        'border:2px solid rgba(255,255,255,0.35);box-shadow:0 2px 8px rgba(0,0,0,0.7);' +
        'transform:translate(-50%,-50%);z-index:10;touch-action:none;user-select:none;' +
        'background:' + mk.color + ';left:' + mk.x + '%;top:' + mk.y + '%;' +
        'cursor:' + (admin ? 'grab' : 'pointer');
      if (admin) {
        el.addEventListener('mousedown',  function(e){ e.preventDefault(); e.stopPropagation(); startDrag(e,'tm',ti,el); });
        el.addEventListener('touchstart', function(e){ e.preventDefault(); e.stopPropagation(); startDrag(e,'tm',ti,el); }, {passive:false});
      }
      wrap.appendChild(el);
    });
    _CM.forEach(function(mk, ci) {
      var el = document.createElement('div');
      el.className = 'dm'; el.id = 'cm2-' + ci;
      el.textContent = mk.icon;
      el.style.cssText = 'position:absolute;font-size:22px;line-height:1;' +
        'transform:translate(-50%,-50%);z-index:11;touch-action:none;user-select:none;' +
        'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.9));' +
        'left:' + mk.x + '%;top:' + mk.y + '%;cursor:' + (admin ? 'grab' : 'default');
      if (admin) {
        el.addEventListener('mousedown',  function(e){ e.preventDefault(); e.stopPropagation(); startDrag(e,'cm',ci,el); });
        el.addEventListener('touchstart', function(e){ e.preventDefault(); e.stopPropagation(); startDrag(e,'cm',ci,el); }, {passive:false});
        var del = document.createElement('div');
        del.className = 'dm-del';
        del.textContent = '×';
        del.style.cssText = 'position:absolute;width:16px;height:16px;border-radius:50%;background:#dc2626;border:2px solid white;color:white;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:20;transform:translate(-50%,-50%);left:calc(' + mk.x + '% + 11px);top:calc(' + mk.y + '% - 11px)';
        (function(i){ del.addEventListener('click', function(ev){ ev.stopPropagation(); _CM.splice(i,1); saveMarkers(); renderMarkers(); }); })(ci);
        wrap.appendChild(del);
      }
      wrap.appendChild(el);
    });
  }

  function startDrag(e, kind, idx, el) {
    var c = client(e);
    _drag = { kind: kind, idx: idx, el: el, ox: c.x, oy: c.y, moved: false };
    el.style.cursor = 'grabbing'; el.style.zIndex = '50';
  }

  function onMove(e) {
    if (!_drag) return; e.preventDefault();
    var c = client(e);
    if (Math.abs(c.x-_drag.ox)>2 || Math.abs(c.y-_drag.oy)>2) _drag.moved = true;
    var p = pct(c.x, c.y);
    if (_drag.kind === 'tm') { _TM[_drag.idx].x = p.x; _TM[_drag.idx].y = p.y; }
    else                     { _CM[_drag.idx].x = p.x; _CM[_drag.idx].y = p.y; }
    _drag.el.style.left = p.x + '%'; _drag.el.style.top = p.y + '%';
  }

  function onUp() {
    if (!_drag) return;
    if (_drag.el) { _drag.el.style.cursor = admin ? 'grab' : 'default'; _drag.el.style.zIndex = ''; }
    _drag = null; saveMarkers();
  }

  function saveMarkers() {
    var cur = Sessions.getCurrent(); if (!cur) return;
    Sessions.updateCurrent({ tactics: Object.assign({}, cur.tactics || {}, { markers: _TM, customMarkers: _CM }) });
  }

  // Expose globals
  window.dashAddMarker = function(typeId, icon, label) {
    _CM.push({ id: 'cm_'+Date.now(), type: typeId, icon: icon, label: label, x: 50, y: 50 });
    renderMarkers(); saveMarkers();
    showToast('Đã thêm ' + label + ' — kéo để di chuyển!');
  };
  window.dashResetMarkers = function() {
    _TM = buildDefaultMarkers(numTeams).map(function(def, i){ return Object.assign({}, def, {color: tColor(i)}); });
    renderMarkers(); saveMarkers(); showToast('Đã reset vị trí!');
  };

  document.addEventListener('mousemove', onMove, {passive:false});
  document.addEventListener('mouseup',   onUp);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('touchend',  onUp);

  renderMarkers();
}
