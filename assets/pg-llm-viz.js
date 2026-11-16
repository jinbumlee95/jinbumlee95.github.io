// SVG / DOM figures for the "PG로 LLM 만들기" series (parts 2–6).
// Each figure looks up its own element and quietly does nothing when absent.

const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORDS = ['BOS', 'sun', 'moon', 'fire', 'hot', 'cold', 'big', 'wet'];
const SENT = [1, 2, 5, 3, 6, 4, 7, 2]; // BOS sun hot moon cold fire big sun
const word = (id) => WORDS[id - 1];
const fmt = (x, d = 3) => {
  const r = Number(x.toFixed(d));
  return (Object.is(r, -0) ? 0 : r).toString();
};
const softmax = (v) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// ---------------------------------------------------------------------
// Shared tooltip
// ---------------------------------------------------------------------
const tip = el('div', 'viz-tip');
tip.setAttribute('role', 'status');
document.body.append(tip);
const showTip = (html, x, y) => {
  tip.innerHTML = html;
  tip.style.display = 'block';
  const r = tip.getBoundingClientRect();
  let left = x + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  tip.style.left = `${left + scrollX}px`;
  tip.style.top = `${y + scrollY - r.height - 10}px`;
};
const hideTip = () => { tip.style.display = 'none'; };

// ---------------------------------------------------------------------
// Small chart kit: bar chart and line chart in plain SVG
// ---------------------------------------------------------------------
function niceTicks(min, max, n = 4) {
  const span = max - min || 1;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) || mag * 10;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}
const logTicks = (min, max) => {
  const out = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) out.push(10 ** e);
  return out;
};
const sci = (v) => {
  if (v >= 1e6) return `${fmt(v / 1e6, 1)}M`;
  if (v >= 1e3) return `${fmt(v / 1e3, 1)}k`;
  if (v < 0.01) return String(Number(v.toPrecision(2)));
  return fmt(v, 2);
};

