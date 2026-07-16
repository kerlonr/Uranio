/* ============================================================
   Urânio (U) — motor de som
   Contador Geiger + efeitos de interface, 100% sintetizados
   com Web Audio API (nenhum arquivo de áudio necessário).
   Desligado por padrão; o usuário ativa no botão "SOM".
   ============================================================ */

window.SFX = (() => {
  let ctx = null;
  let master = null;
  let enabled = false;
  let geigerTimer = null;
  let scrollBoost = 0; // aumenta a taxa de cliques conforme a velocidade do scroll

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ---------- clique de Geiger: estalo curto de ruído filtrado ----------
  let noiseBuffer = null;
  function getNoise() {
    if (!noiseBuffer) {
      const len = Math.floor(ctx.sampleRate * 0.03);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function geigerTick(vol = 1) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200 + Math.random() * 1800;
    bp.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + 0.05);
  }

  // ---------- blip de interface: osciladores curtos ----------
  function tone(freq, dur = 0.08, vol = 0.14, type = 'triangle', when = 0) {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // estrondo grave da detonação: subgrave + rajada de ruído filtrado
  function boom() {
    if (!enabled || !ctx) return;
    const t = ctx.currentTime;
    // subgrave descendente
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 1.8);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(0.55, t + 0.04);
    og.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    osc.connect(og).connect(master);
    osc.start(t);
    osc.stop(t + 2.5);
    // rajada de ruído grave (o "rugido")
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 1.6);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 2);
    src.connect(lp).connect(ng).connect(master);
    src.start(t);
  }

  const sounds = {
    ui:      () => tone(420, 0.06, 0.08),
    fission: () => { geigerTick(0.9); tone(190 + Math.random() * 60, 0.1, 0.06, 'sawtooth'); },
    tick:    () => geigerTick(1),
    alpha:   () => { geigerTick(1); tone(140, 0.18, 0.12, 'sawtooth'); },
    good:    () => { tone(523, 0.1, 0.12); tone(784, 0.14, 0.12, 'triangle', 0.09); },
    bad:     () => { tone(300, 0.12, 0.12); tone(210, 0.18, 0.12, 'triangle', 0.1); },
    boom,
  };

  let lastPlay = {};
  function play(name) {
    if (!enabled || !ctx) return;
    const now = performance.now();
    if (now - (lastPlay[name] || 0) < 45) return; // não satura
    lastPlay[name] = now;
    (sounds[name] || sounds.ui)();
  }

  // ---------- radiação de fundo: processo de Poisson ----------
  // taxa base baixa (radiação ambiente) que "crepita" com o scroll
  function scheduleGeiger() {
    if (!enabled) return;
    const rate = 0.7 + scrollBoost * 22; // cliques por segundo
    const dt = -Math.log(1 - Math.random()) / rate; // intervalo exponencial
    geigerTimer = setTimeout(() => {
      geigerTick(0.4 + Math.random() * 0.5);
      scheduleGeiger();
    }, Math.max(dt * 1000, 18));
  }

  function setScrollVelocity(v) {
    // v em px/frame; normaliza para 0..1
    scrollBoost = Math.min(Math.abs(v) / 60, 1);
  }

  function setEnabled(on) {
    enabled = on;
    if (on) {
      if (!ensureCtx()) { enabled = false; return false; }
      clearTimeout(geigerTimer);
      if (!reduced) scheduleGeiger();
      play('ui');
    } else {
      clearTimeout(geigerTimer);
    }
    try { localStorage.setItem('uranio-som', on ? '1' : '0'); } catch (e) { /* modo privado */ }
    return enabled;
  }

  // ---------- botão de toggle ----------
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('soundToggle');
    const label = document.getElementById('soundLabel');
    if (!btn) return;

    function refresh() {
      btn.classList.toggle('on', enabled);
      btn.setAttribute('aria-pressed', String(enabled));
      label.textContent = enabled ? 'SOM ON' : 'SOM OFF';
      btn.title = enabled
        ? 'Desativar som'
        : 'Ativar som (contador Geiger reage ao seu scroll)';
    }

    btn.addEventListener('click', () => {
      setEnabled(!enabled);
      refresh();
    });

    // som exige gesto do usuário; apenas lembramos a preferência visualmente
    let saved = null;
    try { saved = localStorage.getItem('uranio-som'); } catch (e) { /* ignore */ }
    if (saved === '1') {
      label.textContent = 'SOM?';
      btn.title = 'Você usou som da última vez — clique para reativar';
    }
    refresh();
    if (saved === '1') label.textContent = 'SOM?';

    // blips sutis em elementos interativos
    document.addEventListener('click', (e) => {
      if (!enabled) return;
      if (e.target.closest('.btn, .cycle-step, .density-btn, .flip-card, .dots button, .nav-links a')) {
        play('ui');
      }
    });
  });

  return { play, setScrollVelocity, isEnabled: () => enabled };
})();
