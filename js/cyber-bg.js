/* cyber-bg — Three.js animated 3D background web component
   Variants: "void" (floating abstract shapes + 3D logo, camera flies with scroll)
             "sword" (neon grid floor + wuxia sword rotating with scroll)        */
(function () {
  if (customElements.get('cyber-bg')) return;

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

  function glowCanvas(rgb) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(' + rgb + ',0.85)');
    grad.addColorStop(0.35, 'rgba(' + rgb + ',0.25)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  function logoTexture(THREE, text, glow) {
    const c = document.createElement('canvas');
    c.width = 2048; c.height = 512;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = '700 240px "Chakra Petch", "Be Vietnam Pro", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = glow;
    g.shadowBlur = 60;
    g.fillStyle = 'rgba(234,246,255,0.95)';
    g.fillText(text, 1024, 285);
    g.shadowBlur = 0;
    g.strokeStyle = glow;
    g.lineWidth = 3;
    g.strokeText(text, 1024, 285);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  class CyberBg extends HTMLElement {
    connectedCallback() {
      this.style.display = 'block';
      // fill the mount wrapper — otherwise the host can end up 0px tall
      this.style.position = 'absolute';
      this.style.inset = '0';
      this.style.width = '100%';
      this.style.height = '100%';
      this._dead = false;
      this._mouse = { x: 0, y: 0 };
      this._onMouse = (e) => {
        this._mouse.x = (e.clientX / innerWidth) * 2 - 1;
        this._mouse.y = (e.clientY / innerHeight) * 2 - 1;
      };
      addEventListener('mousemove', this._onMouse, { passive: true });
      loadThree().then((THREE) => { if (!this._dead) this._init(THREE); });
    }

    disconnectedCallback() {
      this._dead = true;
      removeEventListener('mousemove', this._onMouse);
      if (this._raf) cancelAnimationFrame(this._raf);
      removeEventListener('resize', this._onResize);
      if (this._renderer) { this._renderer.dispose(); this._renderer.forceContextLoss && this._renderer.forceContextLoss(); }
    }

    _scrollP() {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      return Math.min(1, Math.max(0, scrollY / max));
    }

    _speed() {
      const v = parseFloat(this.getAttribute('speed'));
      return isNaN(v) ? 1 : v;
    }

    _init(THREE) {
      const variant = this.getAttribute('variant') || 'void';
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      renderer.setSize(innerWidth, innerHeight);
      renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(renderer.domElement);
      this._renderer = renderer;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
      this._scene = scene; this._camera = camera;

      this._onResize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
      };
      addEventListener('resize', this._onResize);

      if (variant === 'sword') this._buildSword(THREE);
      else if (variant === 'dream') this._buildDream(THREE);
      else this._buildVoid(THREE);

      const clock = new THREE.Clock();
      const loop = () => {
        if (this._dead) return;
        this._raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        this._tick(THREE, dt, clock.elapsedTime * this._speed(), this._scrollP());
        renderer.render(scene, camera);
      };
      loop();
    }

    /* ── Variant A: floating abstract shapes, camera fly ─────────────── */
    _buildVoid(THREE) {
      const scene = this._scene, camera = this._camera;
      scene.fog = new THREE.FogExp2(0x05060e, 0.032);
      camera.position.set(0, 0, 9);

      scene.add(new THREE.AmbientLight(0x223, 1.4));
      const l1 = new THREE.PointLight(0x00e5ff, 2.2, 60);
      const l2 = new THREE.PointLight(0xb44cff, 2.4, 60);
      scene.add(l1, l2);
      this._lights = [l1, l2];

      const geos = [
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.OctahedronGeometry(1, 0),
        new THREE.TorusKnotGeometry(0.7, 0.22, 90, 12),
        new THREE.TorusGeometry(0.9, 0.16, 12, 40),
        new THREE.TetrahedronGeometry(1, 0),
      ];
      const solidMat = new THREE.MeshStandardMaterial({
        color: 0x0b1224, metalness: 0.92, roughness: 0.22,
        emissive: 0x061423, emissiveIntensity: 0.7,
      });
      this._shapes = [];
      for (let i = 0; i < 34; i++) {
        const geo = geos[i % geos.length];
        const grp = new THREE.Group();
        const mesh = new THREE.Mesh(geo, solidMat);
        const edgeColor = i % 3 === 0 ? 0xb44cff : 0x00e5ff;
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo, 20),
          new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.55 })
        );
        grp.add(mesh, edges);
        const s = 0.5 + Math.random() * 1.5;
        grp.scale.setScalar(s);
        grp.position.set(
          (Math.random() - 0.5) * 22,
          (Math.random() - 0.5) * 14,
          4 - Math.random() * 95
        );
        // keep a corridor clear in the hero framing
        if (Math.abs(grp.position.x) < 3 && grp.position.z > -8) grp.position.x += grp.position.x < 0 ? -3.5 : 3.5;
        grp.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        grp.userData = {
          rx: (Math.random() - 0.5) * 0.5,
          ry: (Math.random() - 0.5) * 0.6,
          bob: Math.random() * 6.28,
          bobAmp: 0.2 + Math.random() * 0.5,
          y0: grp.position.y,
        };
        scene.add(grp);
        this._shapes.push(grp);
      }

      // glow sprites
      const glowTexC = new THREE.CanvasTexture(glowCanvas('0,229,255'));
      const glowTexM = new THREE.CanvasTexture(glowCanvas('180,76,255'));
      for (let i = 0; i < 16; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: i % 2 ? glowTexM : glowTexC,
          blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5,
        }));
        sp.scale.setScalar(2 + Math.random() * 5);
        sp.position.set((Math.random() - 0.5) * 26, (Math.random() - 0.5) * 16, 2 - Math.random() * 95);
        scene.add(sp);
      }

      // floating 3D logo plane (canvas texture supports Vietnamese diacritics)
      const logoText = this.getAttribute('logo') || 'NHẤT MỘNG';
      const addLogo = () => {
        if (this._dead) return;
        const tex = logoTexture(THREE, logoText, '#00e5ff');
        const mat = new THREE.MeshBasicMaterial({
          map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9,
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), mat);
        plane.position.set(0, 0.4, -26);
        scene.add(plane);
        const plane2 = plane.clone();
        plane2.position.set(0, -1, -70);
        plane2.scale.setScalar(1.6);
        scene.add(plane2);
        this._logos = [plane, plane2];
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(addLogo);
      else addLogo();

      this._variant = 'void';
    }

    /* ── Variant B: neon grid + wuxia sword ──────────────────────────── */
    _buildSword(THREE) {
      const scene = this._scene, camera = this._camera;
      scene.fog = new THREE.FogExp2(0x08050e, 0.03);
      camera.position.set(0, 0.6, 9);

      scene.add(new THREE.AmbientLight(0x332244, 1.6));
      const l1 = new THREE.PointLight(0xff3df2, 2.6, 50);
      l1.position.set(4, 4, 6);
      const l2 = new THREE.PointLight(0x00e5ff, 2.0, 50);
      l2.position.set(-5, -2, 4);
      scene.add(l1, l2);
      this._lights = [l1, l2];

      // twin infinite grids
      const gridA = new THREE.GridHelper(240, 96, 0xff3df2, 0x2a1140);
      gridA.position.y = -4.2;
      const gridB = new THREE.GridHelper(240, 96, 0x00e5ff, 0x101c33);
      gridB.position.y = 7.5;
      gridB.material.transparent = gridA.material.transparent = true;
      gridB.material.opacity = 0.35; gridA.material.opacity = 0.7;
      scene.add(gridA, gridB);
      this._grids = [gridA, gridB];

      // ── sword built from primitives ──
      const sword = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: 0xcfd8ea, metalness: 1, roughness: 0.18 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x131322, metalness: 0.8, roughness: 0.35 });
      const gold = new THREE.MeshStandardMaterial({ color: 0x8a6b2f, metalness: 1, roughness: 0.3, emissive: 0x2a1e08, emissiveIntensity: 0.6 });

      // blade: diamond cross-section (4-sided cylinder), tapers to tip
      const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.17, 4.6, 4, 1), steel);
      blade.scale.z = 0.32;
      blade.position.y = 2.75;
      // neon edge core
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.05, 4.55, 4, 1),
        new THREE.MeshBasicMaterial({ color: 0xff3df2 })
      );
      core.scale.z = 1.9; core.position.y = 2.75;
      // guard
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.2), gold);
      guard.position.y = 0.42;
      const guard2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), gold);
      guard2.rotation.set(0.785, 0, 0.785);
      guard2.position.y = 0.42;
      // handle + pommel
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.95, 10), dark);
      handle.position.y = -0.12;
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), gold);
      pommel.position.y = -0.65;
      // tassel hint: small emissive bead chain
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
      bead.position.set(0, -0.85, 0);
      sword.add(blade, core, guard, guard2, handle, pommel, bead);
      sword.position.set(0, 0.4, 0);
      scene.add(sword);
      this._sword = sword;

      // blade glow sprite
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(glowCanvas('255,61,242')),
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
      }));
      glow.scale.set(5, 8, 1);
      glow.position.copy(sword.position);
      glow.position.y += 2;
      scene.add(glow);

      // drifting shards
      this._shapes = [];
      const shardGeo = new THREE.TetrahedronGeometry(1, 0);
      for (let i = 0; i < 26; i++) {
        const edgeColor = i % 3 === 0 ? 0x00e5ff : 0xff3df2;
        const grp = new THREE.Group();
        grp.add(
          new THREE.Mesh(shardGeo, new THREE.MeshStandardMaterial({ color: 0x140a20, metalness: 0.9, roughness: 0.3 })),
          new THREE.LineSegments(new THREE.EdgesGeometry(shardGeo), new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.6 }))
        );
        grp.scale.setScalar(0.15 + Math.random() * 0.5);
        grp.position.set((Math.random() - 0.5) * 26, -3 + Math.random() * 10, -4 - Math.random() * 40);
        grp.userData = { ry: (Math.random() - 0.5), rx: (Math.random() - 0.5) * 0.6, bob: Math.random() * 6.28, bobAmp: 0.3 + Math.random() * 0.6, y0: grp.position.y };
        scene.add(grp);
        this._shapes.push(grp);
      }

      this._variant = 'sword';
    }

    /* ── Variant C: dream — particle wave sea + neon rings corridor ───── */
    _buildDream(THREE) {
      const scene = this._scene, camera = this._camera;
      scene.fog = new THREE.FogExp2(0x070510, 0.028);
      camera.position.set(0, 1.2, 9);

      scene.add(new THREE.AmbientLight(0x2a2244, 1.6));
      const l1 = new THREE.PointLight(0x00e5ff, 2.2, 70);
      const l2 = new THREE.PointLight(0xb44cff, 2.6, 70);
      scene.add(l1, l2);
      this._lights = [l1, l2];

      // ── particle wave sea (floor) ──
      {
        const cols = 110, rows = 52, sx = 0.85, sz = 1.9;
        const n = cols * rows;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        let k = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            pos[k * 3] = (c - cols / 2) * sx;
            pos[k * 3 + 1] = -4.2;
            pos[k * 3 + 2] = 6 - r * sz;
            const tt = c / cols;
            col[k * 3] = 0.1 + tt * 0.6;
            col[k * 3 + 1] = 0.75 - tt * 0.45;
            col[k * 3 + 2] = 1.0;
            k++;
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this._wave = new THREE.Points(geo, new THREE.PointsMaterial({
          size: 0.07, vertexColors: true, transparent: true, opacity: 0.75,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        scene.add(this._wave);
        this._wavePos = pos;
        this._waveDims = { cols, rows };
        // mirrored ceiling, fainter
        this._waveTop = this._wave.clone();
        this._waveTop.material = this._wave.material.clone();
        this._waveTop.material.opacity = 0.22;
        this._waveTop.position.y = 12.5;
        scene.add(this._waveTop);
      }

      // ── neon ring corridor ──
      this._ringsBg = [];
      for (let i = 0; i < 9; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(5.2 + (i % 3) * 0.7, 0.025, 8, 72),
          new THREE.MeshBasicMaterial({ color: i % 2 ? 0xb44cff : 0x00e5ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
        );
        ring.position.set(0, 1.4, -4 - i * 11);
        ring.userData = { rz: (Math.random() - 0.5) * 0.3, base: ring.position.z };
        scene.add(ring);
        this._ringsBg.push(ring);
      }

      // ── few floating wireframe shapes for depth ──
      this._shapes = [];
      const geos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TorusKnotGeometry(0.7, 0.2, 70, 10)];
      for (let i = 0; i < 14; i++) {
        const geo = geos[i % geos.length];
        const grp = new THREE.Group();
        grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), new THREE.LineBasicMaterial({ color: i % 3 === 0 ? 0x00e5ff : 0xb44cff, transparent: true, opacity: 0.5 })));
        grp.scale.setScalar(0.6 + Math.random() * 1.3);
        grp.position.set((Math.random() - 0.5) * 24, -1 + Math.random() * 8, 0 - Math.random() * 90);
        if (Math.abs(grp.position.x) < 4) grp.position.x += grp.position.x < 0 ? -4 : 4;
        grp.userData = { rx: (Math.random() - 0.5) * 0.4, ry: (Math.random() - 0.5) * 0.5, bob: Math.random() * 6.28, bobAmp: 0.25 + Math.random() * 0.45, y0: grp.position.y };
        scene.add(grp);
        this._shapes.push(grp);
      }

      // glow sprites
      const glowTexC = new THREE.CanvasTexture(glowCanvas('0,229,255'));
      const glowTexM = new THREE.CanvasTexture(glowCanvas('180,76,255'));
      for (let i = 0; i < 12; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: i % 2 ? glowTexM : glowTexC, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
        sp.scale.setScalar(2.5 + Math.random() * 5);
        sp.position.set((Math.random() - 0.5) * 28, 6 - Math.random() * 12, -2 - Math.random() * 85);
        scene.add(sp);
      }

      // ── comets streaking across ──
      this._comets = [];
      {
        const tex = new THREE.CanvasTexture(glowCanvas('180,240,255'));
        for (let i = 0; i < 7; i++) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
          }));
          sp.scale.set(3.4, 0.16, 1);
          sp.material.rotation = -0.5;
          scene.add(sp);
          this._comets.push({ sp, vx: 0, vy: 0, life: 99, wait: Math.random() * 5 });
        }
      }

      // ── vertical aurora beams ──
      this._beams = [];
      {
        const bc = document.createElement('canvas');
        bc.width = 64; bc.height = 256;
        const bg = bc.getContext('2d');
        const gr = bg.createLinearGradient(0, 0, 64, 0);
        gr.addColorStop(0, 'rgba(0,229,255,0)');
        gr.addColorStop(0.5, 'rgba(120,140,255,0.5)');
        gr.addColorStop(1, 'rgba(180,76,255,0)');
        bg.fillStyle = gr;
        bg.fillRect(0, 0, 64, 256);
        const btex = new THREE.CanvasTexture(bc);
        for (let i = 0; i < 5; i++) {
          const beam = new THREE.Mesh(
            new THREE.PlaneGeometry(2.2, 26),
            new THREE.MeshBasicMaterial({ map: btex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
          );
          beam.position.set((Math.random() - 0.5) * 30, 6, -10 - i * 17);
          beam.userData = { ph: Math.random() * 6.28, x0: beam.position.x };
          scene.add(beam);
          this._beams.push(beam);
        }
      }

      // floating logo
      const logoText = this.getAttribute('logo') || 'NHẤT MỘNG';
      const addLogo = () => {
        if (this._dead) return;
        const tex = logoTexture(THREE, logoText, '#b44cff');
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), mat);
        plane.position.set(0, 2.2, -30);
        scene.add(plane);
        const plane2 = plane.clone();
        plane2.position.set(0, 1.4, -74);
        plane2.scale.setScalar(1.7);
        scene.add(plane2);
        this._logos = [plane, plane2];
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(addLogo);
      else addLogo();

      this._variant = 'dream';
    }

    _tick(THREE, dt, t, p) {
      const cam = this._camera, m = this._mouse;
      if (this._shapes) {
        for (const s of this._shapes) {
          s.rotation.y += s.userData.ry * dt;
          s.rotation.x += s.userData.rx * dt;
          s.position.y = s.userData.y0 + Math.sin(t * 0.7 + s.userData.bob) * s.userData.bobAmp;
        }
      }
      if (this._variant === 'dream') {
        // animate wave sea
        const { cols, rows } = this._waveDims;
        const pos = this._wavePos;
        let k = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            pos[k * 3 + 1] = -4.2 + Math.sin(c * 0.22 + t * 1.1) * 0.55 + Math.cos(r * 0.4 + t * 0.8) * 0.45;
            k++;
          }
        }
        this._wave.geometry.attributes.position.needsUpdate = true;
        this._waveTop.geometry = this._wave.geometry;
        // rings pulse + slow roll
        for (const ring of this._ringsBg) {
          ring.rotation.z += ring.userData.rz * dt;
          const s = 1 + Math.sin(t * 1.4 + ring.userData.base) * 0.03;
          ring.scale.set(s, s, 1);
        }
        // comets: wait → streak → respawn
        for (const c of this._comets) {
          if (c.wait > 0) { c.wait -= dt; continue; }
          if (c.life > 1.6) {
            c.sp.position.set(-16 + Math.random() * -8, 2 + Math.random() * 8, cam.position.z - 18 - Math.random() * 30);
            const ang = -0.25 - Math.random() * 0.35;
            const speed = 18 + Math.random() * 14;
            c.vx = Math.cos(ang) * speed; c.vy = Math.sin(ang) * speed;
            c.sp.material.rotation = ang;
            c.life = 0;
            c.wait = 0;
          }
          c.life += dt;
          c.sp.position.x += c.vx * dt;
          c.sp.position.y += c.vy * dt;
          c.sp.material.opacity = Math.sin(Math.min(1, c.life / 1.6) * Math.PI) * 0.75;
          if (c.life > 1.6) c.wait = 1.5 + Math.random() * 4;
        }
        // aurora beams sway + pulse
        for (const b of this._beams) {
          b.position.x = b.userData.x0 + Math.sin(t * 0.3 + b.userData.ph) * 2.4;
          b.material.opacity = 0.1 + (Math.sin(t * 0.7 + b.userData.ph) + 1) * 0.06;
        }
        // camera flies down the corridor with scroll
        const targetZ = 9 - p * 80;
        cam.position.z += (targetZ - cam.position.z) * Math.min(1, dt * 4);
        cam.position.x += (m.x * 1.5 - cam.position.x) * Math.min(1, dt * 3);
        cam.position.y += (1.2 - m.y * 1.1 + Math.sin(p * 3.14) * 1.4 - cam.position.y) * Math.min(1, dt * 3);
        cam.rotation.z = Math.sin(p * 6.28) * 0.05;
        this._lights[0].position.set(Math.sin(t * 0.5) * 9, 5, cam.position.z - 8);
        this._lights[1].position.set(Math.cos(t * 0.45) * -9, -2, cam.position.z - 12);
        if (this._logos) {
          for (const l of this._logos) {
            l.rotation.y = Math.sin(t * 0.35) * 0.14 + m.x * 0.1;
            l.rotation.x = m.y * 0.06;
          }
        }
      } else if (this._variant === 'void') {
        // camera flies down the corridor with scroll
        const targetZ = 9 - p * 78;
        cam.position.z += (targetZ - cam.position.z) * Math.min(1, dt * 4);
        cam.position.x += (m.x * 1.4 - cam.position.x) * Math.min(1, dt * 3);
        cam.position.y += (-m.y * 1.0 - cam.position.y) * Math.min(1, dt * 3);
        cam.rotation.z = Math.sin(p * 6.28) * 0.04;
        this._lights[0].position.set(Math.sin(t * 0.6) * 8, 4, cam.position.z - 6);
        this._lights[1].position.set(Math.cos(t * 0.5) * -8, -3, cam.position.z - 10);
        if (this._logos) {
          for (const l of this._logos) {
            l.rotation.y = Math.sin(t * 0.4) * 0.12 + m.x * 0.1;
            l.rotation.x = m.y * 0.06;
          }
        }
      } else {
        // grids stream past, sword rotates with scroll
        const sp = this._speed();
        for (const g of this._grids) {
          g.position.z = (t * 2.2) % 2.5;
        }
        if (this._sword) {
          this._sword.rotation.y = p * Math.PI * 4 + t * 0.15;
          this._sword.rotation.z = Math.sin(p * Math.PI * 2) * 0.35;
          this._sword.position.y = 0.4 + Math.sin(t * 0.8) * 0.25 - p * 1.2;
        }
        cam.position.x += (m.x * 1.2 - cam.position.x) * Math.min(1, dt * 3);
        cam.position.y += (0.6 - m.y * 0.8 + p * 0.8 - cam.position.y) * Math.min(1, dt * 3);
        cam.lookAt(0, 0.8 - p, 0);
        this._lights[0].intensity = 2.6 + Math.sin(t * 2.2) * 0.5;
      }
    }
  }

  customElements.define('cyber-bg', CyberBg);
})();
