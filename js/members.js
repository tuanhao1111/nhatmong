/**
 * members.js - Quản lý thành viên
 * Tích hợp: Skill (chọn 1 từ danh sách icon) + Task (multi-select)
 * Vai trò chiến đấu: Lương / Công / Thủ / Trợ
 */

const COMBAT_ROLES = [
  { id:'luong', name:'Lương', icon:'🌾', color:'#f0c040', desc:'Cung cấp tài nguyên' },
  { id:'cong',  name:'Công',  icon:'⚔',  color:'#e05050', desc:'Tấn công tiền tuyến'  },
  { id:'thu',   name:'Thủ',   icon:'🛡',  color:'#5090e0', desc:'Phòng thủ trận địa'  },
  { id:'tro',   name:'Trợ',   icon:'💠',  color:'#50d0a0', desc:'Hỗ trợ đồng đội'     }
];

function getCombatRole(id)  { return COMBAT_ROLES.find(r=>r.id===id)||null; }
function combatRoleBadge(id) {
  const r=getCombatRole(id);
  if(!r) return '<span style="color:var(--text-muted)">—</span>';
  return `<span class="badge" style="background:${r.color}22;color:${r.color};border:1px solid ${r.color}44">${r.icon} ${r.name}</span>`;
}
function skillBadge(skillId) {
  if (!skillId) return '<span style="color:var(--text-muted)">—</span>';
  const sk = Settings.get().skills.find(s=>s.id===skillId);
  if (!sk) return '<span style="color:var(--text-muted)">—</span>';
  const img = loadImageFromStorage('skill_' + sk.id);
  return img
    ? `<img src="${img}" title="${escHtml(sk.name)}" style="width:24px;height:24px;border-radius:4px;vertical-align:middle;object-fit:cover">`
    : `<span class="badge" style="background:${sk.color}22;color:${sk.color}">${sk.name}</span>`;
}

