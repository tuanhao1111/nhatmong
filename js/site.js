/* =============================================================================
   PERSONAL SITE · INTERACTIONS
   Lenis smooth scroll + GSAP/ScrollTrigger + canvas particles + custom cursor
   ========================================================================== */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  const hasLenis = typeof window.Lenis !== 'undefined';

  if (hasST) gsap.registerPlugin(ScrollTrigger);

  let lenis = null;

  /* ── Smooth scroll (Lenis) ───────────────────────────────────────────── */
  function initLenis() {
    if (!hasLenis || reduceMotion) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    window.lenis = lenis;
    if (hasST) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  function scrollTo(target) {
    if (lenis) lenis.scrollTo(target, { offset: 0 });
    else {
      const el = document.querySelector(target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /* ── Anchor links ────────────────────────────────────────────────────── */
  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length > 1 && document.querySelector(id)) {
          e.preventDefault();
          scrollTo(id);
        }
      });
    });
  }

  /* ── Custom cursor ───────────────────────────────────────────────────── */
  function initCursor() {
    if (!hasFinePointer || reduceMotion) return;
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;
    document.body.classList.add('cursor-on');

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    });

    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    document.querySelectorAll('[data-cursor]').forEach((el) => {
      el.addEventListener('mouseenter', () => ring.classList.add('hovering'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hovering'));
    });
  }

  /* ── Animated background: Vanta CLOUDS (fallback: canvas particles) ───── */
  function initBackground() {
    const vantaEl = document.getElementById('vanta-bg');
    const canvas = document.getElementById('bg-canvas');
    if (vantaEl && window.VANTA && window.VANTA.BIRDS) {
      try {
        window.VANTA.BIRDS({
          el: vantaEl,
          mouseControls: !reduceMotion,
          touchControls: !reduceMotion,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          backgroundColor: 0x05070a, // match site bg (near-black)
          color1: 0x7171ff,          // violet
          color2: 0x00b9ff,          // cyan
          birdSize: 1.0,
          quantity: 5.0,
          speedLimit: reduceMotion ? 0 : 5.0,
        });
        if (canvas) canvas.style.display = 'none';
        return;
      } catch (e) { console.warn('Vanta failed, using particle fallback', e); }
    }
    initParticles();
  }

  /* ── Canvas particle background (fallback) ───────────────────────────── */
  function initParticles() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, dpr, particles, mouse = { x: -999, y: -999 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = window.innerWidth * dpr;
      h = canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      const count = Math.min(90, Math.floor(window.innerWidth / 16));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4 * dpr,
        vy: (Math.random() - 0.5) * 0.4 * dpr,
        r: (Math.random() * 1.6 + 0.6) * dpr,
      }));
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; });

    const LINK = 120;
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // mouse repel
        const dxm = p.x - mouse.x, dym = p.y - mouse.y;
        const dm = Math.hypot(dxm, dym);
        if (dm < 150 * dpr && dm > 0) {
          p.x += (dxm / dm) * 1.2; p.y += (dym / dm) * 1.2;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 110, 189, 0.55)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK * dpr) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(30, 155, 224, ${0.18 * (1 - d / (LINK * dpr))})`;
            ctx.lineWidth = dpr * 0.6;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    if (!reduceMotion) frame();
    else { // static single frame
      requestAnimationFrame(frame);
      setTimeout(() => { /* let one frame draw */ }, 50);
    }
  }

  /* ── Scroll-reveal animations ────────────────────────────────────────── */
  function initReveals() {
    if (!hasGSAP) return;
    if (reduceMotion || !hasST) {
      gsap && gsap.set('.anim', { clearProps: 'all' });
      return;
    }

    gsap.utils.toArray('.anim').forEach((el) => {
      gsap.from(el, {
        y: 60, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' },
      });
    });

    // Marquee: continuous + scroll velocity nudge
    const track = document.querySelector('.marquee__track');
    if (track) {
      gsap.to(track, { xPercent: -50, repeat: -1, duration: 24, ease: 'none' });
    }

    // Dark sections: subtle parallax on project media
    gsap.utils.toArray('.project__media').forEach((m) => {
      gsap.fromTo(m, { y: 40 }, {
        y: -40, ease: 'none',
        scrollTrigger: { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ── Hero intro (after splash) ───────────────────────────────────────── */
  function heroIntro() {
    if (!hasGSAP || reduceMotion) return;
    const spans = gsap.utils.toArray('.hero__title .line > span');
    if (!spans.length) return; // not on a page with a hero
    gsap.from(spans, {
      yPercent: 115, duration: 1.1, ease: 'power4.out', stagger: 0.08,
    });
    const meta = gsap.utils.toArray('.hero__meta, .hero__scroll');
    if (meta.length) gsap.from(meta, {
      opacity: 0, y: 20, duration: 1, ease: 'power3.out', delay: 0.5, stagger: 0.1,
    });
  }

  /* ── Scroll-driven hero (converge → center → zoom through) ───────────── */
  function scrollHero() {
    if (!hasGSAP || !hasST || reduceMotion) return;
    const hero = document.querySelector('.hero');
    const title = document.querySelector('.hero__title');
    const lines = gsap.utils.toArray('.hero__title .line');
    if (!hero || !title || !lines.length) return;

    gsap.set(title, { transformOrigin: '50% 50%', willChange: 'transform' });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: '+=130%',
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    // (1) DỒN DÒNG: các dòng so le trượt gộp về dòng giữa
    tl.to(lines[0], { yPercent: 60, ease: 'power1.inOut', duration: 0.4 }, 0);
    tl.to(lines[2], { yPercent: -60, ease: 'power1.inOut', duration: 0.4 }, 0);
    // mờ phần meta + chỉ dẫn cuộn
    tl.to('.hero__meta, .hero__scroll', { autoAlpha: 0, y: -24, duration: 0.25 }, 0);

    // (2) THU VỀ GIỮA: cả tiêu đề nhỏ lại và dịch vào chính giữa màn hình
    tl.to(title, {
      scale: 0.42,
      y: () => {
        const r = title.getBoundingClientRect();
        return window.innerHeight / 2 - (r.top + r.height / 2);
      },
      ease: 'power1.inOut',
      duration: 0.6,
    }, 0);

    // (3) ZOOM XUYÊN QUA: phóng to & mờ dần để lộ section kế tiếp
    tl.to(title, { scale: 2.4, autoAlpha: 0, ease: 'power2.in', duration: 0.4 }, 0.62);
  }

  /* ── Splash loader ───────────────────────────────────────────────────── */
  function initSplash(done) {
    const splash = document.getElementById('splash');
    const count = document.getElementById('splash-count');
    const bar = document.getElementById('splash-bar');
    if (!splash) { done(); return; }

    if (reduceMotion || !hasGSAP) {
      splash.style.display = 'none';
      done();
      return;
    }

    const state = { n: 0 };
    const tl = gsap.timeline({ onComplete: () => {
      gsap.to(splash, {
        yPercent: -100, duration: 0.9, ease: 'power4.inOut',
        onComplete: () => { splash.style.display = 'none'; done(); },
      });
    }});
    tl.to(state, {
      n: 100, duration: 1.8, ease: 'power2.inOut',
      onUpdate: () => {
        const v = Math.round(state.n);
        if (count) count.textContent = v;
        if (bar) bar.style.width = v + '%';
      },
    });
  }

  /* ── Menu overlay ────────────────────────────────────────────────────── */
  function initMenu() {
    const btn = document.getElementById('menu-btn');
    const overlay = document.getElementById('menu-overlay');
    if (!btn || !overlay) return;

    function setOpen(open) {
      document.body.classList.toggle('menu-open', open);
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (lenis) open ? lenis.stop() : lenis.start();
    }
    btn.addEventListener('click', () => setOpen(!document.body.classList.contains('menu-open')));
    overlay.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  /* ── Audio ───────────────────────────────────────────────────────────── */
  function initAudio() {
    const audio = document.getElementById('bg-music');
    const widget = document.getElementById('audio-widget');
    if (!audio || !widget) return;
    let playing = false;

    function setUI(on) {
      widget.classList.toggle('playing', on);
      document.querySelectorAll('#audio-label, #audio-label-en').forEach((l) => {
        const vi = l.hasAttribute('data-vi');
        l.textContent = on ? (vi ? 'Đang phát' : 'Now playing') : (vi ? 'Phát nhạc' : 'Play music');
      });
    }

    function toggle() {
      if (playing) {
        audio.pause(); playing = false; setUI(false);
        localStorage.setItem('music_playing', 'false');
      } else {
        audio.play().then(() => {
          playing = true; setUI(true);
          localStorage.setItem('music_playing', 'true');
        }).catch(() => {});
      }
    }
    widget.addEventListener('click', toggle);

    // Auto-play on entry unless the user explicitly muted it on a previous visit.
    const wantMusic = localStorage.getItem('music_playing') !== 'false';
    if (wantMusic) {
      const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
      const kick = () => {
        if (playing) { cleanup(); return; }
        audio.play().then(() => {
          playing = true; setUI(true);
          localStorage.setItem('music_playing', 'true');
          cleanup();
        }).catch(() => {});
      };
      function cleanup() { events.forEach((ev) => window.removeEventListener(ev, kick)); }
      // Try straight away (works for returning visitors / relaxed autoplay policies)…
      audio.play().then(() => {
        playing = true; setUI(true);
        localStorage.setItem('music_playing', 'true');
      }).catch(() => {
        // …otherwise start at the first user gesture.
        events.forEach((ev) => window.addEventListener(ev, kick, { passive: true }));
      });
    }
  }

  /* ── Language toggle ─────────────────────────────────────────────────── */
  function initLang() {
    const toggle = document.getElementById('lang-toggle');
    if (!toggle) return;
    const saved = localStorage.getItem('site_lang');
    if (saved) setLang(saved);

    function setLang(lang) {
      document.body.setAttribute('data-lang', lang);
      document.documentElement.setAttribute('lang', lang);
      toggle.querySelectorAll('button').forEach((b) =>
        b.classList.toggle('active', b.dataset.setLang === lang));
      localStorage.setItem('site_lang', lang);
      if (hasST) ScrollTrigger.refresh();
    }

    toggle.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => setLang(b.dataset.setLang));
    });
  }

  /* ── Boot ────────────────────────────────────────────────────────────── */
  function boot() {
    initLang();
    initBackground();
    initCursor();
    initLenis();
    initMenu();
    initAnchors();
    initReveals();
    scrollHero();
    initAudio();
    initSplash(heroIntro);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
