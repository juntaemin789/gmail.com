// 공간 만들기: 광장과 방 6개의 바닥, 벽, 가구, 조명.
// 단위는 미터. x는 동쪽(+), z는 남쪽(+). 방은 가로세로 20m (-10 ~ +10).
import * as THREE from '/vendor/three.module.js';

const HALF = 10;
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------- 직접 그려서 만드는 바닥·벽 무늬 ----------
function tex(size, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speckle(g, s, n, alpha) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`;
    g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
}
const woodTex = (base, repeat) => tex(512, (g, s) => {
  const rows = 6, h = s / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd(0, s / 2);
    while (x < s) {
      const w = rnd(s * 0.35, s * 0.6);
      g.fillStyle = shade(base, rnd(-0.05, 0.05));
      g.fillRect(x, r * h, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.07)';
      for (let k = 0; k < 5; k++) { // 나뭇결
        const y = r * h + rnd(4, h - 4);
        g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + w * 0.3, y + rnd(-3, 3), x + w * 0.6, y + rnd(-3, 3), x + w, y); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + w - 1.5, r * h, 1.5, h);
      x += w;
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, r * h, s, 1.5);
  }
}, repeat);
const tileTex = (base, grout, repeat) => tex(256, (g, s) => {
  g.fillStyle = grout; g.fillRect(0, 0, s, s);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = shade(base, rnd(-0.025, 0.025));
    g.fillRect(x * s / 2 + 2, y * s / 2 + 2, s / 2 - 4, s / 2 - 4);
  }
  speckle(g, s, 500, 0.05);
}, repeat);
const fabricTex = (base, repeat) => tex(256, (g, s) => { g.fillStyle = base; g.fillRect(0, 0, s, s); speckle(g, s, 9000, 0.09); }, repeat);
const concreteTex = (base, repeat) => tex(512, (g, s) => {
  g.fillStyle = base; g.fillRect(0, 0, s, s); speckle(g, s, 14000, 0.07);
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${rnd(0.02, 0.05)})`; g.beginPath(); g.ellipse(rnd(0, s), rnd(0, s), rnd(20, 70), rnd(10, 40), rnd(0, 3), 0, 7); g.fill(); }
}, repeat);
const paveTex = (base, repeat) => tex(512, (g, s) => {
  g.fillStyle = shade(base, -0.18); g.fillRect(0, 0, s, s);
  const n = 4, w = s / n, h = s / (n * 2);
  for (let r = 0; r < n * 2; r++) for (let c = -1; c < n; c++) {
    g.fillStyle = shade(base, rnd(-0.05, 0.05));
    g.fillRect(c * w + (r % 2) * w / 2 + 2, r * h + 2, w - 4, h - 4);
  }
  speckle(g, s, 6000, 0.06);
}, repeat);
const grassTex = (repeat) => tex(256, (g, s) => {
  g.fillStyle = '#5d9b4a'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `hsl(${rnd(92, 122)},${rnd(35, 55)}%,${rnd(28, 46)}%)`; g.fillRect(rnd(0, s), rnd(0, s), 2, rnd(2, 5)); }
}, repeat);
const facadeTex = (wall, lit) => tex(512, (g, s) => {
  g.fillStyle = wall; g.fillRect(0, 0, s, s); speckle(g, s, 5000, 0.04);
  const cols = 4, rows = 4, w = s / cols, h = s / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const on = Math.random() < lit;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(c * w + w * 0.2 - 3, r * h + h * 0.2 - 3, w * 0.6 + 6, h * 0.58 + 6);
    g.fillStyle = on ? `hsl(${rnd(38, 52)},85%,${rnd(62, 76)}%)` : `hsl(210,${rnd(25, 40)}%,${rnd(30, 44)}%)`;
    g.fillRect(c * w + w * 0.2, r * h + h * 0.2, w * 0.6, h * 0.58);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(c * w + w * 0.2, r * h + h * 0.2, w * 0.6, h * 0.12);
    g.fillStyle = wall; g.fillRect(c * w + w * 0.49, r * h + h * 0.2, w * 0.025, h * 0.58);
  }
}, 1);
const spinesTex = () => tex(256, (g, s) => { // 책등
  g.fillStyle = '#2a211b'; g.fillRect(0, 0, s, s);
  let x = 2;
  while (x < s - 6) {
    const w = rnd(8, 20), h = rnd(s * 0.72, s * 0.94);
    g.fillStyle = `hsl(${rnd(0, 360)},${rnd(25, 60)}%,${rnd(28, 62)}%)`;
    g.fillRect(x, s - h, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, s - h + h * 0.18, w - 4, 3);
    x += w + 1;
  }
}, 1);
function textTex(lines, o) {
  const c = document.createElement('canvas');
  c.width = o.w || 512; c.height = o.h || 256;
  const g = c.getContext('2d');
  g.fillStyle = o.bg || '#222'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = o.color || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => {
    g.font = `${i === 0 ? '800' : '500'} ${i === 0 ? (o.size || 64) : (o.size2 || 34)}px "Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif`;
    g.fillText(l, c.width / 2, c.height * (i + 1) / (lines.length + 1) + (i === 0 ? -4 : 6));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function skyTex(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom);
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- 공간을 조립하는 도구 ----------
class Builder {
  constructor() {
    this.group = new THREE.Group();
    this.colliders = [];   // 지나갈 수 없는 곳: {x, z, r} 원 또는 {x, z, hw, hd} 네모
    this.npcs = [];
    this.flicker = [];     // 일렁이는 불빛
  }
  mat(color, o) {
    o = o || {};
    return new THREE.MeshStandardMaterial({
      color, roughness: o.r == null ? 0.8 : o.r, metalness: o.m || 0, map: o.map || null,
      emissive: o.e || 0x000000, emissiveIntensity: o.ei == null ? 1 : o.ei,
      transparent: !!o.op, opacity: o.op || 1, side: o.side || THREE.FrontSide
    });
  }
  add(geo, m, x, y, z, parent, noShadow) {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    if (!noShadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    (parent || this.group).add(mesh);
    return mesh;
  }
  box(w, h, d, m, x, y, z, parent, noShadow) { return this.add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, noShadow); }
  cyl(rt, rb, h, m, x, y, z, parent, seg) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg || 18), m, x, y, z, parent); }
  sph(r, m, x, y, z, parent, noShadow) { return this.add(new THREE.SphereGeometry(r, 16, 12), m, x, y, z, parent, noShadow); }
  // 가구 묶음을 (x, z)에 놓고 q×90도 돌림. w, d를 주면 그 크기로 통행을 막음
  place(f, x, z, q, w, d) {
    f.position.set(x, 0, z);
    f.rotation.y = -(q || 0) * Math.PI / 2;
    this.group.add(f);
    if (w) this.colliders.push((q || 0) % 2 ? { x, z, hw: d / 2, hd: w / 2 } : { x, z, hw: w / 2, hd: d / 2 });
    return f;
  }
  circle(x, z, r) { this.colliders.push({ x, z, r }); }
  light(color, intensity, dist, x, y, z, flicker) {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(x, y, z);
    this.group.add(l);
    if (flicker) this.flicker.push({ light: l, base: intensity });
    return l;
  }

  // --- 방의 뼈대 ---
  floor(map, size, color) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size || 20, size || 20), this.mat(color || '#ffffff', { map, r: 0.75 }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
    this.group.add(m);
    return m;
  }
  // 안쪽에서만 보이는 벽 4면 (카메라가 벽 밖으로 나가도 방 안이 보임)
  walls(color, height, trimColor, map) {
    const h = height || 3.4;
    const wallMat = this.mat(color, { r: 0.92, map });
    const trim = this.mat(trimColor || '#f4f1ea', { r: 0.6 });
    [[0, -HALF, 0], [0, HALF, Math.PI], [-HALF, 0, Math.PI / 2], [HALF, 0, -Math.PI / 2]].forEach(([x, z, ry]) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(20, h), wallMat);
      w.position.set(x, h / 2, z); w.rotation.y = ry; w.receiveShadow = true;
      this.group.add(w);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.14), trim);
      b.position.set(x * 0.999, 0.07, z * 0.999); b.rotation.y = ry;
      this.group.add(b);
    });
    this.wallH = h;
  }
  // 벽에 붙이는 평면 (그림, 창문, 간판). wall: 'n' | 'w' | 'e'
  onWall(wall, along, y, w, h, m, off) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    const o = HALF - (off || 0.02);
    if (wall === 'n') p.position.set(along, y, -o);
    else if (wall === 'w') { p.position.set(-o, y, along); p.rotation.y = Math.PI / 2; }
    else if (wall === 'e') { p.position.set(o, y, along); p.rotation.y = -Math.PI / 2; }
    else { p.position.set(along, y, o); p.rotation.y = Math.PI; }
    this.group.add(p);
    return p;
  }
  window(wall, along, w, h, glow, y) {
    const cy = y || 1.9;
    this.onWall(wall, along, cy, w + 0.16, h + 0.16, this.mat('#f5f2ec', { r: 0.5 }), 0.03);
    this.onWall(wall, along, cy, w, h, this.mat(glow, { e: glow, ei: 0.85, r: 0.2 }), 0.04);
    this.onWall(wall, along, cy, 0.06, h, this.mat('#f5f2ec'), 0.05);
    this.onWall(wall, along, cy, w, 0.06, this.mat('#f5f2ec'), 0.05);
  }
  picture(wall, along, y, w, h, map, frame) {
    this.onWall(wall, along, y, w + 0.12, h + 0.12, this.mat(frame || '#2b2420', { r: 0.5 }), 0.03);
    this.onWall(wall, along, y, w, h, this.mat('#ffffff', { map, r: 0.7 }), 0.04);
  }
  // 나가는 문: 남쪽 벽에 붙은 문과 바닥 매트
  exitDoor(x, z, matColor) {
    const door = this.onWall('s', x, 1.1, 1.3, 2.2, this.mat('#5a4332', { r: 0.6 }), 0.03);
    door.receiveShadow = true;
    this.onWall('s', x, 2.42, 0.9, 0.24, this.mat('#1f7a45', { map: textTex(['EXIT'], { w: 256, h: 64, bg: '#1f7a45', size: 46 }), e: '#1f7a45', ei: 0.7 }), 0.04);
    const mat = this.box(1.6, 0.02, 1.0, this.mat(matColor || '#3b3b40', { r: 1 }), x, 0.011, z, null, true);
    mat.receiveShadow = true;
  }

  // --- 가구 ---
  chair(x, z, q, color) {
    const f = new THREE.Group(), m = this.mat(color, { r: 0.7 }), leg = this.mat('#2a2a2e', { r: 0.5, m: 0.3 });
    this.box(0.44, 0.05, 0.44, m, 0, 0.46, 0, f);
    this.box(0.44, 0.46, 0.05, m, 0, 0.74, -0.2, f);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => this.box(0.04, 0.45, 0.04, leg, a * 0.19, 0.225, b * 0.19, f));
    this.place(f, x, z, q); this.circle(x, z, 0.24);
  }
  stool(x, z, color) {
    const f = new THREE.Group();
    this.cyl(0.19, 0.17, 0.07, this.mat(color, { r: 0.5 }), 0, 0.47, 0, f);
    this.cyl(0.04, 0.16, 0.44, this.mat('#9aa0a6', { r: 0.35, m: 0.7 }), 0, 0.22, 0, f, 10);
    this.place(f, x, z); this.circle(x, z, 0.2);
  }
  table(x, z, w, d, color, q, legColor) {
    const f = new THREE.Group(), m = this.mat(color, { r: 0.55 }), leg = this.mat(legColor || '#2a2a2e', { r: 0.5, m: 0.3 });
    this.box(w, 0.05, d, m, 0, 0.74, 0, f);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => this.box(0.05, 0.72, 0.05, leg, a * (w / 2 - 0.07), 0.36, b * (d / 2 - 0.07), f));
    this.place(f, x, z, q, w, d);
    return f;
  }
  roundTable(x, z, r, color, h) {
    const f = new THREE.Group(), hh = h || 0.74;
    this.cyl(r, r, 0.045, this.mat(color, { r: 0.5 }), 0, hh, 0, f, 28);
    this.cyl(0.045, 0.045, hh, this.mat('#2a2a2e', { r: 0.4, m: 0.5 }), 0, hh / 2, 0, f, 10);
    this.cyl(r * 0.5, r * 0.55, 0.03, this.mat('#2a2a2e', { r: 0.4, m: 0.5 }), 0, 0.015, 0, f);
    this.place(f, x, z); this.circle(x, z, r * 0.7);
  }
  // 둥근 테이블 하나와 둘러앉는 의자들
  tableSet(x, z, n, topColor, chairColor) {
    this.roundTable(x, z, 0.5, topColor);
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + Math.PI / 4;
      const cx = x + Math.sin(a) * 0.95, cz = z + Math.cos(a) * 0.95;
      const f = new THREE.Group(), m = this.mat(chairColor, { r: 0.7 }), leg = this.mat('#2a2a2e', { r: 0.5, m: 0.3 });
      this.box(0.42, 0.05, 0.42, m, 0, 0.46, 0, f);
      this.box(0.42, 0.44, 0.05, m, 0, 0.72, -0.19, f);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([p, q]) => this.box(0.04, 0.45, 0.04, leg, p * 0.18, 0.225, q * 0.18, f));
      f.position.set(cx, 0, cz); f.rotation.y = a + Math.PI; // 테이블을 바라보게
      this.group.add(f); this.circle(cx, cz, 0.24);
    }
    // 테이블 위 컵
    this.cyl(0.04, 0.035, 0.09, this.mat('#ffffff', { r: 0.3 }), x + 0.15, 0.81, z + 0.1, null, 10);
    this.cyl(0.04, 0.035, 0.09, this.mat('#ffffff', { r: 0.3 }), x - 0.18, 0.81, z - 0.12, null, 10);
  }
  sofa(x, z, q, w, color) {
    const f = new THREE.Group(), m = this.mat(color, { r: 0.95, map: fabricTex('#ffffff', 2) });
    this.box(w, 0.3, 0.9, m, 0, 0.21, 0, f);
    this.box(w, 0.55, 0.22, m, 0, 0.62, -0.34, f);
    this.box(0.2, 0.42, 0.9, m, -w / 2 + 0.1, 0.5, 0, f);
    this.box(0.2, 0.42, 0.9, m, w / 2 - 0.1, 0.5, 0, f);
    const seats = Math.max(1, Math.round((w - 0.4) / 0.75)), sw = (w - 0.44) / seats;
    const cm = this.mat(shade(color, 0.04), { r: 1, map: fabricTex('#ffffff', 1) });
    for (let i = 0; i < seats; i++) this.box(sw - 0.04, 0.14, 0.62, cm, -w / 2 + 0.22 + sw * (i + 0.5), 0.43, 0.1, f);
    this.box(0.06, 0.06, 0.06, this.mat('#2a2a2e'), 0, 0.03, 0, f);
    this.place(f, x, z, q, w, 0.9);
  }
  lowTable(x, z, w, d, color) {
    const f = new THREE.Group();
    this.box(w, 0.06, d, this.mat(color, { r: 0.45 }), 0, 0.4, 0, f);
    this.box(w - 0.2, 0.34, d - 0.2, this.mat(shade(color, -0.1), { r: 0.6 }), 0, 0.19, 0, f);
    this.box(0.26, 0.03, 0.2, this.mat('#c44d4d'), -0.2, 0.445, 0.05, f); // 책
    this.cyl(0.05, 0.04, 0.1, this.mat('#ffffff', { r: 0.3 }), 0.25, 0.48, -0.1, f, 10);
    this.place(f, x, z, 0, w, d);
  }
  counter(x, z, w, d, q, bodyColor, topColor) {
    const f = new THREE.Group();
    this.box(w, 1.0, d, this.mat(bodyColor, { r: 0.7 }), 0, 0.5, 0, f);
    this.box(w + 0.1, 0.06, d + 0.12, this.mat(topColor, { r: 0.35 }), 0, 1.03, 0, f);
    this.place(f, x, z, q, w, d);
    return f;
  }
  plant(x, z, s) {
    const k = s || 1, f = new THREE.Group();
    this.cyl(0.2 * k, 0.15 * k, 0.36 * k, this.mat('#c9c2b6', { r: 0.9 }), 0, 0.18 * k, 0, f, 14);
    const leaf = this.mat('#3f7d3a', { r: 0.9 });
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, m = this.add(new THREE.SphereGeometry(0.2 * k, 8, 6), leaf, Math.sin(a) * 0.16 * k, (0.62 + (i % 3) * 0.22) * k, Math.cos(a) * 0.16 * k, f);
      m.scale.set(1, 1.5, 0.55); m.rotation.y = a; m.rotation.z = 0.5;
    }
    this.place(f, x, z); this.circle(x, z, 0.22 * k);
  }
  floorLamp(x, z, color, intensity) {
    const f = new THREE.Group(), metal = this.mat('#2a2a2e', { r: 0.4, m: 0.6 });
    this.cyl(0.16, 0.18, 0.03, metal, 0, 0.015, 0, f);
    this.cyl(0.015, 0.015, 1.5, metal, 0, 0.76, 0, f, 8);
    const shadeM = this.cyl(0.14, 0.22, 0.3, this.mat('#fff3d6', { e: color, ei: 1.2, r: 0.9, side: THREE.DoubleSide }), 0, 1.6, 0, f, 20);
    shadeM.castShadow = false;
    this.place(f, x, z); this.circle(x, z, 0.16);
    if (intensity) this.light(color, intensity, 9, x, 1.55, z);
  }
  pendant(x, z, y, color, intensity) {
    const top = this.wallH || 3.4;
    this.cyl(0.006, 0.006, top - y, this.mat('#1c1c1f'), x, (top + y) / 2, z, null, 6).castShadow = false;
    this.cyl(0.07, 0.2, 0.2, this.mat('#1c1c1f', { r: 0.4, m: 0.5, side: THREE.DoubleSide }), x, y, z, null, 20).castShadow = false;
    this.sph(0.055, this.mat('#fff0c8', { e: color, ei: 2.2 }), x, y - 0.07, z, null, true);
    if (intensity) this.light(color, intensity, 9, x, y - 0.2, z);
  }
  bookshelf(x, z, q, w, height) {
    const f = new THREE.Group(), h = height || 2.1, wood = this.mat('#6e4f37', { r: 0.7 });
    this.box(w, h, 0.36, wood, 0, h / 2, 0, f);
    const rows = Math.floor(h / 0.48);
    for (let i = 0; i < rows; i++) {
      const t = spinesTex(); t.repeat.set(Math.max(1, Math.round(w / 0.9)), 1);
      this.box(w - 0.1, 0.38, 0.02, this.mat('#ffffff', { map: t, r: 0.8 }), 0, 0.3 + i * 0.48, 0.18, f, true);
    }
    this.place(f, x, z, q, w, 0.36);
  }
  pcDesk(x, z, q, glow) {
    const f = new THREE.Group(), dark = this.mat('#1d1f26', { r: 0.5 });
    this.box(1.3, 0.05, 0.7, this.mat('#2b2e38', { r: 0.5 }), 0, 0.74, 0, f);
    this.box(0.05, 0.72, 0.66, dark, -0.6, 0.36, 0, f);
    this.box(0.05, 0.72, 0.66, dark, 0.6, 0.36, 0, f);
    this.box(0.78, 0.46, 0.04, dark, 0, 1.12, -0.2, f);                                   // 모니터
    this.box(0.72, 0.4, 0.01, this.mat('#0b1020', { e: glow, ei: 1.1, r: 0.2 }), 0, 1.12, -0.176, f, true);
    this.box(0.08, 0.14, 0.08, dark, 0, 0.84, -0.2, f);
    this.box(0.44, 0.02, 0.14, this.mat('#111', { e: glow, ei: 0.25 }), 0, 0.775, 0.12, f, true); // 키보드
    this.box(0.2, 0.44, 0.44, this.mat('#15161b', { e: glow, ei: 0.12 }), 0.42, 0.22, 0, f);      // 본체
    // 게이밍 의자
    const seat = this.mat('#17181d', { r: 0.6 }), accent = this.mat(glow, { r: 0.6 });
    this.box(0.5, 0.1, 0.5, seat, 0, 0.48, 0.75, f);
    this.box(0.5, 0.78, 0.1, seat, 0, 0.92, 1.0, f);
    this.box(0.12, 0.78, 0.11, accent, 0, 0.92, 1.0, f);
    this.cyl(0.04, 0.04, 0.4, this.mat('#555', { m: 0.7, r: 0.3 }), 0, 0.24, 0.75, f, 8);
    this.cyl(0.28, 0.28, 0.04, seat, 0, 0.04, 0.75, f, 5);
    this.place(f, x, z, q);
    const dz = (q || 0) % 2 ? 0 : (q === 2 ? -0.35 : 0.35), dx = (q || 0) % 2 ? (q === 1 ? -0.35 : 0.35) : 0;
    this.colliders.push((q || 0) % 2 ? { x: x + dx, z, hw: 0.75, hd: 0.65 } : { x, z: z + dz, hw: 0.65, hd: 0.75 });
  }
  arcade(x, z, q, color, screen) {
    const f = new THREE.Group(), body = this.mat(color, { r: 0.5 });
    this.box(0.75, 1.85, 0.8, body, 0, 0.925, 0, f);
    this.box(0.62, 0.5, 0.02, this.mat('#05060c', { e: screen, ei: 1.3 }), 0, 1.28, 0.405, f, true);
    this.box(0.75, 0.22, 0.02, this.mat('#111', { e: color, ei: 1.4 }), 0, 1.72, 0.405, f, true);
    this.box(0.75, 0.08, 0.3, this.mat('#111', { r: 0.4 }), 0, 0.92, 0.5, f);
    this.sph(0.035, this.mat('#e03131', { e: '#e03131', ei: 0.6 }), -0.15, 1.0, 0.52, f, true);
    this.place(f, x, z, q, 0.75, 1.1);
  }
  fridge(x, z, q, glow) {
    const f = new THREE.Group();
    this.box(0.9, 1.95, 0.7, this.mat('#d9dde2', { r: 0.35, m: 0.4 }), 0, 0.975, 0, f);
    this.box(0.76, 1.5, 0.02, this.mat('#dff3ff', { e: glow || '#bfe6ff', ei: 0.9, r: 0.1 }), 0, 1.1, 0.355, f, true);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      this.box(0.07, 0.2, 0.02, this.mat(['#2f9e44', '#e03131', '#f08c00', '#1971c2'][(r + c) % 4]), -0.3 + c * 0.12, 0.52 + r * 0.36, 0.368, f, true);
    }
    this.place(f, x, z, q, 0.9, 0.7);
  }
  rug(x, z, w, d, color, round) {
    const m = this.mat(color, { r: 1, map: fabricTex('#ffffff', 3) });
    const g = round ? new THREE.CylinderGeometry(w / 2, w / 2, 0.02, 40) : new THREE.BoxGeometry(w, 0.02, d);
    const r = this.add(g, m, x, 0.012, z, null, true);
    r.receiveShadow = true;
  }
  beanbag(x, z, color) {
    const m = this.sph(0.5, this.mat(color, { r: 1, map: fabricTex('#ffffff', 2) }), x, 0.28, z);
    m.scale.set(1, 0.62, 1);
    this.circle(x, z, 0.42);
  }
  // --- 야외 ---
  tree(x, z, s, dark) {
    const k = s || 1, f = new THREE.Group();
    this.cyl(0.13 * k, 0.2 * k, 2.2 * k, this.mat('#6b4a2f', { r: 1 }), 0, 1.1 * k, 0, f, 8);
    const leaf = this.mat(dark ? '#2f5d38' : '#4f9a45', { r: 1 });
    [[0, 3.0, 0, 1.3], [0.7, 2.5, 0.2, 0.95], [-0.6, 2.6, -0.3, 1.0], [0.1, 3.7, -0.1, 0.9]].forEach(([a, b, c, r]) => {
      this.add(new THREE.IcosahedronGeometry(r * k, 1), leaf, a * k, b * k, c * k, f);
    });
    this.place(f, x, z); this.circle(x, z, 0.3 * k);
  }
  bench(x, z, q) {
    const f = new THREE.Group(), wood = this.mat('#8a5a35', { r: 0.8 }), metal = this.mat('#2a2a2e', { m: 0.5, r: 0.4 });
    [-0.13, 0, 0.13].forEach((o) => this.box(1.6, 0.04, 0.11, wood, 0, 0.45, o, f));
    [0.62, 0.78].forEach((y) => this.box(1.6, 0.11, 0.04, wood, 0, y, -0.22, f));
    [-0.7, 0.7].forEach((o) => { this.box(0.05, 0.45, 0.4, metal, o, 0.225, 0, f); this.box(0.05, 0.45, 0.05, metal, o, 0.65, -0.22, f); });
    this.place(f, x, z, q, 1.6, 0.5);
  }
  streetLamp(x, z, color, intensity) {
    const metal = this.mat('#2a2d33', { m: 0.5, r: 0.5 });
    this.cyl(0.05, 0.08, 3.6, metal, x, 1.8, z, null, 10);
    this.sph(0.2, this.mat('#fff6d8', { e: color || '#ffe9a8', ei: intensity ? 2.5 : 0.5 }), x, 3.7, z, null, true);
    this.circle(x, z, 0.14);
    if (intensity) this.light(color, intensity, 12, x, 3.5, z);
  }
  fountain(x, z) {
    const stone = this.mat('#c9c6bf', { r: 0.9, map: concreteTex('#ffffff', 2) });
    this.cyl(1.75, 1.85, 0.5, stone, x, 0.25, z, null, 36);
    this.cyl(1.52, 1.52, 0.06, this.mat('#4fa8d8', { r: 0.08, m: 0.2, op: 0.82 }), x, 0.49, z, null, 36).castShadow = false;
    this.cyl(0.22, 0.3, 1.3, stone, x, 0.9, z, null, 14);
    this.cyl(0.75, 0.3, 0.2, stone, x, 1.55, z, null, 24);
    this.cyl(0.66, 0.66, 0.03, this.mat('#4fa8d8', { r: 0.08, op: 0.82 }), x, 1.65, z, null, 24).castShadow = false;
    this.cyl(0.05, 0.08, 0.5, this.mat('#bfe3f5', { op: 0.6, r: 0.1 }), x, 1.9, z, null, 8).castShadow = false;
    this.circle(x, z, 1.9);
  }
  // 건물. 정면이 광장 쪽을 보도록 q로 돌림. 문과 차양, 간판 포함
  building(x, z, q, w, h, wall, accent, signText) {
    const f = new THREE.Group(), d = 7;
    const t = facadeTex(wall, 0.25); t.repeat.set(Math.round(w / 3.5), Math.max(1, Math.round((h - 3) / 3)));
    this.box(w, h, d, this.mat(wall, { r: 0.9 }), 0, h / 2, -d / 2, f);
    this.box(w, h - 3.1, 0.02, this.mat('#ffffff', { map: t, r: 0.8 }), 0, 3.1 + (h - 3.1) / 2, 0.012, f, true);
    this.box(w + 0.3, 0.25, d + 0.3, this.mat(shade(wall, -0.15)), 0, h + 0.12, -d / 2, f);
    // 1층: 진열창과 문
    const gw = (w - 1.5) / 2 - 0.7, glass = this.mat('#6f8fa3', { r: 0.08, m: 0.5, e: '#ffd9a0', ei: 0.22 });
    [-1, 1].forEach((side) => {
      const gx = side * (0.75 + 0.35 + gw / 2);
      this.box(gw + 0.16, 1.76, 0.03, this.mat(shade(wall, -0.22), { r: 0.6 }), gx, 1.5, 0.016, f, true);
      this.box(gw, 1.6, 0.02, glass, gx, 1.5, 0.034, f, true);
      this.box(gw + 0.3, 0.5, 0.3, this.mat(shade(wall, -0.12), { r: 0.9 }), gx, 0.25, 0.15, f); // 화단 턱
    });
    this.box(1.5, 2.5, 0.06, this.mat(shade(accent, -0.2), { r: 0.5 }), 0, 1.25, 0.03, f);
    this.box(1.2, 2.25, 0.04, this.mat('#2a2018', { r: 0.4, e: '#ffcf8a', ei: 0.25 }), 0, 1.13, 0.06, f, true);
    this.sph(0.04, this.mat('#d4af37', { m: 0.8, r: 0.3 }), 0.42, 1.1, 0.1, f, true);
    const awn = this.box(w - 0.4, 0.08, 1.3, this.mat(accent, { r: 0.9 }), 0, 2.78, 0.6, f);
    awn.rotation.x = 0.16;
    const sign = this.box(Math.min(w - 1, 4.4), 0.7, 0.08, this.mat('#ffffff', { map: textTex([signText], { w: 512, h: 96, bg: shade(accent, -0.25), size: 60 }), r: 0.6 }), 0, 3.5, 0.06, f, true);
    sign.castShadow = false;
    this.box(1.7, 0.02, 1.0, this.mat('#3a3a3f', { r: 1 }), 0, 0.011, 0.75, f, true).receiveShadow = true; // 문 앞 매트
    this.place(f, x, z, q);
  }
  stringLights(x1, z1, x2, z2, y, color) {
    const bulb = this.mat('#fff2c4', { e: color, ei: 2.4 }), n = 14;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, sag = Math.sin(t * Math.PI) * 0.45;
      const p = new THREE.Vector3(x1 + (x2 - x1) * t, y - sag, z1 + (z2 - z1) * t);
      pts.push(p);
      if (i > 0 && i < n) this.sph(0.05, bulb, p.x, p.y - 0.05, p.z, null, true);
    }
    this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x222222 })));
  }
}

