/**
 * slot-assign.js - Modals cho việc assign / edit / xóa slot
 *
 * Workflow:
 *   - Empty slot click  → openAssignModal(ti, si, isReserve)
 *     → 2 tab: "Chọn từ DB" và "Thêm thành viên tạm"
 *   - Filled slot click → openSlotMenu(ti, si, isReserve)
 *     → 3 nút: Xem chi tiết / Sửa skill+leader / Xóa khỏi slot
 *   - Non-admin click filled → viewSlotInfo(slot) chỉ xem
 *
 * Phụ thuộc:
 *   - Sessions.assignMember(ti, si, memberId, isReserve, extra)
 *   - Sessions.assignCustom(ti, si, custom, isReserve)
 *   - Sessions.updateSlot(ti, si, isReserve, patch)
 *   - Sessions.removeSlot(ti, si, isReserve)
 *   - openModal, showToast, escHtml, COMBAT_ROLES
 */

// ════════════════════════════════════════════════════════════════════════════
// SLOT MENU - khi click vào slot đã có người (admin only)
// ════════════════════════════════════════════════════════════════════════════
function openSlotMenu(teamIdx, slotIdx, isReserve) {
  if (!isAdmin()) return;
  const session = Sessions.getCurrent();
  if (!session) return;
  const slot = isReserve ? session.reserve[slotIdx] : session.teams[teamIdx].slots[slotIdx];
  if (!slot) return;

  const html = `
    <h3 style="margin-bottom:6px">⚙ Quản Lý Slot</h3>
    <div style="color:var(--text-secondary);font-size:13px;margin-bottom:16px">
      ${escHtml(slot.inGameName || slot.name || '?')}
      ${slot.isCustom ? '<span style="font-size:10px;background:#3a2510;color:#ffa500;padding:2px 6px;border-radius:6px;margin-left:6px">tạm</span>' : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove();editSlotInfo(${teamIdx},${slotIdx},${isReserve})">✏ Sửa Skill / Vai Trò / Leader</button>
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove();openAssignModal(${teamIdx},${slotIdx},${isReserve})">🔄 Thay Người Khác</button>
      <button class="btn btn-danger"  onclick="this.closest('.modal-overlay').remove();removeSlotConfirm(${teamIdx},${slotIdx},${isReserve})">🗑 Xóa Khỏi Slot</button>
    </div>`;
  openModal(html, null, true);
}

// ════════════════════════════════════════════════════════════════════════════
// VIEW SLOT INFO - non-admin click filled slot
// ════════════════════════════════════════════════════════════════════════════
function viewSlotInfo(slot) {
  if (!slot) return;
  const settings = Settings.get();
  const cls   = (settings.classes || []).find(c => c.id === slot.class);
  const role  = COMBAT_ROLES.find(r => r.id === slot.combatRole);
  // Skills là array string trực tiếp (không cần lookup nữa)
  const skillNames = [];
  if (Array.isArray(slot.skills)) skillNames.push(...slot.skills.filter(Boolean));
  else if (slot.skill) skillNames.push(slot.skill);
  if (slot.customSkill) skillNames.push(slot.customSkill);
  const skillsHtml = skillNames.length
    ? skillNames.map(n => `<span class="slot-skill-chip">${escHtml(n)}</span>`).join(' ')
    : '<em style="color:var(--text-muted)">— chưa có —</em>';

  const rows = [
    ['Tên hiển thị', escHtml(slot.inGameName || slot.name || '?')],
    ['Hệ phái',     cls ? `<span style="color:${cls.color}">${escHtml(cls.name)}</span>` : '—'],
    ['Vai trò',     role ? `${role.icon} <span style="color:${role.color}">${role.name}</span>` : '—'],
    ['Kỹ năng',     skillsHtml],
    ['Leader',      slot.isLeader ? '<span class="slot-leader-badge">⭐ LEAD</span>' : '<em style="color:var(--text-muted)">không</em>']
  ];
  const tbl = rows.map(r => `<tr><td style="padding:8px 12px;color:var(--text-secondary);font-size:12px;width:120px">${r[0]}</td><td style="padding:8px 12px;font-size:13px">${r[1]}</td></tr>`).join('');

  openModal(`
    <h3 style="margin-bottom:14px">👁 Thông Tin Slot</h3>
    <table style="width:100%;border-collapse:collapse;background:#0c0c1a;border-radius:8px;overflow:hidden">${tbl}</table>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Đóng</button>
    </div>
  `, null, true);
}

