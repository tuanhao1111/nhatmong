/**
 * app.js - Router & SPA init
 */

const PAGES = {
  dashboard: { label:'Chiến Lượt',  icon:'⚔',  render: renderDashboardPage },
  members:   { label:'Thành Viên',  icon:'👥', render: renderMembersPage   },
  sessions:  { label:'Lịch Sử',     icon:'📜', render: renderSessionsPage  },
  movies:    { label:'Xem Phim',    icon:'🎬', render: renderMoviesPage    },
  gacha:     { label:'Gacha',       icon:'🎰', render: renderGachaPage     },
  minigames: { label:'Mini Game',   icon:'🎲', render: renderMinigamesPage },
  khopov:    { label:'Kho POV',     icon:'🎥', render: renderKhoPovPage,    adminOnly:true },
  settings:  { label:'Cấu Hình',    icon:'⚙',  render: renderSettingsPage,  adminOnly:true },
  accounts:  { label:'Tài Khoản',   icon:'🔑', render: renderAccountsPage,  adminOnly:true }
};

let currentPage = 'dashboard';

function renderPage(page) {
  if (!PAGES[page]) page = 'dashboard';
  currentPage = page;
  window.location.hash = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page===page));
  // Bottom-nav active state
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    const k = el.dataset.page;
    const active = (k === page) || (k === '__more' && ['settings','accounts','sessions','movies','khopov'].includes(page));
    el.classList.toggle('active', active);
  });
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
      <a class="nav-item ${key===currentPage?'active':''}" data-page="${key}" href="#" onclick="renderPage('${key}');closeSidebar();return false;">
        <span class="nav-icon">${p.icon}</span><span>${p.label}</span>
      </a>`).join('');
  return `
    <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="closeSidebar()"></div>
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
    </div>`;
}

/**
 * BOTTOM NAVIGATION cho mobile (≤768px) — 5 mục chính + More.
 * Hiển thị qua CSS (display:none ở desktop, display:block ở mobile).
 */
function buildBottomNav() {
  const admin = isAdmin();
  // 5 mục chính dành cho member/admin. "More" mở drawer chứa Settings + Accounts (admin) + Movies + Sessions.
  const TABS = [
    { key:'dashboard', label:'Chiến Lượt', icon:'⚔' },
    { key:'members',   label:'Thành Viên', icon:'👥' },
    { key:'gacha',     label:'Gacha',      icon:'🎰' },
    { key:'minigames', label:'Mini Game',  icon:'🎲' },
    { key:'__more',    label:'More',       icon:'☰' }
  ];
  const items = TABS.map(t => {
    const isActive = (t.key === currentPage) ||
                     (t.key === '__more' && ['settings','accounts','sessions','movies','khopov'].includes(currentPage));
    const onClick = t.key === '__more'
      ? `openSidebar()`
      : `renderPage('${t.key}')`;
    return `
      <a class="bottom-nav-item ${isActive?'active':''}" href="#" onclick="${onClick};return false;" data-page="${t.key}">
        <span class="bottom-nav-icon">${t.icon}</span>
        <span class="bottom-nav-label">${t.label}</span>
      </a>`;
  }).join('');
  return `<nav class="bottom-nav" id="bottom-nav"><div class="bottom-nav-list">${items}</div></nav>`;
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('is-open');
  document.getElementById('sidebar-backdrop')?.classList.toggle('is-open');
}
function openSidebar() {
  document.getElementById('sidebar')?.classList.add('is-open');
  document.getElementById('sidebar-backdrop')?.classList.add('is-open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('is-open');
  document.getElementById('sidebar-backdrop')?.classList.remove('is-open');
}

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
          <button class="sidebar-toggle" onclick="toggleSidebar()" aria-label="Mở menu">☰</button>
          <div class="topbar-breadcrumb">
            <span>🏰</span><span>›</span>
            <span class="current" id="topbar-current">${PAGES[startPage].label}</span>
          </div>
          <div class="topbar-actions">
            <div id="topbar-user-tag"></div>
            ${isAdmin()?`<button class="btn btn-outline btn-sm" onclick="exportData()">📤 Xuất</button>`:''}
          </div>
        </div>
        <div class="page-content"><div id="page-area"></div></div>
        ${buildBottomNav()}
      </div>
    </div>`;

  const user = getCurrentUser();
  if (user) {
    const initials  = user.name ? user.name[0].toUpperCase() : '?';
    const RLABELS   = { admin:'👑 Admin', member:'👤 Member', guest:'🚪 Khách' };
    const roleLabel = RLABELS[user.role]||'👤';
    const roleColor = user.role==='admin'?'var(--accent-gold-text)':user.role==='member'?'var(--accent-bronze-text)':'var(--text-muted)';
    const avaGrad = user.role==='admin'
      ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover))'
      : 'linear-gradient(135deg, var(--accent-bronze), var(--bronze-7))';
    document.getElementById('sidebar-footer').innerHTML = `
      <div class="user-avatar" style="background:${avaGrad}">${initials}</div>
      <div class="user-info">
        <div class="user-name">${escHtml(user.name)}</div>
        <div class="user-role" style="color:${roleColor}">${roleLabel}</div>
      </div>
      <button onclick="logout()" title="Đăng xuất" class="btn-ghost"
        style="padding:var(--sp-2);margin-left:auto;font-size:18px;border-radius:var(--r-md)">⏻</button>`;
    // Topbar role tag: chỉ hiển thị cho admin.
    const tag = document.getElementById('topbar-user-tag');
    if (tag) {
      if (user.role === 'admin') {
        tag.innerHTML = `<span style="font-size:var(--fs-xs);color:${roleColor}">${roleLabel}: <strong>${escHtml(user.name)}</strong></span>`;
      } else {
        tag.innerHTML = '';
      }
    }
  }
  renderPage(startPage);
}

