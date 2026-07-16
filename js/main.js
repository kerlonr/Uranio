/* ============================================================
   Urânio (U) — site educativo · SETREM
   Interações e simulações (JS puro, sem dependências)
   ============================================================ */

// ---------- Navegação ----------
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 30);
});

navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') navLinks.classList.remove('open');
});

// ---------- Animação de entrada (reveal on scroll) ----------
const revealTargets = document.querySelectorAll(
  '.section h2, .section-kicker, .lead, .prop-card, .isotope-card, .app-card, ' +
  '.bigtech-card, .brasil-stat, .flip-card, .timeline-item, .fission-step, ' +
  '.card, .curiosidade-box, .destaque-box, .element-tile, .pros, .cons, .intel-story'
);
revealTargets.forEach((el, i) => {
  el.classList.add('reveal');
  el.style.transitionDelay = `${(i % 6) * 60}ms`;
});
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
revealTargets.forEach((el) => revealObserver.observe(el));

// ---------- Contadores animados ----------
function animateCount(el, target, decimals = 0, duration = 1600) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (target * eased).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Hero
const heroCounters = [
  [document.getElementById('statEnergia'), 200, 0],
  [document.getElementById('statDensidade'), 19.05, 2],
  [document.getElementById('statReatores'), 440, 0],
];
const heroObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    heroCounters.forEach(([el, val, dec]) => animateCount(el, val, dec));
    heroObserver.disconnect();
  }
}, { threshold: 0.3 });
heroObserver.observe(document.querySelector('.hero-stats'));

// Brasil
const brasilObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target;
      animateCount(el, parseFloat(el.dataset.count), 0);
      brasilObserver.unobserve(el);
    }
  });
}, { threshold: 0.4 });
document.querySelectorAll('.brasil-stat strong').forEach((el) => brasilObserver.observe(el));

// ---------- Demo de densidade ----------
const materials = {
  agua:   { peso: '1,0 kg',  label: 'H₂O', bg: 'linear-gradient(145deg, #2e6da8, #163a5e)', scale: 1,
            desc: 'Um litro de água: a referência. 1 kg por cubo de 10 cm.' },
  ferro:  { peso: '7,9 kg',  label: 'Fe',  bg: 'linear-gradient(145deg, #8a8f96, #4a4f55)', scale: 1,
            desc: 'Quase 8× mais denso que a água — o metal do dia a dia.' },
  chumbo: { peso: '11,3 kg', label: 'Pb',  bg: 'linear-gradient(145deg, #6b7280, #33383f)', scale: 1,
            desc: 'Famoso por ser pesado... mas ainda longe do urânio.' },
  uranio: { peso: '19,0 kg', label: 'U',   bg: 'linear-gradient(145deg, #2f9e63, #14532d)', scale: 1.08,
            desc: 'Quase o dobro do chumbo! Por isso o urânio empobrecido é usado como contrapeso em aeronaves e blindagem.' },
};
const densityCube = document.getElementById('densityCube');
const densityCubeLabel = document.getElementById('densityCubeLabel');
const densityWeight = document.getElementById('densityWeight');
const densityDesc = document.getElementById('densityDesc');

document.getElementById('densityButtons').addEventListener('click', (e) => {
  const btn = e.target.closest('.density-btn');
  if (!btn) return;
  document.querySelectorAll('.density-btn').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const m = materials[btn.dataset.material];
  densityCube.style.background = m.bg;
  densityCube.style.transform = `scale(${m.scale})`;
  densityCube.style.boxShadow = btn.dataset.material === 'uranio' ? '0 0 40px rgba(63,220,140,0.4)' : 'none';
  densityCubeLabel.textContent = m.label;
  densityWeight.textContent = m.peso;
  densityDesc.textContent = m.desc;
});

