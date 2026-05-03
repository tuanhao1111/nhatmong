/**
 * auth.js - Hệ thống phân quyền
 *
 * THAY ĐỔI:
 *   - AuthUsers KHÔNG còn ghi localStorage làm source of truth.
 *     Đọc từ cache 'nth_users' (do firebase.js _listenUsers cập nhật).
 *     Ghi (setRole, delete) qua UsersFB → Firestore.
 *   - logout() gọi cả fbLogout() để signOut Firebase Auth.
 */

const SESSION_KEY = 'nth_session';
const USERS_KEY   = 'nth_users';

// ── Lấy user đang đăng nhập ──────────────────────────────────────────────────
function getCurrentUser() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// ── Kiểm tra quyền ───────────────────────────────────────────────────────────
function isAdmin() {
  const u = getCurrentUser();
  return u && u.role === 'admin';
}
function isMember() {
  const u = getCurrentUser();
  return u && (u.role === 'member' || u.role === 'admin');
}
function isGuest() {
  const u = getCurrentUser();
  return !u || u.role === 'guest';
}

function canEdit() { return isAdmin(); }

// Member có thể tự sửa info bản thân không?
function canEditOwnMember(memberId) {
  const u = getCurrentUser();
  if (!u) return false;
  if (u.role === 'admin') return true;
  return u.role === 'member' && u.id === memberId;
}

// ── Guard: nếu chưa đăng nhập thì redirect ───────────────────────────────────
function requireAuth() {
  if (!getCurrentUser()) {
    document.body.style.margin = '0';
    document.body.innerHTML =
      '<div style="position:fixed;inset:0;background:#0a0a0f;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;font-family:sans-serif">' +
        '<div style="font-size:52px;margin-bottom:16px">⚔️</div>' +
        '<div style="font-size:24px;color:#f0c040;letter-spacing:2px;margin-bottom:8px;font-family:Cinzel,serif">NGHỊCH THỦY HÀN</div>' +
        '<div style="color:#808090;margin-bottom:28px">Vui lòng đăng nhập để tiếp tục</div>' +
        '<button onclick="window.location.href=\'login.html\'" ' +
          'style="padding:12px 32px;background:#f0c040;color:#111;border:none;border-radius:8px;' +
          'font-size:15px;font-weight:700;cursor:pointer">Đăng Nhập</button>' +
      '</div>';
  }
}

// ── Đăng xuất ────────────────────────────────────────────────────────────────
function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  // SignOut Firebase Auth nếu đang đăng nhập
  if (typeof fbLogout === 'function') {
    fbLogout().catch(function(){}).finally(function(){
      window.location.href = 'login.html';
    });
  } else {
    window.location.href = 'login.html';
  }
}

// ── Quản lý users (admin) - bây giờ chỉ READ từ cache, WRITE qua UsersFB ────
const AuthUsers = {
  /** Đọc từ cache nth_users (đã được sync bởi firebase.js _listenUsers) */
  getAll() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch { return []; }
  }
};