// bars: [{ label, value, tip }]
function barChart(host, { bars, log = false, yMax, yLabel = '', fmtY = (v) => fmt(v, 2), valueLabels = true }) {
  const W = Math.max(host.clientWidth, 280);
  const H = host.clientHeight || 260;
  const m = { t: 22, r: 12, b: 42, l: 46 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const vals = bars.map((b) => b.value);
  const lo = log ? 10 ** Math.floor(Math.log10(Math.min(...vals.filter((v) => v > 0)))) : 0;
  const hi = yMax ?? (log ? 10 ** Math.ceil(Math.log10(Math.max(...vals))) : Math.max(...vals) * 1.1 || 1);
  const y = log
    ? (v) => ih - ((Math.log10(Math.max(v, lo)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * ih
    : (v) => ih - (v / hi) * ih;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  const g = svgEl('g', { transform: `translate(${m.l},${m.t})` });
  svg.append(g);
  (log ? logTicks(lo, hi) : niceTicks(0, hi)).forEach((t) => {
    g.append(svgEl('line', { x1: 0, x2: iw, y1: y(t), y2: y(t), class: 'grid' }));
    const tx = svgEl('text', { x: -8, y: y(t) + 4, class: 'tick', 'text-anchor': 'end' });
    tx.textContent = log ? sci(t) : fmtY(t);
    g.append(tx);
  });
  if (yLabel) {
    const yl = svgEl('text', { x: -m.l + 4, y: -8, class: 'tick' });
    yl.textContent = yLabel;
    g.append(yl);
  }
  const bw = iw / bars.length;
  const barW = Math.min(bw - 2, Math.max(bw * 0.62, 6));
  bars.forEach((b, i) => {
    const x = i * bw + (bw - barW) / 2;
    const top = y(b.value);
    const h = Math.max(ih - top, 0.5);
    const r = Math.min(4, barW / 2, h);
    // Rounded data-end, square baseline
    const d = `M${x},${ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${ih} Z`;
    g.append(svgEl('path', { d, class: `bar ${b.cls || ''}` }));
    if (valueLabels) {
      const vl = svgEl('text', { x: x + barW / 2, y: top - 6, class: 'val', 'text-anchor': 'middle' });
      vl.textContent = b.valueText ?? fmtY(b.value);
      g.append(vl);
    }
    const xl = svgEl('text', { x: x + barW / 2, y: ih + 16, class: 'tick', 'text-anchor': 'middle' });
    xl.textContent = b.label;
    g.append(xl);
    if (b.sub) {
      const xs = svgEl('text', { x: x + barW / 2, y: ih + 31, class: 'tick sub', 'text-anchor': 'middle' });
      xs.textContent = b.sub;
      g.append(xs);
    }
    const hit = svgEl('rect', { x: i * bw, y: 0, width: bw, height: ih + 20, class: 'hit' });
    hit.addEventListener('pointermove', (e) => showTip(b.tip ?? `<b>${b.label}</b> ${fmtY(b.value)}`, e.clientX, e.clientY));
    hit.addEventListener('pointerleave', hideTip);
    g.append(hit);
  });
  g.append(svgEl('line', { x1: 0, x2: iw, y1: ih, y2: ih, class: 'axis' }));
  host.replaceChildren(svg);
}

// series: [{ name, cls, points: [[x, y], ...] }]
function lineChart(host, { series, log = false, xLabel = '', yLabel = '', fmtX = (v) => fmt(v, 2), fmtY = (v) => fmt(v, 3), markers = [], endLabels = true }) {
  const W = Math.max(host.clientWidth, 280);
  const H = host.clientHeight || 280;
  const m = { t: 22, r: endLabels && series.length > 1 ? 82 : 16, b: 40, l: 50 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const yLo = log ? 10 ** Math.floor(Math.log10(Math.min(...ys))) : Math.min(0, ...ys);
  const yHi = log ? 10 ** Math.ceil(Math.log10(Math.max(...ys))) : Math.max(...ys) * 1.08;
  const X = (v) => ((v - x0) / (x1 - x0 || 1)) * iw;
  const Y = log
    ? (v) => ih - ((Math.log10(v) - Math.log10(yLo)) / (Math.log10(yHi) - Math.log10(yLo))) * ih
    : (v) => ih - ((v - yLo) / (yHi - yLo || 1)) * ih;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
  const g = svgEl('g', { transform: `translate(${m.l},${m.t})` });
  svg.append(g);
  (log ? logTicks(yLo, yHi) : niceTicks(yLo, yHi)).forEach((t) => {
    g.append(svgEl('line', { x1: 0, x2: iw, y1: Y(t), y2: Y(t), class: 'grid' }));
    const tx = svgEl('text', { x: -8, y: Y(t) + 4, class: 'tick', 'text-anchor': 'end' });
    tx.textContent = log ? sci(t) : fmt(t, 2);
    g.append(tx);
  });
  niceTicks(x0, x1, 6).forEach((t) => {
    const tx = svgEl('text', { x: X(t), y: ih + 18, class: 'tick', 'text-anchor': 'middle' });
    tx.textContent = fmtX(t);
    g.append(tx);
  });
  g.append(svgEl('line', { x1: 0, x2: iw, y1: ih, y2: ih, class: 'axis' }));
  if (xLabel) {
    const t = svgEl('text', { x: iw, y: ih + 34, class: 'tick', 'text-anchor': 'end' });
    t.textContent = xLabel;
    g.append(t);
  }
  if (yLabel) {
    const t = svgEl('text', { x: -m.l + 4, y: -8, class: 'tick' });
    t.textContent = yLabel;
    g.append(t);
  }
  series.forEach((s) => {
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    g.append(svgEl('path', { d, class: `line ${s.cls}` }));
    if (endLabels && series.length > 1) {
      const lp = s.points[s.points.length - 1];
      const t = svgEl('text', { x: X(lp[0]) + 8, y: Y(lp[1]) + 4, class: 'end-label' });
      t.textContent = s.name;
      g.append(t);
    }
  });
  markers.forEach((mk) => {
    g.append(svgEl('circle', { cx: X(mk.x), cy: Y(mk.y), r: mk.r || 4.5, class: `marker ${mk.cls || ''}` }));
  });
  // Crosshair + tooltip
  const cross = svgEl('line', { y1: 0, y2: ih, class: 'cross', visibility: 'hidden' });
  const dots = series.map((s) => {
    const c = svgEl('circle', { r: 4, class: `dot ${s.cls}`, visibility: 'hidden' });
    g.append(c);
    return c;
  });
  g.append(cross);
  const hit = svgEl('rect', { x: 0, y: 0, width: iw, height: ih, class: 'hit' });
  hit.addEventListener('pointermove', (e) => {
    const r = hit.getBoundingClientRect();
    const xv = x0 + ((e.clientX - r.left) / r.width) * (x1 - x0);
    const rows = series.map((s, i) => {
      const p = s.points.reduce((a, b) => (Math.abs(b[0] - xv) < Math.abs(a[0] - xv) ? b : a));
      dots[i].setAttribute('cx', X(p[0]));
      dots[i].setAttribute('cy', Y(p[1]));
      dots[i].setAttribute('visibility', 'visible');
      return { s, p };
    });
    cross.setAttribute('x1', X(rows[0].p[0]));
    cross.setAttribute('x2', X(rows[0].p[0]));
    cross.setAttribute('visibility', 'visible');
    showTip(`<b>${xLabel} ${fmtX(rows[0].p[0])}</b>` + rows.map(({ s, p }) => `<br><i class="sw ${s.cls}"></i>${s.name} ${fmtY(p[1])}`).join(''), e.clientX, e.clientY);
  });
  hit.addEventListener('pointerleave', () => {
    hideTip();
    cross.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
  });
  g.append(hit);
  host.replaceChildren(svg);
}

// Re-render a chart whenever its box changes width
function responsive(host, render) {
  let w = 0;
  new ResizeObserver(() => {
    if (host.clientWidth !== w) { w = host.clientWidth; render(); }
  }).observe(host);
}

const setOn = (buttons, on) => buttons.forEach((b) => b.classList.toggle('on', b === on));

// =====================================================================
// Part 2 · layer1 output: which of the 32 cells are lit at each position
// =====================================================================
function layerCells() {
  const host = $('viz-cells');
  if (!host) return;
  const readout = $('cells-readout');
  const buttons = [...document.querySelectorAll('#cells-mode [data-mode]')];
  const regionOf = (c) => ['tok', 'prev', 'pos', 'ans'][Math.floor((c - 1) / 8)];
  const prev = (t) => SENT[Math.max(t - 2, 0)]; // position 1 can only look at itself
  const lit = (mode, t) => {
    const out = [];
    if (mode !== 'nores') out.push(SENT[t - 1], 16 + t);
    if (mode !== 'embed') out.push(8 + prev(t));
    return out;
  };
  const grid = el('div', 'cellgrid');
  const head = el('div', 'cg-row cg-head');
  head.append(el('span', 'cg-name', ''));
  [['1–8 지금 토큰', 'tok'], ['9–16 직전 토큰', 'prev'], ['17–24 위치', 'pos'], ['25–32 정답', 'ans']].forEach(([t, c]) => {
    head.append(el('span', `cg-region ${c}`, t));
  });
  grid.append(head);
  const rows = [];
  for (let t = 1; t <= 8; t++) {
    const row = el('div', 'cg-row');
    row.append(el('span', 'cg-name', `${t} ${word(SENT[t - 1])}`));
    const cells = [];
    for (let c = 1; c <= 32; c++) {
      const cell = el('span', `cg-cell ${regionOf(c)}`);
      cell.dataset.c = c;
      cells.push(cell);
      row.append(cell);
    }
    row.addEventListener('pointerenter', () => describe(t));
    rows.push(cells);
    grid.append(row);
  }
  host.append(grid);
  let mode = 'layer1';
  let focus = 8;
  const describe = (t) => {
    focus = t;
    const on = lit(mode, t);
    const parts = on.sort((a, b) => a - b).map((c) => {
      if (c <= 8) return `${c}번 칸 = 지금 단어 ${word(c)}`;
      if (c <= 16) return `${c}번 칸 = 직전 단어 ${word(c - 8)}`;
      return `${c}번 칸 = ${c - 16}번째 자리`;
    });
    let text = `자리 ${t} (${word(SENT[t - 1])}) → 켜진 칸 {${on.join(', ')}}\n  ` + parts.join('\n  ');
    if (mode === 'nores') text += '\n\n<span class="neg">잔차가 없어서 지금 단어와 자리 칸이 사라졌다.</span> 2층이 볼 재료가 없어진다.';
    if (mode === 'layer1' && t === 1) text += '\n\n1번 자리는 앞이 없어서 자기 자신(BOS)을 앞 단어로 적는다.';
    readout.innerHTML = text;
  };
  const draw = () => {
    rows.forEach((cells, i) => {
      const on = lit(mode, i + 1);
      cells.forEach((cell) => cell.classList.toggle('on', on.includes(Number(cell.dataset.c))));
    });
    describe(focus);
  };
  buttons.forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; setOn(buttons, b); draw(); }));
  draw();
}

// =====================================================================
// Part 3 · the induction head: look up "whose previous word is mine"
// =====================================================================
function induction() {
  const host = $('viz-induct');
  if (!host) return;
  const readout = $('induct-readout');
  const dictButtons = [...document.querySelectorAll('#induct-dict [data-s]')];
  const qButtons = [...document.querySelectorAll('#induct-q [data-q]')];
  let sent = SENT.slice(0, 7);
  let q = 2;
  const draw = () => {
    const toks = [...sent, q];
    const prevOf = (t) => toks[Math.max(t - 2, 0)];
    // Layer-2 attention for the last position: score 10 where prev == q, causal over 1..8
    const scores = toks.map((_, i) => (prevOf(i + 1) === q ? 10 : 0));
    const w = softmax(scores);
    const best = w.indexOf(Math.max(...w));
    const answer = toks[best];
    host.replaceChildren();
    const table = el('div', 'induct');
    const line = (name, cells) => {
      const r = el('div', 'in-row');
      r.append(el('span', 'in-name', name));
      cells.forEach((c) => r.append(c));
      table.append(r);
    };
    line('자리', toks.map((_, i) => el('span', 'in-cell num', i + 1)));
    line('지금 단어 (1–8칸)', toks.map((t, i) => el('span', `in-cell${i === 7 ? ' q' : ''}${i === best ? ' ans' : ''}`, word(t))));
    line('직전 단어 (9–16칸)', toks.map((_, i) => el('span', `in-cell${i === best ? ' key' : ''}`, word(prevOf(i + 1)))));
    line('8번 자리의 어텐션', w.map((p, i) => {
      const c = el('span', 'in-cell bar');
      c.style.setProperty('--p', p);
      c.title = p.toFixed(3);
      c.append(el('i'), el('b', '', fmt(p, 2)));
      if (i === best) c.classList.add('ans');
      return c;
    }));
    host.append(table);
    readout.innerHTML =
      `Query: 8번 자리의 지금 단어 = <span class="hl">${word(q)}</span>\n` +
      `Key:   직전 단어가 ${word(q)}인 자리 = ${best + 1}번  (점수 10, 나머지 0 → 가중치 ${fmt(w[best], 3)})\n` +
      `Value: ${best + 1}번 자리의 지금 단어 = <span class="hl">${word(answer)}</span>  → 대답 ${word(answer)}`;
  };
  dictButtons.forEach((b) => b.addEventListener('click', () => {
    sent = b.dataset.s.split(',').map(Number);
    setOn(dictButtons, b);
    draw();
  }));
  qButtons.forEach((b) => b.addEventListener('click', () => { q = Number(b.dataset.q); setOn(qButtons, b); draw(); }));
  draw();
}

// =====================================================================
// Part 3 · temperature
// =====================================================================
function temperature() {
  const host = $('viz-temp');
  if (!host) return;
  const input = $('temp-t');
  const val = $('temp-t-val');
  const drawBtn = $('temp-draw');
  const readout = $('temp-readout');
  const logits = [0.00005, 0.00009, 0.00005, 0.00005, 0.99968, 0.00005, 0.00005, 0];
  let counts = null;
  const probs = () => softmax(logits.map((l) => (l * 8) / Number(input.value)));
  const render = () => {
    const p = probs();
    val.textContent = Number(input.value).toFixed(1);
    barChart(host, {
      bars: p.map((x, i) => ({
        label: WORDS[i],
        value: x,
        valueText: fmt(x, 2),
        sub: counts ? `${counts[i]}회` : undefined,
        tip: `<b>${WORDS[i]}</b> 확률 ${fmt(x, 4)}${counts ? `<br>40번 중 ${counts[i]}번 뽑힘` : ''}`,
      })),
      yMax: 1,
      yLabel: '확률',
    });
    readout.innerHTML = `softmax(로짓 × 8 ÷ ${Number(input.value).toFixed(1)})   hot = <span class="hl">${fmt(p[4] * 100, 2)}%</span>` +
      (counts ? `\n40번 뽑기: ` + WORDS.map((w, i) => (counts[i] ? `${w} ${counts[i]}` : '')).filter(Boolean).join(' · ') : '');
  };
  input.addEventListener('input', () => { counts = null; render(); });
  drawBtn.addEventListener('click', () => {
    const p = probs();
    counts = Array(8).fill(0);
    for (let k = 0; k < 40; k++) {
      // Roulette: the first slot whose cumulative probability passes a random number
      const r = Math.random();
      let acc = 0;
      const i = p.findIndex((x) => (acc += x) >= r);
      counts[i < 0 ? 7 : i]++;
    }
    render();
  });
  responsive(host, render);
}

// =====================================================================
// Part 3 · one trainable number: loss(a) and gradient descent
// =====================================================================
function lossA() {
  const host = $('viz-lossa');
  if (!host) return;
  const input = $('lossa-lr');
  const val = $('lossa-lr-val');
  const playBtn = $('lossa-play');
  const readout = $('lossa-readout');
  const found = [0.00005, 0.00009, 0.00005, 0.00005, 0.99968, 0.00005, 0.00005, 0];
  const cur = [0, 1, 0, 0, 0, 0, 0, 0]; // just repeat the current word, sun
  const loss = (a) => -Math.log(softmax(found.map((f, j) => (a * f + (1 - a) * cur[j]) * 8))[4]);
  const grad = (a) => (loss(a + 0.001) - loss(a)) / 0.001;
  const curve = [];
  for (let a = 0; a <= 1.2001; a += 0.01) curve.push([a, loss(a)]);
  let path = [];
  let shown = 0;
  let timer = null;
  const run = () => {
    const lr = Number(input.value);
    path = [[0, loss(0)]];
    let a = 0;
    for (let n = 1; n <= 40; n++) {
      a -= lr * grad(a);
      path.push([a, loss(a)]);
    }
  };
  const render = () => {
    const lr = Number(input.value);
    val.textContent = lr.toFixed(2);
    const pts = path.slice(0, shown + 1);
    lineChart(host, {
      series: [{ name: '손실', cls: 's1', points: curve }],
      xLabel: 'a', yLabel: '손실',
      fmtX: (v) => fmt(v, 2), fmtY: (v) => fmt(v, 4),
      markers: pts.filter((p) => p[0] <= 1.2).map((p, i) => ({ x: p[0], y: p[1], r: i === pts.length - 1 ? 6 : 3.5, cls: i === pts.length - 1 ? 'now' : 'trail' })),
      endLabels: false,
    });
    const last = pts[pts.length - 1];
    readout.innerHTML =
      `학습률 ${lr.toFixed(2)} · ${pts.length - 1}걸음\n` +
      `a = ${fmt(last[0], 4)}   손실 = <span class="hl">${fmt(last[1], 4)}</span>   예측 = ${last[0] >= 0.5 ? 'hot' : 'sun'}` +
      (pts.length > 1 ? `\n다음 걸음: a − ${lr.toFixed(2)} × 기울기(${fmt(grad(last[0]), 3)})` : '\n시작점 a = 0: 문맥을 무시하고 sun을 따라 하는 상태');
  };
  const play = () => {
    clearInterval(timer);
    run();
    shown = 0;
    if (reduce) { shown = 40; render(); return; }
    render();
    timer = setInterval(() => {
      shown++;
      render();
      if (shown >= 40) clearInterval(timer);
    }, 90);
  };
  input.addEventListener('input', () => { clearInterval(timer); run(); shown = 0; render(); });
  playBtn.addEventListener('click', play);
  run();
  responsive(host, render);
}

// =====================================================================
// Part 4 · bigram training, live
// =====================================================================
function bigram() {
  const host = $('viz-bigram');
  if (!host) return;
  const readout = $('bigram-readout');
  const pairs = [[2, 5], [2, 5], [2, 5], [3, 6], [3, 6], [3, 6], [4, 7], [4, 7], [4, 7], [1, 2], [1, 3], [1, 4]];
  const cols = [1, 2, 3, 4];
  let W;
  let steps = 0;
  const init = () => {
    W = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => (Math.random() - 0.5) * 0.02));
    steps = 0;
  };
  const probsOf = (j) => softmax(W.map((row) => row[j - 1]));
  const totalLoss = () => pairs.reduce((s, [p, n]) => s - Math.log(probsOf(p)[n - 1]), 0) / pairs.length;
  const step = (lr = 1) => {
    const P = {};
    cols.forEach((j) => { P[j] = probsOf(j); });
    cols.forEach((j) => {
      const mine = pairs.filter((p) => p[0] === j);
      for (let i = 1; i <= 8; i++) {
        const g = mine.reduce((s, [, n]) => s + P[j][i - 1] - (i === n ? 1 : 0), 0) / mine.length;
        W[i - 1][j - 1] -= (lr * g * mine.length) / pairs.length;
      }
    });
    steps++;
  };
  const grid = el('div', 'heat');
  host.append(grid);
  const draw = () => {
    grid.replaceChildren();
    grid.append(el('span', 'h-corner', '다음 ↓ · 앞 →'));
    cols.forEach((j) => grid.append(el('span', 'h-col', word(j))));
    const P = Object.fromEntries(cols.map((j) => [j, probsOf(j)]));
    for (let i = 1; i <= 8; i++) {
      grid.append(el('span', 'h-row', word(i)));
      cols.forEach((j) => {
        const p = P[j][i - 1];
        const c = el('span', 'h-cell', p >= 0.05 ? fmt(p, 2) : '');
        c.style.setProperty('--p', p);
        c.classList.toggle('dark', p > 0.55);
        c.addEventListener('pointermove', (e) => showTip(`앞 단어 <b>${word(j)}</b> → 다음 <b>${word(i)}</b><br>확률 ${fmt(p, 3)}`, e.clientX, e.clientY));
        c.addEventListener('pointerleave', hideTip);
        grid.append(c);
      });
    }
    const pred = cols.map((j) => {
      const p = P[j];
      const k = p.indexOf(Math.max(...p));
      return `${word(j)} → ${word(k + 1)} (${fmt(p[k], 3)})`;
    });
    readout.innerHTML = `${steps}걸음 · 평균 손실 <span class="hl">${fmt(totalLoss(), 4)}</span>  (무작위 기준 ln 8 = 2.0794)\n` + pred.join('   ');
  };
  document.querySelectorAll('#bigram-btns [data-n]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.n);
    if (n === 0) init();
    else for (let k = 0; k < n; k++) step(1);
    draw();
  }));
  init();
  draw();
}

