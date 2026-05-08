/**
 * minigames.js - Sòng Bạc Giang Hồ (Mini-Games Hub) page
 * Embed minigames-hub.html bằng iframe để cách ly CSS/JS,
 * tránh xung đột với app chính (Nhất Mộng).
 *
 * Truyền admin role qua query param ?admin=1 để file con đọc được.
 */

function renderMinigamesPage() {
  const adminFlag = (typeof isAdmin === 'function' && isAdmin()) ? '1' : '0';
  const userName  = (typeof getCurrentUser === 'function' && getCurrentUser())
    ? encodeURIComponent(getCurrentUser().name || '')
    : '';
  const src = `minigames-hub.html?admin=${adminFlag}&user=${userName}`;

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
        title="Sòng Bạc Giang Hồ - Mini Games"
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