// ── Trang quản lý tài khoản (chỉ admin) ──────────────────────────────────────
function renderAccountsPage() {
  if (!isAdmin()) {
    return `<div style="text-align:center;padding:60px;color:var(--text-muted)">
      🔒 Bạn không có quyền truy cập trang này.
    </div>`;
  }

  const users = AuthUsers.getAll();
  const roleOpts = (cur) => ['admin','member','guest'].map(r =>
    `<option value="${r}" ${cur===r?'selected':''}>${ROLE_LABELS[r]}</option>`
  ).join('');

  const rows = users.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Chưa có tài khoản nào đăng ký</td></tr>`
    : users.map(u => `
      <tr>
        <td style="padding:12px 16px">
          <div style="font-weight:600">${escHtml(u.name||u.username||'')}</div>
        </td>
        <td style="padding:12px 16px;color:var(--text-secondary);font-size:13px">${escHtml(u.username||u.email||'')}</td>
        <td style="padding:12px 16px">${accountRoleBadge(u.role)}</td>
        <td style="padding:12px 16px;font-size:12px;color:var(--text-secondary)">${formatDate(u.createdAt)}</td>
        <td style="padding:12px 16px">
          <div style="display:flex;gap:8px;align-items:center">
            <select onchange="setUserRole('${u.id}', this.value)" style="font-size:12px;padding:4px 8px">
              ${roleOpts(u.role)}
            </select>
            <button class="btn btn-danger" style="padding:4px 10px;font-size:12px" onclick="deleteUser('${u.id}','${escHtml(u.name||u.username||'')}')">Xóa</button>
          </div>
        </td>
      </tr>`).join('');

  return `
    <div class="page-header">
      <div class="page-title">Quản Lý Tài Khoản</div>
      <div class="page-subtitle">${users.length} tài khoản đã đăng ký</div>
    </div>

    <div class="card" style="margin-bottom:16px;background:#0f1a0f;border-color:#2a4a2a;padding:14px 18px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🔑</span>
        <div>
          <div style="font-weight:600;color:var(--accent-green)">Tài khoản Admin mặc định</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">
            Username: <strong style="color:var(--text-primary)">admin</strong> ·
            Mật khẩu: <strong style="color:var(--text-primary)">admin123</strong> ·
            Quyền: <strong style="color:var(--accent-gold)">Admin</strong>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
            (Lần đầu setup: admin đăng ký tài khoản này tại trang Đăng ký, rồi vào Firebase Console set role='admin' cho doc /users/{uid})
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <div class="card" style="padding:12px 16px;flex:1;min-width:180px">
        <div style="color:var(--accent-gold);font-weight:700;margin-bottom:4px">👑 Admin</div>
        <div style="font-size:12px;color:var(--text-secondary)">Xem + Sửa + Cấp quyền tài khoản khác</div>
      </div>
      <div class="card" style="padding:12px 16px;flex:1;min-width:180px">
        <div style="color:var(--accent-cyan);font-weight:700;margin-bottom:4px">👤 Member</div>
        <div style="font-size:12px;color:var(--text-secondary)">Xem + tự sửa info bản thân</div>
      </div>
      <div class="card" style="padding:12px 16px;flex:1;min-width:180px">
        <div style="color:var(--text-muted);font-weight:700;margin-bottom:4px">🚪 Guest</div>
        <div style="font-size:12px;color:var(--text-secondary)">Chỉ xem, không được chỉnh sửa</div>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0f0f1e;border-bottom:1px solid var(--border-color)">
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px">Tên</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px">Username</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px">Quyền</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px">Ngày đăng ký</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px">Thao tác</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

const ROLE_LABELS = { admin: 'Admin', member: 'Member', guest: 'Guest' };

function accountRoleBadge(role) {
  const map = {
    admin:  { label: '👑 Admin',  color: '#f0c040' },
    member: { label: '👤 Member', color: '#40c0e0' },
    guest:  { label: '🚪 Guest',  color: '#606070' }
  };
  const r = map[role] || map.guest;
  return `<span class="badge" style="background:${r.color}22;color:${r.color};border:1px solid ${r.color}44">${r.label}</span>`;
}

function setUserRole(userId, newRole) {
  if (!isAdmin()) { denyEdit(); return; }
  if (typeof UsersFB === 'undefined') { showToast('Firebase chưa sẵn sàng', 'error'); return; }
  UsersFB.setRole(userId, newRole)
    .then(function(){
      console.log('[Auth] Role set:', userId, newRole);
      showToast(`Đã cập nhật quyền thành ${ROLE_LABELS[newRole]}!`);
    })
    .catch(function(e){
      console.error('[Auth] setRole error:', e);
      showToast('❌ Lỗi: ' + (e.code || e.message), 'error', 4000);
    });
}

function deleteUser(userId, name) {
  if (!isAdmin()) { denyEdit(); return; }
  if (!confirmDelete(`Xóa tài khoản "${name}"?\n(Lưu ý: chỉ xóa data trong Firestore, Auth account vẫn còn — admin cần xóa thêm trong Firebase Console nếu muốn user không login lại được)`)) return;
  if (typeof UsersFB === 'undefined') { showToast('Firebase chưa sẵn sàng', 'error'); return; }
  UsersFB.delete(userId)
    .then(function(){
      showToast('Đã xóa tài khoản!', 'error');
      renderPage('accounts');
    })
    .catch(function(e){
      console.error('[Auth] delete error:', e);
      showToast('❌ Lỗi: ' + (e.code || e.message), 'error', 4000);
    });
}

function denyEdit() {
  showToast('🔒 Bạn không có quyền chỉnh sửa. Liên hệ Admin để được cấp quyền.', 'error', 4000);
}
