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
        ${admin ? `<div id="dash-marker-toolbar" style="display:flex;gap:6px;flex-wrap:wrap"></div>` : ''}
      </div>
      <div id="dash-map-wrap" style="position:relative;border-radius:8px;overflow:visible;border:1px solid var(--border-color);background:#1a1510;min-height:80px"></div>
      ${admin
        ? `<textarea id="tactics-notes" rows="3" style="width:100%;background:#0f0f1e;resize:vertical;margin-top:8px;border-radius:6px;padding:10px;font-size:14px"
             placeholder="Ghi chép chiến thuật..." onblur="saveTacticsNotes()">${escHtml(session.tactics?.notes||'')}</textarea>`
        : `<div style="background:#0f0f1e;border-radius:6px;padding:12px;margin-top:8px;white-space:pre-wrap;min-height:40px;font-size:14px;line-height:1.7;color:var(--text-secondary)">
             ${escHtml(session.tactics?.notes||'') || '<em style="color:var(--text-muted)">Chưa có ghi chú chiến thuật</em>'}
           </div>`}
    </div>
  `;
}

// ── Actions (admin only) ──────────────────────────────────────────────────────
function createNewSession() {
  if (!isAdmin()) { denyEdit(); return; }
  const name = prompt('Tên đợt bang chiến:', `Tuần ${getWeekNumber(new Date())} - ${new Date().getFullYear()}`);
  if (name === null) return;
  Sessions.createNew({ name: name || undefined });
  showToast('Đã tạo đợt mới!');
  renderPage('dashboard');
}

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function setTeamGroup(teamIndex, groupId) {
  if (!isAdmin()) { denyEdit(); return; }
  const data = loadData();
  if (!data.currentSession) return;
  data.currentSession.teams[teamIndex].group = groupId;
  saveData(data);
}

function saveTacticsNotes() {
  if (!isAdmin()) return;
  const notes = document.getElementById('tactics-notes')?.value;
  if (notes === undefined) return;
  Sessions.updateCurrent({ tactics: { ...Sessions.getCurrent()?.tactics, notes } });
}

// ── View slot (non-admin) ─────────────────────────────────────────────────────
function viewSlotInfo(slot) {
  const ROLE_META = { luong:{icon:'🌾',color:'#f0c040',name:'Lương'}, cong:{icon:'⚔',color:'#e05050',name:'Công'}, thu:{icon:'🛡',color:'#5090e0',name:'Thủ'}, tro:{icon:'💠',color:'#50d0a0',name:'Trợ'} };
  const rm = ROLE_META[slot.combatRole];
  const cc = getClassColor(slot.class);
  openModal(`
    <h3 style="margin-bottom:16px">${escHtml(slot.inGameName||slot.name)}</h3>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f0f1e;border-radius:8px">
        <span style="font-size:20px">${rm?rm.icon:'·'}</span>
        <div>
          <div style="font-size:11px;color:var(--text-secondary)">Vai trò</div>
          <div style="font-weight:700;color:${rm?rm.color:'var(--text-muted)'}">${rm?rm.name:'Chưa xác định'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f0f1e;border-radius:8px">
        <div style="width:14px;height:14px;border-radius:3px;background:${cc}"></div>
        <div>
          <div style="font-size:11px;color:var(--text-secondary)">Class</div>
          <div style="font-weight:700;color:${cc}">${getClassName(slot.class)}</div>
        </div>
      </div>
    </div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Đóng</button></div>
  `);
}

// ── Assign / remove (admin) ───────────────────────────────────────────────────
function openAssignModal(teamIndex, slotIndex, isReserve) {
  if (!isAdmin()) { denyEdit(); return; }
  const members = Members.getAll();
  const session = Sessions.getCurrent();
  const assigned = new Set();
  if (session) {
    session.teams.forEach(t => t.slots.forEach(s => { if(s) assigned.add(s.id); }));
    session.reserve.forEach(s => { if(s) assigned.add(s.id); });
  }
  const available = members.filter(m => !assigned.has(m.id));
  const ROLE_META = { luong:{icon:'🌾',color:'#f0c040'}, cong:{icon:'⚔',color:'#e05050'}, thu:{icon:'🛡',color:'#5090e0'}, tro:{icon:'💠',color:'#50d0a0'} };

  const listHtml = available.length === 0
    ? '<div style="color:var(--text-muted);text-align:center;padding:24px">Không còn thành viên trống</div>'
    : available.map(m => {
        const cc = getClassColor(m.class);
        const rm = ROLE_META[m.combatRole];
        return `<div class="member-pick-item" onclick="assignMember('${m.id}', ${teamIndex}, ${slotIndex}, ${isReserve}, this.closest('.modal-overlay'))">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:4px;height:40px;border-radius:2px;background:${rm?rm.color:cc};flex-shrink:0"></div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(m.inGameName||m.name)}</div>
              <div style="display:flex;gap:6px;margin-top:3px;flex-wrap:wrap">
                ${classBadge(m.class)}
                ${rm ? `<span class="badge" style="background:${rm.color}22;color:${rm.color}">${rm.icon} ${['Lương','Công','Thủ','Trợ'][['luong','cong','thu','tro'].indexOf(m.combatRole)]}</span>` : ''}
                <span style="color:var(--accent-gold);font-size:11px">${formatNumber(m.power)}</span>
              </div>
            </div>
          </div>
        </div>`;
      }).join('');

  openModal(`
    <h3>⚔ Chọn Thành Viên</h3>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap" id="pick-filter-roles">
      <button class="btn btn-outline pick-role-filter active" style="padding:4px 10px;font-size:12px" onclick="filterPickByRole('',this)">Tất cả</button>
      ${Object.entries(ROLE_META).map(([k,r]) => `<button class="btn btn-outline pick-role-filter" style="padding:4px 10px;font-size:12px;border-color:${r.color}44;color:${r.color}" onclick="filterPickByRole('${k}',this)">${r.icon}</button>`).join('')}
    </div>
    <input type="text" placeholder="🔍 Tìm nhanh..." style="width:100%;margin-bottom:10px" oninput="filterMemberPick(this.value)">
    <div id="member-pick-list" style="max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">${listHtml}</div>
    <div class="modal-actions"><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button></div>
  `);
}

function filterPickByRole(roleId, btn) {
  document.querySelectorAll('.pick-role-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.member-pick-item').forEach(item => {
    if (!roleId) { item.style.display = ''; return; }
    // check badge text for role icon
    const hasRole = item.textContent.includes(roleId === 'luong' ? '🌾' : roleId === 'cong' ? '⚔' : roleId === 'thu' ? '🛡' : '💠');
    item.style.display = hasRole ? '' : 'none';
  });
}

function filterMemberPick(q) {
  document.querySelectorAll('.member-pick-item').forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

function assignMember(memberId, teamIndex, slotIndex, isReserve, overlay) {
  if (!isAdmin()) { denyEdit(); return; }
  // Store combatRole in slot too for display
  const member = Members.getById(memberId);
  Sessions.assignMember(teamIndex, slotIndex, memberId, isReserve);
  // Patch combatRole into slot
  const data = loadData();
  if (data.currentSession && member) {
    if (isReserve) {
      if (data.currentSession.reserve[slotIndex]) data.currentSession.reserve[slotIndex].combatRole = member.combatRole;
    } else {
      if (data.currentSession.teams[teamIndex]?.slots[slotIndex]) {
        data.currentSession.teams[teamIndex].slots[slotIndex].combatRole = member.combatRole;
      }
    }
    saveData(data);
  }
  overlay.remove();
  showToast('Đã thêm vào đội hình!');
  renderPage('dashboard');
}

function openSlotMenu(teamIndex, slotIndex, isReserve) {
  if (!isAdmin()) return;
  const session = Sessions.getCurrent();
  const slot = isReserve ? session.reserve[slotIndex] : session.teams[teamIndex]?.slots[slotIndex];
  if (!slot) return;
  const ROLE_META = { luong:{icon:'🌾',color:'#f0c040',name:'Lương'}, cong:{icon:'⚔',color:'#e05050',name:'Công'}, thu:{icon:'🛡',color:'#5090e0',name:'Thủ'}, tro:{icon:'💠',color:'#50d0a0',name:'Trợ'} };
  const rm = ROLE_META[slot.combatRole];
  const cc = getClassColor(slot.class);
  openModal(`
    <h3>${escHtml(slot.inGameName||slot.name)}</h3>
    <div style="display:flex;gap:10px;margin:14px 0;flex-wrap:wrap">
      ${rm ? `<span class="badge" style="background:${rm.color}22;color:${rm.color};font-size:13px;padding:5px 12px">${rm.icon} ${rm.name}</span>` : ''}
      <span class="badge" style="background:${cc}22;color:${cc};font-size:13px;padding:5px 12px">${getClassName(slot.class)}</span>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Đóng</button>
      <button class="btn btn-danger" onclick="removeSlot(${teamIndex},${slotIndex},${isReserve},this.closest('.modal-overlay'))">Gỡ khỏi đội</button>
    </div>
  `);
}

function removeSlot(teamIndex, slotIndex, isReserve, overlay) {
  if (!isAdmin()) { denyEdit(); return; }
  Sessions.removeSlot(teamIndex, slotIndex, isReserve);
  overlay.remove();
  showToast('Đã gỡ!');
  renderPage('dashboard');
}

/* ═══════════════════════════════════════════════════
   initDashMap — gọi sau khi dashboard render xong
═══════════════════════════════════════════════════ */
function initDashMap() {
  var wrap = document.getElementById('dash-map-wrap');
  if (!wrap) return;

  var settings = Settings.get();
  var session  = Sessions.getCurrent();
  var admin    = isAdmin();
  var maps     = settings.maps || [];
  var mapId    = (session && session.map) || settings.currentMap || (maps[0] && maps[0].id) || '';
  var mapObj   = maps.find(function(m){ return m.id === mapId; });
  var mapImg   = (typeof loadImageFromStorage === 'function' && mapObj)
                  ? loadImageFromStorage('map_' + mapObj.id) : '';

  // Render bản đồ
  if (mapImg) {
    wrap.innerHTML = '';
    var img = document.createElement('img');
    img.src = mapImg;
    img.style.cssText = 'display:block;width:100%;height:auto;border-radius:7px;pointer-events:none;-webkit-user-drag:none';
    wrap.appendChild(img);
  } else {
    wrap.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text-muted)">' +
      '<div style="font-size:28px;margin-bottom:6px">🗺</div><div>Chưa có ảnh bản đồ' +
      (admin ? ' — <span onclick="renderPage(\'settings\')" style="color:var(--accent-cyan);cursor:pointer;text-decoration:underline">Upload ở Cấu Hình</span>' : '') +
      '</div></div>';
    // Không render markers nếu không có bản đồ
    return;
  }

  // Toolbar markers (admin)
  var toolbar = document.getElementById('dash-marker-toolbar');
  if (admin && toolbar) {
    var CTYPES = [
      {id:'flag',icon:'🚩',label:'Cờ'},{id:'target',icon:'🎯',label:'Mục tiêu'},
      {id:'danger',icon:'⚠',label:'Nguy hiểm'},{id:'rally',icon:'⚔',label:'Tập kết'},
      {id:'defend',icon:'🛡',label:'Phòng thủ'},{id:'star',icon:'⭐',label:'Chính'},
    ];
    toolbar.innerHTML =
      '<span style="font-size:11px;color:var(--text-secondary);font-weight:600;white-space:nowrap;align-self:center">Thêm marker:</span>' +
      CTYPES.map(function(t){
        return '<button class="btn btn-outline" style="padding:3px 8px;font-size:11px" ' +
          'onclick="dashAddMarker(\'' + t.id + '\',\'' + t.icon + '\',\'' + t.label + '\')">' +
          t.icon + ' ' + t.label + '</button>';
      }).join('') +
      '<button class="btn btn-outline" style="padding:3px 8px;font-size:11px;margin-left:auto" onclick="dashResetMarkers()">↺ Reset</button>';
  }

  // Setup markers
  var numTeams = settings.numTeams || 10;
  var groups   = settings.groups || [];
  var FALL     = ['#22c55e','#40c0e0','#f0c040','#f59e0b','#f28e99','#e05050','#9060e0','#f97316','#ec4899','#14b8a6'];

  function tColor(ti) {
    var t = session && session.teams && session.teams[ti];
    var gid = t && t.group;
    var g = gid && groups.find(function(x){ return x.id === gid; });
    return g ? g.color : FALL[ti % FALL.length];
  }

  var savedM = session && session.tactics && session.tactics.markers;
  var defM   = buildDefaultMarkers(numTeams);
  var _TM = defM.map(function(def, i) {
    var s = savedM && savedM.find(function(m){ return m.teamIndex === i; });
    return { teamIndex: i, x: s ? s.x : def.x, y: s ? s.y : def.y, color: tColor(i) };
  });
  var _CM = ((session && session.tactics && session.tactics.customMarkers) || []).map(function(m){ return Object.assign({}, m); });
  var _drag = null;

  function client(e) {
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    return t ? {x:t.clientX,y:t.clientY} : {x:e.clientX,y:e.clientY};
  }
  function pct(cx, cy) {
    var r = wrap.getBoundingClientRect();
    return {
      x: Math.max(1, Math.min(99, +((cx-r.left)/r.width*100).toFixed(2))),
      y: Math.max(1, Math.min(99, +((cy-r.top)/r.height*100).toFixed(2)))
    };
  }

  function renderMarkers() {
    wrap.querySelectorAll('.dm,.dm-del').forEach(function(e){ e.remove(); });
    _TM.forEach(function(mk, ti) {
      var el = document.createElement('div');
      el.className = 'dm';
      el.textContent = 'T'+(ti+1);
      el.style.cssText =
        'position:absolute;width:32px;height:32px;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-weight:800;font-size:12px;font-family:Cinzel,serif;color:#111;' +
        'border:2px solid rgba(255,255,255,0.35);box-shadow:0 2px 8px rgba(0,0,0,0.7);' +
        'transform:translate(-50%,-50%);z-index:10;touch-action:none;user-select:none;' +
        'background:'+mk.color+';left:'+mk.x+'%;top:'+mk.y+'%;' +
        'cursor:'+(admin?'grab':'pointer');
      if (admin) {
        (function(i,e2){
          e2.addEventListener('mousedown',  function(ev){ ev.preventDefault(); ev.stopPropagation(); _drag={kind:'tm',idx:i,el:e2,ox:client(ev).x,oy:client(ev).y}; e2.style.cursor='grabbing'; e2.style.zIndex='50'; });
          e2.addEventListener('touchstart', function(ev){ ev.preventDefault(); ev.stopPropagation(); _drag={kind:'tm',idx:i,el:e2,ox:client(ev).x,oy:client(ev).y}; e2.style.zIndex='50'; },{passive:false});
        })(ti, el);
      }
      wrap.appendChild(el);
    });
    _CM.forEach(function(mk, ci) {
      var el = document.createElement('div');
      el.className = 'dm';
      el.textContent = mk.icon;
      el.style.cssText =
        'position:absolute;font-size:22px;line-height:1;' +
        'transform:translate(-50%,-50%);z-index:11;touch-action:none;user-select:none;' +
        'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.9));' +
        'left:'+mk.x+'%;top:'+mk.y+'%;cursor:'+(admin?'grab':'default');
      if (admin) {
        (function(i,e2){
          e2.addEventListener('mousedown',  function(ev){ ev.preventDefault(); ev.stopPropagation(); _drag={kind:'cm',idx:i,el:e2,ox:client(ev).x,oy:client(ev).y}; e2.style.cursor='grabbing'; e2.style.zIndex='51'; });
          e2.addEventListener('touchstart', function(ev){ ev.preventDefault(); ev.stopPropagation(); _drag={kind:'cm',idx:i,el:e2,ox:client(ev).x,oy:client(ev).y}; e2.style.zIndex='51'; },{passive:false});
          var del = document.createElement('div');
          del.className='dm-del';
          del.textContent='×';
          del.style.cssText='position:absolute;width:16px;height:16px;border-radius:50%;background:#dc2626;border:2px solid white;color:white;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:20;transform:translate(-50%,-50%);left:calc('+mk.x+'% + 11px);top:calc('+mk.y+'% - 11px)';
          del.addEventListener('click', function(ev){ ev.stopPropagation(); _CM.splice(i,1); saveM(); renderMarkers(); });
          wrap.appendChild(del);
        })(ci, el);
      }
      wrap.appendChild(el);
    });
  }

  function onMove(e) {
    if (!_drag) return; e.preventDefault();
    var c = client(e);
    var p = pct(c.x, c.y);
    if (_drag.kind === 'tm') { _TM[_drag.idx].x=p.x; _TM[_drag.idx].y=p.y; }
    else                     { _CM[_drag.idx].x=p.x; _CM[_drag.idx].y=p.y; }
    _drag.el.style.left=p.x+'%'; _drag.el.style.top=p.y+'%';
  }
  function onUp() {
    if (!_drag) return;
    if (_drag.el) { _drag.el.style.cursor=admin?'grab':'default'; _drag.el.style.zIndex=''; }
    _drag = null; saveM();
  }

  function saveM() {
    var cur = Sessions.getCurrent(); if (!cur) return;
    Sessions.updateCurrent({ tactics: Object.assign({}, cur.tactics||{}, { markers:_TM, customMarkers:_CM }) });
  }

  window.dashAddMarker = function(typeId, icon, label) {
    _CM.push({id:'cm_'+Date.now(),type:typeId,icon:icon,label:label,x:50,y:50});
    renderMarkers(); saveM();
    if (typeof showToast === 'function') showToast('Đã thêm '+label+' — kéo để di chuyển!');
  };
  window.dashResetMarkers = function() {
    _TM = defM.map(function(d,i){ return Object.assign({},d,{color:tColor(i)}); });
    renderMarkers(); saveM();
    if (typeof showToast === 'function') showToast('Đã reset!');
  };

  document.addEventListener('mousemove', onMove, {passive:false});
  document.addEventListener('mouseup',   onUp);
  document.addEventListener('touchmove', onMove, {passive:false});
  document.addEventListener('touchend',  onUp);

  renderMarkers();
}
