/* ============================================================
   Urânio (U) — cena 3D (Three.js)
   Um átomo de U-235 em WebGL atrás do conteúdo. O scroll dirige
   a câmera (dolly, cortes) e a sequência da fissão. Toda a
   animação é função pura do estado — o scroll pode ir e voltar.

   Estado (tweenado pelo scroll.js):
     heroZoom  0→1  câmera mergulha no átomo durante o hero
     calm      0→1  átomo vira pano de fundo discreto (seções de texto)
     cineBlend 0→1  modo cinema: câmera passa para os "cortes"
     cineRadius/cineHeight/cineAngle  posição da câmera no cinema
     fissionT  0→1  linha do tempo da fissão (nêutron → cadeia)
   ============================================================ */

window.S3D = (() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('webgl');
  if (!canvas || !window.THREE || reduced) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null; // sem WebGL: os fallbacks em CSS/DOM assumem
  }

  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);

  document.body.classList.add('webgl-on');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);

  const state = {
    heroZoom: 0,
    calm: 0,
    cineBlend: 0,
    cineRadius: 8,
    cineHeight: 0.4,
    cineAngle: 1.7,
    fissionT: 0,
  };

  // ---------- utilidades ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const smooth = (a, b, t) => {
    const x = clamp01((t - a) / (b - a));
    return x * x * (3 - 2 * x);
  };

  function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.5)'));
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const softGlow = glowTexture();

  function makeGlowSprite(color, scale) {
    const mat = new THREE.SpriteMaterial({
      map: softGlow, color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(scale);
    return s;
  }

  // ---------- luzes ----------
  scene.add(new THREE.AmbientLight(0x3a5548, 1.1));
  const key = new THREE.DirectionalLight(0xd8ffe9, 1.15);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x3fdc8c, 1.6, 30);
  rim.position.set(-5, -2, -4);
  scene.add(rim);

  // ---------- núcleo: dois fragmentos de núcleons ----------
  const seg = isMobile ? 10 : 16;
  const protonMat = new THREE.MeshStandardMaterial({
    color: 0x2fae6d, roughness: 0.35, metalness: 0.25, emissive: 0x0d3a22,
  });
  const neutronMat = new THREE.MeshStandardMaterial({
    color: 0x9aa8a0, roughness: 0.5, metalness: 0.3, emissive: 0x141a17,
  });
  const nucleonGeo = new THREE.SphereGeometry(0.3, seg, seg);

  const fragA = new THREE.Group();
  const fragB = new THREE.Group();
  const nucleus = new THREE.Group();
  nucleus.add(fragA, fragB);
  scene.add(nucleus);

  // empacota ~64 núcleons numa bola; x<0 vai para o fragmento A
  (function packNucleus() {
    const N = 64;
    for (let i = 0; i < N; i++) {
      // distribuição razoavelmente uniforme dentro da esfera
      const r = Math.cbrt(Math.random()) * 1.05;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(ph) * Math.cos(th);
      const y = r * Math.sin(ph) * Math.sin(th);
      const z = r * Math.cos(ph);
      const m = new THREE.Mesh(nucleonGeo, Math.random() < 0.44 ? protonMat : neutronMat);
      m.position.set(x, y, z);
      (x < 0 ? fragA : fragB).add(m);
    }
  })();

  const coreGlow = makeGlowSprite(0x3fdc8c, 6.5);
  nucleus.add(coreGlow);

  // brilhos dos fragmentos (aparecem na ruptura)
  const glowA = makeGlowSprite(0xffb066, 4.2);
  const glowB = makeGlowSprite(0xffb066, 4.2);
  glowA.material.opacity = 0;
  glowB.material.opacity = 0;
  fragA.add(glowA);
  fragB.add(glowB);

  // ---------- elétrons: 3 órbitas elípticas ----------
  const orbits = new THREE.Group();
  const electronSprites = [];
  const orbitLineMats = [];
  [[0, 0], [Math.PI / 3, 0.4], [-Math.PI / 3, -0.4]].forEach(([rz, rx], i) => {
    const curve = new THREE.EllipseCurve(0, 0, 4.6, 1.9, 0, Math.PI * 2);
    const pts = curve.getPoints(120);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x9ab3a5, transparent: true, opacity: 0.28 });
    orbitLineMats.push(mat);
    const ring = new THREE.LineLoop(geo, mat);
    const holder = new THREE.Group();
    holder.add(ring);
    const e = makeGlowSprite(0x3fdc8c, 0.85);
    holder.add(e);
    holder.rotation.set(rx, 0, rz);
    holder.userData = { curve, speed: 0.55 + i * 0.18, phase: i * 2.1 };
    electronSprites.push({ holder, sprite: e });
    orbits.add(holder);
  });
  scene.add(orbits);

  // ---------- nêutron incidente + trilha ----------
  const projMat = new THREE.MeshStandardMaterial({ color: 0xe6efe9, roughness: 0.4, metalness: 0.2, emissive: 0x333333 });
  const projectile = new THREE.Mesh(new THREE.SphereGeometry(0.22, seg, seg), projMat);
  const projGlow = makeGlowSprite(0xffffff, 1.6);
  projectile.add(projGlow);
  scene.add(projectile);

  // ---------- flash da ruptura ----------
  const flash = makeGlowSprite(0xd9ffe9, 1);
  flash.material.opacity = 0;
  scene.add(flash);

  // ---------- nêutrons liberados ----------
  const released = [];
  const relDirs = [
    new THREE.Vector3(0.2, 0.9, 0.35).normalize(),
    new THREE.Vector3(0.5, -0.75, -0.4).normalize(),
    new THREE.Vector3(-0.15, 0.25, 0.95).normalize(),
  ];
  relDirs.forEach(() => {
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.2, seg, seg), projMat);
    n.add(makeGlowSprite(0xffffff, 1.3));
    n.visible = false;
    scene.add(n);
    released.push(n);
  });

  // ---------- poeira ambiente ----------
  const dustCount = isMobile ? 220 : 420;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 46;
    dustPos[i * 3 + 1] = (Math.random() - 0.5) * 30;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 46;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: softGlow, color: 0x3fdc8c, size: 0.32, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(dust);

  // ---------- direções da separação dos fragmentos ----------
  const splitDir = new THREE.Vector3(1, 0.22, -0.1).normalize();

  // ---------- render loop ----------
  const clock = new THREE.Clock();
  let elapsed = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }
  window.addEventListener('resize', resize);

  function render() {
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    resize();

    const st = state;
    const t = st.fissionT;

    // ----- câmera: base (hero/fundo) misturada com os cortes do cinema -----
    const drift = Math.sin(elapsed * 0.12) * 0.3;
    const baseRadius = 11.5 - 4.2 * st.heroZoom + 5 * st.calm;
    const baseHeight = 0.7 - 0.4 * st.heroZoom + 1.6 * st.calm;
    const baseAngle = 0.55 * st.heroZoom + drift;

    const b = clamp01(st.cineBlend);
    // telas estreitas (celular em pé) precisam de câmera mais afastada
    const aspectComp = camera.aspect < 0.75 ? 1.55 : camera.aspect < 1.1 ? 1.28 : 1;
    const radius = lerp(baseRadius, st.cineRadius, b) * aspectComp;
    const height = lerp(baseHeight, st.cineHeight, b);
    const angle = lerp(baseAngle, st.cineAngle, b);

    camera.position.set(radius * Math.sin(angle), height, radius * Math.cos(angle));
    camera.lookAt(0, 0, 0);

    // opacidade global da cena (fica discreta atrás do texto)
    const fade = clamp01(1 - 0.87 * st.calm + b);
    canvas.style.opacity = fade.toFixed(3);

    // ----- átomo em repouso -----
    nucleus.rotation.y += dt * 0.25 * (1 - t);
    nucleus.rotation.x = Math.sin(elapsed * 0.3) * 0.06 * (1 - t);

    // elétrons percorrem as órbitas; somem durante a fissão
    // (visible=false de verdade: opacity 0 ainda deixa artefatos em algumas GPUs)
    const eOpacity = clamp01(1 - t * 2.4);
    orbits.visible = eOpacity > 0.02;
    if (orbits.visible) {
      electronSprites.forEach(({ holder, sprite }, i) => {
        const u = (elapsed * holder.userData.speed + holder.userData.phase) % 1;
        const p = holder.userData.curve.getPoint(u < 0 ? u + 1 : u);
        sprite.position.set(p.x, p.y, 0);
        sprite.material.opacity = 0.9 * eOpacity;
        orbitLineMats[i].opacity = 0.28 * eOpacity;
      });
    }

    // ----- linha do tempo da fissão (determinística) -----
    // 0.00–0.30 aproximação do nêutron
    // 0.30–0.50 captura: núcleo instável vibra
    // 0.50–0.60 ruptura + flash
    // 0.55–1.00 fragmentos se afastam, nêutrons escapam
    const approach = smooth(0.0, 0.3, t);
    projectile.visible = t < 0.31 && t > 0.001;
    if (projectile.visible) {
      const d = lerp(14, 1.15, approach);
      projectile.position.set(-d * 0.94, d * 0.18, d * 0.3);
      projGlow.material.opacity = 0.9;
    }

    const wobble = t > 0.3 && t < 0.52 ? Math.sin(elapsed * 34) * 0.09 * smooth(0.3, 0.42, t) : 0;
    // deforma antes de romper e relaxa de volta na ruptura
    const stretch = 1 + smooth(0.42, 0.52, t) * 0.35 * (1 - smooth(0.52, 0.62, t));
    nucleus.scale.set(1 + wobble + (stretch - 1), 1 + wobble * 0.6, 1 + wobble);

    const sep = smooth(0.52, 1, t) * 5.6;
    fragA.position.copy(splitDir).multiplyScalar(-sep);
    fragB.position.copy(splitDir).multiplyScalar(sep);
    fragA.rotation.z = sep * 0.35;
    fragB.rotation.z = -sep * 0.3;

    const fragGlow = smooth(0.52, 0.62, t) * (1 - smooth(0.85, 1, t) * 0.5);
    glowA.material.opacity = fragGlow * 0.8;
    glowB.material.opacity = fragGlow * 0.8;
    coreGlow.material.opacity = 0.55 * (1 - smooth(0.5, 0.6, t));

    // flash gaussiano no instante da ruptura
    const fl = Math.exp(-Math.pow((t - 0.545) / 0.05, 2));
    flash.material.opacity = fl * 0.95;
    flash.scale.setScalar(1 + fl * 11);

    // nêutrons liberados
    const out = smooth(0.55, 1, t);
    released.forEach((n, i) => {
      n.visible = t > 0.56;
      if (n.visible) {
        n.position.copy(relDirs[i]).multiplyScalar(out * (9 + i * 2.5));
      }
    });

    // poeira sobe lentamente
    const pos = dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      let y = pos.getY(i) + dt * 0.22;
      if (y > 15) y = -15;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);

  return { state };
})();