/* ══════════════════════════════════════════════════════════ LIST PAGE */
function renderMembersPage() {
  if (typeof isGuest === 'function' && isGuest()) {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px">'+
      '<div style="font-size:48px">🔒</div>'+
      '<div style="font-size:18px;font-weight:600;color:var(--text-secondary)">Chỉ thành viên bang mới xem được</div>'+
      '<div style="font-size:13px;color:var(--text-muted);text-align:center;max-width:300px;line-height:1.7">Nội dung này được bảo mật. Vui lòng <a onclick="window.location.href=\'login.html\'" style="color:var(--accent-cyan);cursor:pointer;text-decoration:underline">đăng nhập</a> với tài khoản thành viên.</div>'+
      '</div>';
  }
  const members  = Members.getAll();
  const settings = Settings.get();
  const admin    = isAdmin();
  const filters  = window._memberFilter || { search:'', class:'', group:'', combatRole:'' };

  const filtered = members.filter(m => {
    if (filters.search && !m.name.toLowerCase().includes(filters.search.toLowerCase())
        && !(m.inGameName||'').toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.class     && m.class     !== filters.class)     return false;
    if (filters.combatRole&& m.combatRole!== filters.combatRole) return false;
    return true;
  });

  const classOpts       = settings.classes.map(c=>`<option value="${c.id}" ${filters.class===c.id?'selected':''}>${c.name}</option>`).join('');
  const combatRoleOpts  = COMBAT_ROLES.map(r=>`<option value="${r.id}" ${filters.combatRole===r.id?'selected':''}>${r.icon} ${r.name}</option>`).join('');

  // Role summary
  const roleSummary = COMBAT_ROLES.map(r=>{
    const cnt=members.filter(m=>m.combatRole===r.id).length;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:${r.color}11;border:1px solid ${r.color}33;border-radius:8px">
      <span style="font-size:18px">${r.icon}</span>
      <div><div style="font-size:11px;color:${r.color};font-weight:700">${r.name}</div>
      <div style="font-size:16px;font-weight:700">${cnt}</div></div>
    </div>`;
  }).join('');

  const me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const myId = me ? me.id : null;

  const actionTh = (admin || myId) ? `<th class="th">Thao tác</th>` : '';
  // Admin thấy thêm 2 cột chi tiết
  const adminThs = admin ? `<th class="th">ID Ingame</th><th class="th">Discord</th>` : '';

  const rows = filtered.map(m => {
    let actionTd = '';
    if (admin) {
      actionTd = `
      <td style="padding:10px 16px">
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline" style="padding:5px 10px;font-size:12px" onclick="openEditMember('${m.id}')">Sửa</button>
          <button class="btn btn-danger"  style="padding:5px 10px;font-size:12px" onclick="deleteMember('${m.id}')">Xóa</button>
        </div>
      </td>`;
    } else if (myId && m.id === myId) {
      actionTd = `
      <td style="padding:10px 16px">
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px" onclick="event.stopPropagation();openMyInfoModal('${m.id}')">👁 Xem info</button>
      </td>`;
    } else if (myId) {
      actionTd = `<td style="padding:10px 16px"></td>`;
    }

    // Tên có thể click để xem chi tiết (chính chủ + admin)
    const isMine = myId && m.id === myId;
    const nameClickable = isMine || admin;
    const nameClickAttr = nameClickable
      ? ` onclick="openMyInfoModal('${m.id}')" style="cursor:pointer" title="Click để xem chi tiết"`
      : '';

    // Admin thấy thêm 2 cột
    const adminTds = admin ? `
      <td style="padding:10px 16px;font-family:monospace;font-size:12px;color:var(--text-secondary)">${escHtml(m.inGameId||m.ingameId||'—')}</td>
      <td style="padding:10px 16px;font-family:monospace;font-size:12px;color:var(--text-secondary)">${escHtml(m.discordId||'—')}</td>` : '';

    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:10px 16px"${nameClickAttr}>
          <div style="font-weight:600${nameClickable?';color:var(--accent-cyan)':''}">${escHtml(m.inGameName||m.name)}${isMine?' <span style="font-size:10px;color:var(--accent-gold);font-weight:500">(bạn)</span>':''}</div>
          ${m.inGameName&&m.name!==m.inGameName?`<div style="font-size:11px;color:var(--text-secondary)">${escHtml(m.name)}</div>`:''}
        </td>
        <td style="padding:10px 16px">${classBadge(m.class)}</td>
        <td style="padding:10px 16px;font-weight:600;color:var(--accent-gold)">${formatNumber(m.power||0)}</td>
        <td style="padding:10px 16px">${combatRoleBadge(m.combatRole)}</td>
        ${adminTds}
        <td style="padding:10px 16px;color:var(--text-secondary);font-size:12px">${formatDate(m.joinDate)}</td>
        ${actionTd}
      </tr>`;
  }).join('');

  // Số cột thực tế (cho colspan)
  const colSpan = 5 + (admin?2:0) + ((admin||myId)?1:0);

  return `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div class="page-title">Thành Viên</div>
        <div class="page-subtitle">${members.length} thành viên · ${filtered.length} hiển thị</div>
      </div>
      ${admin
        ? `<button class="btn btn-gold" onclick="openAddMember()">+ Thêm thành viên</button>`
        : `<span class="badge" style="background:rgba(64,192,224,0.1);color:var(--accent-cyan);border:1px solid rgba(64,192,224,0.3);padding:6px 14px">👁 Chế độ xem</span>`}
    </div>

    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">${roleSummary}</div>

    <div class="card" style="margin-bottom:16px;padding:14px">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <input type="text" placeholder="🔍 Tìm tên..." value="${escHtml(filters.search)}" style="flex:1;min-width:180px" oninput="memberFilter('search',this.value)">
        <select onchange="memberFilter('class',this.value)" style="min-width:140px"><option value="">Tất cả class</option>${classOpts}</select>
        <select onchange="memberFilter('combatRole',this.value)" style="min-width:130px"><option value="">Tất cả vai trò</option>${combatRoleOpts}</select>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#0f0f1e;border-bottom:1px solid var(--border-color)">
          <th class="th">Tên</th><th class="th">Class</th><th class="th">Chiến lực</th>
          <th class="th">Vai trò</th>
          ${admin ? '<th class="th">ID Ingame</th><th class="th">Discord</th>' : ''}
          <th class="th">Ngày vào</th>${actionTh}
        </tr></thead>
        <tbody>${filtered.length===0?`<tr><td colspan="${colSpan}" style="text-align:center;padding:40px;color:var(--text-muted)">Không có thành viên nào</td></tr>`:rows}</tbody>
      </table>
    </div>
    <style>.th{padding:12px 16px;text-align:left;font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px}</style>
  `;
}

function memberFilter(key, value) {
  if (!window._memberFilter) window._memberFilter = {};
  window._memberFilter[key] = value;
  document.getElementById('page-area').innerHTML = renderMembersPage();
}

