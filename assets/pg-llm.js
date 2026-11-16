// Three.js scenes for the "PG로 LLM 만들기" study note
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
const C = {
  blue: '#3b82f6', purple: '#8b5cf6', cyan: '#06b6d4', orange: '#f0883e',
  green: '#2f9e5b', red: '#e5534b', yellow: '#e3b341', pink: '#ec4899',
};
const fmt = (x, d = 2) => {
  const r = Number(x.toFixed(d));
  return (Object.is(r, -0) ? 0 : r).toString();
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ----- Theme: re-colour theme-dependent objects when light/dark changes -----
const themeHooks = [];
const onTheme = (fn) => { themeHooks.push(fn); fn(); };
const runTheme = () => themeHooks.forEach((fn) => fn());
new MutationObserver(runTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', runTheme);
const resolve = (c) => (c.startsWith('--') ? cssVar(c) : c);

// ----- Helpers -----
function label(text, { color = '--text', size = 0.4, weight = 700 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.renderOrder = 10;
  const state = { text, color };
  const draw = () => {
    const px = 64;
    const font = `${weight} ${px}px "Pretendard Variable", Pretendard, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(state.text).width) + 16;
    canvas.width = Math.max(w, 2);
    canvas.height = px + 20;
    ctx.font = font;
    ctx.fillStyle = resolve(state.color);
    ctx.textBaseline = 'middle';
    ctx.fillText(state.text, 8, canvas.height / 2 + 2);
    tex.dispose();
    tex.image = canvas;
    tex.needsUpdate = true;
    sprite.scale.set((size * canvas.width) / canvas.height, size, 1);
  };
  sprite.userData.set = (next) => { Object.assign(state, next); draw(); };
  onTheme(draw);
  return sprite;
}

function arrow(color, radius = 0.05) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05, transparent: true });
  const headLen = radius * 6;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 18), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 2.4, headLen, 24), mat);
  group.add(shaft, head);
  const up = new THREE.Vector3(0, 1, 0);
  group.userData.mat = mat;
  group.userData.set = (v) => {
    const len = v.length();
    group.visible = len > 1e-4;
    if (!group.visible) return;
    const hl = Math.min(headLen, len * 0.45);
    shaft.scale.set(1, Math.max(len - hl, 1e-4), 1);
    shaft.position.set(0, (len - hl) / 2, 0);
    head.scale.setScalar(hl / headLen);
    head.position.set(0, len - hl / 2, 0);
    group.quaternion.setFromUnitVectors(up, v.clone().normalize());
  };
  return group;
}

// Plain line segments whose colour follows a CSS variable
function lines(points, { color = '--border', opacity = 1 } = {}) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ transparent: true, opacity });
  onTheme(() => mat.color.set(resolve(color)));
  return new THREE.LineSegments(geo, mat);
}

// ----- Stage: one renderer per figure, drawn only while on screen -----
const stages = [];
function stage(el, { pos, target = [0, 0, 0], fov = 38, autoRotate = false, fit } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    el.insertAdjacentHTML('beforeend', '<p class="viz-fallback">이 브라우저에서는 WebGL을 쓸 수 없어 3D 그림을 보여 주지 못했다.</p>');
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.className = 'viz-canvas';
  el.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 500);
  camera.position.set(...pos);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {
    enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08,
    autoRotate: autoRotate && !reduce, autoRotateSpeed: 0.7,
  });
  controls.target.set(...target);
  controls.update();
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(4, 9, 6);
  scene.add(sun);

  const s = { el, renderer, scene, camera, controls, visible: false, update: null, onEnter: null };
  const resize = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fit?.(camera, w / h);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(el);
  resize();
  new IntersectionObserver(([entry]) => {
    const was = s.visible;
    s.visible = entry.isIntersecting;
    if (s.visible && !was) s.onEnter?.();
  }, { threshold: 0.25 }).observe(el);
  stages.push(s);
  return s;
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  for (const s of stages) {
    if (!s.visible) continue;
    s.update?.(dt, now / 1000);
    s.controls.update();
    s.renderer.render(s.scene, s.camera);
  }
  requestAnimationFrame(loop);
}

// =====================================================================
// 1. Dot product: rotate b against a fixed a, show b's shadow on a
// =====================================================================
function dotScene() {
  const el = document.getElementById('viz-dot');
  const s = el && stage(el, { pos: [1.2, 5.2, 5.6], target: [0.4, 0, -0.4] });
  if (!s) return;
  const to3 = (x, y) => new THREE.Vector3(x, 0, -y);
  const a = [2, 1];
  const aAng = Math.atan2(a[1], a[0]);
  const aLen = Math.hypot(...a);

  // Ground grid and axes
  const pts = [];
  for (let i = -3; i <= 3; i++) {
    pts.push(to3(i, -3), to3(i, 3), to3(-3, i), to3(3, i));
  }
  s.scene.add(lines(pts, { color: '--border', opacity: 0.9 }));
  s.scene.add(lines([to3(-3, 0), to3(3, 0), to3(0, -3), to3(0, 3)], { color: '--muted', opacity: 0.6 }));

  const aArrow = arrow(C.blue, 0.06);
  aArrow.userData.set(to3(...a));
  const bArrow = arrow(C.orange, 0.06);
  const shadow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 1, 16),
    new THREE.MeshStandardMaterial({ color: C.green, roughness: 0.6, transparent: true, opacity: 0.85 }),
  );
  const dropGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const dropMat = new THREE.LineDashedMaterial({ dashSize: 0.12, gapSize: 0.08, transparent: true });
  onTheme(() => dropMat.color.set(cssVar('--muted')));
  const drop = new THREE.Line(dropGeo, dropMat);
  const arcGeo = new THREE.BufferGeometry();
  const arcMat = new THREE.LineBasicMaterial({ transparent: true });
  onTheme(() => arcMat.color.set(cssVar('--text')));
  const arc = new THREE.Line(arcGeo, arcMat);
  const aLabel = label('a', { color: C.blue, size: 0.42 });
  aLabel.position.copy(to3(a[0] * 1.12, a[1] * 1.12)).setY(0.25);
  const bLabel = label('b', { color: C.orange, size: 0.42 });
  const thetaLabel = label('θ', { color: '--text', size: 0.34 });
  s.scene.add(aArrow, bArrow, shadow, drop, arc, aLabel, bLabel, thetaLabel);

  const angleIn = document.getElementById('dot-angle');
  const lenIn = document.getElementById('dot-len');
  const angleVal = document.getElementById('dot-angle-val');
  const lenVal = document.getElementById('dot-len-val');
  const readout = document.getElementById('dot-readout');
  const verdict = document.getElementById('dot-verdict');
  const presets = el.parentElement.querySelectorAll('[data-angle]');

  let cur = { ang: Number(angleIn.value), len: Number(lenIn.value) };
  const target = { ...cur };

  const draw = () => {
    const th = (cur.ang * Math.PI) / 180;
    const b = [cur.len * Math.cos(aAng + th), cur.len * Math.sin(aAng + th)];
    bArrow.userData.set(to3(...b));
    bLabel.position.copy(to3(b[0] * 1.14, b[1] * 1.14)).setY(0.25);

    const dot = a[0] * b[0] + a[1] * b[1];
    const k = dot / (aLen * aLen); // projection of b onto a, as a multiple of a
    const proj = to3(a[0] * k, a[1] * k);
    const pl = proj.length();
    shadow.visible = pl > 0.02;
    if (shadow.visible) {
      shadow.scale.set(1, pl, 1);
      shadow.position.copy(proj).multiplyScalar(0.5).setY(0.02);
      shadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), proj.clone().normalize());
      shadow.material.color.set(dot >= 0 ? C.green : C.red);
    }
    dropGeo.setFromPoints([to3(...b), proj]);
    drop.computeLineDistances();

    const arcPts = [];
    for (let i = 0; i <= 32; i++) {
      const t = aAng + (th * i) / 32;
      arcPts.push(to3(0.55 * Math.cos(t), 0.55 * Math.sin(t)).setY(0.01));
    }
    arcGeo.setFromPoints(arcPts);
    thetaLabel.position.copy(to3(0.85 * Math.cos(aAng + th / 2), 0.85 * Math.sin(aAng + th / 2))).setY(0.2);
    thetaLabel.visible = cur.ang > 8;

    const cls = Math.abs(dot) < 0.05 ? 'zero' : dot > 0 ? 'pos' : 'neg';
    readout.innerHTML =
      `a = [${a.join(', ')}]   |a| = ${fmt(aLen)}\n` +
      `b = [${fmt(b[0])}, ${fmt(b[1])}]   |b| = ${fmt(cur.len, 1)}\n` +
      `a·b = 2×${fmt(b[0])} + 1×${fmt(b[1])} = <span class="${cls}">${fmt(dot)}</span>\n` +
      `|a||b|cosθ = ${fmt(aLen)}×${fmt(cur.len, 1)}×${fmt(Math.cos(th))} = <span class="${cls}">${fmt(aLen * cur.len * Math.cos(th))}</span>`;
    verdict.textContent =
      cls === 'zero' ? '직각: 서로 상관없음 → 내적 0'
        : cls === 'pos' ? `같은 쪽을 가리킴 → 양수${cur.ang < 5 ? ' (가장 큼)' : ''}`
          : `반대쪽을 가리킴 → 음수${cur.ang > 175 ? ' (가장 작음)' : ''}`;
  };

  const sync = () => {
    target.ang = Number(angleIn.value);
    target.len = Number(lenIn.value);
    angleVal.textContent = `${target.ang}°`;
    lenVal.textContent = target.len.toFixed(1);
    presets.forEach((p) => p.classList.toggle('on', Number(p.dataset.angle) === target.ang));
  };
  angleIn.addEventListener('input', sync);
  lenIn.addEventListener('input', sync);
  presets.forEach((p) => p.addEventListener('click', () => { angleIn.value = p.dataset.angle; sync(); }));
  sync();
  draw();

  s.update = (dt) => {
    const f = reduce ? 1 : 1 - Math.exp(-dt * 10);
    const dA = target.ang - cur.ang;
    const dL = target.len - cur.len;
    if (Math.abs(dA) < 0.01 && Math.abs(dL) < 0.001) return;
    cur.ang += dA * f;
    cur.len += dL * f;
    if (Math.abs(target.ang - cur.ang) < 0.05) cur.ang = target.ang;
    if (Math.abs(target.len - cur.len) < 0.002) cur.len = target.len;
    draw();
  };
}

// =====================================================================
// 2. Who is most like me: score vectors in 3D
// =====================================================================
function peopleScene() {
  const el = document.getElementById('viz-people');
  const s = el && stage(el, { pos: [7.5, 5.2, 7.5], target: [1.6, 1.4, 1.6], autoRotate: true });
  if (!s) return;
  const S = 0.4; // scene units per score point
  const to3 = ([kor, math, pe]) => new THREE.Vector3(kor * S, math * S, pe * S);
  const me = [9, 2, 7];
  const people = [
    { name: '민수', v: [8, 2, 8], c: C.purple },
    { name: '철수', v: [9, 3, 6], c: C.cyan },
    { name: '영희', v: [2, 9, 3], c: C.orange },
  ];
  const dot = (x, y) => x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const norm = (x) => Math.sqrt(dot(x, x));

  // Axes, ticks, faint back planes
  const L = 10 * S;
  s.scene.add(lines([new THREE.Vector3(), new THREE.Vector3(L, 0, 0), new THREE.Vector3(), new THREE.Vector3(0, L, 0), new THREE.Vector3(), new THREE.Vector3(0, 0, L)], { color: '--muted', opacity: 0.8 }));
  const grid = [];
  for (let i = 2; i <= 10; i += 2) {
    const g = i * S;
    grid.push(new THREE.Vector3(g, 0, 0), new THREE.Vector3(g, 0, L), new THREE.Vector3(0, 0, g), new THREE.Vector3(L, 0, g));
  }
  s.scene.add(lines(grid, { color: '--border', opacity: 0.9 }));
  [['국어', [L + 0.5, 0, 0]], ['수학', [0, L + 0.4, 0]], ['체육', [0, 0, L + 0.5]]].forEach(([t, p]) => {
    const l = label(t, { color: '--muted', size: 0.32 });
    l.position.set(...p);
    s.scene.add(l);
  });

  const meArrow = arrow(C.blue, 0.07);
  meArrow.userData.set(to3(me));
  const meLabel = label('나 [9,2,7]', { color: C.blue, size: 0.34 });
  meLabel.position.copy(to3(me)).multiplyScalar(1.1).add(new THREE.Vector3(0, 0.3, 0));
  s.scene.add(meArrow, meLabel);

  const list = document.getElementById('people-list');
  const readout = document.getElementById('people-readout');
  const maxDot = Math.max(...people.map((p) => dot(me, p.v)));
  people.forEach((p) => {
    p.dot = dot(me, p.v);
    p.cos = p.dot / (norm(me) * norm(p.v));
    p.arrow = arrow(p.c, 0.05);
    p.arrow.userData.set(to3(p.v));
    p.label = label(`${p.name} [${p.v.join(',')}]`, { color: p.c, size: 0.3 });
    p.label.position.copy(to3(p.v)).multiplyScalar(1.1).add(new THREE.Vector3(0, 0.25, 0));
    s.scene.add(p.arrow, p.label);
    const li = document.createElement('li');
    li.innerHTML =
      `<button type="button" style="--c: ${p.c}"><span class="who">${p.name}</span>` +
      `<span class="meter"><span style="--w: ${(p.dot / maxDot) * 100}%"></span></span>` +
      `<span class="num">${p.dot}</span></button>`;
    p.btn = li.querySelector('button');
    p.btn.addEventListener('click', () => select(p));
    list.append(li);
  });

  const select = (sel) => {
    people.forEach((p) => {
      const on = !sel || p === sel;
      p.arrow.userData.mat.opacity = on ? 1 : 0.18;
      p.label.material.opacity = on ? 1 : 0.25;
      p.btn.classList.toggle('on', p === sel);
    });
    const p = sel || people[0];
    const terms = me.map((m, i) => `${m}×${p.v[i]}`).join(' + ');
    readout.innerHTML =
      `나·${p.name} = ${terms}\n      = <span class="hl">${p.dot}</span>\n` +
      `코사인 = ${p.dot} ÷ (${fmt(norm(me))}×${fmt(norm(p.v))}) = ${p.cos.toFixed(4)}`;
  };
  select(null);
}

// =====================================================================
// 3. Matrix as a machine: warp the plane from I to M
// =====================================================================
function matrixScene() {
  const el = document.getElementById('viz-mat');
  const s = el && stage(el, {
    pos: [5.5, -1.5, 15.5], target: [2, 3.2, 0], fov: 40,
    fit: (cam, aspect) => { cam.position.setLength(aspect < 1 ? 26 : 17.5); },
  });
  if (!s) return;
  const v = [1, 2];
  const R = 3;
  const base = [];
  for (let i = -R; i <= R; i++) {
    base.push([i, -R], [i, R], [-R, i], [R, i]);
  }
  s.scene.add(lines(base.map(([x, y]) => new THREE.Vector3(x, y, 0)), { color: '--border', opacity: 0.9 }));

  const warpGeo = new THREE.BufferGeometry();
  warpGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.length * 3), 3));
  const warpMat = new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: 0.45 });
  s.scene.add(new THREE.LineSegments(warpGeo, warpMat));

  const e1 = arrow(C.red, 0.045);
  const e2 = arrow(C.green, 0.045);
  const inArrow = arrow('#9ca3af', 0.06);
  inArrow.userData.mat.opacity = 0.55;
  inArrow.userData.set(new THREE.Vector3(...v, 0));
  const outArrow = arrow(C.orange, 0.075);
  const inLabel = label('v = [1, 2]', { color: '--muted', size: 0.42 });
  inLabel.position.set(v[0] - 1.1, v[1] + 0.2, 0);
  const outLabel = label('', { color: C.orange, size: 0.5 });
  const e1Label = label('1열', { color: C.red, size: 0.36 });
  const e2Label = label('2열', { color: C.green, size: 0.36 });
  s.scene.add(e1, e2, inArrow, outArrow, inLabel, outLabel, e1Label, e2Label);

  const readout = document.getElementById('mat-readout');
  const note = document.getElementById('mat-note');
  const buttons = document.querySelectorAll('#mat-presets [data-m]');
  const notes = {
    '2,0,1,3': '2×2 기계 예시. 1열 [2,1]은 x축 화살표가, 2열 [0,3]은 y축 화살표가 가는 곳이다.',
    '1,0,0,1': '단위행렬: 들어간 그대로 나온다. 격자가 움직이지 않는다.',
    '0,1,1,0': '골라내기 행렬: 1행이 2번 칸을, 2행이 1번 칸을 가져와 자리가 맞바뀐다.',
    '2,0,0,2': '방향은 그대로, 크기만 2배. vec_scale(v, 2)와 같다.',
  };
  let M = [2, 0, 1, 3];
  let t = 0;
  let playing = false;

  const apply = (m, [x, y]) => [m[0] * x + m[1] * y, m[2] * x + m[3] * y];
  const draw = () => {
    const k = ease(t);
    const m = [1 + (M[0] - 1) * k, M[1] * k, M[2] * k, 1 + (M[3] - 1) * k];
    const pos = warpGeo.attributes.position;
    base.forEach((p, i) => {
      const [x, y] = apply(m, p);
      pos.setXYZ(i, x, y, 0.01);
    });
    pos.needsUpdate = true;
    const c1 = [m[0], m[2]];
    const c2 = [m[1], m[3]];
    e1.userData.set(new THREE.Vector3(...c1, 0.02));
    e2.userData.set(new THREE.Vector3(...c2, 0.02));
    e1Label.position.set(c1[0] + 0.35, c1[1] - 0.3, 0);
    e2Label.position.set(c2[0] - 0.45, c2[1] + 0.2, 0);
    const o = apply(m, v);
    outArrow.userData.set(new THREE.Vector3(...o, 0.04));
    outLabel.userData.set({ text: `[${fmt(o[0], 1)}, ${fmt(o[1], 1)}]` });
    outLabel.position.set(o[0] + 0.9, o[1] + 0.3, 0);
  };
  const explain = () => {
    const out = apply(M, v);
    readout.innerHTML =
      `M = [[${M[0]}, ${M[1]}], [${M[2]}, ${M[3]}]]   v = [${v.join(', ')}]\n` +
      `1행 [${M[0]}, ${M[1]}]·v = ${M[0]}×1 + ${M[1]}×2 = <span class="hl">${out[0]}</span>\n` +
      `2행 [${M[2]}, ${M[3]}]·v = ${M[2]}×1 + ${M[3]}×2 = <span class="hl">${out[1]}</span>\n` +
      `결과 = [${out.join(', ')}]`;
    note.textContent = notes[M.join(',')];
  };
  const play = () => { t = reduce ? 1 : 0; playing = !reduce; draw(); };

  buttons.forEach((b) => b.addEventListener('click', () => {
    buttons.forEach((x) => x.classList.toggle('on', x === b));
    M = b.dataset.m.split(',').map(Number);
    explain();
    play();
  }));
  explain();
  t = 1;
  draw();
  s.onEnter = play;
  s.update = (dt) => {
    if (!playing) return;
    t = Math.min(1, t + dt / 1.8);
    if (t >= 1) playing = false;
    draw();
  };
}

// =====================================================================
// 4. Softmax bars
// =====================================================================
function softmaxScene() {
  const el = document.getElementById('viz-softmax');
  const s = el && stage(el, { pos: [3.2, 4.2, 7.8], target: [0, 1.4, 0] });
  if (!s) return;
  const H = 3.4; // bar height for probability 1
  const colors = [C.blue, C.purple, C.orange];
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 0.06, 2),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.6 }),
  );
  floor.position.y = -0.03;
  onTheme(() => floor.material.color.set(cssVar('--border')));
  s.scene.add(floor);
  // Guide line at probability 1
  s.scene.add(lines([new THREE.Vector3(-2.8, H, -0.6), new THREE.Vector3(2.8, H, -0.6)], { color: '--muted', opacity: 0.5 }));
  const oneLabel = label('p = 1', { color: '--muted', size: 0.26, weight: 600 });
  oneLabel.position.set(-3.2, H, -0.6);
  s.scene.add(oneLabel);

  const bars = colors.map((c, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 }),
    );
    mesh.position.x = (i - 1) * 1.8;
    mesh.scale.set(1.1, 0.001, 1.1);
    const top = label('', { color: '--text', size: 0.36 });
    const bottom = label('', { color: '--muted', size: 0.3, weight: 600 });
    bottom.position.set(mesh.position.x, -0.3, 0.9);
    s.scene.add(mesh, top, bottom);
    return { mesh, top, bottom, h: 0, target: 0 };
  });

  const kIn = document.getElementById('sm-k');
  const kVal = document.getElementById('sm-k-val');
  const table = document.getElementById('sm-table');
  const note = document.getElementById('sm-note');
  const buttons = document.querySelectorAll('#sm-presets [data-x]');
  let xs = [1, 2, 3];

  const compute = () => {
    const k = Number(kIn.value);
    kVal.textContent = String(k);
    const z = xs.map((x) => x * k);
    const m = Math.max(...z);
    const e = z.map((x) => Math.exp(x - m));
    const sum = e.reduce((acc, x) => acc + x, 0);
    const p = e.map((x) => x / sum);
    const top = p.indexOf(Math.max(...p));
    bars.forEach((b, i) => {
      b.target = p[i];
      b.top.userData.set({ text: p[i].toFixed(3) });
      b.bottom.userData.set({ text: `x = ${fmt(z[i])}` });
    });
    table.innerHTML =
      '<thead><tr><th>칸</th><th>x</th><th>x − max</th><th>e^(x−max)</th><th>p</th></tr></thead><tbody>' +
      z.map((x, i) => `<tr class="${i === top ? 'top' : ''}"><td>${i + 1}</td><td>${fmt(x)}</td><td>${fmt(x - m)}</td><td>${e[i].toFixed(3)}</td><td>${p[i].toFixed(3)}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>합</td><td></td><td></td><td>${sum.toFixed(3)}</td><td>${p.reduce((a, b) => a + b, 0).toFixed(3)}</td></tr></tfoot>`;
    note.textContent = p[top] > 0.99
      ? '1등이 거의 다 가져간다. 어텐션은 점수에 10을 곱해서 이렇게 한 자리만 콕 집어 본다.'
      : m > 700
        ? 'exp(1000)은 넘치지만, 최댓값을 빼면 가장 큰 칸이 exp(0) = 1이 되어 안전하다.'
        : '최댓값을 뺀 뒤 exp → 합으로 나누기. 점수 순서는 그대로 남는다.';
  };
  kIn.addEventListener('input', compute);
  buttons.forEach((b) => b.addEventListener('click', () => {
    buttons.forEach((x) => x.classList.toggle('on', x === b));
    xs = b.dataset.x.split(',').map(Number);
    compute();
  }));
  compute();
  s.onEnter = () => { if (!reduce) bars.forEach((b) => { b.h = 0; }); };

  s.update = (dt) => {
    const f = reduce ? 1 : 1 - Math.exp(-dt * 7);
    bars.forEach((b) => {
      b.h += (b.target - b.h) * f;
      const h = Math.max(b.h * H, 0.001);
      b.mesh.scale.y = h;
      b.mesh.position.y = h / 2;
      b.top.position.set(b.mesh.position.x, h + 0.3, 0);
    });
  };
}

// =====================================================================
// 5. embed(): 8 positions × 32 cells
// =====================================================================
function embedScene() {
  const el = document.getElementById('viz-embed');
  const s = el && stage(el, {
    pos: [0, 19, 13], target: [-0.6, 0, 0.6], fov: 36,
    fit: (cam, aspect) => {
      const half = Math.tan((cam.fov * Math.PI) / 360);
      const need = Math.max(21 / (half * aspect), 8 / half);
      cam.position.copy(new THREE.Vector3(0, 19, 13).setLength(need * 1.02)).add(new THREE.Vector3(-0.6, 0, 0.6));
    },
  });
  if (!s) return;
  const words = ['BOS', 'sun', 'moon', 'fire', 'hot', 'cold', 'big', 'wet'];
  const toks = [1, 2, 5, 3, 6, 4, 7, 2];
  const regions = [
    { from: 1, to: 8, name: '1–8 지금 토큰', c: C.blue },
    { from: 9, to: 16, name: '9–16 직전 토큰 (1층이 채움)', c: C.green },
    { from: 17, to: 24, name: '17–24 위치', c: C.orange },
    { from: 25, to: 32, name: '25–32 정답 (2층이 채움)', c: C.pink },
  ];
  const regionOf = (col) => regions[Math.floor((col - 1) / 8)];
  const X = (col) => (col - 16.5) * 1.05 + Math.floor((col - 1) / 8) * 0.5 - 0.75;
  const Z = (t) => (t - 4.5) * 1.15;

  const dimMats = new Map();
  const litMats = new Map();
  regions.forEach((r) => {
    dimMats.set(r, new THREE.MeshStandardMaterial({ color: r.c, transparent: true, opacity: 0.16, roughness: 0.8 }));
    litMats.set(r, new THREE.MeshStandardMaterial({ color: r.c, roughness: 0.35, emissive: r.c, emissiveIntensity: 0.15 }));
  });
  const geo = new THREE.BoxGeometry(0.9, 1, 0.95);
  const cells = [];
  for (let t = 1; t <= 8; t++) {
    for (let c = 1; c <= 32; c++) {
      const mesh = new THREE.Mesh(geo, dimMats.get(regionOf(c)));
      mesh.position.set(X(c), 0.06, Z(t));
      mesh.scale.y = 0.12;
      mesh.userData = { t, c, h: 0.12, target: 0.12 };
      cells.push(mesh);
      s.scene.add(mesh);
    }
    const w = label(`${t} ${words[toks[t - 1] - 1]}`, { color: '--text', size: 0.62 });
    w.position.set(X(1) - 2, 0.2, Z(t));
    s.scene.add(w);
  }
  regions.forEach((r) => {
    const l = label(r.name, { color: r.c, size: 0.62 });
    l.position.set((X(r.from) + X(r.to)) / 2, 0.4, Z(1) - 1.4);
    s.scene.add(l);
  });

  // Highlight frame around the hovered row
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(X(32) - X(1) + 1.4, 0.04, 1.12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.12 }),
  );
  onTheme(() => frame.material.color.set(cssVar('--accent')));
  frame.position.set((X(1) + X(32)) / 2, -0.02, Z(8));
  s.scene.add(frame);

  const readout = document.getElementById('embed-readout');
  const posBtn = document.getElementById('embed-pos');
  const noposBtn = document.getElementById('embed-nopos');
  let withPos = true;
  let row = 8;

  const isLit = (t, c) => c === toks[t - 1] || (withPos && c === 16 + t);
  const litCells = (t) => [toks[t - 1], ...(withPos ? [16 + t] : [])];
  const refresh = () => {
    cells.forEach((m) => {
      const { t, c } = m.userData;
      const on = isLit(t, c);
      m.material = on ? litMats.get(regionOf(c)) : dimMats.get(regionOf(c));
      m.userData.target = on ? 1.2 : 0.12;
    });
    describe();
  };
  const describe = () => {
    const word = words[toks[row - 1] - 1];
    const lit = litCells(row);
    const same = toks.map((tok, i) => i + 1).filter((t) => t !== row && toks[t - 1] === toks[row - 1]);
    let text =
      `자리 ${row} · ${word} → 켜진 칸 {${lit.join(', ')}}\n` +
      `  ${toks[row - 1]}번 칸 = 토큰 번호 ${toks[row - 1]} (${word})` +
      (withPos ? `\n  ${16 + row}번 칸 = 16 + ${row} (${row}번째 자리)` : '');
    if (same.length) {
      const o = same[0];
      text += withPos
        ? `\n\n같은 ${word}인 ${o}번 자리는 {${litCells(o).join(', ')}}: 자리 칸이 달라 <span class="hl">구별된다</span>.`
        : `\n\n같은 ${word}인 ${o}번 자리도 {${litCells(o).join(', ')}}: 벡터가 <span class="neg">완전히 같아</span> 구별이 안 된다.`;
    }
    text += `\n\n켜진 칸 ${withPos ? 16 : 8}개 / 전체 256칸`;
    readout.innerHTML = text;
  };
  const setRow = (t) => {
    if (t === row) return;
    row = t;
    frame.position.z = Z(t);
    describe();
  };

  posBtn.addEventListener('click', () => { withPos = true; posBtn.classList.add('on'); noposBtn.classList.remove('on'); refresh(); });
  noposBtn.addEventListener('click', () => { withPos = false; noposBtn.classList.add('on'); posBtn.classList.remove('on'); refresh(); });

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (e) => {
    const r = s.renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pointer, s.camera);
    const hit = ray.intersectObjects(cells, false)[0];
    if (hit) setRow(hit.object.userData.t);
  };
  s.renderer.domElement.addEventListener('pointermove', (e) => { if (e.buttons === 0) pick(e); });
  s.renderer.domElement.addEventListener('click', pick);

  refresh();
  s.onEnter = () => {
    if (reduce) return;
    cells.forEach((m) => { m.userData.h = 0.12; });
  };
  s.update = (dt) => {
    const f = reduce ? 1 : 1 - Math.exp(-dt * 6);
    cells.forEach((m) => {
      const d = m.userData;
      if (Math.abs(d.target - d.h) < 0.001) return;
      d.h += (d.target - d.h) * f;
      m.scale.y = d.h;
      m.position.y = d.h / 2;
    });
  };
}

// =====================================================================
// 6. Layer-1 attention weights: 8×8 bars, scale and causal mask
// =====================================================================
const WORDS = ['BOS', 'sun', 'moon', 'fire', 'hot', 'cold', 'big', 'wet'];
const SENT = [1, 2, 5, 3, 6, 4, 7, 2];
const softmaxArr = (v) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

function attnScene() {
  const el = document.getElementById('viz-attn');
  const s = el && stage(el, {
    pos: [6.5, 9.5, 10.5], target: [0, 0.6, 0.3], fov: 36,
    fit: (cam, aspect) => { cam.position.setLength(aspect < 1 ? 24 : 15.5); },
  });
  if (!s) return;
  const X = (k) => (k - 4.5) * 1.1; // k_pos → x
  const Z = (q) => (q - 4.5) * 1.1; // q_pos → z
  const H = 3;
  const geo = new THREE.BoxGeometry(0.82, 1, 0.82);
  const barMat = new THREE.MeshStandardMaterial({ color: C.blue, roughness: 0.4 });
  const hotMat = new THREE.MeshStandardMaterial({ color: C.orange, roughness: 0.4 });
  const maskMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.25 });
  onTheme(() => maskMat.color.set(cssVar('--muted')));
  const bars = [];
  for (let q = 1; q <= 8; q++) {
    for (let k = 1; k <= 8; k++) {
      const m = new THREE.Mesh(geo, barMat);
      m.position.set(X(k), 0, Z(q));
      m.userData = { q, k, h: 0.02, target: 0.02 };
      bars.push(m);
      s.scene.add(m);
    }
    const ql = label(`${q} ${WORDS[SENT[q - 1] - 1]}`, { color: '--text', size: 0.42 });
    ql.position.set(X(1) - 1.5, 0.1, Z(q));
    s.scene.add(ql);
    const kl = label(String(q), { color: '--muted', size: 0.38 });
    kl.position.set(X(q), 0.1, Z(1) - 1.1);
    s.scene.add(kl);
  }
  const axisL = label('보는 자리 (k) →', { color: '--muted', size: 0.36, weight: 600 });
  axisL.position.set(X(8) + 0.4, 0.1, Z(1) - 1.9);
  s.scene.add(axisL);

  const scaleIn = document.getElementById('attn-scale');
  const scaleVal = document.getElementById('attn-scale-val');
  const maskBtns = document.querySelectorAll('#attn-mask [data-mask]');
  const readout = document.getElementById('attn-readout');
  let masked = true;
  let row = 3;
  const weights = () => {
    const sc = Number(scaleIn.value);
    const out = [];
    for (let q = 1; q <= 8; q++) {
      const ks = masked ? q : 8;
      // q of position q lights cell q−1, k of position k lights cell k → dot is 1 only at k = q−1
      const scores = Array.from({ length: ks }, (_, i) => (i + 1 === q - 1 ? sc : 0));
      out.push(softmaxArr(scores));
    }
    return out;
  };
  const refresh = () => {
    scaleVal.textContent = scaleIn.value;
    const w = weights();
    bars.forEach((m) => {
      const { q, k } = m.userData;
      const p = w[q - 1][k - 1];
      if (p === undefined) { m.material = maskMat; m.userData.target = 0.02; return; }
      m.material = k === q - 1 || (q === 1 && k === 1) ? hotMat : barMat;
      m.userData.target = Math.max(p * H, 0.02);
    });
    const r = w[row - 1];
    readout.innerHTML =
      `${row}번 자리 (${WORDS[SENT[row - 1] - 1]})  배율 ${scaleIn.value}${masked ? ' · 마스킹' : ' · 마스킹 없음'}\n` +
      `가중치 [${r.map((p) => p.toFixed(3)).join(', ')}]\n` +
      (row === 1 ? '앞이 없으니 자기 자신만 본다.'
        : `직전 자리 ${row - 1}번에 <span class="hl">${(r[row - 2] * 100).toFixed(1)}%</span>` +
          (masked ? '' : ` · 미래 자리(${row + 1}~8)에 ${(r.slice(row).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%`));
  };
  scaleIn.addEventListener('input', refresh);
  maskBtns.forEach((b) => b.addEventListener('click', () => {
    masked = b.dataset.mask === 'on';
    maskBtns.forEach((x) => x.classList.toggle('on', x === b));
    refresh();
  }));

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const pick = (e) => {
    const r = s.renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, s.camera);
    const hit = ray.intersectObjects(bars, false)[0];
    if (hit && hit.object.userData.q !== row) { row = hit.object.userData.q; refresh(); }
  };
  s.renderer.domElement.addEventListener('pointermove', (e) => { if (e.buttons === 0) pick(e); });
  s.renderer.domElement.addEventListener('click', pick);
  refresh();
  s.onEnter = () => { if (!reduce) bars.forEach((m) => { m.userData.h = 0.02; }); };
  s.update = (dt) => {
    const f = reduce ? 1 : 1 - Math.exp(-dt * 7);
    bars.forEach((m) => {
      const d = m.userData;
      if (Math.abs(d.target - d.h) < 0.001) return;
      d.h += (d.target - d.h) * f;
      m.scale.y = d.h;
      m.position.y = d.h / 2;
    });
  };
}

// =====================================================================
// 7. Learning rate on a bowl-shaped loss surface (illustration)
// =====================================================================
function bowlScene() {
  const el = document.getElementById('viz-bowl');
  const s = el && stage(el, { pos: [7, 7.5, 9], target: [0, 0.8, 0], fov: 38 });
  if (!s) return;
  // f(x, y) = 0.5·x² + 3·y²: gentle along x, steep along y
  const f = (x, y) => 0.5 * x * x + 3 * y * y;
  const grad = (x, y) => [x, 6 * y];
  const S = 0.32; // height scale
  const R = 3.2;
  const RY = 1.6; // the steep axis gets a narrower range so the bowl is not clipped
  const seg = 48;
  const geo = new THREE.PlaneGeometry(2 * R, 2 * RY, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = -pos.getZ(i);
    pos.setY(i, Math.min(f(x, y), 14) * S);
  }
  geo.computeVertexNormals();
  const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: C.cyan, transparent: true, opacity: 0.35, side: THREE.DoubleSide, roughness: 0.8 }));
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.18 }));
  onTheme(() => wire.material.color.set(cssVar('--muted')));
  s.scene.add(surf, wire);

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshStandardMaterial({ color: C.orange, roughness: 0.3 }));
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
  trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: C.orange }));
  trail.frustumCulled = false;
  s.scene.add(ball, trail);
  const goal = label('바닥', { color: '--muted', size: 0.32, weight: 600 });
  goal.position.set(0, 0.25, 0);
  s.scene.add(goal);

  const btns = document.querySelectorAll('#bowl-lr [data-lr]');
  const readout = document.getElementById('bowl-readout');
  const to3 = (x, y) => new THREE.Vector3(x, Math.min(f(x, y), 14) * S + 0.12, -y);
  let path = [];
  let t = 0;
  const run = (lr) => {
    path = [[-2.6, 1.1]];
    for (let n = 0; n < 30; n++) {
      const [x, y] = path[path.length - 1];
      const [gx, gy] = grad(x, y);
      const nx = x - lr * gx;
      const ny = y - lr * gy;
      path.push([nx, ny]);
      if (Math.abs(nx) > R || Math.abs(ny) > RY) break;
    }
    t = reduce ? path.length - 1 : 0;
    const last = path[path.length - 1];
    const out = Math.abs(last[0]) > R || Math.abs(last[1]) > RY;
    readout.innerHTML =
      `학습률 ${lr} · ${path.length - 1}걸음\n` +
      (out ? '<span class="neg">한 걸음이 골짜기를 건너뛰어 점점 더 높이 튕겨 나간다.</span>'
        : `손실 ${fmt(f(...path[0]), 2)} → <span class="hl">${fmt(f(...last), 4)}</span>` +
          (lr >= 0.3 ? '  (가파른 쪽으로 좌우로 출렁이며 내려감)' : '  (출렁임 없이 내려감)'));
  };
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.classList.toggle('on', x === b));
    run(Number(b.dataset.lr));
  }));
  run(0.1);
  s.onEnter = () => { if (!reduce) t = 0; };
  s.update = (dt) => {
    t = Math.min(t + dt * 4, path.length - 1);
    const i = Math.floor(t);
    const a = path[i];
    const b = path[Math.min(i + 1, path.length - 1)];
    const k = t - i;
    const cx = a[0] + (b[0] - a[0]) * k;
    const cy = a[1] + (b[1] - a[1]) * k;
    ball.position.copy(to3(Math.max(-R, Math.min(R, cx)), Math.max(-RY, Math.min(RY, cy))));
    const pts = path.slice(0, i + 1).map(([x, y]) => to3(Math.max(-R, Math.min(R, x)), Math.max(-RY, Math.min(RY, y)))).concat([ball.position.clone()]);
    const attr = trailGeo.attributes.position;
    pts.slice(0, 40).forEach((p, k) => attr.setXYZ(k, p.x, p.y, p.z));
    attr.needsUpdate = true;
    trailGeo.setDrawRange(0, Math.min(pts.length, 40));
  };
}

// =====================================================================
// 8. Superposition: more words than dimensions
// =====================================================================
function superScene() {
  const el = document.getElementById('viz-super');
  const s = el && stage(el, { pos: [3.6, 2.8, 4.6], target: [0, 0, 0], fov: 38, autoRotate: true });
  if (!s) return;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 20), new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.12 }));
  onTheme(() => sphere.material.color.set(cssVar('--muted')));
  s.scene.add(sphere);
  s.scene.add(lines([new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0), new THREE.Vector3(0, -2, 0), new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 0, -2), new THREE.Vector3(0, 0, 2)], { color: '--border' }));
  const palette = [C.blue, C.orange, C.green, C.purple, C.pink, C.yellow, C.red, C.cyan];
  const arrows = palette.map((c) => arrow(c, 0.035));
  const labels = palette.map((c) => label('', { color: c, size: 0.26 }));
  arrows.forEach((a) => s.scene.add(a));
  labels.forEach((l) => s.scene.add(l));
  const btns = document.querySelectorAll('#super-mode [data-n]');
  const again = document.getElementById('super-again');
  const readout = document.getElementById('super-readout');
  let n = 3;
  const randUnit = () => {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    return v.lengthSq() < 1e-4 ? randUnit() : v.normalize();
  };
  const draw = () => {
    const vs = n === 3 ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)] : Array.from({ length: n }, randUnit);
    arrows.forEach((a, i) => {
      a.visible = i < n;
      labels[i].visible = i < n;
      if (i >= n) return;
      a.userData.set(vs[i].clone().multiplyScalar(1.6));
      labels[i].userData.set({ text: WORDS[i] });
      labels[i].position.copy(vs[i]).multiplyScalar(1.85);
    });
    const ds = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) ds.push(Math.abs(vs[i].dot(vs[j])));
    const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
    readout.innerHTML =
      `3칸(3차원)에 단어 ${n}개 · 서로 다른 쌍 ${ds.length}개\n` +
      `평균 간섭 |내적| = <span class="${avg < 1e-9 ? 'zero' : 'neg'}">${avg.toFixed(4)}</span>   최대 = ${Math.max(...ds).toFixed(4)}` +
      (n === 3 ? '\n칸 수만큼은 완전히 직교로 담을 수 있다.' : '\n칸보다 단어가 많으면 어떤 배치로도 간섭을 0으로 만들 수 없다.');
  };
  btns.forEach((b) => b.addEventListener('click', () => {
    n = Number(b.dataset.n);
    btns.forEach((x) => x.classList.toggle('on', x === b));
    again.disabled = n === 3;
    draw();
  }));
  again.addEventListener('click', draw);
  again.disabled = true;
  draw();
}

dotScene();
peopleScene();
matrixScene();
softmaxScene();
embedScene();
attnScene();
bowlScene();
superScene();
requestAnimationFrame(loop);
