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

  /* ── Custom cursor (context-aware label) ─────────────────────────────── */
  function initCursor() {
    if (!hasFinePointer || reduceMotion) return;
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    const label = document.getElementById('cursor-label');
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

    // Delegated hover so dynamically-added elements (e.g. movie cards) work too.
    const isEN = () => document.body.dataset.lang === 'en';
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-cursor]');
      if (!t) return;
      ring.classList.add('hovering');
      const txt = (isEN() && t.dataset.cursorEn) ? t.dataset.cursorEn : (t.dataset.cursor || '');
      if (txt) { if (label) label.textContent = txt; ring.classList.add('labeled'); }
    });
    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest('[data-cursor]');
      if (!t || t.contains(e.relatedTarget)) return; // ignore moves to a child
      ring.classList.remove('hovering', 'labeled');
      if (label) label.textContent = '';
    });
  }

  /* ── Magnetic buttons ────────────────────────────────────────────────── */
  function initMagnetic() {
    if (!hasFinePointer || reduceMotion || !hasGSAP) return;
    const sel = '[data-magnetic], .btn-discord, .gbtn, .menu-btn, .phim-more, .reveal__close';
    document.querySelectorAll(sel).forEach((el) => {
      const s = parseFloat(el.dataset.magnetic) || 0.32;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - (r.left + r.width / 2)) * s,
          y: (e.clientY - (r.top + r.height / 2)) * s,
          duration: 0.4, ease: 'power3.out',
        });
      });
      el.addEventListener('mouseleave', () =>
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }));
    });
  }

  /* ── 3D tilt cards ───────────────────────────────────────────────────── */
  function initTilt() {
    if (!hasFinePointer || reduceMotion || !hasGSAP) return;
    document.querySelectorAll('[data-tilt], .xcard').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(card, {
          rotateY: px * 9, rotateX: -py * 9, transformPerspective: 850, transformOrigin: 'center',
          duration: 0.4, ease: 'power2.out',
        });
      });
      card.addEventListener('mouseleave', () =>
        gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.6, ease: 'power3.out' }));
    });
  }

  /* ── Spotlight that follows the cursor on dark sections ──────────────── */
  function initSpotlight() {
    if (!hasFinePointer) return;
    document.querySelectorAll('.section--dark').forEach((sec) => {
      sec.addEventListener('mousemove', (e) => {
        const r = sec.getBoundingClientRect();
        sec.style.setProperty('--sx', (e.clientX - r.left) + 'px');
        sec.style.setProperty('--sy', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ── Scroll progress bar ─────────────────────────────────────────────── */
  function initScrollProgress() {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);
    const upd = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
    };
    window.addEventListener('scroll', upd, { passive: true });
    if (window.lenis) window.lenis.on('scroll', upd);
    upd();
  }

  /* ── Subtle UI sound effects (off by default, toggleable) ────────────── */
  function initUISound() {
    if (reduceMotion) return;
    let on = localStorage.getItem('ui_sfx') === 'true';
    let ctx = null;
    const ensure = () => {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    function blip(freq, dur, vol) {
      if (!on) return;
      try {
        const c = ensure();
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = freq;
        o.connect(g); g.connect(c.destination);
        const now = c.currentTime;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(vol, now + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.start(now); o.stop(now + dur);
      } catch (e) {}
    }
    const btn = document.createElement('button');
    btn.className = 'sfx-toggle';
    btn.setAttribute('data-cursor', '');
    const sync = () => { btn.classList.toggle('on', on); btn.textContent = on ? 'SFX ON' : 'SFX OFF'; };
    sync();
    btn.addEventListener('click', () => {
      on = !on; localStorage.setItem('ui_sfx', on ? 'true' : 'false'); sync();
      if (on) blip(660, 0.09, 0.05);
    });
    document.body.appendChild(btn);

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('[data-cursor]')) blip(900, 0.045, 0.02);
    });
    document.addEventListener('click', (e) => {
      if (e.target.closest('a, button, [data-cursor]')) blip(520, 0.09, 0.04);
    });
  }

  /* ── Animated background: Vanta BIRDS (fallback: canvas particles) ─────
     three.js + Vanta nặng ~700KB nên chỉ tải trên desktop; mobile / máy yếu
     dùng canvas particles nhẹ. Version được ghim cứng để không vỡ bất chợt. */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function startVanta(vantaEl, canvas) {
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
  }

  function initBackground() {
    const vantaEl = document.getElementById('vanta-bg');
    const canvas = document.getElementById('bg-canvas');
    const wantVanta = vantaEl && hasFinePointer && window.innerWidth >= 900 && !reduceMotion;
    if (!wantVanta) { initParticles(); return; }
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.birds.min.js'))
      .then(() => startVanta(vantaEl, canvas))
      .catch((e) => { console.warn('Vanta failed, using particle fallback', e); initParticles(); });
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

  /* ── Skew on scroll velocity ─────────────────────────────────────────── */
  function initScrollSkew() {
    if (!hasGSAP || reduceMotion) return;
    const targets = gsap.utils.toArray('.marquee__track, .page-title');
    if (!targets.length) return;
    const setters = targets.map((t) => gsap.quickTo(t, 'skewY', { duration: 0.5, ease: 'power3' }));
    let resetTimer;
    const apply = (v) => {
      const sk = Math.max(-7, Math.min(7, v * 0.45));
      setters.forEach((s) => s(sk));
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setters.forEach((s) => s(0)), 120);
    };
    if (window.lenis) window.lenis.on('scroll', (e) => apply(e.velocity || 0));
    else {
      let last = window.scrollY, lastT = performance.now();
      window.addEventListener('scroll', () => {
        const now = performance.now(), y = window.scrollY;
        apply((y - last) / Math.max(16, now - lastT) * 16);
        last = y; lastT = now;
      }, { passive: true });
    }
  }

  /* ── Word-by-word reveal for big headings ────────────────────────────── */
  function splitWords(el) {
    const wrap = (node) => {
      if (node.nodeType === 3) {
        if (!node.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (part.trim() === '') { frag.appendChild(document.createTextNode(part)); return; }
          const s = document.createElement('span');
          s.className = 'word'; s.textContent = part;
          frag.appendChild(s);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1 && node.tagName !== 'BR') {
        [...node.childNodes].forEach(wrap);
      }
    };
    [...el.childNodes].forEach(wrap);
  }
  function initWordReveal() {
    if (!hasGSAP || reduceMotion) return;
    gsap.utils.toArray('[data-split]').forEach((el) => {
      splitWords(el);
      if (!hasST) return;
      const words = el.querySelectorAll('.word');
      gsap.from(words, {
        yPercent: 60, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 90%' },
      });
    });
  }

  /* ── Explore: pin + stagger the cards in (storytelling) ──────────────── */
  function initExplorePin() {
    if (!hasGSAP || !hasST || reduceMotion) return;
    const sec = document.getElementById('explore');
    if (!sec) return;
    const cards = sec.querySelectorAll('.xcard');
    if (!cards.length) return;
    gsap.set(cards[0], { xPercent: -10, opacity: 0 });
    if (cards[1]) gsap.set(cards[1], { xPercent: 10, opacity: 0 });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: '+=90%', pin: true, scrub: 1, invalidateOnRefresh: true },
    });
    tl.to(cards[0], { xPercent: 0, opacity: 1, ease: 'power2.out', duration: 0.5 }, 0.05);
    if (cards[1]) tl.to(cards[1], { xPercent: 0, opacity: 1, ease: 'power2.out', duration: 0.5 }, 0.5);
  }

  /* ── Multi-layer parallax (card art drifts) ──────────────────────────── */
  function initParallax() {
    if (!hasGSAP || !hasST || reduceMotion) return;
    gsap.utils.toArray('.xcard__media').forEach((el) => {
      gsap.fromTo(el, { yPercent: -8 }, {
        yPercent: 8, ease: 'none',
        scrollTrigger: { trigger: el.closest('.xcard') || el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  /* ── Nav shrink + backdrop after the hero ────────────────────────────── */
  function initNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const upd = () => {
      const y = window.scrollY || document.documentElement.scrollTop;
      nav.classList.toggle('scrolled', y > window.innerHeight * 0.6);
    };
    window.addEventListener('scroll', upd, { passive: true });
    if (window.lenis) window.lenis.on('scroll', upd);
    upd();
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
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
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

    // Nhạc nối tiếp giữa các trang: lưu vị trí đang phát vào sessionStorage
    // và tua lại đúng chỗ đó khi trang mới bắt đầu phát.
    const POS_KEY = 'music_pos';
    const savePos = () => {
      if (audio.currentTime > 0) {
        try { sessionStorage.setItem(POS_KEY, String(audio.currentTime)); } catch (e) {}
      }
    };
    let lastSave = 0;
    audio.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastSave > 5000) { lastSave = now; savePos(); }
    });
    window.addEventListener('pagehide', savePos);
    audio.addEventListener('loadedmetadata', () => {
      let t = 0;
      try { t = parseFloat(sessionStorage.getItem(POS_KEY)) || 0; } catch (e) {}
      if (t > 0 && (!isFinite(audio.duration) || t < audio.duration)) audio.currentTime = t;
    }, { once: true });

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
    initMagnetic();
    initTilt();
    initSpotlight();
    initScrollProgress();
    initUISound();
    initScrollSkew();
    initWordReveal();
    initExplorePin();
    initParallax();
    initNavScroll();
    initSplash(heroIntro);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
