# Urânio (U) — Site Educativo

Site interativo baseado no relatório de Química sobre o urânio (SETREM — Engenharia de Computação).

## Como abrir

Basta abrir o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge).
Não precisa de servidor, internet nem instalação — é 100% HTML, CSS e JavaScript puros.

No WSL/Linux:

```bash
# opção 1: abrir direto no navegador do Windows (WSL)
explorer.exe index.html

# opção 2: servir localmente
python3 -m http.server 8000
# e acessar http://localhost:8000
```

## O que tem de interativo

- **Simulador de reação em cadeia** — dispare nêutrons contra núcleos de U-235 e controle a reação com barras de controle (canvas).
- **Simulador de meia-vida** — 128 átomos decaem a cada rodada e o gráfico compara com a curva exponencial teórica.
- **Comparador de densidade** — sinta o peso de um cubo de 10 cm em água, ferro, chumbo e urânio.
- **Comparador de energia** — arraste o slider e veja quantos barris de petróleo equivalem a N pastilhas de UO₂.
- **Ciclo do combustível clicável** — da mina de Caetité à tomada.
- **Demo de soft error** — dispare uma partícula alfa contra uma memória de 8 bits e corrija com ECC (caso Intel, 1978).
- **Cartões de curiosidades** que viram ao clicar.
- **Quiz** com 8 perguntas sobre o conteúdo.

## Estrutura

```
Site/
├── index.html      # todo o conteúdo do site
├── css/style.css   # tema escuro minimalista (verde "vidro de urânio")
└── js/main.js      # simulações e interações (sem dependências)
```