// ════════════════════════════════════════════════════════════════════════════
// ASSIGN MODAL - chọn từ DB hoặc tạo thành viên tạm
// ════════════════════════════════════════════════════════════════════════════
function openAssignModal(teamIdx, slotIdx, isReserve) {
  if (!isAdmin()) return;
  const session = Sessions.getCurrent();
  if (!session) return;

  const settings = Settings.get();
  const allMembers = Members.getAll();
  const availCount = allMembers.filter(m => !Sessions.getMemberAssignment(m.id) && !Sessions.isAbsent(m.id)).length;

  const tabHtml = `
    <h3 style="margin-bottom:6px">➕ Thêm Vào Slot</h3>
    <div style="color:var(--text-secondary);font-size:12px;margin-bottom:14px">
      ${isReserve ? `Dự bị #${slotIdx+1}` : `Team T${teamIdx+1} • Slot #${slotIdx+1}`}
    </div>

    <div style="display:flex;gap:0;border-bottom:1px solid var(--border-color);margin-bottom:14px">
      <button id="assign-tab-db"     class="assign-tab active" onclick="switchAssignTab('db')">👥 Chọn từ Thành Viên (rảnh: ${availCount})</button>
      <button id="assign-tab-custom" class="assign-tab"        onclick="switchAssignTab('custom')">✏ Thêm Thành Viên Tạm</button>
    </div>

    <div id="assign-pane-db">
      ${renderAssignPickFromDb(teamIdx, slotIdx, isReserve, allMembers)}
    </div>

    <div id="assign-pane-custom" style="display:none">
      ${renderAssignCustomForm(teamIdx, slotIdx, isReserve, settings)}
    </div>

    <div class="modal-actions" style="margin-top:14px">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
    </div>
  `;
  openModal(tabHtml, null, true);
  ensureAssignStyles();
  bindSlotEditFieldEvents();
  setTimeout(() => {
    const search = document.getElementById('assign-search');
    if (search) search.addEventListener('input', () => filterAssignList(teamIdx, slotIdx, isReserve));
  }, 30);
}

function switchAssignTab(tab) {
  document.getElementById('assign-tab-db').classList.toggle('active', tab === 'db');
  document.getElementById('assign-tab-custom').classList.toggle('active', tab === 'custom');
  document.getElementById('assign-pane-db').style.display     = tab === 'db' ? '' : 'none';
  document.getElementById('assign-pane-custom').style.display = tab === 'custom' ? '' : 'none';
}

function ensureAssignStyles() {
  if (document.getElementById('assign-modal-styles')) return;
  const s = document.createElement('style');
  s.id = 'assign-modal-styles';
  s.textContent = `
    .assign-tab { flex:1;padding:10px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-secondary);cursor:pointer;font-size:13px;font-weight:600;transition:all 0.15s; }
    .assign-tab:hover { color:var(--text-primary); }
    .assign-tab.active { color:var(--accent-gold);border-bottom-color:var(--accent-gold); }
    .assign-member-card { padding:8px 12px;background:#0c0c1a;border:1px solid var(--border-color);border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:all 0.12s; }
    .assign-member-card:hover { border-color:var(--accent-gold);background:#1a1a2e; }
    .assign-member-card.is-unavailable { opacity:0.55;background:#0a0a14;cursor:not-allowed; }
    .assign-member-card.is-unavailable:hover { border-color:rgba(255,80,80,0.4);background:#100c10; }
    .member-status-badge {
      font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;
      border:1px solid;letter-spacing:0.3px;white-space:nowrap;
    }
    .assign-skill-chip { display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:10px;font-size:11px;cursor:pointer;border:1px solid transparent;transition:all 0.1s;user-select:none; }
    .assign-skill-chip.active { background:rgba(240,192,64,0.18);border-color:rgba(240,192,64,0.5);color:var(--accent-gold); }
    .assign-skill-chip:not(.active) { background:#0c0c1a;border-color:#2a2a40;color:var(--text-secondary); }
    .assign-skill-chip:hover { transform:translateY(-1px); }
    .assign-role-chip { padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;border:2px solid transparent;background:#0c0c1a;color:var(--text-secondary);transition:all 0.12s;font-weight:600; }
  `;
  document.head.appendChild(s);
}

// ── Tab 1: Pick from DB ─────────────────────────────────────────────────────
function renderAssignPickFromDb(teamIdx, slotIdx, isReserve, members) {
  const settings = Settings.get();
  if (members.length === 0) {
    return '<div style="text-align:center;padding:40px;color:var(--text-muted)">Chưa có thành viên nào trong DB. <br>Dùng tab "Thêm Thành Viên Tạm" bên cạnh.</div>';
  }
  // Sort: rảnh (available) lên đầu, đã xếp / nghỉ xuống cuối
  const sorted = members.slice().sort((a, b) => {
    const aBusy = !!Sessions.getMemberAssignment(a.id) || Sessions.isAbsent(a.id);
    const bBusy = !!Sessions.getMemberAssignment(b.id) || Sessions.isAbsent(b.id);
    if (aBusy !== bBusy) return aBusy ? 1 : -1;
    return (a.inGameName || a.name || '').localeCompare(b.inGameName || b.name || '');
  });
  return `
    <input type="text" id="assign-search" placeholder="🔍 Tìm theo tên hoặc tên ingame..." style="width:100%;margin-bottom:10px;padding:8px 12px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;font-size:13px">
    <div id="assign-list" style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto;padding-right:4px">
      ${sorted.map(m => renderMemberCard(m, settings, teamIdx, slotIdx, isReserve)).join('')}
    </div>
  `;
}

function renderMemberCard(m, settings, ti, si, isReserve) {
  const cls  = settings.classes.find(c => c.id === m.class);
  const role = COMBAT_ROLES.find(r => r.id === m.combatRole);
  const memberSkills = Array.isArray(m.skills) ? m.skills : (m.skill ? [m.skill] : []);
  const skillTxt = memberSkills.filter(Boolean).join(' + ');

  // Check unavailable status
  const assignment = Sessions.getMemberAssignment(m.id);
  const isAbsent   = Sessions.isAbsent(m.id);
  const unavailable = !!assignment || isAbsent;

  let statusBadge = '';
  if (assignment) {
    statusBadge = `<span class="member-status-badge" style="background:rgba(80,144,224,0.2);color:#5090e0;border-color:rgba(80,144,224,0.4)">🎯 Đã ở ${assignment.label}</span>`;
  } else if (isAbsent) {
    statusBadge = `<span class="member-status-badge" style="background:rgba(255,140,0,0.18);color:#ffa84d;border-color:rgba(255,140,0,0.4)">😴 Xin nghỉ</span>`;
  }

  const clickAttr = unavailable
    ? `onclick="event.stopPropagation();showAssignBlocked('${m.id}')"`
    : `onclick="confirmAssignMember('${m.id}', ${ti}, ${si}, ${isReserve})"`;

  return `
    <div class="assign-member-card ${unavailable ? 'is-unavailable' : ''}"
         data-name="${escHtml((m.inGameName || m.name || '').toLowerCase())}"
         ${clickAttr}>
      <div style="width:8px;height:36px;border-radius:2px;background:${cls?cls.color:'#888'}"></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(m.inGameName || m.name || '?')}</span>
          ${statusBadge}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${cls ? `<span style="color:${cls.color}">${escHtml(cls.name)}</span>` : ''}
          ${role ? ` • <span style="color:${role.color}">${role.icon} ${role.name}</span>` : ''}
          ${skillTxt ? ` • ${escHtml(skillTxt)}` : ''}
        </div>
      </div>
      <div style="font-size:18px;color:${unavailable?'var(--text-muted)':'var(--accent-gold)'}">${unavailable?'🚫':'→'}</div>
    </div>
  `;
}

function showAssignBlocked(memberId) {
  const m = Members.getById(memberId);
  const assignment = Sessions.getMemberAssignment(memberId);
  const isAbsent = Sessions.isAbsent(memberId);
  let msg = '';
  if (assignment) msg = `❌ ${m.inGameName||m.name} đã được xếp ở ${assignment.label}. Hãy bỏ slot cũ trước nếu muốn chuyển.`;
  else if (isAbsent) msg = `❌ ${m.inGameName||m.name} đã đăng ký xin nghỉ. Hãy bỏ trạng thái nghỉ trước nếu muốn xếp.`;
  else msg = '❌ Không thể xếp thành viên này.';
  if (typeof showToast === 'function') showToast(msg, 'error', 4500);
}

function filterAssignList(ti, si, isReserve) {
  const q = (document.getElementById('assign-search')?.value || '').toLowerCase().trim();
  document.querySelectorAll('#assign-list .assign-member-card').forEach(card => {
    const name = card.dataset.name || '';
    card.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

function confirmAssignMember(memberId, ti, si, isReserve) {
  // Mở 1 form nhỏ để admin tinh chỉnh skill/leader/role TRƯỚC khi assign
  const member = Members.getById(memberId);
  if (!member) { showToast('Không tìm thấy thành viên', 'error'); return; }
  const settings = Settings.get();
  const memberSkills = Array.isArray(member.skills) ? member.skills : (member.skill ? [member.skill] : []);

  // Đóng modal hiện tại trước
  document.querySelectorAll('.modal-overlay').forEach(o => o.remove());

  openModal(`
    <h3 style="margin-bottom:6px">🎯 Xác Nhận Xếp Slot</h3>
    <div style="color:var(--text-secondary);font-size:12px;margin-bottom:14px">
      ${escHtml(member.inGameName || member.name)} → ${isReserve ? `Dự bị #${si+1}` : `T${ti+1} Slot #${si+1}`}
    </div>

    <div style="display:flex;flex-direction:column;gap:14px">
      ${buildSlotEditFields({
        combatRole: member.combatRole,
        skills:     memberSkills,
        customSkill:'',
        isLeader:   false
      }, settings)}
    </div>

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove();openAssignModal(${ti},${si},${isReserve})">← Quay lại</button>
      <button class="btn btn-gold" onclick="doAssignMember('${memberId}', ${ti}, ${si}, ${isReserve}, this.closest('.modal-overlay'))">Xếp vào slot</button>
    </div>
  `, null, true);
  ensureAssignStyles();
  bindSlotEditFieldEvents();
}

function doAssignMember(memberId, ti, si, isReserve, ov) {
  const extra = readSlotEditFields();
  Sessions.assignMember(ti, si, memberId, isReserve, extra);
  ov.remove();
  showToast('✅ Đã xếp vào slot');
  renderPage('dashboard');
}

// ── Tab 2: Custom inline form ───────────────────────────────────────────────
function renderAssignCustomForm(ti, si, isReserve, settings) {
  return `
    <div style="background:#1c1610;border:1px solid #d97706;border-radius:6px;padding:10px;margin-bottom:14px;font-size:12px;color:#fbbf24">
      ⚠ Thành viên tạm sẽ <strong>chỉ tồn tại trong slot này</strong>, không xuất hiện ở trang Thành Viên và sẽ mất khi xóa slot.
    </div>

    <div style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px">Tên hiển thị</label>
        <input type="text" id="custom-name" placeholder="Tên ingame hoặc nickname"
          oninput="checkCustomNameDup()"
          style="width:100%;padding:8px 12px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;font-size:13px">
        <div id="custom-name-warn" style="display:none;margin-top:6px;padding:8px 10px;background:rgba(224,80,80,0.12);border:1px solid rgba(224,80,80,0.45);border-radius:6px;font-size:12px;color:#ff7070;line-height:1.4"></div>
      </div>

      <div>
        <label style="display:block;font-size:12px;color:var(--text-secondary);margin-bottom:4px">Hệ phái</label>
        <select id="custom-class" style="width:100%;padding:8px 12px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;font-size:13px">
          <option value="">— Chọn hệ phái —</option>
          ${settings.classes.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>

      ${buildSlotEditFields({ combatRole:'', skills:[], customSkill:'', isLeader:false }, settings)}
    </div>

    <div class="modal-actions">
      <button class="btn btn-gold" id="custom-submit-btn" onclick="doAssignCustom(${ti}, ${si}, ${isReserve}, this.closest('.modal-overlay'))">✓ Tạo & Xếp slot</button>
    </div>
  `;
}

/* So khớp tên: lowercase + trim + collapse khoảng trắng */
function _normName(s) {
  return (s || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Tìm xem tên có trùng với ai trong DB hoặc slot không.
 * Trả về { type: 'db'|'slot', label: string, matchedName: string } hoặc null.
 */
function findCustomNameMatch(rawName) {
  const norm = _normName(rawName);
  if (!norm) return null;

  // Chỉ match theo inGameName (tên ingame).
  // Với member tạm: name === inGameName (lúc tạo) nên cũng được bao phủ.

  // 1. Check DB members
  const allMembers = Members.getAll();
  for (const m of allMembers) {
    if (_normName(m.inGameName) === norm) {
      const display = m.inGameName || m.name;
      return { type:'db', label:`Trùng với thành viên "${display}" trong Danh Sách`, matchedName: display };
    }
  }

  // 2. Check ai đã ở trong slot session hiện tại (kể cả custom/tạm)
  const session = Sessions.getCurrent();
  if (session) {
    for (let ti=0; ti<session.teams.length; ti++) {
      const slots = session.teams[ti].slots || [];
      for (let si=0; si<slots.length; si++) {
        const s = slots[si];
        if (s && _normName(s.inGameName) === norm) {
          const display = s.inGameName || s.name;
          return { type:'slot', label:`Trùng với người ở T${ti+1} Slot #${si+1} ("${display}")`, matchedName: display };
        }
      }
    }
    for (let si=0; si<(session.reserve || []).length; si++) {
      const s = session.reserve[si];
      if (s && _normName(s.inGameName) === norm) {
        const display = s.inGameName || s.name;
        return { type:'slot', label:`Trùng với người ở Dự bị #${si+1} ("${display}")`, matchedName: display };
      }
    }
  }

  return null;
}

/**
 * Realtime kiểm tra tên — gọi qua oninput của input.
 * Hiện/ẩn warn box, enable/disable nút submit.
 */
function checkCustomNameDup() {
  const inp  = document.getElementById('custom-name');
  const warn = document.getElementById('custom-name-warn');
  const btn  = document.getElementById('custom-submit-btn');
  if (!inp || !warn || !btn) return;

  const match = findCustomNameMatch(inp.value);
  if (match) {
    warn.style.display = 'block';
    warn.innerHTML = `<strong>⚠ Tên đã tồn tại</strong><br>${escHtml(match.label)}.<br><span style="color:#ffb060">Hãy đổi tên khác hoặc dùng tab "Chọn từ Thành Viên".</span>`;
    inp.style.borderColor = '#e05050';
    btn.disabled = true;
    btn.style.opacity = '0.45';
    btn.style.cursor = 'not-allowed';
  } else {
    warn.style.display = 'none';
    warn.textContent = '';
    inp.style.borderColor = '';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
  }
}

function doAssignCustom(ti, si, isReserve, ov) {
  const name = document.getElementById('custom-name')?.value.trim();
  if (!name) { showToast('⚠ Cần nhập tên hiển thị', 'error'); return; }

  // Double-check trùng tên (phòng race condition)
  const match = findCustomNameMatch(name);
  if (match) {
    showToast('❌ ' + match.label, 'error', 4500);
    return;
  }

  const cls  = document.getElementById('custom-class')?.value || '';
  const extra = readSlotEditFields();
  Sessions.assignCustom(ti, si, {
    name: name,
    class: cls,
    combatRole: extra.combatRole,
    skills: extra.skills,
    customSkill: extra.customSkill,
    isLeader: extra.isLeader
  }, isReserve);
  ov.remove();
  showToast('✅ Đã thêm thành viên tạm');
  renderPage('dashboard');
}

// ════════════════════════════════════════════════════════════════════════════
// EDIT SLOT INFO - sửa skill / role / leader của slot có sẵn
// ════════════════════════════════════════════════════════════════════════════
function editSlotInfo(ti, si, isReserve) {
  if (!isAdmin()) return;
  const session = Sessions.getCurrent();
  if (!session) return;
  const slot = isReserve ? session.reserve[si] : session.teams[ti].slots[si];
  if (!slot) return;

  const settings = Settings.get();
  const slotSkills = Array.isArray(slot.skills) ? slot.skills : (slot.skill ? [slot.skill] : []);

  openModal(`
    <h3 style="margin-bottom:6px">✏ Sửa Thông Tin Slot</h3>
    <div style="color:var(--text-secondary);font-size:12px;margin-bottom:14px">${escHtml(slot.inGameName || slot.name)}</div>

    <div style="display:flex;flex-direction:column;gap:14px">
      ${buildSlotEditFields({
        combatRole: slot.combatRole || '',
        skills:     slotSkills,
        customSkill:slot.customSkill || '',
        isLeader:   !!slot.isLeader
      }, settings)}
    </div>

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="doSaveSlotEdit(${ti}, ${si}, ${isReserve}, this.closest('.modal-overlay'))">Lưu</button>
    </div>
  `, null, true);
  ensureAssignStyles();
  bindSlotEditFieldEvents();
}

function doSaveSlotEdit(ti, si, isReserve, ov) {
  const patch = readSlotEditFields();
  // skills[0] cũng update field skill cũ (backward compat)
  patch.skill = patch.skills[0] || '';
  Sessions.updateSlot(ti, si, isReserve, patch);
  ov.remove();
  showToast('✅ Đã cập nhật');
  renderPage('dashboard');
}

// ════════════════════════════════════════════════════════════════════════════
// SHARED: edit fields UI for slot (combat role + multi-skill + custom skill + leader)
// ════════════════════════════════════════════════════════════════════════════
function buildSlotEditFields(values, settings) {
  // Skills giờ là free-text - mỗi dòng 1 skill
  const skillsText = Array.isArray(values.skills) ? values.skills.join('\n') : '';

  const roleChips = COMBAT_ROLES.map(r => {
    const active = values.combatRole === r.id;
    return `<span class="assign-role-chip" data-role="${r.id}" data-color="${r.color}"
              style="${active ? `border-color:${r.color};color:${r.color};background:${r.color}18` : ''}">${r.icon} ${r.name}</span>`;
  }).join('');

  return `
    <div>
      <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:6px;font-weight:600">⚔ Vai trò chiến đấu</label>
      <div id="slot-role-chips" style="display:flex;gap:8px;flex-wrap:wrap">${roleChips}</div>
    </div>

    <div>
      <label style="display:block;font-size:13px;color:var(--text-secondary);margin-bottom:4px;font-weight:600">✨ Kỹ năng</label>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">Mỗi dòng là 1 kỹ năng. VD:<br>TCD<br>Tường băng<br>Lead</div>
      <textarea id="slot-skills-text" rows="4"
        placeholder="Nhập mỗi kỹ năng 1 dòng..."
        style="width:100%;padding:8px 12px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-primary);border-radius:6px;font-size:13px;font-family:inherit;resize:vertical">${escHtml(skillsText)}</textarea>
    </div>

    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px 14px;background:${values.isLeader?'rgba(240,192,64,0.15)':'#0c0c1a'};border:2px solid ${values.isLeader?'rgba(240,192,64,0.6)':'var(--border-color)'};border-radius:8px;transition:all 0.15s" id="slot-leader-wrap">
      <input type="checkbox" id="slot-leader" ${values.isLeader?'checked':''} style="width:20px;height:20px;cursor:pointer;accent-color:#f0c040">
      <span style="font-size:14px;font-weight:700">⭐ Đặt làm <span style="color:#f0c040">LEADER</span> của team</span>
    </label>
  `;
}

function bindSlotEditFieldEvents() {
  // Role chips - single select
  document.querySelectorAll('#slot-role-chips .assign-role-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const wasActive = chip.dataset.active === '1';
      // Reset all
      document.querySelectorAll('#slot-role-chips .assign-role-chip').forEach(c => {
        c.dataset.active = '';
        c.style.borderColor = '';
        c.style.color = '';
        c.style.background = '#0c0c1a';
      });
      if (!wasActive) {
        chip.dataset.active = '1';
        const color = chip.dataset.color;
        chip.style.borderColor = color;
        chip.style.color = color;
        chip.style.background = color + '18';
      }
    });
    // Initial state
    const isInitialActive = chip.style.borderColor && chip.style.borderColor !== 'transparent';
    if (isInitialActive) chip.dataset.active = '1';
  });

  // Skill chips không còn nữa - dùng textarea thay thế

  // Leader checkbox visual update
  const leaderCb = document.getElementById('slot-leader');
  if (leaderCb) leaderCb.addEventListener('change', () => {
    const wrap = document.getElementById('slot-leader-wrap');
    if (!wrap) return;
    if (leaderCb.checked) {
      wrap.style.background = 'rgba(240,192,64,0.15)';
      wrap.style.borderColor = 'rgba(240,192,64,0.6)';
    } else {
      wrap.style.background = '#0c0c1a';
      wrap.style.borderColor = 'var(--border-color)';
    }
  });
}

