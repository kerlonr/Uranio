# Urânio (U) — Site Educativo

Experiência interativa de scroll baseada no relatório de Química sobre o urânio
(SETREM — Engenharia de Computação). Estilo: escuro, minimalista, cinematográfico.

## Como abrir

Basta abrir o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge).
Funciona **offline** — bibliotecas e fontes estão salvas localmente. Só os vídeos do
YouTube precisam de internet.

No WSL/Linux:

```bash
# opção 1: abrir direto no navegador do Windows (WSL)
explorer.exe index.html

# opção 2: servir localmente
python3 -m http.server 8000
# e acessar http://localhost:8000
```

## A experiência

- **Cena 3D em tempo real (Three.js)**: um átomo de U-235 em WebGL vive atrás de todo o
  conteúdo. O scroll dirige a câmera — dolly no hero, "modo pano de fundo" nas seções de
  texto e o momento principal: a **sequência cinematográfica da fissão**, com 4 cortes de
  câmera (CAM 01 → CAM 04), HUD de filmagem e legendas sincronizadas, tudo controlado
  pelo scroll (estilo página dos AirPods da Apple).
- **Hiroshima, 1945**: no fim da página, uma sequência de detonação completa dirigida pelo
  scroll — clarão, onda de choque, tremor de câmera, bola de fogo e o cogumelo se formando
  em partículas — com legendas históricas (64 kg de urânio, 15 quilotons, <1 g de massa
  convertida) que amarram no contraste com o reator controlado.
- **Scroll suave com inércia** (Lenis) + **cenas guiadas pelo scroll** (GSAP ScrollTrigger):
  - hero fixado que se dissolve conforme você rola, com letras animadas na abertura;
  - linha do tempo **horizontal** (1789 → 2024) que anda conforme o scroll;
  - frases gigantes ("statements") que se iluminam palavra por palavra;
  - barra de progresso de leitura e navegação lateral por capítulos.
- **Fallbacks**: sem WebGL (ou com `prefers-reduced-motion`), a sequência 3D dá lugar aos
  cards de etapas da fissão e ao átomo em CSS — o conteúdo nunca depende do 3D.
- **Som opcional** (botão "SOM" na barra): um **contador Geiger sintetizado** via Web Audio
  que crepita mais rápido conforme a velocidade do scroll, além de efeitos nas simulações
  e no quiz. Nenhum arquivo de áudio — tudo gerado em tempo real.
- **Vídeos em português** (Manual do Mundo em Angra, ciclo do combustível pela INB,
  Ciência Todo Dia) — carregam só ao clicar.

## Interativos

- Simulador de **reação em cadeia** com barras de controle (canvas)
- Simulador de **meia-vida** com curva exponencial teórica
- Comparadores de **densidade** e de **energia por pastilha**
- **Ciclo do combustível** clicável, demo de **soft error** com ECC (caso Intel 1978)
- Flip cards de curiosidades e **quiz** com 8 perguntas

## Estrutura

```
Site/
├── index.html          # todo o conteúdo
├── css/style.css       # tema (Space Grotesk + IBM Plex Mono, verde urânio)
├── fonts/              # fontes locais (woff2)
└── js/
    ├── vendor/         # gsap, ScrollTrigger, lenis, three (locais)
    ├── scene3d.js      # cena 3D: átomo, fissão e sistema de câmera
    ├── scroll.js       # coreografia de scroll (dirige a cena 3D)
    ├── sound.js        # contador Geiger + efeitos (Web Audio)
    └── main.js         # simulações e interações
```

Acessibilidade: respeita `prefers-reduced-motion` (desativa cenas e som ambiente),
foco visível no teclado e som sempre desligado por padrão.