// ---------- 각 공간 ----------
const SCENES = {
  plaza(b) {
    b.floor(paveTex('#cfc8bb', 9), 20);
    const lawn = b.floor(grassTex(50), 140); lawn.position.y = -0.02;
    b.fountain(0, 0);
    b.bench(-3.6, 3.2, 2); b.bench(3.6, 3.2, 2); b.bench(-3.6, -3.4, 0); b.bench(3.6, -3.4, 0);
    b.tree(-8.3, 8.3, 1.1); b.tree(8.3, 8.3, 1.2); b.tree(-8.6, -8.4, 1); b.tree(8.6, -8.4, 1.05); b.tree(0, -8.9, 0.9);
    [[-13, 13, 1.4], [13, 14, 1.3], [-6, 15, 1.2], [5, 16, 1.5], [-17, 4, 1.3], [17, 5, 1.2], [0, 19, 1.6], [-11, 20, 1.3], [12, 21, 1.2]].forEach(([x, z, s]) => b.tree(x, z, s, true));
    b.streetLamp(-6.2, 6.2); b.streetLamp(6.2, 6.2); b.streetLamp(-6.2, -6.2); b.streetLamp(6.2, -6.2);
    // 화단
    [[-6.5, 0], [6.5, 0]].forEach(([x, z]) => {
      b.box(1.6, 0.35, 1.6, b.mat('#8d8778', { r: 1 }), x, 0.175, z);
      for (let i = 0; i < 9; i++) b.sph(0.2, b.mat(['#e8596a', '#f6c445', '#f08fc0', '#ffffff'][i % 4], { r: 0.9 }), x + rnd(-0.55, 0.55), 0.45, z + rnd(-0.55, 0.55));
      b.colliders.push({ x, z, hw: 0.8, hd: 0.8 });
    });
    // 건물: 북쪽 2, 서쪽 2, 동쪽 2 (문 위치는 src/rooms.js의 portals와 같아야 함)
    b.building(-3.75, -10.3, 0, 6.6, 7.5, '#d9c4a5', '#8a5a2b', '카페 쉼표');
    b.building(3.75, -10.3, 0, 6.6, 9, '#d8b7bd', '#b5536f', '고민 라운지');
    b.building(-10.3, -2.5, 3, 5.6, 8, '#3a3f58', '#7c3aed', 'PC방');
    b.building(-10.3, 4, 3, 5.6, 5.5, '#c96a3a', '#d9480f', '포장마차');
    b.building(10.3, -2.5, 1, 5.6, 7, '#b9c7d8', '#2457a6', '스터디룸');
    b.building(10.3, 4, 1, 5.6, 14, '#8f98a8', '#e8b923', '루프탑');
    // 멀리 보이는 건물들
    [[-22, -20, 9, 14], [-9, -24, 8, 20], [4, -25, 10, 16], [18, -21, 9, 24], [-26, 2, 8, 12], [27, -4, 8, 18], [25, 14, 9, 11], [-25, 16, 8, 15]].forEach(([x, z, w, h]) => {
      const t = facadeTex('#aab3c2', 0.15); t.repeat.set(2, Math.round(h / 4));
      b.box(w, h, w, b.mat('#ffffff', { map: t, r: 0.9 }), x, h / 2, z, null, true);
    });
    return {
      bg: skyTex('#6fb1ea', '#dcefff'), fog: ['#dcefff', 35, 90],
      hemi: ['#cfe6ff', '#8a9a70', 1.15], sun: ['#fff4dc', 2.6, [9, 16, 10]], outdoor: true
    };
  },

  cafe(b) {
    b.floor(woodTex('#b98a5e', 5));
    b.walls('#efe6d8', 3.4, '#5a4332');
    // 카운터와 뒤쪽 선반
    b.counter(0, -7.6, 6.2, 0.8, 0, '#5a4332', '#e9e2d6');
    b.box(0.5, 0.42, 0.42, b.mat('#b8bcc2', { m: 0.8, r: 0.25 }), -1.9, 1.27, -7.6);          // 에스프레소 머신
    b.box(0.34, 0.36, 0.3, b.mat('#23252b', { r: 0.4 }), 2.0, 1.24, -7.6);                     // 계산대
    b.box(1.1, 0.34, 0.5, b.mat('#f4f1ea', { op: 0.45, r: 0.1 }), 0.6, 1.23, -7.6, null, true); // 진열대
    [-0.25, 0.05, 0.35].forEach((o, i) => b.cyl(0.11, 0.11, 0.07, b.mat(['#e9b872', '#8b5a3c', '#f3d9c1'][i]), 0.6 + o, 1.1, -7.6, null, 14));
    [1.5, 2.1].forEach((y) => {
      b.box(5.6, 0.05, 0.3, b.mat('#5a4332', { r: 0.7 }), 0, y, -9.8);
      for (let i = 0; i < 12; i++) b.cyl(0.055, 0.05, rnd(0.14, 0.26), b.mat(['#ffffff', '#3a2a22', '#c98f4e', '#6f8f72'][i % 4], { r: 0.4 }), -2.5 + i * 0.45, y + 0.13, -9.8, null, 10);
    });
    b.picture('n', 4.6, 2.2, 2.4, 1.3, textTex(['MENU', '아메리카노  4,000', '카페라떼  4,500', '바닐라라떼  5,000'], { w: 512, h: 288, bg: '#26211d', size: 52, size2: 30 }));
    b.picture('n', -4.8, 2.1, 1.6, 1.6, textTex(['쉼표 ,', 'coffee & talk'], { w: 256, h: 256, bg: '#d9c4a5', color: '#3a2a22', size: 62, size2: 26 }), '#f4f1ea');
    b.npcs.push({ x: 0.2, z: -8.7, ry: 0, name: '바리스타', look: { skin: 1, hair: 3, hairColor: 1, top: 1, bottom: 1 } });
    [-2.4, 0, 2.4].forEach((x, i) => b.pendant(x, -7.3, 2.35, '#ffcf8a', i === 1 ? 26 : 0));
    // 좌석
    b.tableSet(-5.6, -2.6, 3, '#d9c1a0', '#3d3a36'); b.tableSet(-5.8, 2.6, 2, '#d9c1a0', '#3d3a36');
    b.tableSet(5.4, -2.8, 3, '#d9c1a0', '#7a5c44'); b.tableSet(5.8, 2.4, 2, '#d9c1a0', '#7a5c44');
    b.tableSet(0, 0.4, 4, '#2f2a26', '#8a6a4f');
    b.table(-8.9, 6.6, 0.6, 2.6, '#b98a5e', 0); b.stool(-8.3, 5.8, '#3d3a36'); b.stool(-8.3, 6.6, '#3d3a36'); b.stool(-8.3, 7.4, '#3d3a36');
    b.sofa(7.4, 7.6, 2, 2.6, '#7a8b6f'); b.lowTable(7.4, 6.2, 1.1, 0.6, '#5a4332');
    b.rug(0, 0.4, 3.6, 3.6, '#a9907a', true);
    b.window('w', -3, 2.6, 1.7, '#cfe8ff'); b.window('w', 2.5, 2.6, 1.7, '#cfe8ff'); b.window('e', -3, 2.6, 1.7, '#cfe8ff'); b.window('e', 2.5, 2.6, 1.7, '#cfe8ff');
    b.plant(-9.2, -9.1, 1.3); b.plant(9.2, -9.1, 1.3); b.plant(9.2, 9.0, 1.1); b.plant(-9.3, 2.6, 0.9);
    b.pendant(-5.6, -2.6, 2.3, '#ffcf8a', 14); b.pendant(5.4, -2.8, 2.3, '#ffcf8a', 14); b.pendant(0, 0.4, 2.3, '#ffcf8a', 0);
    b.exitDoor(0, 9.25);
    return { bg: '#1c1714', hemi: ['#fff1dc', '#6b5644', 0.85], sun: ['#ffe2b8', 1.5, [6, 14, 8]] };
  },

  lounge(b) {
    b.floor(woodTex('#7a5a45', 5));
    b.walls('#e6d3d0', 3.4, '#f7f1ee');
    // 벽난로
    b.box(2.6, 2.2, 0.5, b.mat('#b9a79f', { r: 0.95, map: concreteTex('#ffffff', 1) }), 0, 1.1, -9.7);
    b.box(1.3, 0.9, 0.1, b.mat('#120c0a'), 0, 0.5, -9.42, null, true);
    b.box(0.9, 0.3, 0.06, b.mat('#ff8a2b', { e: '#ff6a00', ei: 2.4 }), 0, 0.26, -9.38, null, true);
    b.box(2.9, 0.08, 0.6, b.mat('#5a4332'), 0, 1.35, -9.65);
    b.light('#ff9a4a', 22, 10, 0, 0.7, -8.6, true);
    b.colliders.push({ x: 0, z: -9.7, hw: 1.3, hd: 0.3 });
    b.picture('n', 0, 2.45, 1.5, 0.9, textTex(['천천히, 편하게'], { w: 512, h: 288, bg: '#c98f8f', size: 54 }), '#f7f1ee');
    // 벽난로 앞 소파
    b.rug(0, -5.6, 6.2, 4.6, '#b6889a');
    b.sofa(0, -3.6, 2, 3.0, '#c9a5ad'); b.sofa(-3.0, -6.0, 1, 2.3, '#a98a9c'); b.sofa(3.0, -6.0, 3, 2.3, '#a98a9c');
    b.lowTable(0, -5.9, 1.5, 0.8, '#5a4332');
    // 구석 자리
    b.rug(-6.2, 4.4, 3.6, 3.6, '#8f9db5', true);
    b.sofa(-6.2, 6.3, 2, 2.3, '#7f8fb0'); b.sofa(-8.2, 4.2, 1, 2.0, '#7f8fb0'); b.lowTable(-6.0, 4.2, 1.1, 0.7, '#3a2d25');
    b.rug(6.2, 4.4, 3.6, 3.6, '#c7b08a', true);
    b.sofa(6.2, 6.3, 2, 2.3, '#c9a46a'); b.sofa(8.2, 4.2, 3, 2.0, '#c9a46a'); b.lowTable(6.0, 4.2, 1.1, 0.7, '#3a2d25');
    b.bookshelf(-9.78, -5.5, 3, 3.2); b.bookshelf(9.78, -5.5, 1, 3.2);
    b.floorLamp(-4.6, -3.2, '#ffc98a', 16); b.floorLamp(4.6, -3.2, '#ffc98a', 0); b.floorLamp(-8.9, 7.6, '#ffc98a', 14); b.floorLamp(8.9, 7.6, '#ffc98a', 14);
    b.plant(-9.1, -9.1, 1.4); b.plant(9.1, -9.1, 1.4); b.plant(-9.2, 0.2, 1); b.plant(9.2, 0.2, 1);
    b.window('w', 4.5, 2.4, 1.8, '#ffd9b8'); b.window('e', 4.5, 2.4, 1.8, '#ffd9b8');
    b.picture('w', -1.5, 2.0, 1.2, 1.5, textTex(['♡'], { w: 256, h: 320, bg: '#f2c9cf', color: '#b5536f', size: 150 }), '#f7f1ee');
    b.picture('e', -1.5, 2.0, 1.2, 1.5, textTex(['talk'], { w: 256, h: 320, bg: '#cfd8ea', color: '#4a5f8a', size: 80 }), '#f7f1ee');
    b.exitDoor(0, 9.25, '#6b4a55');
    return { bg: '#191314', hemi: ['#ffe6d9', '#5a4640', 0.6], sun: ['#ffd9b0', 0.9, [5, 14, 9]] };
  },

  pcroom(b) {
    b.floor(tileTex('#2a2d3a', '#16171f', 10));
    b.walls('#1b1d2b', 3.4, '#7c3aed');
    const glows = ['#22d3ee', '#f472b6', '#a78bfa', '#34d399'];
    // 서쪽·동쪽 벽을 따라 놓인 자리와 가운데 두 줄
    [-6.2, -3.6, -1.0, 1.6, 4.2].forEach((z, i) => {
      b.pcDesk(-9.2, z, 3, glows[i % 4]); b.pcDesk(9.2, z, 1, glows[(i + 1) % 4]);
    });
    [-4.6, -2.2, 0.2, 2.6].forEach((z, i) => {
      b.pcDesk(-2.6, z, 3, glows[(i + 2) % 4]); b.pcDesk(2.6, z, 1, glows[(i + 3) % 4]);
    });
    b.box(0.08, 1.3, 9.4, b.mat('#14151c'), -3.0, 0.65, -1.0); b.box(0.08, 1.3, 9.4, b.mat('#14151c'), 3.0, 0.65, -1.0);
    // 북쪽: 오락기와 카운터
    [['#e03131', '#ffd43b'], ['#1971c2', '#63e6be'], ['#f08c00', '#ff8787'], ['#7048e8', '#74c0fc']].forEach(([c, s], i) => b.arcade(-8.4 + i * 1.15, -9.3, 0, c, s));
    b.counter(6.4, -8.0, 4.6, 0.8, 0, '#22242e', '#3b3f52');
    b.fridge(8.8, -9.5, 0, '#9be7ff');
    b.box(0.34, 0.36, 0.3, b.mat('#111', { e: '#22d3ee', ei: 0.4 }), 5.2, 1.24, -8.0);
    for (let i = 0; i < 5; i++) b.box(0.22, 0.3, 0.16, b.mat(['#e03131', '#f08c00', '#2f9e44', '#1971c2', '#f472b6'][i]), 6.3 + i * 0.32, 1.21, -8.1);
    b.npcs.push({ x: 6.4, z: -9.0, ry: 0, name: '알바', look: { skin: 0, hair: 4, hairColor: 0, top: 1, bottom: 1 } });
    // 네온 조명
    const neon = (c, wall, along, y, w) => b.onWall(wall, along, y, w, 0.07, b.mat('#ffffff', { e: c, ei: 3 }), 0.03);
    neon('#f472b6', 'n', 0, 3.0, 19.6); neon('#22d3ee', 'n', 0, 2.8, 19.6);
    neon('#22d3ee', 'w', 0, 3.0, 19.6); neon('#f472b6', 'e', 0, 3.0, 19.6);
    b.picture('n', 1.2, 2.0, 3.4, 1.0, textTex(['GAME ZONE'], { w: 512, h: 150, bg: '#0d0e17', color: '#f472b6', size: 78 }), '#22d3ee');
    b.light('#b79cff', 46, 18, 0, 3.0, -1); b.light('#22d3ee', 30, 14, -6, 2.8, 5); b.light('#f472b6', 30, 14, 6, 2.8, 5);
    b.rug(0, 6.6, 5.2, 2.6, '#2b2350');
    b.beanbag(-1.5, 6.6, '#7c3aed'); b.beanbag(1.5, 6.6, '#0ea5b7');
    b.exitDoor(0, 9.25, '#2b2350');
    return { bg: '#07070d', hemi: ['#9aa6ff', '#2a2a44', 0.95], sun: ['#b9c6ff', 1.1, [4, 14, 8]] };
  },

  pocha(b) {
    b.floor(concreteTex('#9a958c', 4));
    b.walls('#d2552c', 3.2, '#3a3a3f', fabricTex('#ffffff', 6));
    // 주방
    b.counter(0, -7.8, 8.4, 0.9, 0, '#8d9197', '#c7ccd1');
    [-3.2, -2.2].forEach((x) => { b.cyl(0.3, 0.3, 0.3, b.mat('#b9bec4', { m: 0.8, r: 0.3 }), x, 1.22, -7.8, null, 20); b.cyl(0.27, 0.27, 0.02, b.mat('#b5432b', { e: '#b5432b', ei: 0.25 }), x, 1.36, -7.8, null, 20); });
    b.box(1.2, 0.08, 0.7, b.mat('#2a2a2e'), 1.6, 1.1, -7.8);                                    // 철판
    for (let i = 0; i < 6; i++) b.cyl(0.04, 0.04, 0.3, b.mat('#c98f4e'), 1.2 + i * 0.16, 1.17, -7.8, null, 8).rotation.x = Math.PI / 2;
    b.fridge(-8.6, -9.5, 0, '#c8f3d2'); b.fridge(-7.6, -9.5, 0, '#c8f3d2');
    b.box(3.4, 1.9, 0.4, b.mat('#8d9197', { m: 0.5, r: 0.4 }), 6.4, 0.95, -9.75); b.colliders.push({ x: 6.4, z: -9.75, hw: 1.7, hd: 0.25 });
    b.picture('n', 0, 2.45, 5.2, 0.9, textTex(['오늘의 안주', '떡볶이 · 어묵탕 · 닭꼬치 · 계란말이 · 파전'], { w: 1024, h: 180, bg: '#f4e3b5', color: '#8a1f12', size: 70, size2: 36 }), '#8a1f12');
    b.npcs.push({ x: 0, z: -8.9, ry: 0, name: '사장님', look: { skin: 2, hair: 3, hairColor: 0, top: 2, bottom: 1 } });
    // 플라스틱 테이블과 의자
    const sets = [[-5.8, -3.6], [0, -3.4], [5.8, -3.6], [-6.2, 1.6], [-0.6, 2.0], [5.6, 1.4], [-5.4, 6.4], [5.8, 6.2]];
    sets.forEach(([x, z], i) => {
      b.roundTable(x, z, 0.6, i % 2 ? '#c9302c' : '#2e6fd1', 0.72);
      const n = 3 + (i % 2);
      for (let k = 0; k < n; k++) { const a = k * Math.PI * 2 / n + i; b.stool(x + Math.sin(a) * 1.0, z + Math.cos(a) * 1.0, i % 2 ? '#2e6fd1' : '#c9302c'); }
      b.cyl(0.035, 0.045, 0.24, b.mat('#2f9e44', { r: 0.2, op: 0.85 }), x + 0.15, 0.86, z, null, 10);   // 병
      b.cyl(0.16, 0.12, 0.07, b.mat('#f4f1ea', { r: 0.4 }), x - 0.14, 0.78, z + 0.1, null, 14);          // 접시
    });
    // 줄지어 달린 전구
    b.stringLights(-9.5, -5, 9.5, -5, 3.0, '#ffd27a'); b.stringLights(-9.5, 0.5, 9.5, 0.5, 3.0, '#ffd27a'); b.stringLights(-9.5, 6, 9.5, 6, 3.0, '#ffd27a');
    b.light('#ffc56b', 34, 14, 0, 2.7, -4.5); b.light('#ffc56b', 26, 13, -4, 2.7, 3.5); b.light('#ffc56b', 26, 13, 4, 2.7, 3.5);
    [-7.5, 7.5].forEach((x) => { // 붉은 등
      b.cyl(0.22, 0.22, 0.5, b.mat('#e03131', { e: '#ff3b30', ei: 1.3 }), x, 2.5, -8.9, null, 14).castShadow = false;
    });
    b.box(0.6, 0.9, 0.6, b.mat('#2e6fd1', { r: 0.6 }), 9.2, 0.45, 8.6); b.box(0.6, 0.9, 0.6, b.mat('#e8a530', { r: 0.6 }), 8.5, 0.45, 9.1); // 박스
    b.colliders.push({ x: 8.9, z: 8.8, hw: 0.7, hd: 0.6 });
    b.exitDoor(0, 9.25, '#5a2a1c');
    return { bg: '#150c08', hemi: ['#ffd9b0', '#4a3326', 0.5], sun: ['#ffc98a', 0.7, [5, 14, 9]] };
  },

  study(b) {
    b.floor(woodTex('#d4b78f', 5));
    b.walls('#f1f3f5', 3.4, '#cfd6de');
    b.bookshelf(-6.4, -9.78, 0, 5.6, 2.6); b.bookshelf(-0.3, -9.78, 0, 5.6, 2.6);
    b.bookshelf(-9.78, -3.5, 3, 5.0, 2.6); b.bookshelf(-9.78, 3.0, 3, 5.0, 2.6);
    // 화이트보드
    b.picture('e', -2, 1.9, 4.2, 1.7, textTex(['이번 주 목표', '하루 2시간 · 꾸준히 · 포기하지 않기'], { w: 768, h: 310, bg: '#fbfbfb', color: '#2457a6', size: 62, size2: 34 }), '#9aa3ad');
    b.window('n', 6.2, 3.4, 1.8, '#d6ecff'); b.window('e', 4.6, 2.6, 1.8, '#d6ecff');
    // 긴 책상 세 줄
    [-4.6, -0.6, 3.4].forEach((z, r) => {
      [-2.6, 3.6].forEach((x) => {
        b.table(x, z, 4.4, 1.1, '#e6d2b0', 0, '#8b96a3');
        for (let i = 0; i < 4; i++) {
          const cx = x - 1.65 + i * 1.1;
          b.chair(cx, z - 0.95, 0, '#4a6fa5'); b.chair(cx, z + 0.95, 2, '#4a6fa5');
          if ((i + r) % 2 === 0) { // 스탠드와 책
            b.cyl(0.07, 0.09, 0.02, b.mat('#2a2a2e'), cx, 0.775, z, null, 12);
            b.cyl(0.01, 0.01, 0.34, b.mat('#2a2a2e'), cx, 0.94, z, null, 6);
            b.sph(0.06, b.mat('#fff3c4', { e: '#ffe9a8', ei: 1.8 }), cx, 1.1, z, null, true);
          } else b.box(0.3, 0.05, 0.22, b.mat(['#c44d4d', '#2f6f4f', '#2457a6'][(i + r) % 3]), cx, 0.79, z + 0.2);
        }
      });
    });
    b.sofa(7.6, 7.6, 2, 2.6, '#6f86a8'); b.lowTable(7.6, 6.2, 1.1, 0.6, '#8b6b4a'); b.rug(7.6, 6.6, 3.6, 3.4, '#aeb9c9');
    b.plant(9.2, -9.1, 1.3); b.plant(-9.2, 8.9, 1.2); b.plant(3.2, -9.2, 1);
    b.floorLamp(9.0, 9.0, '#fff1cf', 12);
    b.light('#ffffff', 26, 16, -3, 3.1, -1); b.light('#ffffff', 22, 16, 4, 3.1, 2);
    b.exitDoor(0, 9.25, '#4a5568');
    return { bg: '#1b1e22', hemi: ['#ffffff', '#9a8f80', 1.0], sun: ['#fff7ea', 1.6, [6, 15, 8]] };
  },

  rooftop(b) {
    b.floor(woodTex('#6f5a4a', 6));
    // 난간
    const wallM = b.mat('#3a3f4a', { r: 0.9, map: concreteTex('#ffffff', 3) }), rail = b.mat('#c9ced6', { m: 0.8, r: 0.3 });
    [[0, -HALF, 20.4, 0.3], [0, HALF, 20.4, 0.3], [-HALF, 0, 0.3, 20.4], [HALF, 0, 0.3, 20.4]].forEach(([x, z, w, d]) => {
      b.box(w, 0.9, d, wallM, x, 0.45, z);
      b.box(w < 1 ? 0.06 : w, 0.05, d < 1 ? 0.06 : d, rail, x, 1.2, z);
    });
    for (let i = -9; i <= 9; i += 3) { [[i, -HALF], [i, HALF], [-HALF, i], [HALF, i]].forEach(([x, z]) => b.cyl(0.025, 0.025, 0.32, rail, x, 1.05, z, null, 6)); }
    // 야경: 주변 건물들
    const sky = [[-30, -26, 12, 26], [-16, -30, 10, 40], [-2, -34, 12, 30], [12, -29, 10, 46], [27, -27, 12, 28], [-34, -6, 10, 34], [-31, 14, 12, 22], [33, -8, 10, 38], [32, 12, 12, 26], [-20, 32, 12, 24], [0, 36, 14, 34], [20, 33, 12, 28], [-44, -30, 14, 50], [44, -34, 14, 56], [0, -52, 20, 62]];
    sky.forEach(([x, z, w, h]) => {
      const t = facadeTex('#1a2030', 0.42); t.repeat.set(Math.round(w / 4), Math.round(h / 5));
      b.box(w, h, w, b.mat('#9aa3b8', { map: t, e: '#ffd98a', ei: 0.32, r: 0.9 }), x, h / 2 - 24, z, null, true).material.emissiveMap = t;
    });
    b.sph(2.2, b.mat('#fdf6d8', { e: '#fff2b8', ei: 1.6 }), -34, 44, -70, null, true); // 달
    // 자리
    b.rug(-4.6, -3.6, 5.4, 4.6, '#8a6f4e');
    b.sofa(-4.6, -5.6, 0, 3.0, '#d9cbb5'); b.sofa(-7.4, -3.2, 1, 2.3, '#d9cbb5'); b.lowTable(-4.4, -3.4, 1.5, 0.8, '#3a2d25');
    b.rug(5.2, 3.6, 4.8, 4.8, '#4f6f73', true);
    b.beanbag(4.2, 2.6, '#e8a530'); b.beanbag(6.3, 2.8, '#c0392b'); b.beanbag(5.2, 4.8, '#2f9e6a'); b.lowTable(5.3, 3.5, 0.8, 0.8, '#3a2d25');
    b.roundTable(5.6, -5.2, 0.45, '#2a2a2e', 1.05); b.stool(4.7, -5.2, '#c9ced6'); b.stool(6.5, -5.2, '#c9ced6'); b.stool(5.6, -6.1, '#c9ced6');
    b.roundTable(-5.6, 5.4, 0.45, '#2a2a2e', 1.05); b.stool(-6.5, 5.4, '#c9ced6'); b.stool(-4.7, 5.4, '#c9ced6');
    [[-9.1, -9.1], [9.1, -9.1], [-9.1, 9.0], [9.1, 9.0], [-9.1, 0.5], [9.1, 0.5]].forEach(([x, z]) => b.plant(x, z, 1.4));
    // 전구 줄
    [[-9, -9], [9, -9], [-9, 9], [9, 9]].forEach(([x, z]) => b.cyl(0.04, 0.04, 3.3, b.mat('#2a2a2e'), x, 1.65, z, null, 8));
    b.stringLights(-9, -9, 9, 9, 3.3, '#ffd27a'); b.stringLights(9, -9, -9, 9, 3.3, '#ffd27a');
    b.stringLights(-9, -9, 9, -9, 3.3, '#ffd27a'); b.stringLights(-9, 9, 9, 9, 3.3, '#ffd27a');
    b.light('#ffc56b', 30, 15, 0, 2.6, 0); b.light('#ffc56b', 20, 12, -5, 2.4, -4); b.light('#ffc56b', 20, 12, 5, 2.4, 4);
    b.exitDoor(0, 9.25, '#2b2f38');
    return {
      bg: skyTex('#070b1c', '#27304f'), fog: ['#141a30', 40, 130],
      hemi: ['#7f93d6', '#1a1c28', 0.55], sun: ['#aebcff', 0.9, [-8, 16, -10]], outdoor: true
    };
  }
};

