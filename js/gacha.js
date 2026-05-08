/**
 * gacha.js - Gacha Bang Chiến page
 * Embed gacha-component.html bằng iframe để cách ly CSS/JS,
 * tránh xung đột với app chính (Nhất Mộng).
 *
 * Truyền admin role qua query param ?admin=1 để file con đọc được.
 * Admin → có quyền sửa rosters, quay thưởng, đóng chu kỳ, xóa lịch sử.
 * Member/Guest → chỉ xem (read-only).
 */

function renderGachaPage() {
  const adminFlag = (typeof isAdmin === 'function' && isAdmin()) ? '1' : '0';
  const src = `gacha-component.html?admin=${adminFlag}`;

  return `
    <div style="
      width:100%;
      height:calc(100vh - 80px);
      min-height:600px;
      border:1px solid var(--border-color);
      border-radius:12px;
      overflow:hidden;
      background:var(--bg-card);
      position:relative;
    ">
      <iframe
        src="${src}"
        title="Gacha Bang Chiến"
        style="
          width:100%;
          height:100%;
          border:none;
          display:block;
          background:transparent;
        "
        loading="lazy"
        allow="clipboard-read; clipboard-write"
      ></iframe>
    </div>
  `;
}