// =====================================================================
// Part 4 · unseen sentences: attention of the model trained on 120 sentences
// =====================================================================
function unseen() {
  const host = $('viz-unseen');
  if (!host) return;
  const rows = [
    { id: 101, s: 'BOS hot sun cold moon big fire hot', want: 3, ans: 'sun', pred: 'sun', p: [0, 0, 0.80, 0, 0.17, 0, 0.01, 0] },
    { id: 102, s: 'BOS hot sun cold moon big fire cold', want: 5, ans: 'moon', pred: 'moon', p: [0, 0, 0.10, 0, 0.75, 0, 0.14, 0] },
    { id: 103, s: 'BOS wet fire hot cold sun moon wet', want: 3, ans: 'fire', pred: 'moon', p: [0.04, 0.03, 0.07, 0.13, 0.03, 0.28, 0.40, 0.01] },
    { id: 104, s: 'BOS wet fire hot cold sun moon hot', want: 5, ans: 'cold', pred: 'cold', p: [0, 0, 0.01, 0, 0.92, 0.03, 0.02, 0] },
  ];
  rows.forEach((r) => {
    const row = el('div', 'us-row');
    const toks = r.s.split(' ');
    row.append(el('div', 'us-head', `<b>${r.id}</b> 정답 ${r.ans} · 예측 <span class="${r.ans === r.pred ? 'pos' : 'neg'}">${r.pred}</span>`));
    const bars = el('div', 'us-bars');
    r.p.forEach((p, i) => {
      const b = el('span', `us-bar${i + 1 === r.want ? ' want' : ''}`);
      b.style.setProperty('--p', p);
      b.append(el('i'), el('small', '', toks[i]));
      b.addEventListener('pointermove', (e) => showTip(`${i + 1}번 자리 <b>${toks[i]}</b><br>가중치 ${p.toFixed(2)}${i + 1 === r.want ? '<br>봐야 할 자리' : ''}`, e.clientX, e.clientY));
      b.addEventListener('pointerleave', hideTip);
      bars.append(b);
    });
    row.append(bars);
    host.append(row);
  });
}