// 방 하나를 만들어 돌려줌
export function buildScene(id) {
  const b = new Builder();
  const env = (SCENES[id] || SCENES.plaza)(b);
  return Object.assign({ group: b.group, colliders: b.colliders, npcs: b.npcs, flicker: b.flicker }, env);
}

// 가구와 벽을 통과하지 못하게 위치를 밀어냄
export function resolveCollision(pos, colliders, radius, limit) {
  const r = radius || 0.3;
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      if (c.r != null) {
        const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + r;
        if (d < min) { const k = d > 1e-4 ? (min - d) / d : 0; pos.x += dx * k || min; pos.z += dz * k; }
      } else {
        const nx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw)), nz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
        const dx = pos.x - nx, dz = pos.z - nz, d = Math.hypot(dx, dz);
        if (d === 0) { // 안쪽에 들어간 경우: 가까운 변으로 내보냄
          const ox = c.hw - Math.abs(pos.x - c.x) + r, oz = c.hd - Math.abs(pos.z - c.z) + r;
          if (ox < oz) pos.x += pos.x < c.x ? -ox : ox; else pos.z += pos.z < c.z ? -oz : oz;
        } else if (d < r) { pos.x += dx / d * (r - d); pos.z += dz / d * (r - d); }
      }
    }
  }
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
  return pos;
}

export function disposeScene(scene) {
  scene.group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
  });
  if (scene.bg && scene.bg.isTexture) scene.bg.dispose();
}