/* ══════════════════════════════════════════════════════════ FORM */
function buildMemberForm(m={}, selfEdit=false) {
  const settings   = Settings.get();
  const classOpts  = settings.classes.map(c=>`<option value="${c.id}" ${m.class===c.id?'selected':''}>${c.name}</option>`).join('');

  // 3 field private (ID ingame + Discord): chỉ admin sửa được
  // Member tự xem được (read-only) ở popup info, không có ở form sửa của member
  const privateFields = !selfEdit ? `
    <div class="form-row">
      <div class="form-group"><label>ID Ingame</label><input type="text" id="mf-ingame-id" value="${escHtml(m.inGameId||m.ingameId||'')}" placeholder="ID nhân vật"></div>
      <div class="form-group"><label>ID Discord</label><input type="text" id="mf-discord-id" value="${escHtml(m.discordId||'')}" placeholder="username#0000"></div>
    </div>` : '';

  return `
    <div class="form-row">
      <div class="form-group"><label>Tên thật</label><input type="text" id="mf-name" value="${escHtml(m.name||'')}" placeholder="Tên hiển thị"></div>
      <div class="form-group"><label>Tên trong game</label><input type="text" id="mf-ingame" value="${escHtml(m.inGameName||'')}" placeholder="Nickname game"${selfEdit?' readonly style="opacity:0.6;cursor:not-allowed"':''}></div>
    </div>
    <div class="form-group"><label>Class</label><select id="mf-class"${selfEdit?' disabled style="opacity:0.6;cursor:not-allowed"':''}><option value="">-- Chọn class --</option>${classOpts}</select></div>

    ${privateFields}

    <div class="form-row">
      <div class="form-group"><label>Chiến lực</label><input type="number" id="mf-power" value="${m.power||0}"></div>
      <div class="form-group"><label>Ghi chú</label><input type="text" id="mf-note" value="${escHtml(m.note||'')}"></div>
    </div>

    ${selfEdit ? '<div style="margin-top:6px;font-size:11px;color:var(--text-muted);font-style:italic">ℹ Một số trường (Tên ingame, Class, ID ingame, ID Discord) chỉ admin sửa được. Liên hệ Bang Chủ nếu cần đổi.</div>' : ''}
  `;
}

function initFormPickers() {
  // Không còn fields cần bind events - kept for backward compat
}

function getMemberFormValues() {
  const v = {
    name:       document.getElementById('mf-name')?.value.trim()  || '',
    inGameName: document.getElementById('mf-ingame')?.value.trim()|| '',
    class:      document.getElementById('mf-class')?.value        || '',
    power:      parseInt(document.getElementById('mf-power')?.value)||0,
    note:       document.getElementById('mf-note')?.value.trim()  || ''
  };
  // Admin form có thêm 2 field private
  const idIngame  = document.getElementById('mf-ingame-id');
  const idDiscord = document.getElementById('mf-discord-id');
  if (idIngame)  v.inGameId  = idIngame.value.trim();
  if (idDiscord) v.discordId = idDiscord.value.trim();
  return v;
}

/* ══════════════════════════════════════════════════════════ ADD */
function openAddMember() {
  if (!isAdmin()) { denyEdit(); return; }
  const ov = openModal(`
    <h3 style="margin-bottom:16px">⚔ Thêm Thành Viên</h3>
    ${buildMemberForm()}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="submitAddMember(this.closest('.modal-overlay'))">Thêm</button>
    </div>`, null, true);
  setTimeout(initFormPickers, 60);
}
function submitAddMember(ov) {
  const v = getMemberFormValues();
  if (!v.name&&!v.inGameName){showToast('Vui lòng nhập tên!','error');return;}
  Members.add({...v,name:v.name||v.inGameName})
    .then(function(){ ov.remove(); showToast('Đã thêm thành viên!'); /* listener sẽ re-render */ })
    .catch(function(){ /* showToast đã chạy trong storage.js */ });
}

/* ══════════════════════════════════════════════════════════ EDIT */
function openEditMember(id) {
  // Admin sửa được tất cả; member chỉ sửa được record của chính mình
  if (!canEditOwnMember(id)) { denyEdit(); return; }
  const m = Members.getById(id); if(!m) return;
  const isSelfEdit = !isAdmin();
  openModal(`
    <h3 style="margin-bottom:16px">✏ ${isSelfEdit ? 'Sửa Thông Tin Của Tôi' : 'Chỉnh Sửa Thành Viên'}</h3>
    ${buildMemberForm(m, isSelfEdit)}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="submitEditMember('${id}',this.closest('.modal-overlay'))">Lưu</button>
    </div>`, null, true);
  setTimeout(initFormPickers, 60);
}
function submitEditMember(id, ov) {
  if (!canEditOwnMember(id)) { denyEdit(); return; }
  const v = getMemberFormValues();
  // Member tự sửa: KHÔNG cho thay đổi các field admin-only
  if (!isAdmin()) {
    delete v.group;
    delete v.combatRole;
    delete v.inGameName;   // tên ingame không đổi sau đăng ký
    delete v.class;        // class không đổi sau đăng ký
    delete v.inGameId;     // ID ingame admin-only
    delete v.discordId;    // ID Discord admin-only
  }
  Members.update(id,{...v,name:v.name||v.inGameName})
    .then(function(){ ov.remove(); showToast('Đã cập nhật!'); })
    .catch(function(){});
}