// =====================================================================
// Part 5 · ablation results
// =====================================================================
function ablation() {
  const host = $('viz-ablate');
  if (!host) return;
  const buttons = [...document.querySelectorAll('#ablate-mode [data-m]')];
  const readout = $('ablate-readout');
  const base = 0.0073;
  const sets = {
    weights: {
      bars: [['원본', 0.0073], ['wq 1–8', 1.6745], ['wq 9–16', 0.0083], ['wk 1–8', 0.0083], ['wk 9–16', 0.7507], ['wk 17–24', 0.1814]],
      note: '가중치 끄기: 그 칸을 보지 못하게 W의 열을 0으로 만들었다.',
    },
    channels: {
      bars: [['안 끊음', 0.0073], ['1–8 끊음', 2.0794], ['9–16 끊음', 0.7750], ['17–24 끊음', 0.1088]],
      note: '통로 끊기: 1층 출력에서 그 칸을 0으로 만든 뒤 2층에 넣었다. 2.0794는 8개 중 아무거나 찍을 때의 손실이다.',
    },
  };
  let mode = 'weights';
  const render = () => {
    const set = sets[mode];
    barChart(host, {
      bars: set.bars.map(([label, v]) => ({
        label, value: v, valueText: fmt(v, 4), sub: `×${fmt(v / base, 1)}`,
        tip: `<b>${label}</b><br>손실 ${fmt(v, 4)}<br>원본의 ${fmt(v / base, 1)}배`,
      })),
      log: true, yLabel: '손실 (로그 눈금)', fmtY: (v) => fmt(v, 4),
    });
    readout.textContent = set.note;
  };
  buttons.forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; setOn(buttons, b); render(); }));
  responsive(host, render);
}

