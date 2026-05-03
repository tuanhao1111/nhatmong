/**
 * app.js - Router & SPA init
 */

const PAGES = {
  dashboard: { label:'Chiến Lượt',  icon:'⚔',  render: renderDashboardPage },
  members:   { label:'Thành Viên',  icon:'👥', render: renderMembersPage   },
  sessions:  { label:'Lịch Sử',     icon:'📜', render: renderSessionsPage  },
  movies:    { label:'Xem Phim',    icon:'🎬', render: renderMoviesPage    },
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
    if (page==='movies') { initMoviesPage(); }
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
  // Member mới được ghi trực tiếp vào /guilds/guild_main/members khi đăng ký,
  // không cần xử lý pending nữa. Dọn dẹp legacy key nếu có.
  try { localStorage.removeItem('nth_pending_members'); } catch(e) {}
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
    /* ────── TEAMS GRID — 2-3 cột tùy màn hình ────── */
    .teams-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:14px; }
    @media (max-width:780px) { .teams-grid { grid-template-columns:1fr; } }

    .team-card  { background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;overflow:hidden; }
    .team-header{ padding:10px 12px;background:linear-gradient(180deg,#0f0f1e,#0a0a18);border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
    .team-label { font-size:14px;font-weight:700; }
    .team-count { font-size:11px;color:var(--text-muted);margin-left:auto;padding:2px 8px;background:#0a0a18;border-radius:10px;border:1px solid var(--border-color); }
    .team-group-select { font-size:11px;background:#0c0c1a;border:1px solid var(--border-color);color:var(--text-secondary);padding:3px 6px;cursor:pointer;border-radius:4px;max-width:120px; }

    /* ────── SLOTS — Excel-style 3-cột rõ ràng ────── */
    .slots-list { padding:0; }
    .slot-row { display:grid;grid-template-columns:36px 1.4fr 1fr;align-items:stretch;border-bottom:1px solid #1a1a2e;transition:background 0.12s;min-height:46px; }
    .slot-row:last-child { border-bottom:none; }
    .slot-row.filled { cursor:pointer; }
    .slot-row.filled:hover { background:rgba(240,192,64,0.05); }

    /* Cột STT */
    .slot-num-cell { display:flex;align-items:center;justify-content:center;background:#08080f;color:var(--text-secondary);font-weight:700;font-size:13px;font-family:'Cinzel',serif;border-right:1px solid #1a1a2e; }
    .slot-num-cell.muted { color:var(--text-muted); }

    /* Cột tên (background màu class) */
    .slot-name-cell { display:flex;flex-direction:column;justify-content:center;padding:6px 10px;border-right:1px solid #1a1a2e;min-width:0; }
    .slot-name-cell.empty-cell { background:#0a0a14;color:var(--text-muted);font-size:12px;font-style:italic;justify-content:center; }
    .slot-name-main { font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2; }
    .slot-name-cls  { font-size:10px;opacity:0.75;font-weight:600;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }

    /* Cột info (skill trên + role dưới) */
    .slot-info-cell { display:flex;flex-direction:column;justify-content:center;padding:5px 10px;background:#0a0a14;min-width:0; }
    .slot-info-cell.empty-cell { background:#08080f; }
    .slot-info-skills { display:flex;flex-wrap:wrap;gap:3px;align-items:center;line-height:1.2;min-height:14px; }
    .slot-skill-chip { font-size:10px;font-weight:600;padding:1px 6px;border-radius:8px;background:rgba(240,192,64,0.12);color:var(--accent-gold);border:1px solid rgba(240,192,64,0.3);white-space:nowrap; }
    .slot-info-role  { font-size:10px;font-weight:700;line-height:1.3;margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap; }
    .slot-leader-badge { font-size:9px;font-weight:900;padding:1px 6px;border-radius:8px;background:linear-gradient(135deg,#f0c040,#e8a020);color:#0a0a0f;border:1px solid #f0c040;letter-spacing:0.5px;text-shadow:0 1px 0 rgba(255,255,255,0.3); }

    .slot-row.empty:hover .slot-name-cell.empty-cell { color:var(--accent-gold); }

    /* ────── RESERVE (giữ layout cũ — gọn hơn) ────── */
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
