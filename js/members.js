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
        <button class="btn btn-outline" style="padding:5px 10px;font-size:12px" onclick="openEditMember('${m.id}')">✏ Sửa info của tôi</button>
      </td>`;
    } else if (myId) {
      actionTd = `<td style="padding:10px 16px"></td>`;
    }
    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:10px 16px">
          <div style="font-weight:600">${escHtml(m.inGameName||m.name)}</div>
          ${m.inGameName&&m.name!==m.inGameName?`<div style="font-size:11px;color:var(--text-secondary)">${escHtml(m.name)}</div>`:''}
        </td>
        <td style="padding:10px 16px">${classBadge(m.class)}</td>
        <td style="padding:10px 16px;font-weight:600;color:var(--accent-gold)">${formatNumber(m.power||0)}</td>
        <td style="padding:10px 16px">${combatRoleBadge(m.combatRole)}</td>
        <td style="padding:10px 16px;color:var(--text-secondary);font-size:12px">${formatDate(m.joinDate)}</td>
        ${actionTd}
      </tr>`;
  }).join('');

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
          <th class="th">Ngày vào</th>${actionTh}
        </tr></thead>
        <tbody>${filtered.length===0?`<tr><td colspan="${(admin||myId)?6:5}" style="text-align:center;padding:40px;color:var(--text-muted)">Không có thành viên nào</td></tr>`:rows}</tbody>
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

  return `
    <div class="form-row">
      <div class="form-group"><label>Tên thật</label><input type="text" id="mf-name" value="${escHtml(m.name||'')}" placeholder="Tên hiển thị"></div>
      <div class="form-group"><label>Tên trong game</label><input type="text" id="mf-ingame" value="${escHtml(m.inGameName||'')}" placeholder="Nickname game"></div>
    </div>
    <div class="form-group"><label>Class</label><select id="mf-class"><option value="">-- Chọn class --</option>${classOpts}</select></div>

    <div class="form-row">
      <div class="form-group"><label>Chiến lực</label><input type="number" id="mf-power" value="${m.power||0}"></div>
      <div class="form-group"><label>Ghi chú</label><input type="text" id="mf-note" value="${escHtml(m.note||'')}"></div>
    </div>
  `;
}

function initFormPickers() {
  // Không còn fields cần bind events - kept for backward compat
}

function getMemberFormValues() {
  return {
    name:       document.getElementById('mf-name')?.value.trim()  || '',
    inGameName: document.getElementById('mf-ingame')?.value.trim()|| '',
    class:      document.getElementById('mf-class')?.value        || '',
    power:      parseInt(document.getElementById('mf-power')?.value)||0,
    note:       document.getElementById('mf-note')?.value.trim()  || ''
  };
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
  // Member tự sửa: KHÔNG cho thay đổi group/combatRole (admin-only fields)
  if (!isAdmin()) {
    delete v.group;
    delete v.combatRole;
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