// =====================================================================
// Part 6 · BPE, step by step
// =====================================================================
function bpe() {
  const host = $('viz-bpe');
  if (!host) return;
  const readout = $('bpe-readout');
  const corpus = ['lower', 'lower', 'lowest', 'lowest', 'newer', 'newer', 'newer', 'wider', 'wider', 'slower', 'slowest'];
  const uniq = [...new Set(corpus)];
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  let toks;
  let log;
  const reset = () => { toks = corpus.map((w) => [...w]); log = []; };
  const topPair = () => {
    const c = new Map();
    toks.forEach((p) => {
      for (let i = 0; i < p.length - 1; i++) {
        const k = `${p[i]}\u0000${p[i + 1]}`;
        c.set(k, (c.get(k) || 0) + 1);
      }
    });
    const best = [...c].map(([k, n]) => [...k.split('\u0000'), n])
      .sort((A, B) => B[2] - A[2] || cmp(A[0], B[0]) || cmp(A[1], B[1]))[0];
    return best && best[2] >= 2 ? best : null;
  };
  const merge = () => {
    const best = topPair();
    if (!best) return false;
    const [a, b, n] = best;
    // Same trick as the SQL: join with spaces, replace "a b" with "ab", split again
    toks = toks.map((p) => p.join(' ').split(`${a} ${b}`).join(a + b).split(' '));
    log.push(`${a} + ${b} → ${a + b} (${n}회)`);
    return true;
  };
  const draw = () => {
    host.replaceChildren();
    const list = el('div', 'bpe');
    uniq.forEach((w) => {
      const p = toks[corpus.indexOf(w)];
      const times = corpus.filter((x) => x === w).length;
      const row = el('div', 'bpe-row');
      row.append(el('span', 'bpe-word', `${w} <small>×${times}</small>`));
      const pieces = el('span', 'bpe-pieces');
      p.forEach((s) => pieces.append(el('code', s.length > 1 ? 'big' : '', s)));
      row.append(pieces, el('span', 'bpe-n', `${p.length}조각`));
      list.append(row);
    });
    host.append(list);
    const total = toks.reduce((s, p) => s + p.length, 0);
    const vocab = new Set(toks.flat()).size;
    const next = topPair();
    readout.innerHTML =
      `병합 ${log.length}회 · 총 토큰 <span class="hl">${total}</span> (글자 단위 60, 단어 단위 11) · 조각 종류 ${vocab}\n` +
      (log.length ? log.map((l, i) => `${i + 1}. ${l}`).join('\n') : '아직 합치기 전: 전부 글자 단위다.') +
      `\n다음 후보: ${next ? `${next[0]} + ${next[1]} (${next[2]}회)` : '없음 (2회 이상 나오는 쌍이 없음)'}`;
  };
  $('bpe-step').addEventListener('click', () => { merge(); draw(); });
  $('bpe-five').addEventListener('click', () => { reset(); for (let k = 0; k < 5; k++) merge(); draw(); });
  $('bpe-reset').addEventListener('click', () => { reset(); draw(); });
  reset();
  draw();
}

