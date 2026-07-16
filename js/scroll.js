/* ============================================================
   Urânio (U) — coreografia de scroll
   Lenis (scroll suave) + GSAP ScrollTrigger (cenas fixadas)
   Com fallback completo para prefers-reduced-motion e no-JS.
   ============================================================ */

(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  // ---------- navegação lateral (funciona mesmo sem GSAP) ----------
  const dots = document.getElementById('dots');
  const dotButtons = dots ? Array.from(dots.querySelectorAll('button')) : [];

  function scrollToTarget(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: -64, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }

  dotButtons.forEach((b) => b.addEventListener('click', () => scrollToTarget(b.dataset.target)));

  if (!hasGsap || reduced) {
    // sem animações: conteúdo já é visível por padrão; só liga os dots por IO
    const map = new Map(dotButtons.map((b) => [b.dataset.target, b]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          dotButtons.forEach((b) => b.classList.remove('active'));
          map.get(e.target.id)?.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    dotButtons.forEach((b) => {
      const sec = document.getElementById(b.dataset.target);
      if (sec) io.observe(sec);
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // ---------- Lenis: scroll suave com inércia ----------
  let lenis = null;
  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
      if (window.SFX) SFX.setScrollVelocity(lenis.velocity || 0);
    });
    gsap.ticker.lagSmoothing(0);

    // âncoras da navegação superior passam pelo Lenis
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href').slice(1);
        if (!id || !document.getElementById(id)) return;
        e.preventDefault();
        scrollToTarget(id);
      });
    });
  }

  // ---------- barra de progresso de leitura ----------
  gsap.to('#progressBar', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
  });

  // ---------- sequência de abertura do hero ----------
  // o título sobe inteiro por trás da máscara (uma peça só: quebrar em
  // letras com clip de gradiente renderiza bugado em vários navegadores)
  gsap.timeline()
    .from('.hero-eyebrow', { opacity: 0, y: 14, duration: 0.7, ease: 'power2.out' })
    .from('.hero-title', { yPercent: 108, duration: 1.05, ease: 'power4.out' }, 0.15)
    .from('.hero-sub', { opacity: 0, y: 18, duration: 0.7, ease: 'power2.out' }, 0.7)
    .from('.atom', { opacity: 0, scale: 0.6, duration: 0.9, ease: 'back.out(1.6)' }, 0.85)
    .from('.hero-stat', { opacity: 0, y: 22, stagger: 0.12, duration: 0.6, ease: 'power2.out' }, 1.05)
    .from('.hero-hint', { opacity: 0, duration: 0.8 }, 1.4);

  // ---------- hero fixado: dissolve cinematográfico ao rolar ----------
  const s3d = window.S3D; // cena 3D (null sem WebGL / com motion reduzido)

  const heroTl = gsap.timeline({
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: '+=65%',
      pin: true,
      scrub: 0.6,
    },
  })
    .to('.hero-title', { scale: 0.88, opacity: 0 }, 0)
    .to('.hero-eyebrow, .hero-sub, .hero-hint', { opacity: 0, y: -26 }, 0)
    .to('.hero-stats', { opacity: 0, y: -40 }, 0.05)
    .to('.atom', { scale: 2.6, opacity: 0 }, 0)
    .to('.hero-bg', { opacity: 0.25 }, 0);

  if (s3d) {
    // a câmera 3D mergulha no átomo junto com o dissolve do hero
    heroTl.to(s3d.state, { heroZoom: 1, ease: 'none' }, 0);

    // saindo do hero, o átomo vira pano de fundo discreto ("calm")
    gsap.fromTo(s3d.state, { calm: 0 }, {
      calm: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '#introducao',
        start: 'top 85%',
        end: 'top 30%',
        scrub: 0.4,
      },
    });

    // ---------- CINEMA: a fissão dirigida pelo scroll ----------
    const captions = gsap.utils.toArray('.cinema-caption');
    const hudCam = document.getElementById('hudCam');
    const hudLabel = document.getElementById('hudLabel');
    const shots = [
      { cam: 'CAM 01', label: 'APROXIMAÇÃO', radius: 8.5, height: 0.4, angle: 1.7 },
      { cam: 'CAM 02', label: 'CAPTURA', radius: 4.6, height: 0.9, angle: 2.9 },
      { cam: 'CAM 03', label: 'RUPTURA', radius: 7.2, height: 2.3, angle: 0.8 },
      { cam: 'CAM 04', label: 'REAÇÃO EM CADEIA', radius: 13.5, height: 1.4, angle: -0.6 },
    ];

    const cine = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: '#cinema',
        start: 'top top',
        end: '+=3200',
        pin: true,
        scrub: 0.5,
        onUpdate(self) {
          // HUD acompanha o "corte" atual (funciona nos dois sentidos)
          const i = Math.min(Math.floor(self.progress * 4), 3);
          if (hudCam.textContent !== shots[i].cam) {
            hudCam.textContent = shots[i].cam;
            hudLabel.textContent = shots[i].label;
            if (window.SFX) SFX.play('ui');
          }
        },
      },
    });

    // entrada no modo cinema + posição inicial da câmera
    gsap.set(s3d.state, {
      cineRadius: shots[0].radius,
      cineHeight: shots[0].height,
      cineAngle: shots[0].angle,
    });
    cine.to(s3d.state, { cineBlend: 1, duration: 0.35, ease: 'power2.out' }, 0);
    cine.to('#cinema .cinema-hud', { opacity: 1, duration: 0.3 }, 0.05);

    // a fissão avança linearmente por toda a sequência
    cine.to(s3d.state, { fissionT: 1, duration: 3.35, ease: 'none' }, 0.3);

    // cortes de câmera + legendas (1 unidade de timeline por plano)
    shots.forEach((shot, i) => {
      if (i > 0) {
        cine.to(s3d.state, {
          cineRadius: shot.radius,
          cineHeight: shot.height,
          cineAngle: shot.angle,
          duration: 0.22,
        }, i);
      }
      cine.fromTo(captions[i],
        { autoAlpha: 0, y: 34 },
        { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power3.out' },
        i + 0.12);
      cine.to(captions[i], { autoAlpha: 0, y: -22, duration: 0.22, ease: 'power2.in' }, i + 0.82);
    });

    // saída: volta ao modo pano de fundo
    cine.to('#cinema .cinema-hud', { opacity: 0, duration: 0.2 }, 3.75);
    cine.to(s3d.state, { cineBlend: 0, duration: 0.3, ease: 'power2.in' }, 3.72);

    // ---------- HIROSHIMA: a detonação dirigida pelo scroll ----------
    const bombCaps = gsap.utils.toArray('#bombaCinema .cinema-caption');
    let boomPlayed = false;
    const bomb = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: '#bombaCinema',
        start: 'top top',
        end: '+=3000',
        pin: true,
        scrub: 0.5,
        onUpdate(self) {
          // estrondo ao cruzar a detonação (uma vez por passagem)
          if (self.progress > 0.16 && !boomPlayed) {
            boomPlayed = true;
            if (window.SFX) SFX.play('boom');
          } else if (self.progress < 0.08) {
            boomPlayed = false;
          }
        },
      },
    });

    bomb.to(s3d.state, { bombBlend: 1, duration: 0.3, ease: 'power2.out' }, 0);
    bomb.to('#bombaCinema .cinema-hud', { opacity: 1, duration: 0.25 }, 0.05);

    // a detonação avança linearmente (DET = 0.1 acontece cedo)
    bomb.to(s3d.state, { bombT: 1, duration: 3.3, ease: 'none' }, 0.3);

    // clarão branco na tela no instante da detonação (bombT ≈ 0.1 → t ≈ 0.63)
    bomb.to('#nukeFlash', { opacity: 1, duration: 0.07, ease: 'power1.in' }, 0.56);
    bomb.to('#nukeFlash', { opacity: 0, duration: 0.5, ease: 'power2.out' }, 0.64);

    // legendas: três atos sobre a nuvem crescendo
    bombCaps.forEach((cap, i) => {
      const at = 1.0 + i * 0.95;
      bomb.fromTo(cap,
        { autoAlpha: 0, y: 34 },
        { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power3.out' }, at);
      bomb.to(cap, { autoAlpha: 0, y: -22, duration: 0.2, ease: 'power2.in' }, at + 0.72);
    });

    // saída: fumaça fica ao fundo e a página segue para a conclusão
    bomb.to('#bombaCinema .cinema-hud', { opacity: 0, duration: 0.2 }, 3.6);
    bomb.to(s3d.state, { bombBlend: 0.22, duration: 0.4, ease: 'power2.in' }, 3.6);
  }

  // ---------- partículas ambiente no hero (fallback 2D, sem WebGL) ----------
  (function particles() {
    if (document.body.classList.contains('webgl-on')) return; // a cena 3D cuida disso
    const canvas = document.getElementById('heroParticles');
    if (!canvas) return;
    const pctx = canvas.getContext('2d');
    let w, h, dpr;
    const motes = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 42; i++) {
      motes.push({
        x: Math.random(), y: Math.random(),
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.00025,
        vy: -0.0001 - Math.random() * 0.00035,
        a: 0.15 + Math.random() * 0.4,
        tw: Math.random() * Math.PI * 2,
      });
    }

    function frame(t) {
      pctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += m.vx; m.y += m.vy;
        if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;
        const alpha = m.a * (0.6 + 0.4 * Math.sin(t / 900 + m.tw));
        pctx.fillStyle = `rgba(63, 220, 140, ${alpha})`;
        pctx.beginPath();
        pctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        pctx.fill();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ---------- statements: palavras acendem com o scroll ----------
  document.querySelectorAll('.statement-text').forEach((el) => {
    const nodes = [];
    // envolve cada palavra em <span class="w">, preservando <em>
    function wrapWords(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (/^\s+$/.test(part) || part === '') {
            frag.appendChild(document.createTextNode(part));
          } else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
            nodes.push(s);
          }
        });
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(wrapWords);
      }
    }
    Array.from(el.childNodes).forEach(wrapWords);

    gsap.fromTo(nodes,
      { opacity: 0.13, y: 8 },
      {
        opacity: 1, y: 0,
        stagger: 0.06,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top 78%',
          end: 'top 30%',
          scrub: 0.4,
        },
      });
  });

  // ---------- entradas de seção ----------
  gsap.utils.toArray('.section .section-kicker, .section h2').forEach((el) => {
    gsap.from(el, {
      y: 30, opacity: 0, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });

  // grades: cards entram em cascata
  gsap.utils.toArray(
    '.props-grid, .isotope-grid, .apps-grid, .bigtech-grid, .brasil-stats, .flip-grid, .pellet-equivs, .videos-grid, .intel-grid'
  ).forEach((grid) => {
    gsap.from(grid.children, {
      y: 42, opacity: 0, duration: 0.75, stagger: 0.08, ease: 'power3.out',
      scrollTrigger: { trigger: grid, start: 'top 84%' },
    });
  });

  // blocos isolados
  gsap.utils.toArray('.card, .curiosidade-box, .destaque-box, .element-tile, .pros, .cons, .intel-story, .cycle')
    .forEach((el) => {
      gsap.from(el, {
        y: 46, opacity: 0, duration: 0.85, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%' },
      });
    });

  // barras de isótopos crescem quando aparecem
  gsap.utils.toArray('.isotope-fill').forEach((bar) => {
    gsap.from(bar, {
      scaleX: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: bar, start: 'top 88%' },
    });
  });

  const mm = gsap.matchMedia();

  const webglOn = document.body.classList.contains('webgl-on');

  mm.add('(min-width: 900px)', () => {
    // ---------- linha do tempo horizontal fixada ----------
    const track = document.getElementById('tlTrack');
    if (track) {
      const getDistance = () => Math.max(track.scrollWidth - document.documentElement.clientWidth, 0);
      gsap.to(track, {
        x: () => -getDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.tl-section',
          start: 'top top',
          end: () => '+=' + (getDistance() + 300),
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      });
    }

    // ---------- etapas da fissão (fallback sem WebGL): acendem fixadas ----------
    const steps = webglOn ? [] : gsap.utils.toArray('#fissionSteps .fission-step');
    if (steps.length) {
      gsap.set(steps, { opacity: 0.3 });
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '#fissionSteps',
          start: 'center center',
          end: '+=900',
          pin: true,
          scrub: 0.5,
        },
      });
      steps.forEach((s, i) => {
        tl.to(s, {
          opacity: 1,
          duration: 1,
          onStart: () => s.classList.add('lit'),
          onReverseComplete: () => s.classList.remove('lit'),
        }, i);
        tl.to('#fissionProgress', { width: `${((i + 1) / steps.length) * 100}%`, duration: 1 }, i);
      });
      // respiro no final para o leitor absorver
      tl.to({}, { duration: 0.6 });
    }
  });

  mm.add('(max-width: 899px)', () => {
    // no celular (fallback sem WebGL): etapas acendem ao entrar na tela
    if (webglOn) return;
    gsap.utils.toArray('#fissionSteps .fission-step').forEach((s) => {
      ScrollTrigger.create({
        trigger: s,
        start: 'top 78%',
        onEnter: () => s.classList.add('lit'),
      });
    });
  });

  // ---------- dots ativos por seção ----------
  dotButtons.forEach((b) => {
    const sec = document.getElementById(b.dataset.target);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec,
      start: 'top center',
      end: 'bottom center',
      onToggle: (self) => {
        if (self.isActive) {
          dotButtons.forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
        }
      },
    });
  });

  // os pins são criados fora da ordem do documento (cinema antes do pin da
  // timeline); sem o sort, o ScrollTrigger acumula errado os espaçadores de pin
  ScrollTrigger.sort();
  ScrollTrigger.refresh();

  // recalcula depois que fontes carregam (alturas mudam)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();
