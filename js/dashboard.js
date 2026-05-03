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
  if (typeof isGuest === 'function' && isGuest()) {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px">'+
      '<div style="font-size:48px">🔒</div>'+
      '<div style="font-size:18px;font-weight:600;color:var(--text-secondary)">Chỉ thành viên bang mới xem được</div>'+
      '<div style="font-size:13px;color:var(--text-muted);text-align:center;max-width:300px;line-height:1.7">Nội dung này được bảo mật. Vui lòng <a onclick="window.location.href=\'login.html\'" style="color:var(--accent-cyan);cursor:pointer;text-decoration:underline">đăng nhập</a> với tài khoản thành viên.</div>'+
      '</div>';
  }
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
  // Hàm helper: xác định vai trò chính của team (đa số members combat role nào)
  function dominantRole(team) {
    const counts = { luong:0, cong:0, thu:0, tro:0 };
    team.slots.forEach(s => { if (s && s.combatRole && counts[s.combatRole] !== undefined) counts[s.combatRole]++; });
    let best = null, bestN = 0;
    for (const k in counts) if (counts[k] > bestN) { best = k; bestN = counts[k]; }
    return best;
  }

  // Hàm helper: chuyển hex sang rgba
  function hexA(hex, a) {
    if (!hex) return `rgba(255,255,255,${a})`;
    const h = hex.replace('#','');
    const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  const teamsHtml = session.teams.map((team, ti) => {
    const filledCount = team.slots.filter(Boolean).length;
    // team.role là vai trò admin tự chọn. Không còn auto-dominant.
    const teamRole    = team.role || '';
    const teamRoleMeta= teamRole ? ROLE_META[teamRole] : null;
    // team.size: 'small' | 'medium' | 'large' (mặc định 'medium')
    const teamSize    = team.size || 'medium';

    const slotsHtml = team.slots.map((slot, si) => {
      if (slot) {
        const classColor = getClassColor(slot.class);
        const className  = getClassName(slot.class);
        // Skill: từ array slot.skills hoặc string slot.skill (legacy)
        const skillNames = [];
        if (Array.isArray(slot.skills)) skillNames.push(...slot.skills.filter(Boolean));
        else if (slot.skill) skillNames.push(slot.skill);
        if (slot.customSkill) skillNames.push(slot.customSkill);
        const skillsHtml = skillNames.length
          ? skillNames.map(n => `<span class="slot-skill-chip">${escHtml(n)}</span>`).join('')
          : '<span style="color:var(--text-muted);font-style:italic;font-size:11px">— chưa nhập kỹ năng —</span>';
        const leaderBadge = slot.isLeader
          ? '<div class="slot-info-role"><span class="slot-leader-badge">⭐ LEAD</span></div>'
          : '';
        const customMark = slot.isCustom
          ? '<span title="Thành viên tạm — không trong DB" style="font-size:10px;color:rgba(0,0,0,0.45);margin-left:5px">⚠</span>'
          : '';
        const clickAttr  = admin ? `onclick="openSlotMenu(${ti}, ${si}, false)"` : `onclick="viewSlotInfo(${JSON.stringify(slot).replace(/"/g,'&quot;')})"`;
        const dragAttrs = admin ? `draggable="true" data-drag="member" data-team-idx="${ti}" data-slot-idx="${si}"` : '';
        return `
          <div class="slot-row filled" ${dragAttrs} ${clickAttr}>
            <div class="slot-num-cell">${si+1}</div>
            <div class="slot-name-cell" style="background:${hexA(classColor, 0.88)};color:#0a0a0f">
              <div class="slot-name-main">${escHtml(slot.inGameName || slot.name)}${customMark}</div>
              <div class="slot-name-cls">${escHtml(className)}</div>
            </div>
            <div class="slot-info-cell">
              <div class="slot-info-skills">${skillsHtml}</div>
              ${leaderBadge}
            </div>
          </div>`;
      }
      // Empty slot - is also a drop target for member drags
      const clickAttr = admin ? `onclick="openAssignModal(${ti}, ${si}, false)"` : '';
      const dropAttrs = admin ? `data-drop="empty-slot" data-team-idx="${ti}" data-slot-idx="${si}"` : '';
      return `
        <div class="slot-row empty" ${dropAttrs} ${clickAttr} style="${admin?'cursor:pointer':'cursor:default'}">
          <div class="slot-num-cell muted">${si+1}</div>
          <div class="slot-name-cell empty-cell">
            ${admin ? '<span>+ Thêm thành viên</span>' : '<span>— trống —</span>'}
          </div>
          <div class="slot-info-cell empty-cell"></div>
        </div>`;
    }).join('');

    // Team header: nhãn vai trò chính TO + RÕ
    const headerBg = teamRoleMeta ? hexA(teamRoleMeta.color, 0.18) : 'linear-gradient(180deg,#0f0f1e,#0a0a18)';
    const headerBorder = teamRoleMeta ? hexA(teamRoleMeta.color, 0.55) : 'transparent';
    const headerColor = teamRoleMeta ? teamRoleMeta.color : 'var(--text-secondary)';

    // Dropdown vai trò - admin sửa được, member chỉ xem
    const roleSelectorHtml = admin
      ? renderTeamRoleDropdown(ti, teamRole)
      : (teamRoleMeta
          ? `<div class="team-role-display"><span class="team-role-icon" style="color:${teamRoleMeta.color}">${teamRoleMeta.icon}</span><span class="team-role-name" style="color:${teamRoleMeta.color}">${teamRoleMeta.name.toUpperCase()}</span></div>`
          : `<div class="team-role-display"><span class="team-role-name" style="color:var(--text-muted);font-style:italic">CHƯA XẾP</span></div>`);

    // Resize control (admin only) - 3 mức nhỏ/vừa/to
    const sizeBtnsHtml = admin ? `
      <div class="team-size-ctrl" title="Đổi kích cỡ">
        <button type="button" class="tsz-btn ${teamSize==='small'?'on':''}"  onclick="event.stopPropagation();setTeamSize(${ti},'small')"  title="Nhỏ">▪</button>
        <button type="button" class="tsz-btn ${teamSize==='medium'?'on':''}" onclick="event.stopPropagation();setTeamSize(${ti},'medium')" title="Vừa">◼</button>
        <button type="button" class="tsz-btn ${teamSize==='large'?'on':''}"  onclick="event.stopPropagation();setTeamSize(${ti},'large')"  title="Lớn">⬛</button>
      </div>` : '';

    // Drag handle (admin only) - kéo cả team
    const dragHandle = admin ? `<span class="team-drag-handle" title="Kéo để hoán đổi team">⋮⋮</span>` : '';

    const teamDragAttrs = admin ? `draggable="true" data-drag="team" data-team-idx="${ti}"` : '';

    return `
      <div class="team-card team-size-${teamSize}" ${teamDragAttrs} data-team-idx="${ti}" style="${teamRoleMeta ? `border-top:4px solid ${teamRoleMeta.color}` : 'border-top:4px solid transparent'}">
        <div class="team-header-big" style="background:${headerBg};border-bottom-color:${headerBorder}">
          ${dragHandle}
          <div class="team-label-big" style="color:${headerColor}">
            <span class="team-no">T${ti+1}</span>
          </div>
          ${roleSelectorHtml}
          ${sizeBtnsHtml}
          <span class="team-count-big">${filledCount}/${team.slots.length}</span>
        </div>
        <div class="slots-list">${slotsHtml}</div>
      </div>`;
  }).join('');

  // ── Reserve ───────────────────────────────────────────────────────────────
  const reserveHtml = session.reserve.map((slot, si) => {
    if (slot) {
      const classColor = getClassColor(slot.class);
      const clickAttr  = admin ? `onclick="openSlotMenu(-1, ${si}, true)"` : '';
      return `
        <div class="reserve-slot filled" ${clickAttr} style="border-left:3px solid ${classColor}">
          <div style="display:flex;align-items:center;gap:6px">
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

    <!-- Xin Nghỉ -->
    ${renderAbsenceSection(session, admin)}

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

  // Resolve map theo thứ tự ưu tiên:
  //   1. settings.currentMap (đang dùng theo Cấu Hình)
  //   2. session.map (nếu hợp lệ)
  //   3. map đầu tiên có ảnh
  //   4. map đầu tiên
  var mapId = '';
  if (settings.currentMap && maps.find(function(m){return m.id === settings.currentMap;})) {
    mapId = settings.currentMap;
  } else if (session && session.map && maps.find(function(m){return m.id === session.map;})) {
    mapId = session.map;
  } else {
    var withImg = maps.find(function(m){ return getMapImage(m.id); });
    mapId = withImg ? withImg.id : (maps[0] && maps[0].id) || '';
  }

  // Tự động "chữa" session.map nếu nó stale (admin only, để không spam writes)
  if (admin && session && session.map !== mapId && mapId) {
    Sessions.updateCurrent({ map: mapId });
  }

  var mapObj   = maps.find(function(m){ return m.id === mapId; });
  var mapImg   = mapObj ? getMapImage(mapObj.id) : '';

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
  var FALL     = ['#22c55e','#40c0e0','#f0c040','#f59e0b','#f28e99','#e05050','#9060e0','#f97316','#ec4899','#14b8a6'];
  var ROLE_COLORS = { luong:'#f0c040', cong:'#e05050', thu:'#5090e0', tro:'#50d0a0' };

  function tColor(ti) {
    var t = session && session.teams && session.teams[ti];
    if (!t) return FALL[ti % FALL.length];
    // Ưu tiên team.role (admin chọn). Nếu chưa chọn, dùng FALL theo index.
    if (t.role && ROLE_COLORS[t.role]) return ROLE_COLORS[t.role];
    return FALL[ti % FALL.length];
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

/* ════════════════════════════════════════════════════════════════════════
   TEAM ROLE DROPDOWN - admin chọn vai trò chính của team từ dropdown trượt
   ════════════════════════════════════════════════════════════════════════ */
function renderTeamRoleDropdown(teamIdx, currentRole) {
  const ROLES = [
    { id:'',      name:'Chưa xếp', icon:'',  color:'var(--text-muted)' },
    { id:'luong', name:'Lương',    icon:'🌾', color:'#f0c040' },
    { id:'cong',  name:'Công',     icon:'⚔',  color:'#e05050' },
    { id:'thu',   name:'Thủ',      icon:'🛡',  color:'#5090e0' },
    { id:'tro',   name:'Trợ',      icon:'💠', color:'#50d0a0' }
  ];
  const cur = ROLES.find(r => r.id === (currentRole || '')) || ROLES[0];
  const triggerColor = cur.id ? cur.color : 'var(--text-muted)';
  const triggerStyle = cur.id ? '' : 'font-style:italic';

  const itemsHtml = ROLES.map(r => `
    <div class="trd-item ${r.id === currentRole ? 'selected' : ''}"
         data-team-idx="${teamIdx}" data-role="${r.id}"
         onclick="setTeamRole(${teamIdx}, '${r.id}')">
      ${r.icon ? `<span class="trd-icon" style="color:${r.color}">${r.icon}</span>` : '<span class="trd-icon"></span>'}
      <span class="trd-name" style="color:${r.color};${r.id===''?'font-style:italic':''}">${r.name.toUpperCase()}</span>
      ${r.id === currentRole ? '<span class="trd-check">✓</span>' : ''}
    </div>
  `).join('');

  return `
    <div class="trd-wrap" data-team-idx="${teamIdx}">
      <button class="trd-trigger" type="button" onclick="toggleTeamRoleDropdown(this)">
        ${cur.icon ? `<span class="trd-trigger-icon" style="color:${cur.color}">${cur.icon}</span>` : ''}
        <span class="trd-trigger-name" style="color:${triggerColor};${triggerStyle}">${cur.name.toUpperCase()}</span>
        <span class="trd-caret">▾</span>
      </button>
      <div class="trd-menu">${itemsHtml}</div>
    </div>`;
}

function toggleTeamRoleDropdown(btn) {
  const wrap = btn.closest('.trd-wrap');
  if (!wrap) return;
  const isOpen = wrap.classList.contains('open');
  // Đóng tất cả dropdown khác trước
  document.querySelectorAll('.trd-wrap.open').forEach(w => { if (w !== wrap) w.classList.remove('open'); });
  // Toggle current
  wrap.classList.toggle('open', !isOpen);
}

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', function(e) {
  if (!e.target.closest('.trd-wrap')) {
    document.querySelectorAll('.trd-wrap.open').forEach(w => w.classList.remove('open'));
  }
});

function setTeamRole(teamIdx, roleId) {
  if (!isAdmin()) return;
  const data = loadData();
  if (!data.currentSession || !data.currentSession.teams[teamIdx]) return;
  data.currentSession.teams[teamIdx].role = roleId || '';
  if (typeof window.saveData === 'function') window.saveData(data); else saveData(data);
  // Đóng dropdown trước khi re-render để tránh visual flash
  document.querySelectorAll('.trd-wrap.open').forEach(w => w.classList.remove('open'));
  renderPage('dashboard');
}

/* ════════════════════════════════════════════════════════════════════════
   ABSENCE SECTION - danh sách xin nghỉ
   ════════════════════════════════════════════════════════════════════════ */
function renderAbsenceSection(session, isAdmin) {
  const absences = session.absences || [];
  const me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const myId = me ? me.id : null;
  const meAlreadyAbsent = myId && absences.some(a => a.memberId === myId);
  const meAlreadyAssigned = myId && Sessions.getMemberAssignment(myId);

  const rowsHtml = absences.length === 0
    ? '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:13px;font-style:italic">Chưa có ai xin nghỉ</div>'
    : absences.map(a => {
        const canRemove = isAdmin || (myId && a.memberId === myId);
        const dateStr = a.addedAt ? new Date(a.addedAt).toLocaleDateString('vi-VN', {day:'2-digit',month:'2-digit'}) : '';
        return `
          <div class="absence-row">
            <div class="absence-dot">😴</div>
            <div class="absence-info">
              <div class="absence-name">${escHtml(a.inGameName || a.name || '?')}</div>
              ${a.reason ? `<div class="absence-reason">"${escHtml(a.reason)}"</div>` : ''}
              <div class="absence-meta">
                ${a.addedBy ? `Đăng ký bởi ${escHtml(a.addedBy)}` : ''}
                ${dateStr ? ` · ${dateStr}` : ''}
              </div>
            </div>
            ${canRemove
              ? `<button class="btn btn-outline" style="padding:4px 12px;font-size:12px" onclick="removeAbsence('${a.memberId}')">↩ Bỏ nghỉ</button>`
              : ''}
          </div>`;
      }).join('');

  // Action buttons
  let actionsHtml = '';
  if (isAdmin) {
    actionsHtml = `<button class="btn btn-cyan" style="padding:6px 14px;font-size:12px" onclick="openAbsenceAdminModal()">+ Thêm người nghỉ</button>`;
  } else if (myId && !meAlreadyAbsent && !meAlreadyAssigned) {
    actionsHtml = `<button class="btn btn-outline" style="padding:6px 14px;font-size:12px" onclick="openAbsenceSelfModal()">😴 Đăng ký xin nghỉ</button>`;
  } else if (meAlreadyAssigned) {
    actionsHtml = `<span style="font-size:11px;color:var(--text-muted);font-style:italic">Bạn đang ở ${meAlreadyAssigned.label} — không thể đăng ký nghỉ</span>`;
  }

  return `
    <div class="card" style="margin-top:20px">
      <div class="section-header">
        <span class="section-title">😴 Xin Nghỉ Bang Chiến</span>
        <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
          <span style="color:var(--text-secondary);font-size:13px">${absences.length} người</span>
          ${actionsHtml}
        </div>
      </div>
      <div class="absence-list">${rowsHtml}</div>
    </div>
    <style>
      .absence-list { display:flex;flex-direction:column;gap:6px; }
      .absence-row {
        display:flex;align-items:center;gap:12px;
        padding:10px 14px;background:#0c0c1a;
        border:1px solid var(--border-color);border-radius:8px;
        border-left:3px solid #ff8c00;
      }
      .absence-dot { font-size:22px;line-height:1; }
      .absence-info { flex:1;min-width:0; }
      .absence-name { font-weight:700;font-size:14px;color:#ffa84d; }
      .absence-reason { font-size:12px;color:var(--text-secondary);font-style:italic;margin-top:2px; }
      .absence-meta { font-size:10px;color:var(--text-muted);margin-top:3px; }
    </style>`;
}

/* ── Admin: thêm người nghỉ (pick từ danh sách) ─────────────────────────── */
function openAbsenceAdminModal() {
  if (!isAdmin()) return;
  const allMembers = Members.getAll();
  // Lọc người chưa nghỉ + chưa được xếp slot
  const available = allMembers.filter(m => !Sessions.isAbsent(m.id) && !Sessions.getMemberAssignment(m.id));
  if (available.length === 0) {
    showToast('Tất cả thành viên đã được xếp hoặc đã nghỉ', 'error', 4000);
    return;
  }
  const sorted = available.slice().sort((a,b) => (a.inGameName||a.name||'').localeCompare(b.inGameName||b.name||''));
  const optionsHtml = sorted.map(m => {
    const cls = Settings.get().classes.find(c => c.id === m.class);
    return `<option value="${m.id}">${escHtml(m.inGameName || m.name)}${cls ? ' — ' + cls.name : ''}</option>`;
  }).join('');

  openModal(`
    <h3 style="margin-bottom:14px">😴 Thêm Người Xin Nghỉ</h3>
    <div class="form-group">
      <label>Thành viên</label>
      <select id="abs-member-id" style="width:100%;padding:10px 12px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;font-size:14px">
        <option value="">-- Chọn người --</option>
        ${optionsHtml}
      </select>
    </div>
    <div class="form-group">
      <label>Lý do (tùy chọn)</label>
      <input type="text" id="abs-reason" placeholder="VD: Bận, ốm, đi công tác..." style="width:100%;padding:10px 12px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;font-size:13px">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="submitAbsence(this.closest('.modal-overlay'))">Xác nhận</button>
    </div>`, null, true);
}

function submitAbsence(ov) {
  const memberId = document.getElementById('abs-member-id')?.value;
  const reason   = document.getElementById('abs-reason')?.value.trim() || '';
  if (!memberId) { showToast('Hãy chọn thành viên', 'error'); return; }
  Sessions.addAbsence(memberId, reason);
  ov.remove();
  showToast('✅ Đã thêm vào danh sách nghỉ');
  renderPage('dashboard');
}

/* ── Member: tự đăng ký nghỉ ────────────────────────────────────────────── */
function openAbsenceSelfModal() {
  const me = getCurrentUser();
  if (!me || me.id === 'guest') { showToast('Chỉ thành viên đăng nhập mới đăng ký được', 'error'); return; }
  const member = Members.getById(me.id);
  if (!member) { showToast('Tài khoản của bạn chưa có trong danh sách thành viên', 'error', 4000); return; }
  if (Sessions.getMemberAssignment(me.id)) { showToast('Bạn đang ở trong team — không đăng ký nghỉ được', 'error'); return; }

  openModal(`
    <h3 style="margin-bottom:8px">😴 Đăng Ký Xin Nghỉ</h3>
    <div style="color:var(--text-secondary);font-size:13px;margin-bottom:14px">
      ${escHtml(member.inGameName || member.name)}
    </div>
    <div style="background:#1c1610;border:1px solid #d97706;border-radius:6px;padding:10px;margin-bottom:14px;font-size:12px;color:#fbbf24;line-height:1.5">
      ⚠ Đăng ký này được lưu cục bộ trên trình duyệt của bạn. Để admin nhìn thấy & cập nhật cho cả bang, bạn nên báo qua Discord/Zalo cho Bang Chủ.
    </div>
    <div class="form-group">
      <label>Lý do (tùy chọn)</label>
      <input type="text" id="abs-self-reason" placeholder="VD: Bận, ốm, đi công tác..." style="width:100%;padding:10px 12px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;font-size:13px">
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="submitSelfAbsence(this.closest('.modal-overlay'))">Xác nhận nghỉ</button>
    </div>`, null, true);
}

function submitSelfAbsence(ov) {
  const me = getCurrentUser();
  if (!me) return;
  const reason = document.getElementById('abs-self-reason')?.value.trim() || '';
  Sessions.addAbsence(me.id, reason);
  ov.remove();
  showToast('✅ Đã đăng ký xin nghỉ');
  renderPage('dashboard');
}

/* ── Bỏ nghỉ ────────────────────────────────────────────────────────────── */
function removeAbsence(memberId) {
  const me = getCurrentUser();
  // Permission: admin OR user của chính mình
  if (!isAdmin() && (!me || me.id !== memberId)) {
    showToast('Không có quyền', 'error');
    return;
  }
  if (!confirm('Bỏ trạng thái xin nghỉ?')) return;
  Sessions.removeAbsence(memberId);
  showToast('Đã bỏ nghỉ');
  renderPage('dashboard');
}