// =====================================================================
// Part 6 · two heads in one layer (t−1 and t−2)
// =====================================================================
function twoHeads() {
  const host = $('viz-heads');
  if (!host) return;
  const heads = [
    { name: '헤드 1 · w_q1 (offs 17)', back: 1, hi: 7 },
    { name: '헤드 2 · w_q1b (offs 18)', back: 2, hi: 6 },
  ];
  const wrap = el('div', 'heads');
  heads.forEach((h) => {
    const box = el('div', 'head-box');
    box.append(el('p', 'head-name', h.name));
    const g = el('div', 'mini');
    g.append(el('span', 'm-corner', ''));
    for (let s = 1; s <= 8; s++) g.append(el('span', 'm-col', s));
    for (let t = 1; t <= 8; t++) {
      // q lights cell (t − back) when that row of the selector exists; k lights cell s
      const target = t - h.back;
      const scores = [];
      for (let s = 1; s <= t; s++) scores.push(target >= 1 && target <= h.hi && s === target ? 10 : 0);
      const w = softmax(scores);
      g.append(el('span', 'm-row', `${t} ${word(SENT[t - 1])}`));
      for (let s = 1; s <= 8; s++) {
        const c = el('span', 'm-cell');
        if (s > t) c.classList.add('masked');
        else {
          const p = w[s - 1];
          c.style.setProperty('--p', p);
          if (p > 0.55) c.classList.add('dark');
          c.textContent = p > 0.05 ? fmt(p, 2) : '';
          c.addEventListener('pointermove', (e) => showTip(`${h.name}<br>${t}번 자리 → ${s}번 자리<br>가중치 ${fmt(p, 3)}`, e.clientX, e.clientY));
          c.addEventListener('pointerleave', hideTip);
        }
        g.append(c);
      }
    }
    box.append(g);
    wrap.append(box);
  });
  host.append(wrap);
}

