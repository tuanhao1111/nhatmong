/**
 * gacha.js - Gacha Bang Chiến page
 * Embed gacha-component.html bằng iframe để cách ly CSS/JS,
 * tránh xung đột với app chính (Nhất Mộng).
 */

function renderGachaPage() {
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
        src="gacha-component.html"
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
