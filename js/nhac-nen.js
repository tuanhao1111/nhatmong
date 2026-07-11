/* =============================================================================
   NHẠC NỀN · nút bật/tắt kiểu HUD, dùng chung cho mọi trang
   - Nhớ trạng thái bật/tắt + vị trí đang phát (localStorage) → chuyển trang nhạc nối tiếp
   - Tôn trọng autoplay policy: nếu trình duyệt chặn thì chờ thao tác đầu tiên
   - preload="none": chỉ tải file (~3MB) khi người dùng thật sự bật nhạc
   ========================================================================== */
(function () {
  'use strict';

  var ONKEY = 'nm_music_on';   // '1' = đang bật
  var TKEY = 'nm_music_t';     // giây đang phát, để trang sau phát tiếp

  var audio = new Audio();
  audio.loop = true;
  audio.volume = 0.35;
  audio.preload = 'none';
  audio.src = 'assets/nhac-nen.mp3';

  // ── Nút HUD ──────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent =
    '#nm-music{position:fixed;right:18px;bottom:60px;z-index:400;width:42px;height:42px;' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
    'border-radius:999px;border:1px solid rgba(180,76,255,0.5);background:rgba(7,5,16,0.85);' +
    'color:#d9b6ff;font-size:16px;line-height:1;padding:0;' +
    'transition:border-color 0.3s,box-shadow 0.3s,color 0.3s;-webkit-tap-highlight-color:transparent;}' +
    '#nm-music:hover{border-color:#00e5ff;color:#00e5ff;}' +
    '#nm-music.on{border-color:#00e5ff;color:#00e5ff;box-shadow:0 0 22px -4px rgba(0,229,255,0.8);' +
    'animation:nmMusicPulse 2.2s ease-in-out infinite;}' +
    '#nm-music .nm-music__off{position:absolute;font-size:20px;color:rgba(178,166,205,0.9);' +
    'transform:rotate(-45deg);pointer-events:none;}' +
    '#nm-music.on .nm-music__off{display:none;}' +
    '@keyframes nmMusicPulse{0%,100%{box-shadow:0 0 14px -4px rgba(0,229,255,0.55);}' +
    '50%{box-shadow:0 0 28px -2px rgba(0,229,255,0.9);}}' +
    '@media (prefers-reduced-motion: reduce){#nm-music.on{animation:none;}}';
  document.head.appendChild(style);

  var btn = document.createElement('button');
  btn.id = 'nm-music';
  btn.type = 'button';
  btn.innerHTML = '♪<span class="nm-music__off">/</span>';
  btn.setAttribute('aria-label', 'Bật/tắt nhạc nền');
  btn.title = 'Nhạc nền';

  function mount() { document.body.appendChild(btn); }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  function setUI(on) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  // ── Phát / dừng ──────────────────────────────────────────────────────────
  var armed = false; // đã gắn listener chờ thao tác đầu tiên (khi autoplay bị chặn)

  function tryPlay() {
    // Phát tiếp từ vị trí trang trước để lại
    var t = parseFloat(localStorage.getItem(TKEY) || '0');
    if (t > 0 && audio.readyState === 0) {
      audio.addEventListener('loadedmetadata', function () {
        if (isFinite(audio.duration)) audio.currentTime = t % audio.duration;
      }, { once: true });
    }
    audio.play().then(function () {
      setUI(true);
    }).catch(function () {
      // Autoplay bị chặn → chờ chạm/phím đầu tiên rồi phát
      if (armed) return;
      armed = true;
      var kick = function () {
        armed = false;
        if (localStorage.getItem(ONKEY) === '1') tryPlay();
      };
      document.addEventListener('pointerdown', kick, { once: true });
      document.addEventListener('keydown', kick, { once: true });
    });
  }

  function toggle() {
    if (audio.paused) {
      try { localStorage.setItem(ONKEY, '1'); } catch (e) {}
      tryPlay();
    } else {
      audio.pause();
      setUI(false);
      try {
        localStorage.setItem(ONKEY, '0');
        localStorage.setItem(TKEY, String(audio.currentTime || 0));
      } catch (e) {}
    }
  }
  btn.addEventListener('click', toggle);

  // Lưu vị trí đang phát định kỳ + khi rời trang → trang sau nối tiếp
  var save = function () {
    if (!audio.paused) {
      try { localStorage.setItem(TKEY, String(audio.currentTime || 0)); } catch (e) {}
    }
  };
  setInterval(save, 3000);
  window.addEventListener('pagehide', save);

  // Lần trước đang bật → tự phát lại
  if (localStorage.getItem(ONKEY) === '1') tryPlay();
})();