// =====================================================================
// Part 6 · stacking layers with random weights, with and without layernorm
// =====================================================================
function depth() {
  const host = $('viz-depth');
  if (!host) return;
  const btn = $('depth-again');
  const readout = $('depth-readout');
  const embed = SENT.map((tok, t) => Array.from({ length: 32 }, (_, c) => (c + 1 === tok || c + 1 === 17 + t ? 1 : 0)));
  const layernorm = (v) => {
    const mu = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length);
    return v.map((x) => (x - mu) / (sd + 1e-9));
  };
  let res;
  const simulate = () => {
    const Wm = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => (Math.random() - 0.5) * 0.5));
    const layer = (x, ln) => x.map((row) => {
      const out = row.map((xi, i) => xi + Wm[i].reduce((s, w, j) => s + w * row[j], 0));
      return ln ? layernorm(out) : out;
    });
    const maxAbs = (x) => Math.max(...x.flat().map(Math.abs));
    const run = (ln) => {
      const pts = [];
      let x = embed;
      for (let n = 1; n <= 24; n++) { x = layer(x, ln); pts.push([n, maxAbs(x)]); }
      return pts;
    };
    res = { raw: run(false), ln: run(true) };
  };
  const render = () => {
    lineChart(host, {
      series: [
        { name: 'layernorm 없음', cls: 's2', points: res.raw },
        { name: 'layernorm 있음', cls: 's1', points: res.ln },
      ],
      log: true, xLabel: '층', yLabel: '최대 절댓값 (로그 눈금)', fmtX: (v) => fmt(v, 0), fmtY: (v) => sci(v),
    });
    const r = res.raw;
    readout.innerHTML =
      `layernorm 없음: 1층 ${fmt(r[0][1], 2)} → 12층 ${sci(r[11][1])} → 24층 <span class="neg">${sci(r[23][1])}</span> (${sci(r[23][1] / r[0][1])}배)\n` +
      `layernorm 있음: 24층 내내 ${fmt(Math.min(...res.ln.map((p) => p[1])), 2)} ~ ${fmt(Math.max(...res.ln.map((p) => p[1])), 2)}`;
  };
  btn.addEventListener('click', () => { simulate(); render(); });
  simulate();
  responsive(host, render);
}