function initDashboardStyles() {
  if (document.getElementById('dashboard-styles')) return;
  const style = document.createElement('style');
  style.id = 'dashboard-styles';
  style.textContent = `
    /* ────── TEAMS GRID — masonry-like với CSS columns ────── */
    .teams-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px;align-items:start; }
    @media (max-width:780px) { .teams-grid { grid-template-columns:1fr; } }

    .team-card  {
      background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;overflow:hidden;
      transition:opacity 0.18s, transform 0.18s, box-shadow 0.18s;
    }

    /* ────── TEAM SIZES (preset 3 mức) ────── */
    /* Small: chiếm 1 cột bình thường, slots compact hơn */
    .team-card.team-size-small  { /* default behavior - 1 col */ }
    .team-card.team-size-small .slot-row { min-height:42px; }
    .team-card.team-size-small .slot-num-cell { font-size:13px; }
    .team-card.team-size-small .slot-name-main { font-size:13px; }
    .team-card.team-size-small .slot-skill-chip { font-size:11px;padding:2px 7px; }
    .team-card.team-size-small .team-no { font-size:22px; }
    .team-card.team-size-small .team-role-name, .team-card.team-size-small .trd-trigger-name { font-size:14px; }

    .team-card.team-size-medium { /* default (already styled below) */ }

    /* Large: chiếm 2 cột grid */
    .team-card.team-size-large  { grid-column: span 2; }
    .team-card.team-size-large .slot-row { min-height:62px; }
    .team-card.team-size-large .slot-num-cell { font-size:18px; }
    .team-card.team-size-large .slot-name-main { font-size:16px; }
    .team-card.team-size-large .slot-skill-chip { font-size:13px;padding:4px 11px; }
    .team-card.team-size-large .team-no { font-size:34px; }
    .team-card.team-size-large .team-role-name, .team-card.team-size-large .trd-trigger-name { font-size:20px; }
    @media (max-width:900px) { .team-card.team-size-large { grid-column: auto; } }

    /* ────── DRAG & DROP STATES ────── */
    .team-card[draggable="true"] { cursor:grab; }
    .team-card.dragging-team { opacity:0.4;transform:scale(0.97); }
    .team-card.drag-over-team {
      box-shadow:0 0 0 3px var(--accent-gold),0 8px 24px var(--amber-a4);
      transform:scale(1.015);
    }
    .slot-row.filled[draggable="true"] { cursor:grab; }
    .slot-row.filled.dragging-member { opacity:0.4; }
    .slot-row.drag-over-slot {
      box-shadow:inset 0 0 0 2px var(--accent-gold);
      background:var(--amber-a3) !important;
    }

    /* Drag handle */
    .team-drag-handle {
      font-size:16px;color:rgba(255,255,255,0.35);cursor:grab;
      letter-spacing:-2px;font-weight:900;line-height:1;
      padding:0 4px;user-select:none;
    }
    .team-drag-handle:hover { color:var(--accent-gold); }
    .team-drag-handle:active { cursor:grabbing; }

    /* Resize control 3 nút */
    .team-size-ctrl {
      display:flex;gap:2px;background:rgba(0,0,0,0.3);
      border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:2px;
    }
    .tsz-btn {
      background:transparent;border:none;color:var(--text-muted);
      font-size:11px;padding:3px 6px;cursor:pointer;border-radius:4px;
      line-height:1;transition:all 0.15s;
    }
    .tsz-btn:hover { color:var(--text-primary);background:rgba(255,255,255,0.05); }
    .tsz-btn.on { color:var(--accent-gold);background:var(--amber-a4); }

    /* ────── TEAM HEADER TO + RÕ ────── */
    .team-header-big {
      display:flex;align-items:center;gap:14px;
      padding:14px 18px;
      border-bottom:2px solid;
      background:linear-gradient(180deg, var(--sand-2), var(--sand-1));
    }
    .team-label-big { display:flex;align-items:center; }
    .team-no {
      font-family:var(--font-display);font-weight:900;font-size:28px;
      letter-spacing:1px;line-height:1;
    }

    /* Display only (member) */
    .team-role-display { display:flex;align-items:center;gap:8px;flex:1; }
    .team-role-icon { font-size:24px;line-height:1; }
    .team-role-name {
      font-family:var(--font-display);font-weight:900;font-size:18px;
      letter-spacing:3px;line-height:1;
    }

    /* ─── Team role dropdown (TRD) - admin chọn vai trò team ─── */
    .trd-wrap {
      position:relative;flex:1;display:flex;align-items:center;
    }
    .trd-trigger {
      display:flex;align-items:center;gap:8px;
      width:100%;padding:6px 10px;
      background:rgba(0,0,0,0.25);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:8px;
      cursor:pointer;color:inherit;font-family:inherit;
      transition:all 0.18s ease;
      text-align:left;
    }
    .trd-trigger:hover {
      background:rgba(0,0,0,0.4);
      border-color:rgba(255,255,255,0.18);
    }
    .trd-trigger-icon { font-size:22px;line-height:1; }
    .trd-trigger-name {
      font-family:var(--font-display);font-weight:900;font-size:17px;
      letter-spacing:2.5px;line-height:1;flex:1;
    }
    .trd-caret {
      font-size:14px;color:var(--text-muted);
      transition:transform 0.25s cubic-bezier(.4,0,.2,1);
      margin-left:auto;
    }
    .trd-wrap.open .trd-caret { transform:rotate(180deg);color:var(--accent-gold); }
    .trd-wrap.open .trd-trigger { border-color:var(--amber-a6); }

    /* Menu - smooth slide animation */
    .trd-menu {
      position:absolute;top:calc(100% + 4px);left:0;right:0;
      background:var(--bg-card);
      border:1px solid var(--border-color);
      border-radius:10px;
      box-shadow:0 8px 28px rgba(0,0,0,0.6);
      z-index:50;overflow:hidden;
      max-height:0;opacity:0;
      transform:translateY(-6px);
      transition:max-height 0.28s cubic-bezier(.4,0,.2,1),
                 opacity 0.18s ease,
                 transform 0.28s cubic-bezier(.4,0,.2,1);
      pointer-events:none;
    }
    .trd-wrap.open .trd-menu {
      max-height:280px;opacity:1;transform:translateY(0);
      pointer-events:auto;
    }
    .trd-item {
      display:flex;align-items:center;gap:10px;
      padding:10px 14px;cursor:pointer;
      border-bottom:1px solid var(--sand-3);
      transition:background 0.12s;
    }
    .trd-item:last-child { border-bottom:none; }
    .trd-item:hover { background:var(--sand-a4); }
    .trd-item.selected { background:var(--amber-a3); }
    .trd-icon { font-size:20px;width:22px;display:inline-block;text-align:center;line-height:1; }
    .trd-name {
      font-family:var(--font-display);font-weight:800;font-size:14px;
      letter-spacing:2px;flex:1;
    }
    .trd-check { color:var(--accent-gold);font-weight:900;font-size:14px; }

    .team-count-big {
      font-family:var(--font-display);font-weight:700;font-size:14px;
      color:var(--text-secondary);padding:4px 12px;
      background:rgba(0,0,0,0.4);border-radius:14px;
      border:1px solid rgba(255,255,255,0.08);
      white-space:nowrap;
    }

    /* ────── SLOTS — Excel-style 3-cột rõ ràng ────── */
    .slots-list { padding:0; }
    .slot-row { display:grid;grid-template-columns:42px 1.4fr 1.2fr;align-items:stretch;border-bottom:1px solid var(--sand-3);transition:background 0.12s;min-height:54px; }
    .slot-row:last-child { border-bottom:none; }
    .slot-row.filled { cursor:pointer; }
    .slot-row.filled:hover { background:var(--amber-a3); }

    /* Cột STT */
    .slot-num-cell { display:flex;align-items:center;justify-content:center;background:var(--sand-1);color:var(--text-secondary);font-weight:700;font-size:15px;font-family:var(--font-display);border-right:1px solid var(--sand-3); }
    .slot-num-cell.muted { color:var(--text-muted); }

    /* Cột tên (background màu class) */
    .slot-name-cell { display:flex;flex-direction:column;justify-content:center;padding:8px 12px;border-right:1px solid var(--sand-3);min-width:0; }
    .slot-name-cell.empty-cell { background:var(--sand-1);color:var(--text-muted);font-size:13px;font-style:italic;justify-content:center; }
    .slot-name-main { font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2; }
    .slot-name-cls  { font-size:11px;opacity:0.78;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }

    /* Cột info (skill trên + role dưới) */
    .slot-info-cell { display:flex;flex-direction:column;justify-content:center;padding:6px 12px;background:var(--sand-1);min-width:0;gap:4px; }
    .slot-info-cell.empty-cell { background:var(--sand-1); }
    .slot-info-skills { display:flex;flex-wrap:wrap;gap:4px;align-items:center;line-height:1.2; }
    .slot-skill-chip {
      font-size:12px;font-weight:600;padding:3px 9px;border-radius:10px;
      background:var(--amber-a4);color:var(--accent-gold);
      border:1px solid var(--amber-a6);white-space:nowrap;
    }
    .slot-info-role  { font-size:12px;font-weight:700;line-height:1.3;display:flex;align-items:center;gap:6px;flex-wrap:wrap; }
    .slot-leader-badge {
      font-size:10px;font-weight:900;padding:2px 7px;border-radius:8px;
      background:linear-gradient(135deg, var(--amber-9), var(--amber-10));color:var(--sand-1);
      border:1px solid var(--amber-9);letter-spacing:0.5px;
      text-shadow:0 1px 0 rgba(255,255,255,0.3);
    }

    .slot-row.empty:hover .slot-name-cell.empty-cell { color:var(--accent-gold); }

    /* ────── RESERVE (giữ layout cũ — gọn hơn) ────── */
    .reserve-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px; }
    .reserve-slot { padding:8px 10px;border-radius:6px;font-size:11px;transition:all 0.15s; }
    .reserve-slot.empty { background:var(--sand-1);border:1px dashed var(--sand-6);display:flex;justify-content:space-between;align-items:center;color:var(--text-muted); }
    .reserve-slot.empty:hover { border-color:var(--accent-cyan);color:var(--accent-cyan); }
    .reserve-slot.filled { background:var(--sand-3);border:1px solid var(--sand-5);cursor:pointer; }
    .reserve-slot.filled:hover { background:var(--sand-4); }

    .member-pick-item { padding:10px 12px;background:var(--sand-2);border:1px solid var(--border-color);border-radius:8px;cursor:pointer;transition:all 0.15s; }
    .member-pick-item:hover { border-color:var(--accent-gold);background:var(--sand-3); }
    .cfg-section { background:var(--bg-card);border:1px solid var(--border-color);border-radius:10px;padding:20px;margin-bottom:20px; }
    .cfg-row { display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--sand-3);flex-wrap:wrap; }
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
