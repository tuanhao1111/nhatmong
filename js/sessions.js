/**
 * sessions.js - Lịch sử đợt bang chiến
 */

function renderSessionsPage() {
  if (typeof isGuest === 'function' && isGuest()) {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:16px">'+
      '<div style="font-size:48px">🔒</div>'+
      '<div style="font-size:18px;font-weight:600;color:var(--text-secondary)">Chỉ thành viên bang mới xem được</div>'+
      '<div style="font-size:13px;color:var(--text-muted);text-align:center;max-width:300px;line-height:1.7">Nội dung này được bảo mật. Vui lòng <a onclick="window.location.href=\'login.html\'" style="color:var(--accent-cyan);cursor:pointer;text-decoration:underline">đăng nhập</a> với tài khoản thành viên.</div>'+
      '</div>';
  }
  const allSessions = Sessions.getAll();
  const current = Sessions.getCurrent();

  const currentHtml = current ? `
    <div class="card" style="border-color:var(--accent-green);background:#0a1a10;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <div class="badge" style="background:var(--accent-green)22;color:var(--accent-green);margin-bottom:8px">ĐANG CHẠY</div>
          <div style="font-family:var(--font-display);font-size:20px;font-weight:700">${escHtml(current.name)}</div>
          <div style="color:var(--text-secondary);font-size:12px;margin-top:4px">${formatDateTime(current.createdAt)}</div>
        </div>
        <div style="display:flex;gap:16px">
          <div style="text-align:center"><div style="font-size:11px;color:var(--text-secondary)">Số đội</div><div style="font-size:20px;font-weight:700">${current.teams.length}</div></div>
          <div style="text-align:center"><div style="font-size:11px;color:var(--text-secondary)">Slot/đội</div><div style="font-size:20px;font-weight:700">${current.teams[0]?.slots.length||0}</div></div>
          <div style="text-align:center"><div style="font-size:11px;color:var(--text-secondary)">Dự bị</div><div style="font-size:20px;font-weight:700">${current.reserve.filter(Boolean).length}</div></div>
          <div style="text-align:center"><div style="font-size:11px;color:var(--text-secondary)">Bản đồ</div><div style="font-size:14px;font-weight:600;color:var(--accent-gold)">${escHtml(current.map)}</div></div>
        </div>
        <button class="btn btn-gold" onclick="navigate('dashboard')">Xem chi tiết »</button>
      </div>
    </div>
  ` : `<div class="card" style="text-align:center;padding:30px;margin-bottom:16px;color:var(--text-muted)">Chưa có đợt nào đang chạy</div>`;

  const historyHtml = allSessions.length === 0
    ? '<div style="text-align:center;padding:30px;color:var(--text-muted)">Chưa có lịch sử</div>'
    : allSessions.map(s => {
        const filled = [...s.teams.flatMap(t=>t.slots), ...s.reserve].filter(Boolean).length;
        const total = s.teams.reduce((a,t)=>a+t.slots.length,0) + s.reserve.length;
        return `
          <div class="card" style="margin-bottom:10px">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div>
                <div style="font-weight:600;font-size:15px">${escHtml(s.name)}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${formatDateTime(s.createdAt)} · Đóng: ${formatDateTime(s.closedAt)}</div>
              </div>
              <div style="display:flex;gap:12px;color:var(--text-secondary);font-size:13px">
                <span>👥 ${filled}/${total} người</span>
                <span>🗺 ${s.map||'—'}</span>
              </div>
            </div>
          </div>`;
      }).join('');

  return `
    <div class="page-header">
      <div class="page-title">Lịch Sử Đợt</div>
      <div class="page-subtitle">Quản lý lịch sử đợt bang chiến</div>
    </div>
    ${currentHtml}
    <div class="section-header" style="margin-top:20px">
      <span class="section-title">📜 Lịch sử cũ (${allSessions.length})</span>
    </div>
    ${historyHtml}
  `;
}
