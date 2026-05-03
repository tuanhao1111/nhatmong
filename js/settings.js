/**
 * settings.js - Cấu hình (chỉ Admin)
 * Layout theo hình mẫu: Đội hình / Class / Skill / Task / Nhóm / Bản đồ chiến thuật
 */

function renderSettingsPage() {
  if (!isAdmin()) return `<div style="text-align:center;padding:80px;color:var(--text-muted)">🔒 Chỉ Admin mới có thể truy cập trang cấu hình.</div>`;

  const s     = Settings.get();
  const guild = Guild.get();

  /* ── Đội hình ── */
  const formationHtml = `
    <div class="cfg-section">
      <div class="section-header"><span class="section-title">⚔ Đội Hình</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:600px">
        <div class="form-group"><label>SỐ TEAM</label><input type="number" id="cfg-teams" value="${s.numTeams}" min="1" max="20"></div>
        <div class="form-group"><label>SLOT MỖI TEAM</label><input type="number" id="cfg-slots" value="${s.slotsPerTeam}" min="1" max="12"></div>
        <div class="form-group"><label>DỰ BỊ</label><input type="number" id="cfg-reserve" value="${s.reserveSlots}" min="0" max="100"></div>
      </div>
      <button class="btn btn-gold" style="margin-top:8px" onclick="saveFormation()">Lưu đội hình</button>
    </div>`;

  /* ── Classes ── */
  const classRows = s.classes.map(c => `
    <div class="cfg-row">
      <input class="cfg-input-id" type="text" value="${escHtml(c.id)}" readonly>
      <input class="cfg-input-name" type="text" value="${escHtml(c.name)}" onchange="cfgUpdateClass('${c.id}','name',this.value)">
      <input type="color" value="${c.color}" onchange="cfgUpdateClass('${c.id}','color',this.value)"
             style="width:44px;height:36px;padding:2px;cursor:pointer;border-radius:4px;border:1px solid #2a2a45;background:#1a1a2e">
      <div style="width:20px;height:20px;border-radius:50%;background:${c.color}"></div>
      <button class="btn btn-danger cfg-btn-sm" onclick="cfgDeleteClass('${c.id}')">Xóa</button>
    </div>`).join('');

  /* ── Skills, Tasks, Groups ĐÃ BỊ LOẠI BỎ — skill nay nhập tự do ở slot,
        không còn task/nhóm trong app                                    ── */

  /* ── Maps ── */
  const mapRows = s.maps.map(m => {
    const imgSrc = loadImageFromStorage('map_' + m.id);
    const thumb  = imgSrc
      ? `<img src="${imgSrc}" style="height:40px;border-radius:4px;object-fit:cover;max-width:80px;border:1px solid #444">`
      : `<div style="height:40px;width:60px;border-radius:4px;background:#1a1a2e;border:1px dashed #444;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:18px">🗺</div>`;
    const isActive = (s.currentMap === m.id);
    return `
    <div class="cfg-row" style="${isActive?'background:#0a1a0a;border-radius:6px;padding:4px 8px':''}">
      <input class="cfg-input-id" type="text" value="${escHtml(m.id)}" readonly>
      <input class="cfg-input-name" type="text" value="${escHtml(m.name)}" onchange="cfgUpdateMap('${m.id}','name',this.value)" style="flex:1">
      ${thumb}
      <label class="btn btn-outline cfg-btn-sm" style="cursor:pointer">
        Upload ảnh
        <input type="file" accept="image/*" style="display:none" onchange="uploadMapImg('${m.id}',this)">
      </label>
      ${isActive
        ? `<span style="color:var(--accent-green);font-size:12px;font-weight:600;white-space:nowrap">✔ Đang dùng</span>`
        : `<button class="btn btn-outline cfg-btn-sm" onclick="setActiveMap('${m.id}')">Dùng</button>`}
      <button class="btn btn-danger cfg-btn-sm" onclick="cfgDeleteMap('${m.id}')">Xóa</button>
    </div>`;
  }).join('');

  return `
    <!-- Inject settings styles -->
    <style>
      .cfg-section { background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:20px;margin-bottom:20px; }
      .cfg-row { display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1a1a2e;flex-wrap:wrap; }
      .cfg-row:last-child { border-bottom:none; }
      .cfg-input-id   { width:150px;font-size:12px;color:var(--text-secondary);flex-shrink:0; }
      .cfg-input-name { flex:1;min-width:140px; }
      .cfg-btn-sm { padding:5px 12px;font-size:12px;white-space:nowrap;flex-shrink:0; }
    </style>

    <div class="page-header">
      <div class="page-title">Cấu Hình</div>
      <div class="page-subtitle">Quản lý cấu hình: đội hình, class, bản đồ</div>
    </div>

    <!-- Guild -->
    <div class="cfg-section">
      <div class="section-header"><span class="section-title">🏰 Thông Tin Bang</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:600px">
        <div class="form-group"><label>Tên Bang</label><input type="text" id="cfg-guild-name" value="${escHtml(guild.name)}"></div>
        <div class="form-group"><label>Giới thiệu</label><input type="text" id="cfg-guild-desc" value="${escHtml(guild.description)}"></div>
      </div>
      <button class="btn btn-gold" onclick="saveGuildInfo()">Lưu</button>
    </div>

    ${formationHtml}

    <!-- Classes -->
    <div class="cfg-section">
      <div class="section-header">
        <span class="section-title">🎭 Danh Sách Class</span>
        <button class="btn btn-cyan" style="padding:6px 14px;font-size:12px" onclick="cfgOpenAddClass()">+ Thêm class</button>
      </div>
      <div>${classRows || '<div style="color:var(--text-muted);padding:12px">Chưa có class nào</div>'}</div>
    </div>

    <!-- Maps -->
    <div class="cfg-section">
      <div class="section-header">
        <span class="section-title">🗺 Bản Đồ Chiến Thuật</span>
        <button class="btn btn-cyan" style="padding:6px 14px;font-size:12px" onclick="cfgOpenAddMap()">+ Thêm bản đồ</button>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:var(--text-secondary);letter-spacing:1px;text-transform:uppercase">MAP HIỆN TẠI</label>
        <select onchange="setActiveMap(this.value)" style="width:100%;margin-top:6px;max-width:400px">
          ${s.maps.map(m => `<option value="${m.id}" ${s.currentMap===m.id?'selected':''}>${m.name}</option>`).join('')}
        </select>
      </div>
      <div>${mapRows || '<div style="color:var(--text-muted);padding:12px">Chưa có bản đồ nào</div>'}</div>
    </div>

    <!-- Danger zone -->
    <div class="cfg-section" style="border-color:#e0404044">
      <div class="section-title" style="color:var(--accent-red);margin-bottom:12px">⚠ Vùng Nguy Hiểm</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-danger" onclick="clearAllMembers()">Xóa toàn bộ thành viên</button>
        <button class="btn btn-danger" onclick="resetAllData()">Reset toàn bộ dữ liệu</button>
        <button class="btn btn-outline" onclick="exportData()">📤 Xuất JSON</button>
        <label class="btn btn-outline" style="cursor:pointer">📥 Nhập JSON<input type="file" accept=".json" style="display:none" onchange="importData(this)"></label>
      </div>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════ GUILD / FORMATION */
function saveGuildInfo() {
  Guild.update({ name: document.getElementById('cfg-guild-name').value.trim(), description: document.getElementById('cfg-guild-desc').value.trim() });
  const el = document.getElementById('sidebar-guild-name');
  if (el) el.textContent = Guild.get().name;
  showToast('Đã lưu thông tin bang!');
}
function saveFormation() {
  Settings.update({
    numTeams:     +document.getElementById('cfg-teams').value   || 10,
    slotsPerTeam: +document.getElementById('cfg-slots').value   || 6,
    reserveSlots: +document.getElementById('cfg-reserve').value || 30
  });
  showToast('Đã lưu đội hình!');
}

/* ══════════════════════════════════════════════════════════ CLASS */
function cfgUpdateClass(id, field, value) { Settings.updateClass(id, { [field]: value }); }
function cfgDeleteClass(id) {
  if (!confirmDelete('Xóa class này?')) return;
  Settings.deleteClass(id); showToast('Đã xóa!','error'); renderPage('settings');
}
function cfgOpenAddClass() {
  openModal(`
    <h3>+ Thêm Class</h3>
    <div class="form-group"><label>Mã (không dấu)</label><input type="text" id="nc-id" placeholder="vd: kiem_khach"></div>
    <div class="form-group"><label>Tên hiển thị</label><input type="text" id="nc-name" placeholder="vd: Kiếm Khách"></div>
    <div class="form-group"><label>Màu sắc</label><input type="color" id="nc-color" value="#80c7e6" style="width:100%;height:40px"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="cfgSubmitAddClass(this.closest('.modal-overlay'))">Thêm</button>
    </div>`);
}
function cfgSubmitAddClass(ov) {
  const id=document.getElementById('nc-id').value.trim().replace(/\s+/g,'_').toLowerCase();
  const name=document.getElementById('nc-name').value.trim();
  const color=document.getElementById('nc-color').value;
  if(!id||!name){showToast('Điền đầy đủ!','error');return;}
  Settings.addClass({id,name,color}); ov.remove(); showToast('Đã thêm class!'); renderPage('settings');
}


/* ══════════════════════════════════════════════════════════ MAP */
function cfgUpdateMap(id, field, value) { Settings.updateMap(id, { [field]: value }); }
function setActiveMap(id) {
  Settings.update({ currentMap: id });
  showToast('Đã đặt bản đồ hiện tại!');
  renderPage('settings');
}
function cfgDeleteMap(id) {
  if (!confirmDelete('Xóa bản đồ này?')) return;
  Settings.deleteMap(id); showToast('Đã xóa!','error'); renderPage('settings');
}
function uploadMapImg(id, input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    saveImageToStorage('map_' + id, e.target.result);
    showToast('Đã upload ảnh bản đồ!');
    renderPage('settings');
  };
  reader.readAsDataURL(file);
}
function cfgOpenAddMap() {
  openModal(`
    <h3>+ Thêm Bản Đồ</h3>
    <div class="form-group"><label>Mã bản đồ</label><input type="text" id="nm-id" placeholder="vd: map_2"></div>
    <div class="form-group"><label>Tên bản đồ</label><input type="text" id="nm-name" placeholder="vd: Chiến Trường 2"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      <button class="btn btn-gold" onclick="cfgSubmitAddMap(this.closest('.modal-overlay'))">Thêm</button>
    </div>`);
}
function cfgSubmitAddMap(ov) {
  const id=document.getElementById('nm-id').value.trim().replace(/\s+/g,'_').toLowerCase();
  const name=document.getElementById('nm-name').value.trim();
  if(!id||!name){showToast('Điền đầy đủ!','error');return;}
  Settings.addMap({id,name}); ov.remove(); showToast('Đã thêm bản đồ!'); renderPage('settings');
}

/* ══════════════════════════════════════════════════════════ DANGER */
function clearAllMembers() {
  if (!confirmDelete('XÓA TOÀN BỘ thành viên? Không thể hoàn tác!')) return;
  const data=loadData(); data.members=[]; saveData(data); showToast('Đã xóa!','error');
}
function resetAllData() {
  if (!confirm('RESET TOÀN BỘ? Không thể hoàn tác!')) return;
  localStorage.removeItem(DB_KEY); showToast('Đã reset! Tải lại...','error');
  setTimeout(()=>location.reload(),1500);
}
function exportData() {
  const blob=new Blob([JSON.stringify(loadData(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`guild_data_${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url); showToast('Đã xuất!');
}
function importData(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const data=JSON.parse(e.target.result);
      if(!confirm('Ghi đè dữ liệu hiện tại?')) return;
      saveData(data); showToast('Đã nhập!'); setTimeout(()=>location.reload(),1000);
    } catch { showToast('File không hợp lệ!','error'); }
  };
  reader.readAsText(file);
}