// =====================================================================
// Part 6 · superposition: pack 3 items into one vector, read them back
// =====================================================================
function recovery() {
  const host = $('viz-recover');
  if (!host) return;
  const btn = $('recover-again');
  const dims = [3, 4, 6, 8, 12, 16, 24];
  const unit = (d) => {
    const v = Array.from({ length: d }, () => Math.random() - 0.5);
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const trial = (d) => {
    const emb = Array.from({ length: 8 }, () => unit(d));
    const pick = [];
    while (pick.length < 3) {
      const k = Math.floor(Math.random() * 8);
      if (!pick.includes(k)) pick.push(k);
    }
    const mix = Array.from({ length: d }, (_, i) => pick.reduce((s, k) => s + emb[k][i], 0));
    const top = emb.map((e, k) => [dot(mix, e), k]).sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => x[1]);
    return pick.every((k) => top.includes(k));
  };
  let rates;
  const simulate = () => {
    rates = dims.map((d) => {
      let ok = 0;
      for (let k = 0; k < 400; k++) ok += trial(d);
      return ok / 400;
    });
  };
  const render = () => barChart(host, {
    bars: dims.map((d, i) => ({
      label: `${d}칸`, value: rates[i] * 100, valueText: `${Math.round(rates[i] * 100)}%`,
      tip: `<b>${d}칸</b>에 단어 8개를 무작위 방향으로 담고<br>3개를 더한 벡터에서 다시 3개를 꺼낸 성공률<br>${Math.round(rates[i] * 100)}% (400회)`,
    })),
    yMax: 100, yLabel: '3개 복원 성공률 (%)', fmtY: (v) => fmt(v, 0),
  });
  btn.addEventListener('click', () => { simulate(); render(); });
  simulate();
  responsive(host, render);
}

layerCells();
induction();
temperature();
lossA();
bigram();
unseen();
ablation();
bpe();
twoHeads();
depth();
recovery();
