/**
 * app.js - Router & SPA init
 */

const PAGES = {
  dashboard: { label:'Chiến Lượt',  icon:'⚔',  render: renderDashboardPage },
  members:   { label:'Thành Viên',  icon:'👥', render: renderMembersPage   },
  sessions:  { label:'Lịch Sử',     icon:'📜', render: renderSessionsPage  },
  settings:  { label:'Cấu Hình',    icon:'⚙',  render: renderSettingsPage, adminOnly:true },
  accounts:  { label:'Tài Khoản',   icon:'🔑', render: renderAccountsPage, adminOnly:true }
};

let currentPage = 'dashboard';

function renderPage(page) {
  if (!PAGES[page]) page = 'dashboard';
  currentPage = page;
  window.location.hash = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
  const topbar = document.getElementById('topbar-current');
  if (topbar) topbar.textContent = PAGES[page].label;
  const area = document.getElementById('page-area');
  if (!area) return;
  area.innerHTML = '';
  setTimeout(() => {
    area.innerHTML = PAGES[page].render();
    if (page==='dashboard') { initDashboardStyles(); setTimeout(initDashMap, 100); }
  }, 20);
}

function navigate(page) { renderPage(page); }

function buildSidebar() {
  const guild = Guild.get();
  const admin = isAdmin();
  const navItems = Object.entries(PAGES)
    .filter(([,p]) => !p.adminOnly || admin)
    .map(([key,p]) => `
      <a class="nav-item ${key===currentPage?'active':''}" data-page="${key}" href="#" onclick="renderPage('${key}');return false;">
        <span class="nav-icon">${p.icon}</span><span>${p.label}</span>
      </a>`).join('');
  return `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">⚔</div>
        <div class="sidebar-guild-name" id="sidebar-guild-name">${escHtml(guild.name)}</div>
      </div>
      <nav class="sidebar-nav">${navItems}</nav>
      <div class="sidebar-footer" id="sidebar-footer">
        <div class="user-avatar">?</div>
        <div class="user-info"><div class="user-name">...</div><div class="user-role">...</div></div>
      </div>
    </div>
    <button class="sidebar-toggle" onclick="toggleSidebar()">☰</button>`;
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

function initApp() {
  // Xử lý pending members từ đăng ký
  try {
    var pending = JSON.parse(localStorage.getItem('nth_pending_members') || '[]');
    if (pending.length > 0 && typeof Members !== 'undefined') {
      pending.forEach(function(pm) {
        var ex = Members.getAll().find(function(m){ return m.id===pm.id || m.inGameName===pm.inGameName; });
        if (!ex) Members.add(pm);
      });
      localStorage.removeItem('nth_pending_members');
    }
  } catch(e) {}
  requireAuth();
  const hash      = window.location.hash.replace('#','') || 'dashboard';
  const startPage = PAGES[hash] ? hash : 'dashboard';
  document.body.innerHTML = `
    <div class="app-layout">
      ${buildSidebar()}
      <div class="main-content">
        <div class="page-topbar">
          <div class="topbar-breadcrumb">
            <span>🏰</span><span>›</span>
            <span class="current" id="topbar-current">${PAGES[startPage].label}</span>
          </div>
          <div class="topbar-actions" style="display:flex;gap:10px;align-items:center">
            <div id="topbar-user-tag"></div>
            ${isAdmin()?`<button class="btn btn-gold" style="font-size:12px;padding:6px 14px" onclick="fbPushNow()" title="Đẩy dữ liệu lên Firebase">🔥 Push Firebase</button>`:''}
            ${isAdmin()?`<button class="btn btn-outline" style="font-size:12px" onclick="exportData()">📤 Xuất</button>`:''}}
          </div>
        </div>
        <div class="page-content"><div id="page-area"></div></div>
      </div>
    </div>`;

  const user = getCurrentUser();
  if (user) {
    const initials  = user.name ? user.name[0].toUpperCase() : '?';
    const RLABELS   = { admin:'👑 Admin', member:'👤 Member', guest:'🚪 Khách' };
    const roleLabel = RLABELS[user.role]||'👤';
    const roleColor = user.role==='admin'?'var(--accent-gold)':user.role==='member'?'var(--accent-cyan)':'var(--text-muted)';
    document.getElementById('sidebar-footer').innerHTML = `
      <div class="user-avatar" style="background:linear-gradient(135deg,${user.role==='admin'?'var(--accent-gold),#a07820':'#3060a0,#6090d0'})">${initials}</div>
      <div class="user-info">
        <div class="user-name">${escHtml(user.name)}</div>
        <div class="user-role" style="color:${roleColor}">${roleLabel}</div>
      </div>
      <button onclick="logout()" title="Đăng xuất"
        style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:4px;margin-left:auto"
        onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-muted)'">⏻</button>`;
    const tag = document.getElementById('topbar-user-tag');
    if (tag) tag.innerHTML = `<span style="font-size:12px;color:${roleColor}">${roleLabel}: <strong>${escHtml(user.name)}</strong></span>`;
  }
  renderPage(startPage);
}

function initDashboardStyles() {
  if (document.getElementById('dashboard-styles')) return;
  const style = document.createElement('style');
  style.id = 'dashboard-styles';
  style.textContent = `
    .teams-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px; }
    .team-card  { background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;overflow:hidden; }
    .team-header{ padding:8px 10px;background:#0c0c1c;border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:6px; }
    .team-label { font-size:14px;font-weight:700; }
    .team-count { font-size:11px; }
    .team-group-select { font-size:10px;background:transparent;border:none;color:var(--text-secondary);padding:2px 4px;cursor:pointer;flex:1; }
    .slots-list { padding:6px;display:flex;flex-direction:column;gap:4px; }
    .slot { border-radius:6px;font-size:11px;transition:all 0.15s;border-left:4px solid transparent;overflow:hidden; }
    .slot.empty { padding:7px 10px;background:#0c0c1c;color:var(--text-muted);border:1px dashed #2a2a40;display:flex;justify-content:space-between;align-items:center; }
    .slot.empty:hover { border-color:var(--accent-gold);color:var(--accent-gold); }
    .slot.filled { padding:6px 10px;background:#111124;cursor:pointer; }
    .slot.filled:hover { background:#1a1a35; }
    .slot-top  { display:flex;justify-content:space-between;align-items:center;margin-bottom:2px; }
    .slot-role-icon { font-size:13px;line-height:1; }
    .slot-num  { font-size:9px;color:var(--text-muted); }
    .slot-name { font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
    .slot-meta { display:flex;gap:6px;margin-top:2px;align-items:center; }
    .slot-skill-img { width:16px;height:16px;border-radius:3px;object-fit:cover; }
    .slot-plus { font-size:14px; }
    .reserve-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px; }
    .reserve-slot { padding:8px 10px;border-radius:6px;font-size:11px;transition:all 0.15s; }
    .reserve-slot.empty { background:#0c0c1c;border:1px dashed #2a2a40;display:flex;justify-content:space-between;align-items:center;color:var(--text-muted); }
    .reserve-slot.empty:hover { border-color:var(--accent-cyan);color:var(--accent-cyan); }
    .reserve-slot.filled { background:#111124;border:1px solid #1e1e38;cursor:pointer; }
    .reserve-slot.filled:hover { background:#1a1a35; }
    .member-pick-item { padding:10px 12px;background:#0f0f1e;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;transition:all 0.15s; }
    .member-pick-item:hover { border-color:var(--accent-gold);background:#1a1a2e; }
    .cfg-section { background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:20px;margin-bottom:20px; }
    .cfg-row { display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1a1a2e;flex-wrap:wrap; }
    .cfg-row:last-child { border-bottom:none; }
    .cfg-input-id   { width:150px;font-size:12px;color:var(--text-secondary);flex-shrink:0; }
    .cfg-input-name { flex:1;min-width:140px; }
    .cfg-btn-sm { padding:5px 12px;font-size:12px;white-space:nowrap;flex-shrink:0; }
    .pick-role-filter.active { border-color:var(--accent-gold)!important;color:var(--accent-gold)!important; }
    .setting-row { display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color); }
    .setting-row:last-child { border-bottom:none; }
  `;
  document.head.appendChild(style);
}

window.addEventListener('DOMContentLoaded', initApp);