// ============================================================
// SIMULADOR DE FISSÃO EM CADEIA
// ============================================================
(() => {
  const canvas = document.getElementById('fissionCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const fissionCountEl = document.getElementById('fissionCount');
  const energyCountEl = document.getElementById('energyCount');
  const neutronCountEl = document.getElementById('neutronCount');
  const rodSlider = document.getElementById('controlRods');
  const rodValue = document.getElementById('rodValue');

  const NUCLEUS_R = 13;
  const NEUTRON_R = 3.5;
  const MAX_NEUTRONS = 260;

  let nuclei = [];
  let neutrons = [];
  let flashes = [];
  let fragments = [];
  let fissions = 0;
  let energy = 0;

  // 3 barras de controle verticais entre as colunas de núcleos
  const rodXs = [W * 0.32, W * 0.55, W * 0.78];
  const ROD_W = 12;

  function buildNuclei() {
    nuclei = [];
    const cols = 9, rows = 5;
    const x0 = 110, x1 = W - 50, y0 = 55, y1 = H - 55;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        nuclei.push({
          x: x0 + (c / (cols - 1)) * (x1 - x0) + (Math.random() - 0.5) * 14,
          y: y0 + (r / (rows - 1)) * (y1 - y0) + (Math.random() - 0.5) * 12,
          alive: true,
          fade: 1,
        });
      }
    }
  }

  function reset() {
    buildNuclei();
    neutrons = [];
    flashes = [];
    fragments = [];
    fissions = 0;
    energy = 0;
    updateStats();
  }

  function updateStats() {
    fissionCountEl.textContent = fissions;
    energyCountEl.textContent = (fissions * 200).toLocaleString('pt-BR');
    neutronCountEl.textContent = neutrons.length;
  }

  function spawnNeutron(x, y, angle, speed) {
    if (neutrons.length >= MAX_NEUTRONS) return;
    neutrons.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }

  function fire(y = null) {
    const yy = y ?? 60 + Math.random() * (H - 120);
    spawnNeutron(14, yy, (Math.random() - 0.5) * 0.35, 3.2);
  }

  document.getElementById('fireNeutron').addEventListener('click', () => fire());
  document.getElementById('resetFission').addEventListener('click', reset);
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    fire(((e.clientY - rect.top) / rect.height) * H);
  });
  rodSlider.addEventListener('input', () => {
    rodValue.textContent = `${rodSlider.value}%`;
  });

  function step() {
    const rodDepth = (rodSlider.value / 100) * H; // profundidade das barras

    // move nêutrons
    for (let i = neutrons.length - 1; i >= 0; i--) {
      const n = neutrons[i];
      n.x += n.vx;
      n.y += n.vy;

      // quica nas paredes de cima/baixo
      if (n.y < NEUTRON_R || n.y > H - NEUTRON_R) n.vy *= -1;

      // sai pelos lados
      if (n.x < -10 || n.x > W + 10) { neutrons.splice(i, 1); continue; }

      // absorção pelas barras de controle
      let absorbed = false;
      for (const rx of rodXs) {
        if (Math.abs(n.x - rx) < ROD_W / 2 + NEUTRON_R && n.y < rodDepth) {
          flashes.push({ x: n.x, y: n.y, r: 2, max: 10, color: '160,170,180' });
          neutrons.splice(i, 1);
          absorbed = true;
          break;
        }
      }
      if (absorbed) continue;

      // colisão com núcleos
      for (const nu of nuclei) {
        if (!nu.alive) continue;
        const dx = n.x - nu.x, dy = n.y - nu.y;
        if (dx * dx + dy * dy < (NUCLEUS_R + NEUTRON_R) ** 2) {
          nu.alive = false;
          fissions++;
          energy += 200;
          flashes.push({ x: nu.x, y: nu.y, r: 4, max: 34, color: '63,220,140' });
          // fragmentos (Ba / Kr)
          const fa = Math.random() * Math.PI * 2;
          fragments.push(
            { x: nu.x, y: nu.y, vx: Math.cos(fa) * 1.6, vy: Math.sin(fa) * 1.6, life: 1 },
            { x: nu.x, y: nu.y, vx: -Math.cos(fa) * 1.6, vy: -Math.sin(fa) * 1.6, life: 1 }
          );
          // 2 a 3 novos nêutrons
          const count = 2 + (Math.random() < 0.5 ? 1 : 0);
          for (let k = 0; k < count; k++) {
            spawnNeutron(nu.x, nu.y, Math.random() * Math.PI * 2, 2.6 + Math.random() * 1.2);
          }
          neutrons.splice(i, 1);
          break;
        }
      }
    }

    // fragmentos e flashes decaem
    fragments.forEach((f) => { f.x += f.vx; f.y += f.vy; f.life -= 0.03; });
    fragments = fragments.filter((f) => f.life > 0);
    flashes.forEach((fl) => { fl.r += 2.2; });
    flashes = flashes.filter((fl) => fl.r < fl.max);

    updateStats();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const rodDepth = (rodSlider.value / 100) * H;

    // barras de controle
    for (const rx of rodXs) {
      // guia da barra
      ctx.fillStyle = 'rgba(154,179,165,0.07)';
      ctx.fillRect(rx - ROD_W / 2, 0, ROD_W, H);
      // barra inserida
      if (rodDepth > 2) {
        const grad = ctx.createLinearGradient(rx - ROD_W / 2, 0, rx + ROD_W / 2, 0);
        grad.addColorStop(0, '#5a6570');
        grad.addColorStop(0.5, '#8a95a0');
        grad.addColorStop(1, '#5a6570');
        ctx.fillStyle = grad;
        ctx.fillRect(rx - ROD_W / 2, 0, ROD_W, rodDepth);
      }
    }

    // núcleos
    for (const nu of nuclei) {
      if (!nu.alive) {
        if (nu.fade > 0) {
          nu.fade -= 0.04;
          ctx.globalAlpha = Math.max(nu.fade, 0) * 0.35;
          ctx.beginPath();
          ctx.arc(nu.x, nu.y, NUCLEUS_R, 0, Math.PI * 2);
          ctx.strokeStyle = '#3fdc8c';
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        continue;
      }
      const g = ctx.createRadialGradient(nu.x - 4, nu.y - 4, 2, nu.x, nu.y, NUCLEUS_R);
      g.addColorStop(0, '#6dedb0');
      g.addColorStop(1, '#14532d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nu.x, nu.y, NUCLEUS_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '700 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('U-235', nu.x, nu.y);
    }

    // fragmentos
    for (const f of fragments) {
      ctx.globalAlpha = f.life;
      ctx.fillStyle = '#ff9d47';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // flashes de energia
    for (const fl of flashes) {
      ctx.strokeStyle = `rgba(${fl.color}, ${1 - fl.r / fl.max})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // nêutrons
    for (const n of neutrons) {
      ctx.fillStyle = '#e6efe9';
      ctx.shadowColor = '#e6efe9';
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(n.x, n.y, NEUTRON_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // legenda
    ctx.fillStyle = 'rgba(154,179,165,0.55)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('dica: clique em qualquer ponto para disparar um nêutron', 12, H - 12);
  }

  function loop() {
    step();
    draw();
    requestAnimationFrame(loop);
  }

  reset();
  loop();
})();

// ============================================================
// SIMULADOR DE MEIA-VIDA
// ============================================================
(() => {
  const TOTAL = 128;
  const grid = document.getElementById('atomsGrid');
  const chart = document.getElementById('halflifeChart');
  const cctx = chart.getContext('2d');
  const atomsLeftEl = document.getElementById('atomsLeft');

  let atoms = [];
  let history = [];

  function build() {
    grid.innerHTML = '';
    atoms = [];
    for (let i = 0; i < TOTAL; i++) {
      const d = document.createElement('div');
      d.className = 'atom-dot';
      grid.appendChild(d);
      atoms.push({ el: d, alive: true });
    }
    history = [TOTAL];
    atomsLeftEl.textContent = TOTAL;
    drawChart();
  }

  function decayStep() {
    let alive = 0;
    atoms.forEach((a) => {
      if (!a.alive) return;
      if (Math.random() < 0.5) {
        a.alive = false;
        a.el.classList.add('decayed');
      } else {
        alive++;
      }
    });
    history.push(alive);
    atomsLeftEl.textContent = alive;
    drawChart();
  }

  function drawChart() {
    const W = chart.width, H = chart.height;
    const pad = { l: 40, r: 12, t: 16, b: 30 };
    cctx.clearRect(0, 0, W, H);

    const n = Math.max(history.length, 8);
    const plotW = W - pad.l - pad.r;
    const plotH = H - pad.t - pad.b;

    // eixos
    cctx.strokeStyle = 'rgba(154,179,165,0.3)';
    cctx.beginPath();
    cctx.moveTo(pad.l, pad.t);
    cctx.lineTo(pad.l, H - pad.b);
    cctx.lineTo(W - pad.r, H - pad.b);
    cctx.stroke();

    cctx.fillStyle = 'rgba(154,179,165,0.7)';
    cctx.font = '10px system-ui, sans-serif';
    cctx.textAlign = 'right';
    [0, 32, 64, 96, 128].forEach((v) => {
      const y = H - pad.b - (v / TOTAL) * plotH;
      cctx.fillText(v, pad.l - 6, y + 3);
      cctx.strokeStyle = 'rgba(154,179,165,0.1)';
      cctx.beginPath();
      cctx.moveTo(pad.l, y);
      cctx.lineTo(W - pad.r, y);
      cctx.stroke();
    });

    // curva teórica N = N0 · (1/2)^t
    cctx.strokeStyle = 'rgba(255,157,71,0.5)';
    cctx.setLineDash([4, 4]);
    cctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const t = (px / plotW) * (n - 1);
      const v = TOTAL * Math.pow(0.5, t);
      const x = pad.l + px;
      const y = H - pad.b - (v / TOTAL) * plotH;
      px === 0 ? cctx.moveTo(x, y) : cctx.lineTo(x, y);
    }
    cctx.stroke();
    cctx.setLineDash([]);

    // barras medidas
    const barW = Math.min(plotW / n * 0.55, 34);
    history.forEach((v, i) => {
      const x = pad.l + (i / (n - 1)) * plotW - barW / 2;
      const h = (v / TOTAL) * plotH;
      const grad = cctx.createLinearGradient(0, H - pad.b - h, 0, H - pad.b);
      grad.addColorStop(0, '#3fdc8c');
      grad.addColorStop(1, '#1b7a43');
      cctx.fillStyle = grad;
      cctx.beginPath();
      cctx.roundRect(Math.max(x, pad.l), H - pad.b - h, barW, h, 3);
      cctx.fill();
      cctx.fillStyle = 'rgba(230,239,233,0.85)';
      cctx.textAlign = 'center';
      cctx.fillText(v, Math.max(x, pad.l) + barW / 2, H - pad.b - h - 5);
    });

    cctx.fillStyle = 'rgba(154,179,165,0.7)';
    cctx.textAlign = 'center';
    cctx.fillText('meias-vidas →', pad.l + plotW / 2, H - 8);
    cctx.textAlign = 'left';
    cctx.fillStyle = 'rgba(255,157,71,0.8)';
    cctx.fillText('- - curva teórica', W - 105, pad.t + 4);
  }

  document.getElementById('decayStep').addEventListener('click', decayStep);
  document.getElementById('resetDecay').addEventListener('click', build);
  build();
})();

// ---------- Comparador de pastilhas ----------
(() => {
  const slider = document.getElementById('pelletSlider');
  const num = document.getElementById('pelletNum');
  const word = document.getElementById('pelletWord');
  const fmt = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  function update() {
    const n = parseInt(slider.value, 10);
    num.textContent = n;
    word.textContent = n === 1 ? 'pastilha' : 'pastilhas';
    document.getElementById('eqOil').textContent = fmt(n * 3);
    document.getElementById('eqCoal').textContent = fmt(n * 1);
    document.getElementById('eqWood').textContent = fmt(n * 1.5);
  }
  slider.addEventListener('input', update);
  update();
})();

// ---------- Ciclo do combustível ----------
(() => {
  const cycle = document.getElementById('cycle');
  const info = document.getElementById('cycleInfo');
  cycle.addEventListener('click', (e) => {
    const btn = e.target.closest('.cycle-step');
    if (!btn) return;
    cycle.querySelectorAll('.cycle-step').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    info.textContent = btn.dataset.info;
  });
})();

// ---------- Demo de bit flip (soft error) ----------
(() => {
  const row = document.getElementById('bitsRow');
  const msg = document.getElementById('bitflipMsg');
  const byteEl = document.getElementById('byteValue');
  const original = [0, 1, 1, 0, 1, 0, 0, 1];
  let bits = [];

  function render() {
    row.innerHTML = '';
    bits.forEach((b, i) => {
      const d = document.createElement('div');
      d.className = 'bit' + (b !== original[i] ? ' flipped' : '');
      d.textContent = b;
      row.appendChild(d);
    });
    const flipped = bits.some((b, i) => b !== original[i]);
    byteEl.textContent = bits.join('');
    msg.classList.toggle('error', flipped);
    msg.innerHTML = flipped
      ? '⚠️ <em>Soft error!</em> Um bit foi invertido pela partícula alfa — o valor armazenado mudou: <strong>' + bits.join('') + '</strong>'
      : 'Memória íntegra. Valor armazenado: <strong>' + bits.join('') + '</strong>';
  }

  document.getElementById('alphaBtn').addEventListener('click', () => {
    const i = Math.floor(Math.random() * 8);
    bits[i] = bits[i] === 0 ? 1 : 0;
    render();
  });
  document.getElementById('eccBtn').addEventListener('click', () => {
    bits = [...original];
    render();
    msg.innerHTML = '🛡️ A memória <strong>ECC</strong> detectou e corrigiu o erro automaticamente — exatamente o que os servidores fazem desde o caso Intel.';
  });

  bits = [...original];
  render();
})();

// ---------- Flip cards ----------
document.querySelectorAll('.flip-card').forEach((card) => {
  card.addEventListener('click', () => card.classList.toggle('flipped'));
});

// ============================================================
// QUIZ
// ============================================================
(() => {
  const questions = [
    {
      q: 'Qual isótopo do urânio é físsil — o "combustível" de fato dos reatores?',
      options: ['U-238', 'U-235', 'U-234', 'U-232'],
      answer: 1,
      why: 'O U-235 é o único isótopo natural físsil, mas representa apenas 0,72% do urânio natural — por isso o combustível precisa ser enriquecido.',
    },
    {
      q: 'Quem descobriu o urânio, em 1789?',
      options: ['Henri Becquerel', 'Marie Curie', 'Martin Heinrich Klaproth', 'Ernest Rutherford'],
      answer: 2,
      why: 'Klaproth o descobriu em 1789 e o batizou em homenagem ao planeta Urano. A radioatividade só seria descoberta 107 anos depois, por Becquerel.',
    },
    {
      q: 'Quanta energia libera, aproximadamente, cada fissão de um núcleo de U-235?',
      options: ['2 eV', '200 MeV', '200 J', '2 kWh'],
      answer: 1,
      why: 'Cada fissão libera ~200 MeV — milhões de vezes mais que uma reação química, pois parte da massa vira energia (E = mc²).',
    },
    {
      q: 'O que aconteceu em Oklo, no Gabão, há cerca de 2 bilhões de anos?',
      options: [
        'Caiu o meteoro que trouxe urânio à Terra',
        'Um depósito natural de urânio funcionou sozinho como reator nuclear',
        'Foi construída a primeira mina de urânio',
        'Formou-se o maior cristal de uraninita do mundo',
      ],
      answer: 1,
      why: 'A água subterrânea agiu como moderador e o depósito operou como reator natural por centenas de milhares de anos — 16 zonas de reação!',
    },
    {
      q: 'Por que memórias de servidores usam ECC (correção de erros) até hoje?',
      options: [
        'Para acelerar a leitura dos dados',
        'Por causa dos soft errors — como os causados por urânio no encapsulamento de chips em 1978',
        'Para economizar energia',
        'Para aumentar a capacidade de armazenamento',
      ],
      answer: 1,
      why: 'O caso Intel (1978) mostrou que partículas alfa podiam inverter bits. Isso impulsionou as memórias ECC e os materiais "low-alpha".',
    },
    {
      q: 'Qual é a única mina de urânio ativa do Brasil?',
      options: ['Santa Quitéria (CE)', 'Resende (RJ)', 'Caetité (BA)', 'Angra dos Reis (RJ)'],
      answer: 2,
      why: 'Caetité (BA), operada pela INB, com ~74 mil toneladas de reservas. Santa Quitéria (CE) é um projeto futuro; Resende (RJ) faz o enriquecimento.',
    },
    {
      q: 'Uma pastilha de urânio enriquecido (~6 g) equivale a quantos barris de petróleo?',
      options: ['3 barris', '30 barris', 'Meio barril', '300 barris'],
      answer: 0,
      why: 'Segundo a INB: 3 barris de petróleo, 1 tonelada de carvão ou 1,5 tonelada de lenha — a maior densidade energética comercial que existe.',
    },
    {
      q: 'Por que as big techs (Microsoft, Google, Amazon, Meta) estão contratando energia nuclear?',
      options: [
        'Porque é a energia mais barata do mercado',
        'Para minerar urânio nos data centers',
        'Porque data centers de IA precisam de energia contínua, densa e de baixo carbono',
        'Por exigência dos governos',
      ],
      answer: 2,
      why: 'Data centers funcionam 24/7 — o perfil perfeito para a energia nuclear: contínua (independe do clima), densa e praticamente sem emissão de CO₂.',
    },
  ];

  let current = 0;
  let score = 0;
  let answered = false;

  const countEl = document.getElementById('quizCount');
  const questionEl = document.getElementById('quizQuestion');
  const optionsEl = document.getElementById('quizOptions');
  const feedbackEl = document.getElementById('quizFeedback');
  const nextBtn = document.getElementById('quizNext');
  const progressEl = document.getElementById('quizProgress');
  const bodyEl = document.getElementById('quizBody');
  const resultEl = document.getElementById('quizResult');

  function show() {
    const q = questions[current];
    answered = false;
    countEl.textContent = `Pergunta ${current + 1} de ${questions.length}`;
    questionEl.textContent = q.q;
    feedbackEl.textContent = '';
    nextBtn.hidden = true;
    progressEl.style.width = `${(current / questions.length) * 100}%`;
    optionsEl.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt;
      btn.addEventListener('click', () => pick(btn, i));
      optionsEl.appendChild(btn);
    });
  }

  function pick(btn, i) {
    if (answered) return;
    answered = true;
    const q = questions[current];
    const buttons = optionsEl.querySelectorAll('.quiz-option');
    buttons.forEach((b) => (b.disabled = true));
    buttons[q.answer].classList.add('correct');
    if (i === q.answer) {
      score++;
      feedbackEl.innerHTML = `✅ <strong>Correto!</strong> ${q.why}`;
    } else {
      btn.classList.add('wrong');
      feedbackEl.innerHTML = `❌ <strong>Não foi dessa vez.</strong> ${q.why}`;
    }
    nextBtn.hidden = false;
    nextBtn.textContent = current === questions.length - 1 ? 'Ver resultado →' : 'Próxima →';
  }

  function finish() {
    progressEl.style.width = '100%';
    bodyEl.hidden = true;
    resultEl.hidden = false;
    document.getElementById('quizScore').textContent = `${score}/${questions.length}`;
    const pct = score / questions.length;
    let verdict;
    if (pct === 1) verdict = '☢️ Perfeito! Você domina o urânio como um engenheiro nuclear.';
    else if (pct >= 0.75) verdict = '🌟 Excelente! Você entendeu muito bem o elemento 92.';
    else if (pct >= 0.5) verdict = '👍 Bom resultado — vale revisar as seções acima para fechar as lacunas.';
    else verdict = '📖 Que tal explorar o site de novo? As respostas estão todas aqui.';
    document.getElementById('quizVerdict').textContent = verdict;
  }

  nextBtn.addEventListener('click', () => {
    current++;
    current < questions.length ? show() : finish();
  });

  document.getElementById('quizRestart').addEventListener('click', () => {
    current = 0;
    score = 0;
    bodyEl.hidden = false;
    resultEl.hidden = true;
    show();
  });

  show();
})();