/* ══════════════════════════════════════════════════════════ DELETE */
function deleteMember(id) {
  if (!isAdmin()) { denyEdit(); return; }
  const m = Members.getById(id); if(!m) return;
  if (!confirmDelete(`Xóa "${m.inGameName||m.name}"?`)) return;
  Members.delete(id)
    .then(function(){ showToast('Đã xóa!','error'); })
    .catch(function(){});
}

/* ══════════════════════════════════════════════════════════ INFO POPUP
   Hiển thị thông tin chi tiết của member.
   - Chính chủ luôn xem được info của mình (gồm cả ID ingame + Discord)
   - Admin xem được info của bất kỳ ai
   - Member khác xem thì chỉ thấy thông tin công khai (tên, class, chiến lực)
*/
function openMyInfoModal(id) {
  const m = Members.getById(id);
  if (!m) { showToast('Không tìm thấy thành viên', 'error'); return; }

  const me = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
  const myId = me ? me.id : null;
  const isMine = myId && id === myId;
  const admin = isAdmin();
  // Chỉ chính chủ + admin xem được ID ingame và Discord
  const showPrivate = isMine || admin;

  const cls = (Settings.get().classes || []).find(c => c.id === m.class);
  const role = getCombatRole(m.combatRole);

  const ingameId = m.inGameId || m.ingameId || '';

  const privateRows = showPrivate ? `
    <tr><td class="info-k">ID Ingame</td><td class="info-v" style="font-family:monospace">${escHtml(ingameId || '— chưa có —')}</td></tr>
    <tr><td class="info-k">ID Discord</td><td class="info-v" style="font-family:monospace">${escHtml(m.discordId || '— chưa có —')}</td></tr>
  ` : '';

  const editBtn = (isMine || admin) ? `
    <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove();openEditMember('${m.id}')">
      ✏ ${isMine && !admin ? 'Sửa info của tôi' : 'Sửa'}
    </button>` : '';

  openModal(`
    <h3 style="margin-bottom:16px">👤 Thông Tin ${isMine ? 'Của Tôi' : 'Thành Viên'}</h3>

    <div style="background:#0c0c1a;border-radius:8px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <tr><td class="info-k">Tên hiển thị</td><td class="info-v">${escHtml(m.name || '—')}</td></tr>
        <tr><td class="info-k">Tên ingame</td><td class="info-v" style="font-weight:600">${escHtml(m.inGameName || '—')}</td></tr>
        <tr><td class="info-k">Hệ phái</td><td class="info-v">${cls ? `<span style="color:${cls.color};font-weight:600">${escHtml(cls.name)}</span>` : '—'}</td></tr>
        <tr><td class="info-k">Vai trò</td><td class="info-v">${role ? `<span style="color:${role.color}">${role.icon} ${role.name}</span>` : '—'}</td></tr>
        <tr><td class="info-k">Chiến lực</td><td class="info-v" style="color:var(--accent-gold);font-weight:600">${formatNumber(m.power || 0)}</td></tr>
        ${privateRows}
        <tr><td class="info-k">Ngày vào</td><td class="info-v" style="color:var(--text-secondary);font-size:12px">${formatDate(m.joinDate)}</td></tr>
        ${m.note ? `<tr><td class="info-k">Ghi chú</td><td class="info-v" style="font-style:italic;color:var(--text-secondary)">${escHtml(m.note)}</td></tr>` : ''}
      </table>
    </div>

    ${showPrivate ? '' : '<div style="margin-top:10px;font-size:11px;color:var(--text-muted);font-style:italic">ℹ Một số thông tin (ID ingame, Discord) chỉ hiển thị cho chính chủ và admin.</div>'}

    <div class="modal-actions">
      ${editBtn}
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Đóng</button>
    </div>

    <style>
      .info-k { padding:10px 14px;color:var(--text-secondary);font-size:12px;width:130px;border-bottom:1px solid var(--border-color);background:rgba(255,255,255,0.02) }
      .info-v { padding:10px 14px;font-size:13px;border-bottom:1px solid var(--border-color);word-break:break-all }
      tr:last-child .info-k, tr:last-child .info-v { border-bottom:none }
    </style>
  `, null, true);
}
