/* mong-gate — interactive 3D particle logo gate.
   Particles form the word (default "MỘNG"). Drag = rotate cloud in 3D,
   mouse move = particles scatter, .enter() = explosion, then fires
   bubbling CustomEvent('mong-done').                                     */
(function () {
  if (customElements.get('mong-gate')) return;

  let threePromise = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threePromise) {
      threePromise = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        s.onload = () => res(window.THREE);
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return threePromise;
  }

  function glowOrbCanvas() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.25, 'rgba(0,229,255,0.55)');
    grad.addColorStop(0.6, 'rgba(180,76,255,0.25)');
    grad.addColorStop(1, 'rgba(180,76,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  }

  class MongGate extends HTMLElement {
    connectedCallback() {
      this.style.display = 'block';
      // fill the mount wrapper — otherwise the host can end up 0px tall
      this.style.position = 'absolute';
      this.style.inset = '0';
      this.style.width = '100%';
      this.style.height = '100%';
      this._dead = false;
      loadThree().then((T) => { if (!this._dead) this._init(T); });
    }

    disconnectedCallback() {
      this._dead = true;
      if (this._raf) cancelAnimationFrame(this._raf);
      removeEventListener('resize', this._onResize);
      if (this._renderer) this._renderer.dispose();
    }

    enter() {
      if (this._exploding) return;
      if (!this._points) { this._pendingEnter = true; return; }
      this._explode();
    }

    _explode() {
      this._exploding = true;
      const n = this._count;
      for (let i = 0; i < n; i++) {
        const j = i * 3;
        // gentle outward drift + strong pull toward the camera → "fly through"
        const x = this._pos[j], y = this._pos[j + 1], z = this._pos[j + 2];
        const d = Math.max(0.3, Math.hypot(x, y));
        const boost = 0.12 + Math.random() * 0.28;
        this._vel[j] += (x / d) * boost + (Math.random() - 0.5) * 0.15;
        this._vel[j + 1] += (y / d) * boost + (Math.random() - 0.5) * 0.15;
        this._vel[j + 2] += 0.25 + Math.random() * 0.5;
      }
      this._rotBoost = 0.35;
      this.dispatchEvent(new CustomEvent('mong-enter-start', { bubbles: true }));
      setTimeout(() => {
        if (!this._dead) this.dispatchEvent(new CustomEvent('mong-done', { bubbles: true }));
      }, 1200);
    }

    _init(THREE) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      renderer.setSize(this.clientWidth || innerWidth, this.clientHeight || innerHeight);
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
      this.style.position = this.style.position || 'relative';
      this.appendChild(renderer.domElement);
      this._renderer = renderer;

      const W = () => this.clientWidth || innerWidth;
      const H = () => this.clientHeight || innerHeight;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, W() / H(), 0.1, 100);
      camera.position.z = 13;
      this._camera = camera;
      this._onResize = () => {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
      };
      addEventListener('resize', this._onResize);

      const group = new THREE.Group();
      scene.add(group);
      this._group = group;

      // ── ambient dust field behind the logo ──
      {
        const dn = 700;
        const dp = new Float32Array(dn * 3);
        for (let i = 0; i < dn; i++) {
          dp[i * 3] = (Math.random() - 0.5) * 46;
          dp[i * 3 + 1] = (Math.random() - 0.5) * 30;
          dp[i * 3 + 2] = -4 - Math.random() * 26;
        }
        const dg = new THREE.BufferGeometry();
        dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
        this._dust = new THREE.Points(dg, new THREE.PointsMaterial({
          color: 0x6a5a9e, size: 0.045, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        scene.add(this._dust);
      }
      this._rings = [];

      // ── rising energy streaks ──
      {
        const sn = 90;
        const sp = new Float32Array(sn * 3);
        const sv = new Float32Array(sn);
        const sc = new Float32Array(sn * 3);
        for (let i = 0; i < sn; i++) {
          sp[i * 3] = (Math.random() - 0.5) * 42;
          sp[i * 3 + 1] = -16 + Math.random() * 32;
          sp[i * 3 + 2] = -3 - Math.random() * 22;
          sv[i] = 1.5 + Math.random() * 3.5;
          const mag = Math.random() < 0.5;
          sc[i * 3] = mag ? 0.7 : 0.1; sc[i * 3 + 1] = mag ? 0.3 : 0.85; sc[i * 3 + 2] = 1;
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
        this._streaks = new THREE.Points(sg, new THREE.PointsMaterial({
          size: 0.09, vertexColors: true, transparent: true, opacity: 0.7,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        scene.add(this._streaks);
        this._streakPos = sp; this._streakVel = sv; this._streakN = sn;
      }

      // ── orbiting glow orb around the word ──
      this._orb = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(glowOrbCanvas()),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
      }));
      this._orb.scale.setScalar(1.6);
      scene.add(this._orb);

      // ── sample text pixels → particle homes ──
      const text = this.getAttribute('text') || 'MỘNG';
      const buildParticles = () => {
        if (this._dead || this._points) return;
        const cw = 1200, ch = 480;
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const g = c.getContext('2d');
        g.font = '700 300px "Chakra Petch", "Be Vietnam Pro", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = '#fff';
        g.fillText(text, cw / 2, ch / 2 + 30);
        const data = g.getImageData(0, 0, cw, ch).data;

        const homes = [], step = 5;
        for (let y = 0; y < ch; y += step) {
          for (let x = 0; x < cw; x += step) {
            if (data[(y * cw + x) * 4 + 3] > 128) {
              homes.push(
                (x - cw / 2) * 0.013 + (Math.random() - 0.5) * 0.03,
                -(y - ch / 2) * 0.013 + (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 1.4
              );
            }
          }
        }
        const count = homes.length / 3;
        this._count = count;
        this._home = new Float32Array(homes);
        this._pos = new Float32Array(count * 3);
        this._vel = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        // start scattered far away, converge to form the word
        for (let i = 0; i < count; i++) {
          const j = i * 3;
          this._pos[j] = (Math.random() - 0.5) * 40;
          this._pos[j + 1] = (Math.random() - 0.5) * 26;
          this._pos[j + 2] = (Math.random() - 0.5) * 30;
          const tmix = Math.min(1, Math.max(0, (this._home[j] + 7) / 14)) * 0.85 + Math.random() * 0.15;
          // cyan → magenta across the word
          colors[j] = 0.05 + tmix * 0.95;
          colors[j + 1] = 0.9 - tmix * 0.62;
          colors[j + 2] = 1.0 - tmix * 0.06;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this._pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const mat = new THREE.PointsMaterial({
          size: 0.055, vertexColors: true, transparent: true, opacity: 0.95,
          blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        });
        this._mat = mat;
        this._points = new THREE.Points(geo, mat);
        group.add(this._points);
        // announce convergence (particles settle into the word)
        setTimeout(() => {
          if (!this._dead && !this._exploding) this.dispatchEvent(new CustomEvent('mong-ready', { bubbles: true }));
        }, 2600);
        if (this._pendingEnter) this._explode();
      };
      const fontSpec = '700 300px "Chakra Petch"';
      let built = false;
      const tryBuild = () => { if (!built) { built = true; buildParticles(); } };
      if (document.fonts && document.fonts.load) {
        document.fonts.load(fontSpec, text).then(() => tryBuild()).catch(() => tryBuild());
        setTimeout(tryBuild, 1600); // fallback if font never resolves
      } else tryBuild();

      // ── interaction ──
      this._rotT = { x: 0, y: 0 };
      this._mouseWorld = new THREE.Vector3(999, 999, 0);
      let dragging = false, lx = 0, ly = 0, moved = 0;
      const el = renderer.domElement;
      el.style.pointerEvents = 'auto';
      el.addEventListener('pointerdown', (e) => {
        dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId);
        // shockwave ring at the click point
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.05, 0.09, 48),
          new THREE.MeshBasicMaterial({ color: 0xb44cff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.position.copy(this._mouseWorld);
        if (Math.abs(ring.position.x) > 100) ring.position.set(0, 0, 0);
        scene.add(ring);
        this._rings.push({ mesh: ring, life: 0 });
        // shove nearby particles outward
        if (this._points && !this._exploding) {
          const local = new THREE.Vector3().copy(ring.position);
          group.worldToLocal(local);
          for (let i = 0; i < this._count; i++) {
            const j = i * 3;
            const dx = this._pos[j] - local.x, dy = this._pos[j + 1] - local.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < 6) {
              const f = (6 - d2) * 0.03 / Math.max(0.2, Math.sqrt(d2));
              this._vel[j] += dx * f; this._vel[j + 1] += dy * f;
              this._vel[j + 2] += (Math.random() - 0.5) * f * 2;
            }
          }
        }
      });
      el.addEventListener('pointermove', (e) => {
        const r = this.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
        const hh = Math.tan((55 * Math.PI) / 360) * camera.position.z;
        this._mouseWorld.set(nx * hh * camera.aspect, ny * hh, 0);
        if (dragging) {
          this._rotT.y += (e.clientX - lx) * 0.006;
          this._rotT.x += (e.clientY - ly) * 0.004;
          this._rotT.x = Math.max(-0.9, Math.min(0.9, this._rotT.x));
          moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
          lx = e.clientX; ly = e.clientY;
        }
      });
      const up = () => { dragging = false; };
      // no button: a tap (not a drag) or a scroll gesture enters the site
      el.addEventListener('pointerup', () => { const wasTap = moved < 8; up(); if (wasTap) this.enter(); });
      el.addEventListener('pointerleave', () => { this._mouseWorld.set(999, 999, 0); up(); });
      el.addEventListener('wheel', (e) => { if (e.deltaY > 0) this.enter(); }, { passive: true });

      // ── loop ──
      const clock = new THREE.Clock();
      this._rotBoost = 0;
      const local = new THREE.Vector3();
      const loop = () => {
        if (this._dead) return;
        this._raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;

        group.rotation.y += ((this._rotT.y + Math.sin(t * 0.3) * 0.12) - group.rotation.y) * Math.min(1, dt * 4) + this._rotBoost * dt;
        group.rotation.x += ((this._rotT.x + Math.sin(t * 0.23) * 0.05) - group.rotation.x) * Math.min(1, dt * 4);
        if (this._rotBoost) this._rotBoost *= 1 - dt * 0.6;

        if (this._points) {
          local.copy(this._mouseWorld);
          group.worldToLocal(local);
          const pos = this._pos, vel = this._vel, home = this._home, n = this._count;
          const exploding = this._exploding;
          for (let i = 0; i < n; i++) {
            const j = i * 3;
            if (!exploding) {
              vel[j] += (home[j] - pos[j]) * 0.022;
              vel[j + 1] += (home[j + 1] - pos[j + 1]) * 0.022;
              vel[j + 2] += (home[j + 2] - pos[j + 2]) * 0.022;
              const dx = pos[j] - local.x, dy = pos[j + 1] - local.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 2.6) {
                const f = (2.6 - d2) * 0.045 / Math.max(0.15, Math.sqrt(d2));
                vel[j] += dx * f;
                vel[j + 1] += dy * f;
                vel[j + 2] += (Math.random() - 0.5) * f;
              }
              vel[j] *= 0.9; vel[j + 1] *= 0.9; vel[j + 2] *= 0.9;
            } else {
              vel[j] *= 0.995; vel[j + 1] *= 0.995; vel[j + 2] *= 0.995;
            }
            pos[j] += vel[j]; pos[j + 1] += vel[j + 1]; pos[j + 2] += vel[j + 2];
          }
          this._points.geometry.attributes.position.needsUpdate = true;
          if (exploding) {
            // camera dives forward through the particle field
            camera.position.z += (0.5 - camera.position.z) * Math.min(1, dt * 1.7);
            if (camera.position.z < 6) this._mat.opacity = Math.max(0, this._mat.opacity - dt * 1.4);
          }
        }
        if (this._dust) {
          this._dust.rotation.y = t * 0.012;
          this._dust.position.y = Math.sin(t * 0.18) * 0.5;
          this._dust.material.opacity = 0.45 + Math.sin(t * 0.9) * 0.15;
        }
        if (this._streaks) {
          for (let i = 0; i < this._streakN; i++) {
            this._streakPos[i * 3 + 1] += this._streakVel[i] * dt;
            if (this._streakPos[i * 3 + 1] > 17) {
              this._streakPos[i * 3 + 1] = -17;
              this._streakPos[i * 3] = (Math.random() - 0.5) * 42;
            }
          }
          this._streaks.geometry.attributes.position.needsUpdate = true;
        }
        if (this._orb) {
          const a = t * 0.7;
          this._orb.position.set(Math.cos(a) * 8.6, Math.sin(a * 1.7) * 2.2, Math.sin(a) * 2.5);
          this._orb.material.opacity = 0.65 + Math.sin(t * 3) * 0.25;
        }
        for (let i = this._rings.length - 1; i >= 0; i--) {
          const r = this._rings[i];
          r.life += dt;
          const s = 1 + r.life * 14;
          r.mesh.scale.set(s, s, s);
          r.mesh.material.opacity = Math.max(0, 0.85 - r.life * 1.4);
          if (r.life > 0.7) { scene.remove(r.mesh); this._rings.splice(i, 1); }
        }
        renderer.render(scene, camera);
      };
      loop();
    }
  }

  customElements.define('mong-gate', MongGate);
})();
