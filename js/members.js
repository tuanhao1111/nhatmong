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
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'min-height:60vh;gap:16px;color:var(--text-muted,#555)">' +
      '<div style="font-size:48px">🔒</div>' +
      '<div style="font-size:18px;font-weight:600">Nội dung bị ẩn</div>' +
      '<div style="font-size:13px;text-align:center;max-width:300px;line-height:1.6">Chế độ Khách không xem được thông tin. Vui lòng <a onclick="window.location.href=\'login.html\'" style="color:#40c0e0;cursor:pointer">đăng nhập</a> để xem đầy đủ.</div>' +
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
    if (filters.group     && m.group     !== filters.group)     return false;
    if (filters.combatRole&& m.combatRole!== filters.combatRole) return false;
    return true;
  });

  const classOpts       = settings.classes.map(c=>`<option value="${c.id}" ${filters.class===c.id?'selected':''}>${c.name}</option>`).join('');
  const groupOpts       = settings.groups.map(g=>`<option value="${g.id}" ${filters.group===g.id?'selected':''}>${g.name}</option>`).join('');
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

  const actionTh = admin ? `<th class="th">Thao tác</th>` : '';
  const rows = filtered.map(m => {
    const actionTd = admin ? `
      <td style="padding:10px 16px">
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline" style="padding:5px 10px;font-size:12px" onclick="openEditMember('${m.id}')">Sửa</button>
          <button class="btn btn-danger"  style="padding:5px 10px;font-size:12px" onclick="deleteMember('${m.id}')">Xóa</button>
        </div>
      </td>` : '';
    return `
      <tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:10px 16px">
          <div style="font-weight:600">${escHtml(m.inGameName||m.name)}</div>
          ${m.inGameName&&m.name!==m.inGameName?`<div style="font-size:11px;color:var(--text-secondary)">${escHtml(m.name)}</div>`:''}
        </td>
        <td style="padding:10px 16px">${classBadge(m.class)}</td>
        <td style="padding:10px 16px;font-weight:600;color:var(--accent-gold)">${formatNumber(m.power||0)}</td>
        <td style="padding:10px 16px">${combatRoleBadge(m.combatRole)}</td>
        <td style="padding:10px 16px">${skillBadge(m.skill)}</td>
        <td style="padding:10px 16px">${m.group?`<span class="badge" style="background:${getGroupColor(m.group)}22;color:${getGroupColor(m.group)}">${getGroupName(m.group)}</span>`:'<span style="color:var(--text-muted)">—</span>'}</td>
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
        <select onchange="memberFilter('group',this.value)" style="min-width:130px"><option value="">Tất cả nhóm</option>${groupOpts}</select>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#0f0f1e;border-bottom:1px solid var(--border-color)">
          <th class="th">Tên</th><th class="th">Class</th><th class="th">Chiến lực</th>
          <th class="th">Vai trò</th><th class="th">Skill</th><th class="th">Nhóm</th>
          <th class="th">Ngày vào</th>${actionTh}
        </tr></thead>
        <tbody>${filtered.length===0?`<tr><td colspan="${admin?8:7}" style="text-align:center;padding:40px;color:var(--text-muted)">Không có thành viên nào</td></tr>`:rows}</tbody>
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
function buildMemberForm(m={}) {
  const settings   = Settings.get();
  const classOpts  = settings.classes.map(c=>`<option value="${c.id}" ${m.class===c.id?'selected':''}>${c.name}</option>`).join('');
  const groupOpts  = settings.groups.map(g=>`<option value="${g.id}" ${m.group===g.id?'selected':''}>${g.name}</option>`).join('');

  // Combat role picker
  const combatOpts = COMBAT_ROLES.map(r=>`
    <label style="cursor:pointer">
      <input type="radio" name="mf-combat-role" value="${r.id}" ${m.combatRole===r.id?'checked':''} style="display:none">
      <div class="combat-role-opt" data-id="${r.id}" style="
        padding:10px 12px;border-radius:8px;border:2px solid ${m.combatRole===r.id?r.color:'#2a2a45'};
        background:${m.combatRole===r.id?r.color+'18':'#0f0f1e'};
        display:flex;align-items:center;gap:10px;transition:all 0.15s">
        <span style="font-size:22px">${r.icon}</span>
        <div><div style="font-weight:700;color:${r.color}">${r.name}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${r.desc}</div></div>
      </div>
    </label>`).join('');

  // Skill grid (chọn 1)
  const skillGrid = settings.skills.length === 0
    ? '<div style="color:var(--text-muted);font-size:12px">Chưa có skill. Thêm ở Cấu Hình.</div>'
    : `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px" id="skill-grid">
        ${settings.skills.map(sk => {
          const img    = loadImageFromStorage('skill_' + sk.id);
          const active = m.skill === sk.id;
          return `<label style="cursor:pointer">
            <input type="radio" name="mf-skill" value="${sk.id}" ${active?'checked':''} style="display:none">
            <div class="skill-opt" data-id="${sk.id}" style="
              text-align:center;padding:6px 4px;border-radius:8px;
              border:2px solid ${active?sk.color:'#2a2a45'};
              background:${active?sk.color+'18':'#0f0f1e'};
              transition:all 0.15s;cursor:pointer">
              ${img
                ? `<img src="${img}" style="width:44px;height:44px;border-radius:6px;object-fit:cover;display:block;margin:0 auto 4px">`
                : `<div style="width:44px;height:44px;border-radius:6px;background:${sk.color}33;display:flex;align-items:center;justify-content:center;margin:0 auto 4px;font-size:20px">✨</div>`}
              <div style="font-size:10px;color:${active?sk.color:'var(--text-secondary)'};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(sk.name)}</div>
            </div>
          </label>`;
        }).join('')}
      </div>`;

  // Task checkboxes
  const taskChecks = settings.tasks.length === 0
    ? '<div style="color:var(--text-muted);font-size:12px">Chưa có task. Thêm ở Cấu Hình.</div>'
    : `<div style="display:flex;gap:10px;flex-wrap:wrap" id="task-checks">
        ${settings.tasks.map(t => {
          const img     = loadImageFromStorage('task_' + t.id);
          const checked = (m.tasks||[]).includes(t.id);
          return `<label style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:2px solid ${checked?t.color:'#2a2a45'};background:${checked?t.color+'18':'#0f0f1e'}" id="task-label-${t.id}">
            <input type="checkbox" name="mf-task" value="${t.id}" ${checked?'checked':''} style="display:none"
                   onchange="toggleTaskLabel('${t.id}','${t.color}',this)">
            ${img?`<img src="${img}" style="width:20px;height:20px;border-radius:3px;object-fit:cover">`:''}
            <span style="font-size:12px;font-weight:600;color:${checked?t.color:'var(--text-secondary)'}">${escHtml(t.name)}</span>
          </label>`;
        }).join('')}
      </div>`;

  return `
    <div class="form-row">
      <div class="form-group"><label>Tên thật</label><input type="text" id="mf-name" value="${escHtml(m.name||'')}" placeholder="Tên hiển thị"></div>
      <div class="form-group"><label>Tên trong game</label><input type="text" id="mf-ingame" value="${escHtml(m.inGameName||'')}" placeholder="Nickname game"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Class</label><select id="mf-class"><option value="">-- Chọn class --</option>${classOpts}</select></div>
      <div class="form-group"><label>Nhóm</label><select id="mf-group"><option value="">-- Chọn nhóm --</option>${groupOpts}</select></div>
    </div>

    <div class="form-group">
      <label>⚔ Vai Trò Chiến Đấu</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">${combatOpts}</div>
    </div>

    <div class="form-group">
      <label>✨ Skill</label>
      ${skillGrid}
    </div>

    <div class="form-group">
      <label>📦 Nhiệm Vụ</label>
      ${taskChecks}
    </div>

    <div class="form-row">
      <div class="form-group"><label>Chiến lực</label><input type="number" id="mf-power" value="${m.power||0}"></div>
      <div class="form-group"><label>Ghi chú</label><input type="text" id="mf-note" value="${escHtml(m.note||'')}"></div>
    </div>
  `;
}

function toggleTaskLabel(taskId, color, checkbox) {
  const label = document.getElementById('task-label-' + taskId);
  if (!label) return;
  const on = checkbox.checked;
  label.style.border      = `2px solid ${on?color:'#2a2a45'}`;
  label.style.background  = on ? color+'18' : '#0f0f1e';
  const span = label.querySelector('span');
  if (span) span.style.color = on ? color : 'var(--text-secondary)';
}

function initFormPickers() {
  // Combat role
  document.querySelectorAll('#combat-role-picker label, .form-group label').forEach(l=>{
    const radio = l.querySelector('input[type=radio][name="mf-combat-role"]');
    if (!radio) return;
    l.addEventListener('click', ()=>{
      const id = radio.value;
      document.querySelectorAll('.combat-role-opt').forEach(opt=>{
        const r = getCombatRole(opt.dataset.id);
        const active = opt.dataset.id === id;
        opt.style.border     = `2px solid ${active?r.color:'#2a2a45'}`;
        opt.style.background = active ? r.color+'18' : '#0f0f1e';
      });
    });
  });
  // Skill
  document.querySelectorAll('input[name="mf-skill"]').forEach(radio=>{
    radio.closest('label').addEventListener('click', ()=>{
      const id = radio.value;
      const sk = Settings.get().skills.find(s=>s.id===id);
      document.querySelectorAll('.skill-opt').forEach(opt=>{
        const s2 = Settings.get().skills.find(s=>s.id===opt.dataset.id);
        const active = opt.dataset.id === id;
        opt.style.border     = `2px solid ${active&&sk?sk.color:'#2a2a45'}`;
        opt.style.background = active&&sk ? sk.color+'18' : '#0f0f1e';
        const nameEl = opt.querySelector('div:last-child');
        if (nameEl) nameEl.style.color = active&&s2 ? s2.color : 'var(--text-secondary)';
      });
    });
  });
}

function getMemberFormValues() {
  const combatRadio = document.querySelector('input[name="mf-combat-role"]:checked');
  const skillRadio  = document.querySelector('input[name="mf-skill"]:checked');
  const taskChecked = [...document.querySelectorAll('input[name="mf-task"]:checked')].map(el=>el.value);
  return {
    name:       document.getElementById('mf-name')?.value.trim()  || '',
    inGameName: document.getElementById('mf-ingame')?.value.trim()|| '',
    class:      document.getElementById('mf-class')?.value        || '',
    group:      document.getElementById('mf-group')?.value        || '',
    power:      parseInt(document.getElementById('mf-power')?.value)||0,
    combatRole: combatRadio?.value || '',
    skill:      skillRadio?.value  || '',
    tasks:      taskChecked,
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
  Members.add({...v,name:v.name||v.inGameName}); ov.remove(); showToast('Đã thêm thành viên!'); renderPage('members');
}

/* ══════════════════════════════════════════════════════════ EDIT */
function openEditMember(id) {
  if (!isAdmin()) { denyEdit(); return; }
  const m = Members.getById(id); if(!m) return;
  openModal(`
    <h3 style="margin-bottom:16px">✏ Chỉnh Sửa Thành Viên</h3>
    ${buildMemberForm(m)}
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="submitEditMember('${id}',this.closest('.modal-overlay'))">Lưu</button>
    </div>`, null, true);
  setTimeout(initFormPickers, 60);
}
function submitEditMember(id, ov) {
  const v = getMemberFormValues();
  Members.update(id,{...v,name:v.name||v.inGameName}); ov.remove(); showToast('Đã cập nhật!'); renderPage('members');
}

/* ══════════════════════════════════════════════════════════ DELETE */
function deleteMember(id) {
  if (!isAdmin()) { denyEdit(); return; }
  const m = Members.getById(id); if(!m) return;
  if (!confirmDelete(`Xóa "${m.inGameName||m.name}"?`)) return;
  Members.delete(id); showToast('Đã xóa!','error'); renderPage('members');
}
