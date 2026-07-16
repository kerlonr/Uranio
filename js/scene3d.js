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
    bombBlend: 0, // 0 = cena do átomo · 1 = cena de Hiroshima
    bombT: 0,     // linha do tempo da detonação (0→1)
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

  // ============================================================
  //  HIROSHIMA — cogumelo nuclear (tudo função pura de bombT)
  // ============================================================
  const GROUND_Y = -3.2;
  const DET = 0.1; // instante da detonação em bombT
  const boom = new THREE.Group();
  boom.visible = false;
  scene.add(boom);

  // chão escuro para dar horizonte
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x0b120e, transparent: true, opacity: 0 });
  const groundMesh = new THREE.Mesh(new THREE.CircleGeometry(70, 48), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = GROUND_Y;
  boom.add(groundMesh);

  // clarão no marco zero
  const boomFlash = makeGlowSprite(0xfff3cf, 1);
  boomFlash.material.opacity = 0;
  boomFlash.position.set(0, GROUND_Y + 1.2, 0);
  boom.add(boomFlash);

  // onda de choque rasteira
  const shockMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), shockMat);
  shock.rotation.x = -Math.PI / 2;
  shock.position.y = GROUND_Y + 0.06;
  boom.add(shock);

  // nuvem de pontos genérica
  function makeCloud(count, size, baseColor, additive) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const v = 0.75 + Math.random() * 0.45; // variação de tom por ponto
      c.set(baseColor).multiplyScalar(v);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size, map: softGlow, vertexColors: true, transparent: true, opacity: 0,
      depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const cloud = new THREE.Points(geo, mat);
    boom.add(cloud);
    return cloud;
  }

  // sementes determinísticas por ponto
  const FIRE_N = isMobile ? 90 : 150;
  const fire = makeCloud(FIRE_N, 2.1, 0xffffff, true);
  const fireSeed = [];
  for (let i = 0; i < FIRE_N; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    fireSeed.push({
      dx: Math.sin(ph) * Math.cos(th), dy: Math.sin(ph) * Math.sin(th), dz: Math.cos(ph),
      r: 0.45 + Math.random() * 0.55, ph: Math.random() * Math.PI * 2,
    });
  }

  const SMOKE_N = isMobile ? 180 : 300;
  const smoke = makeCloud(SMOKE_N, 2.6, 0x4a423c, false);
  const smokeSeed = [];
  for (let i = 0; i < SMOKE_N; i++) {
    const isCap = i > SMOKE_N * 0.34; // 1/3 tronco, 2/3 chapéu
    smokeSeed.push({
      isCap,
      a: Math.random() * Math.PI * 2,       // ângulo em volta do eixo
      v: Math.random() * Math.PI * 2,       // posição no "rolo" do chapéu
      yf: Math.random(),                    // fração de altura no tronco
      j: 0.6 + Math.random() * 0.8,         // jitter
      ph: Math.random() * Math.PI * 2,
    });
  }

  function updateBoom(bt) {
    const active = state.bombBlend > 0.004;
    boom.visible = active;
    if (!active) return;

    groundMat.opacity = 0.9 * state.bombBlend;

    const boomAppear = smooth(DET - 0.02, DET + 0.04, bt);
    const riseY = GROUND_Y + 1.4 + smooth(DET, 0.9, bt) * 12.5; // centro da bola de fogo

    // bola de fogo: esfera de pontos que sobe e incha; cor esfria com o tempo
    const fireR = 0.4 + smooth(DET, 0.55, bt) * 3.1 + smooth(0.55, 1, bt) * 1.3;
    const fpos = fire.geometry.attributes.position;
    for (let i = 0; i < FIRE_N; i++) {
      const s = fireSeed[i];
      const wob = 1 + Math.sin(elapsed * 1.7 + s.ph) * 0.12;
      fpos.setXYZ(i,
        s.dx * fireR * s.r * wob,
        riseY + s.dy * fireR * s.r * 0.85 * wob,
        s.dz * fireR * s.r * wob);
    }
    fpos.needsUpdate = true;
    const heat = 1 - smooth(0.45, 0.95, bt) * 0.75;
    fire.material.color.setRGB(1, 0.45 + 0.55 * heat, 0.18 + 0.5 * heat * heat);
    fire.material.opacity = boomAppear * (0.35 + 0.65 * heat);

    // fumaça: tronco em coluna + chapéu em rolo toroidal
    const spos = smoke.geometry.attributes.position;
    const capR = 1.1 + smooth(0.32, 1, bt) * 4.6;   // raio do chapéu
    const roll = smooth(0.32, 1, bt) * 2.4;          // rotação do rolo
    const stemTop = riseY - 0.6;
    for (let i = 0; i < SMOKE_N; i++) {
      const s = smokeSeed[i];
      if (s.isCap) {
        const mr = (0.9 + 0.7 * Math.sin(s.ph)) * (0.5 + smooth(0.32, 1, bt));
        const rr = capR + mr * Math.cos(s.v + roll);
        spos.setXYZ(i,
          rr * Math.cos(s.a) * s.j,
          riseY + 0.5 + mr * Math.sin(s.v + roll) * 0.75,
          rr * Math.sin(s.a) * s.j);
      } else {
        const y = GROUND_Y + 0.4 + s.yf * Math.max(stemTop - GROUND_Y, 0.5);
        const taper = 0.8 + 1.3 * Math.pow(s.yf, 1.6); // coluna alarga no topo
        const swirl = s.a + elapsed * 0.12 + s.yf * 2.2;
        spos.setXYZ(i,
          Math.cos(swirl) * taper * s.j * smooth(DET, 0.5, bt),
          y,
          Math.sin(swirl) * taper * s.j * smooth(DET, 0.5, bt));
      }
    }
    spos.needsUpdate = true;
    smoke.material.opacity = smooth(DET + 0.03, DET + 0.3, bt) * 0.92;
    const glow2 = 0.35 * heat; // o fogo ilumina a fumaça por baixo no começo
    smoke.material.color.setRGB(0.62 + glow2, 0.5 + glow2 * 0.6, 0.42 + glow2 * 0.25);

    // onda de choque
    const sw = smooth(DET, 0.62, bt) * 48 + 0.001;
    shock.scale.set(sw, sw, 1);
    shockMat.opacity = bt > DET ? 0.8 * (1 - smooth(0.3, 0.62, bt)) : 0;

    // clarão no marco zero
    const fl = Math.exp(-Math.pow((bt - DET) / 0.04, 2));
    boomFlash.material.opacity = fl;
    boomFlash.scale.setScalar(2 + fl * 34);
  }

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
    const bb = clamp01(st.bombBlend);
    // telas estreitas (celular em pé) precisam de câmera mais afastada
    const aspectComp = camera.aspect < 0.75 ? 1.55 : camera.aspect < 1.1 ? 1.28 : 1;
    let radius = lerp(baseRadius, st.cineRadius, b) * aspectComp;
    let height = lerp(baseHeight, st.cineHeight, b);
    let angle = lerp(baseAngle, st.cineAngle, b);

    // Hiroshima: plano aberto, câmera baixa olhando o horizonte
    radius = lerp(radius, 30 * aspectComp, bb);
    height = lerp(height, 1.6, bb);
    angle = lerp(angle, 0.35 + drift * 0.3, bb);
    const lookY = lerp(0, 4.6, bb);

    // tremor de câmera na onda de choque
    const shake = Math.exp(-Math.pow((st.bombT - DET - 0.03) / 0.07, 2)) * 0.55 * bb;
    camera.position.set(
      radius * Math.sin(angle) + Math.sin(elapsed * 53) * shake,
      height + Math.cos(elapsed * 67) * shake * 0.7,
      radius * Math.cos(angle));
    camera.lookAt(0, lookY, 0);

    // opacidade global da cena (fica discreta atrás do texto)
    const fade = clamp01(1 - 0.87 * st.calm + b + bb);
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

    // troca de cena: o átomo sai quando a bomba entra
    // (por último, para vencer os blocos acima que também mexem em .visible)
    if (bb >= 0.6) {
      nucleus.visible = false;
      orbits.visible = false;
      projectile.visible = false;
      flash.visible = false;
      released.forEach((n) => { n.visible = false; });
    } else {
      nucleus.visible = true;
      flash.visible = true;
    }
    updateBoom(st.bombT);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);

  return { state };
})();