function readSlotEditFields() {
  const activeRole = document.querySelector('#slot-role-chips .assign-role-chip[data-active="1"]');
  // Parse skills từ textarea: mỗi dòng = 1 skill, bỏ dòng trống
  const skillsRaw = document.getElementById('slot-skills-text')?.value || '';
  const skills = skillsRaw.split('\n').map(s => s.trim()).filter(Boolean);
  return {
    combatRole: activeRole ? activeRole.dataset.role : '',
    skills:     skills,
    customSkill:'',  // không còn dùng - đã merge vào skills
    isLeader:   !!document.getElementById('slot-leader')?.checked
  };
}

// ════════════════════════════════════════════════════════════════════════════
// REMOVE SLOT
// ════════════════════════════════════════════════════════════════════════════
function removeSlotConfirm(ti, si, isReserve) {
  if (!isAdmin()) return;
  if (!confirmDelete('Xóa người này khỏi slot?')) return;
  Sessions.removeSlot(ti, si, isReserve);
  showToast('Đã xóa khỏi slot', 'error');
  renderPage('dashboard');
}

// ════════════════════════════════════════════════════════════════════════════
// SESSION HELPERS
// ════════════════════════════════════════════════════════════════════════════
function createNewSession() {
  if (!isAdmin()) return;
  if (!confirm('Tạo đợt mới sẽ đóng đợt hiện tại (đợt cũ vẫn xem được ở Lịch Sử). Tiếp tục?')) return;
  Sessions.createNew();
  showToast('✅ Đã tạo đợt mới');
  renderPage('dashboard');
}

function saveTacticsNotes() {
  if (!isAdmin()) return;
  const ta = document.getElementById('tactics-notes');
  if (!ta) return;
  const session = Sessions.getCurrent();
  if (!session) return;
  const tactics = session.tactics || {};
  tactics.notes = ta.value;
  Sessions.updateCurrent({ tactics: tactics });
}
