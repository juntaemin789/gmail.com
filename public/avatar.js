// 사람 모양 아바타. 키 약 1.75m, 앞쪽이 +z 방향.
import * as THREE from '/vendor/three.module.js';

export const SKINS = ['#f7dcc8', '#efc4a2', '#d9a47c', '#b07a55', '#7a5238'];
export const HAIR_STYLES = ['짧은 머리', '단발', '긴 머리', '묶은 머리', '모자', '민머리'];
export const HAIR_COLORS = ['#1f1b18', '#4a3222', '#8a5a2b', '#d0aa62', '#b9bac2', '#a8403c'];
export const TOPS = ['#e9ecef', '#2f3640', '#c0392b', '#2e6fd1', '#2f9e6a', '#e8a530', '#8e5fc7', '#e58fb0'];
export const BOTTOMS = ['#2c3e50', '#1c1c1f', '#3d5a80', '#b8a78a', '#6b4f3a', '#7f8c8d'];

export function randomLook() {
  const r = (n) => Math.floor(Math.random() * n);
  return { skin: r(SKINS.length), hair: r(4), hairColor: r(HAIR_COLORS.length), top: r(TOPS.length), bottom: r(BOTTOMS.length) };
}

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function makeAvatar(look) {
  const g = new THREE.Group();
  const std = (color, rough) => new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.8 : rough });
  const skin = std(SKINS[look.skin] || SKINS[0], 0.65);
  const top = std(TOPS[look.top] || TOPS[0], 0.85);
  const bottom = std(BOTTOMS[look.bottom] || BOTTOMS[0], 0.9);
  const hairMat = std(HAIR_COLORS[look.hairColor] || HAIR_COLORS[0], 0.6);
  const shoe = std('#f1f1f1', 0.6);
  const dark = std('#22242a', 0.4);

  // 몸통 전체(걸을 때 위아래로 살짝 움직임)
  const body = new THREE.Group();
  g.add(body);

  // 다리: 엉덩이 높이에서 회전
  const legGeo = new THREE.CapsuleGeometry(0.095, 0.6, 4, 12);
  const shoeGeo = new THREE.BoxGeometry(0.15, 0.09, 0.27);
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.105, 0.86, 0);
    body.add(pivot);
    mesh(legGeo, bottom, 0, -0.4, 0, pivot);
    mesh(shoeGeo, shoe, 0, -0.815, 0.045, pivot);
    return pivot;
  });

  // 골반과 상체
  mesh(new THREE.CapsuleGeometry(0.15, 0.08, 4, 12), bottom, 0, 0.88, 0, body).scale.set(1.15, 1, 0.8);
  // 상의가 골반을 덮도록 아래로 길게
  const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.36, 8, 20), top, 0, 1.17, 0, body);
  torso.scale.set(1.1, 1, 0.72);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skin, 0, 1.47, 0, body);

  // 팔: 어깨에서 회전
  const armGeo = new THREE.CapsuleGeometry(0.062, 0.42, 4, 10);
  const handGeo = new THREE.SphereGeometry(0.068, 10, 8);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.285, 1.37, 0);
    pivot.rotation.z = side * 0.09;
    body.add(pivot);
    mesh(armGeo, top, 0, -0.26, 0, pivot);
    mesh(handGeo, skin, 0, -0.56, 0, pivot);
    return pivot;
  });

  // 머리
  const head = new THREE.Group();
  head.position.set(0, 1.66, 0);
  head.scale.setScalar(1.08);
  body.add(head);
  mesh(new THREE.SphereGeometry(0.17, 24, 18), skin, 0, 0, 0, head).scale.set(1.02, 1.1, 1.06);
  const eyeGeo = new THREE.SphereGeometry(0.02, 8, 6);
  mesh(eyeGeo, dark, -0.06, 0.015, 0.155, head).castShadow = false;
  mesh(eyeGeo, dark, 0.06, 0.015, 0.155, head).castShadow = false;
  mesh(new THREE.SphereGeometry(0.022, 8, 6), skin, 0, -0.03, 0.168, head).castShadow = false; // 코

  // 머리 모양
  const cap = () => new THREE.SphereGeometry(0.182, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const style = look.hair;
  if (style === 4) { // 모자
    const capMat = std(BOTTOMS[look.bottom] || BOTTOMS[0], 0.8);
    const c = mesh(cap(), capMat, 0, 0.03, 0, head); c.scale.set(1, 1.02, 1.05);
    mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), capMat, 0, 0.06, 0.13, head);
    const back = mesh(new THREE.SphereGeometry(0.176, 16, 10, 0, Math.PI, Math.PI * 0.3, Math.PI * 0.4), hairMat, 0, 0, 0, head);
    back.rotation.y = Math.PI;
  } else if (style !== 5) {
    const c = mesh(cap(), hairMat, 0, 0.012, -0.012, head);
    c.scale.set(1.05, 1.12, 1.1);
    c.rotation.x = -0.38;
    if (style === 1 || style === 2) { // 단발, 긴 머리: 뒤와 옆을 덮는 머리카락
      const len = style === 1 ? 0.2 : 0.42;
      const shell = mesh(new THREE.CylinderGeometry(0.185, style === 1 ? 0.19 : 0.17, len, 18, 1, true, Math.PI * 0.62, Math.PI * 1.76), hairMat, 0, 0.03 - len / 2, -0.012, head);
      shell.material = hairMat.clone();
      shell.material.side = THREE.DoubleSide;
    } else if (style === 3) { // 묶은 머리
      mesh(new THREE.SphereGeometry(0.075, 12, 10), hairMat, 0, 0.13, -0.17, head);
    } else { // 짧은 머리: 뒤통수
      const back = mesh(new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI, Math.PI * 0.35, Math.PI * 0.32), hairMat, 0, 0.005, -0.005, head);
      back.rotation.y = Math.PI;
    }
  }

  g.userData = { body, legs, arms, head, phase: Math.random() * 10, walk: 0 };
  return g;
}

// 걷는 동작과 숨 쉬는 동작. moving: 걷는 중인지, dt: 지난 시간(초)
export function animateAvatar(g, moving, dt) {
  const u = g.userData;
  u.walk += ((moving ? 1 : 0) - u.walk) * Math.min(1, dt * 10); // 걷기 ↔ 서 있기를 부드럽게 전환
  u.phase += dt * (moving ? 9.5 : 1.6);
  const swing = Math.sin(u.phase) * 0.7 * u.walk;
  u.legs[0].rotation.x = swing;
  u.legs[1].rotation.x = -swing;
  u.arms[0].rotation.x = -swing * 0.8;
  u.arms[1].rotation.x = swing * 0.8;
  u.body.position.y = Math.abs(Math.cos(u.phase)) * 0.035 * u.walk + Math.sin(u.phase) * 0.004 * (1 - u.walk);
  u.body.rotation.x = 0.06 * u.walk;
  u.head.rotation.y = Math.sin(u.phase * 0.35) * 0.12 * (1 - u.walk);
}

export function disposeAvatar(g) {
  g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
