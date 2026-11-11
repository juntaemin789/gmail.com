import * as THREE from '/vendor/three.module.js';
import { makeAvatar, animateAvatar, disposeAvatar, randomLook, SKINS, HAIR_STYLES, HAIR_COLORS, TOPS, BOTTOMS } from '/avatar.js';
import { buildScene, resolveCollision, disposeScene } from '/scenes.js';

const $ = (id) => document.getElementById(id);
const SPEED = 3.4;        // 걷는 속도 (m/s)
const LIMIT = 9.4;        // 방 가장자리 (m)
const PORTAL_R = 0.9;     // 문에 이만큼 가까이 가면 이동
const HEAD_Y = 1.98;      // 이름표 높이
const toM = (u) => (u - 400) / 40;            // 서버 좌표 → 미터
const toU = (m) => Math.round(m * 40 + 400);  // 미터 → 서버 좌표
const coarse = matchMedia('(pointer: coarse)').matches;

// ---------- 저장된 내 정보 ----------
function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; }
}
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 불가 환경 */ } }

let profile = load('swimpyo.profile3d', null);
const draft = profile ? { name: profile.name, look: { ...profile.look } } : { name: '', look: randomLook() };
const blocked = new Set(load('swimpyo.blocked', []));

// ---------- 상태 ----------
let ws = null, connected = false, switching = false;
let rooms = new Map(), counts = {};
let myId = null, roomId = null;
const players = new Map();
let env = null;                    // 지금 보이는 공간
let npcs = [], doorLabels = [];
const keys = {};
let target = null, stuck = 0, lastSent = 0, sentX = 0, sentZ = 0;
const cam = { yaw: 0, pitch: 0.5, dist: coarse ? 9.5 : 8.5, focus: new THREE.Vector3(0, 1.2, 5) };

// ---------- 입장 화면: 아바타 꾸미기 ----------
const PICKS = [
  ['skinPicks', 'skin', SKINS, true], ['hairPicks', 'hair', HAIR_STYLES, false], ['hairColorPicks', 'hairColor', HAIR_COLORS, true],
  ['topPicks', 'top', TOPS, true], ['bottomPicks', 'bottom', BOTTOMS, true]
];
const LABELS = { skin: '피부', hair: '머리 모양', hairColor: '머리 색', top: '상의', bottom: '하의' };
PICKS.forEach(([boxId, key, list, isColor]) => {
  list.forEach((v, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = isColor ? 'swatch' : 'opt';
    if (isColor) { b.style.background = v; b.setAttribute('aria-label', `${LABELS[key]} ${i + 1}`); } else b.textContent = v;
    b.addEventListener('click', () => { draft.look[key] = i; refreshPicks(); rebuildPreview(); });
    $(boxId).appendChild(b);
  });
});
function refreshPicks() {
  PICKS.forEach(([boxId, key]) => [...$(boxId).children].forEach((b, i) => b.classList.toggle('on', draft.look[key] === i)));
}

const pv = { renderer: null, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(32, 1, 0.1, 50), avatar: null };
function setupPreview() {
  pv.renderer = new THREE.WebGLRenderer({ canvas: $('preview'), antialias: true, alpha: true });
  pv.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  pv.scene.add(new THREE.HemisphereLight('#ffffff', '#55607a', 1.5));
  const key = new THREE.DirectionalLight('#fff3e0', 2.4); key.position.set(2, 4, 4); pv.scene.add(key);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.08, 40), new THREE.MeshStandardMaterial({ color: '#3a4266', roughness: 0.7 }));
  disc.position.y = -0.04; pv.scene.add(disc);
  pv.camera.position.set(0, 1.25, 4.6); pv.camera.lookAt(0, 0.92, 0);
}
function rebuildPreview() {
  if (pv.avatar) { pv.scene.remove(pv.avatar); disposeAvatar(pv.avatar); }
  pv.avatar = makeAvatar(draft.look);
  pv.scene.add(pv.avatar);
}
function showEntry() {
  $('entry').hidden = false;
  $('nameInput').value = draft.name;
  $('enterBtn').textContent = connected ? '저장하기' : '입장하기';
  refreshPicks();
  if (!pv.renderer) setupPreview();
  rebuildPreview();
}
showEntry();

$('entryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 10);
  if (!name) return;
  draft.name = name;
  profile = { name, look: { ...draft.look } };
  save('swimpyo.profile3d', profile);
  $('entry').hidden = true;
  $('game').hidden = false;
  if (!renderer) setupWorld();
  resize();
  if (connected) send({ t: 'hello', name: profile.name, look: profile.look });
  else connect();
});
$('editBtn').addEventListener('click', showEntry);

// ---------- 3D 세계 ----------
let renderer = null, sun = null, hemi = null, marker = null;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);

function setupWorld() {
  renderer = new THREE.WebGLRenderer({ canvas: $('world'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  hemi = new THREE.HemisphereLight('#ffffff', '#666666', 1);
  scene.add(hemi);
  sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  const size = coarse ? 1024 : 2048;
  sun.shadow.mapSize.set(size, size);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // 누른 곳을 보여 주는 표시
  marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.03;
  scene.add(marker);
}

function clearLabels() {
  doorLabels.forEach((d) => d.el.remove());
  npcs.forEach((n) => n.tag.remove());
  doorLabels = []; npcs = [];
}

function setRoom(id) {
  if (env) { scene.remove(env.group); disposeScene(env); }
  clearLabels();
  env = buildScene(id);
  scene.add(env.group);
  scene.background = typeof env.bg === 'string' ? new THREE.Color(env.bg) : env.bg;
  scene.fog = env.fog ? new THREE.Fog(env.fog[0], env.fog[1], env.fog[2]) : null;
  hemi.color.set(env.hemi[0]); hemi.groundColor.set(env.hemi[1]); hemi.intensity = env.hemi[2];
  sun.color.set(env.sun[0]); sun.intensity = env.sun[1]; sun.position.set(...env.sun[2]);

  env.npcs.forEach((n) => {
    const av = makeAvatar(n.look);
    av.position.set(n.x, 0, n.z); av.rotation.y = n.ry;
    env.group.add(av);
    npcs.push({ av, x: n.x, z: n.z, tag: makeLabel('tag npc', n.name) });
  });
  const room = rooms.get(id);
  (room.portals || []).forEach((p) => {
    const el = document.createElement('div');
    el.className = 'door-label';
    $('labels').appendChild(el);
    doorLabels.push({ el, to: p.to, x: toM(p.x), z: toM(p.y), y: id === 'plaza' ? 2.55 : 0.5 });
  });
  renderDoorLabels();
  cam.yaw = 0;
}

function makeLabel(cls, text) {
  const el = document.createElement('div');
  el.className = cls; el.textContent = text;
  $('labels').appendChild(el);
  return el;
}

function renderDoorLabels() {
  doorLabels.forEach((d) => {
    const r = rooms.get(d.to);
    if (!r) return;
    d.el.textContent = d.to === 'plaza' ? '광장으로 나가기' : r.name;
    if (d.to !== 'plaza') {
      const s = document.createElement('small');
      s.textContent = `${r.group} · ${counts[d.to] || 0}명`;
      d.el.appendChild(s);
    }
  });
}

// ---------- 플레이어 ----------
function addPlayer(p) {
  const av = makeAvatar(p.look);
  const x = toM(p.x), z = toM(p.y);
  av.position.set(x, 0, z);
  av.rotation.y = Math.PI; // 처음에는 북쪽(방 안쪽)을 봄
  scene.add(av);
  players.set(p.id, {
    id: p.id, pid: p.pid, name: p.name, look: p.look, av, x, z, sx: x, sz: z, ry: Math.PI, moving: false,
    tag: makeLabel('tag' + (p.id === myId ? ' me' : ''), p.name), bubble: null, bubbleUntil: 0
  });
}
function removePlayer(id) {
  const p = players.get(id);
  if (!p) return;
  scene.remove(p.av); disposeAvatar(p.av);
  p.tag.remove(); if (p.bubble) p.bubble.remove();
  players.delete(id);
}
const me = () => players.get(myId);

// ---------- 서버 연결 ----------
function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  ws.onopen = () => {
    connected = true; toast('');
    send({ t: 'hello', name: profile.name, look: profile.look, room: roomId || 'plaza' });
  };
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (handlers[m.t]) handlers[m.t](m);
  };
  ws.onclose = () => {
    connected = false;
    toast('연결이 끊겼어요. 다시 연결하는 중…', true);
    setTimeout(connect, 2000);
  };
}

const handlers = {
  world(m) { rooms = new Map(m.rooms.map((r) => [r.id, r])); counts = m.counts; },
  init(m) {
    switching = false; target = null;
    [...players.keys()].forEach(removePlayer);
    myId = m.you; roomId = m.room;
    setRoom(roomId);
    m.players.forEach(addPlayer);
    const p = me();
    sentX = p.x; sentZ = p.z;
    cam.focus.set(p.x, 1.2, p.z);
    const room = rooms.get(roomId);
    $('log').textContent = '';
    m.history.forEach((c) => addChat(c, true));
    addSystem(`${room.name}에 들어왔어요. ${room.desc}`);
    if (room.topic) addSystem(`오늘의 이야깃거리: ${room.topic}`);
    renderHeader();
  },
  join(m) {
    addPlayer(m.p);
    if (!blocked.has(m.p.pid)) addSystem(`${m.p.name}님이 들어왔어요.`);
    renderHeader();
  },
  leave(m) { removePlayer(m.id); renderHeader(); },
  m(m) { const p = players.get(m.id); if (p) { p.sx = toM(m.x); p.sz = toM(m.y); } },
  upd(m) {
    const p = players.get(m.id);
    if (!p) return;
    p.name = m.name; p.look = m.look; p.tag.textContent = m.name;
    scene.remove(p.av); disposeAvatar(p.av);
    p.av = makeAvatar(m.look); p.av.position.set(p.x, 0, p.z); p.av.rotation.y = p.ry;
    scene.add(p.av);
  },
  c(m) {
    if (blocked.has(m.pid)) return;
    addChat(m);
    const p = players.get(m.id);
    if (!p) return;
    if (!p.bubble) p.bubble = makeLabel('bubble', '');
    p.bubble.textContent = m.text; p.bubble.style.opacity = 1;
    p.bubbleUntil = performance.now() + 5500;
  },
  counts(m) { counts = m.counts; renderHeader(); renderDoorLabels(); if (!$('roomsPanel').hidden) renderRoomCards(); },
  err(m) {
    toast(m.msg);
    if (switching) { switching = false; const p = me(); if (p) target = { x: 0, z: p.z > 0 ? 5 : 0 }; }
  },
  note(m) { toast(m.msg); }
};

// ---------- 화면 위 정보, 방 목록 ----------
function renderHeader() {
  const room = rooms.get(roomId);
  if (!room) return;
  $('roomTitle').textContent = `${room.name} · ${players.size}명`;
  $('roomTopic').textContent = room.topic ? `오늘의 이야깃거리: ${room.topic}` : room.desc;
}

function renderRoomCards() {
  const box = $('roomCards');
  box.textContent = '';
  rooms.forEach((r) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'room-card' + (r.id === roomId ? ' here' : '');
    const head = document.createElement('div'); head.className = 'rc-head';
    const name = document.createElement('b'); name.textContent = r.name;
    const group = document.createElement('span'); group.className = 'chip'; group.textContent = r.group;
    const count = document.createElement('span'); count.className = 'rc-count';
    count.textContent = `${counts[r.id] || 0}명${r.id === roomId ? ' · 지금 여기' : ''}`;
    head.append(name, group, count);
    const desc = document.createElement('div'); desc.className = 'rc-desc';
    desc.textContent = r.topic ? `${r.desc} · 오늘: ${r.topic}` : r.desc;
    card.append(head, desc);
    card.addEventListener('click', () => {
      $('roomsPanel').hidden = true;
      if (r.id !== roomId) { switching = true; send({ t: 'join', room: r.id }); }
    });
    box.appendChild(card);
  });
}
$('roomsBtn').addEventListener('click', () => { renderRoomCards(); $('roomsPanel').hidden = false; });
$('roomsClose').addEventListener('click', () => { $('roomsPanel').hidden = true; });
$('roomsPanel').addEventListener('click', (e) => { if (e.target === $('roomsPanel')) $('roomsPanel').hidden = true; });

// ---------- 채팅 ----------
function trimLog() {
  const log = $('log');
  while (log.children.length > 80) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}
function addSystem(text) {
  const row = document.createElement('div');
  row.className = 'sys'; row.textContent = text;
  $('log').appendChild(row); trimLog();
}
function addChat(m, old) {
  if (blocked.has(m.pid)) return;
  const row = document.createElement('div');
  row.className = 'msg' + (old ? ' old' : '');
  const name = document.createElement('button');
  name.type = 'button'; name.className = 'who'; name.textContent = m.name;
  if (m.id === myId && !old) name.classList.add('me');
  else name.addEventListener('click', () => openUserMenu(m));
  const text = document.createElement('span'); text.textContent = m.text;
  row.append(name, text);
  $('log').appendChild(row); trimLog();
}
$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (!text) return;
  send({ t: 'c', text });
  $('chatInput').value = '';
});

let menuTarget = null;
function openUserMenu(m) { menuTarget = m; $('userMenuName').textContent = m.name; $('userMenu').hidden = false; }
$('userMenuClose').addEventListener('click', () => { $('userMenu').hidden = true; });
$('blockBtn').addEventListener('click', () => {
  blocked.add(menuTarget.pid); save('swimpyo.blocked', [...blocked]);
  $('userMenu').hidden = true; toast(`${menuTarget.name}님의 채팅을 숨겼어요.`);
});
$('reportBtn').addEventListener('click', () => {
  send({ t: 'report', pid: menuTarget.pid, name: menuTarget.name, text: menuTarget.text });
  $('userMenu').hidden = true;
});

let toastTimer = null;
function toast(text, sticky) {
  const el = $('status');
  clearTimeout(toastTimer);
  el.textContent = text; el.hidden = !text;
  if (text && !sticky) toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ---------- 입력: 눌러서 이동, 드래그로 시점 회전, 두 손가락·휠로 확대 ----------
const canvas = $('world');
const pointers = new Map();
let dragging = false, pinch = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();

function setTarget(x, z) {
  if (!me() || switching) return;
  target = { x: Math.max(-LIMIT, Math.min(LIMIT, x)), z: Math.max(-LIMIT, Math.min(LIMIT, z)) };
  stuck = 0;
  marker.position.set(target.x, 0.03, target.z); marker.material.opacity = 0.9; marker.scale.setScalar(1);
  $('hint').classList.add('gone');
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (pointers.size === 1) dragging = false;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); dragging = true; }
  if (document.activeElement === $('chatInput')) $('chatInput').blur();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch > 0) cam.dist = Math.max(3.5, Math.min(15, cam.dist * pinch / d));
    pinch = d;
    return;
  }
  if (!dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) dragging = true;
  if (dragging) {
    cam.yaw -= dx * 0.006;
    cam.pitch = Math.max(0.18, Math.min(1.25, cam.pitch + dy * 0.004));
    $('hint').classList.add('gone');
  }
});
function pointerEnd(e) {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p || dragging || e.type === 'pointercancel') return;
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.ray.intersectPlane(floor, hit) && Math.abs(hit.x) < 11 && Math.abs(hit.z) < 11) setTarget(hit.x, hit.z);
}
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.max(3.5, Math.min(15, cam.dist * (1 + e.deltaY * 0.001))); }, { passive: false });

const KEYMAP = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0] };
const keyName = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (e.key === 'Enter' && !typing && !$('game').hidden && $('entry').hidden) { $('chatInput').focus(); e.preventDefault(); return; }
  if (e.key === 'Escape') { $('chatInput').blur(); return; }
  if (typing) return;
  if (KEYMAP[keyName(e)]) { keys[keyName(e)] = true; e.preventDefault(); $('hint').classList.add('gone'); }
});
addEventListener('keyup', (e) => { delete keys[keyName(e)]; });
addEventListener('blur', () => { for (const k in keys) delete keys[k]; });

function resize() {
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = innerWidth < innerHeight ? 62 : 50; // 세로 화면에서는 더 넓게
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- 매 프레임 ----------
function turnToward(p, dx, dz, dt) {
  const want = Math.atan2(dx, dz);
  let diff = want - p.ry;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  p.ry += diff * Math.min(1, dt * 12);
  p.av.rotation.y = p.ry;
}

const tmp = { x: 0, z: 0 };
function update(dt, now) {
  const p = me();
  if (p && env) {
    // 내 이동: 키보드(시점 기준)가 우선, 아니면 누른 곳으로
    let kx = 0, kz = 0;
    for (const k in keys) { kx += KEYMAP[k][0]; kz += KEYMAP[k][1]; }
    let vx = 0, vz = 0, want = 0;
    if (kx || kz) {
      target = null;
      const len = Math.hypot(kx, kz), f = kz / len, s = kx / len;
      vx = (-Math.sin(cam.yaw) * f + Math.cos(cam.yaw) * s) * SPEED;
      vz = (-Math.cos(cam.yaw) * f - Math.sin(cam.yaw) * s) * SPEED;
      want = SPEED * dt;
    } else if (target) {
      const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.06) target = null;
      else { want = Math.min(d, SPEED * dt); vx = dx / d * want / dt; vz = dz / d * want / dt; }
    }
    if (want > 0 && !switching) {
      tmp.x = p.x + vx * dt; tmp.z = p.z + vz * dt;
      resolveCollision(tmp, env.colliders, 0.3, LIMIT);
      const moved = Math.hypot(tmp.x - p.x, tmp.z - p.z);
      p.moving = moved > want * 0.25;
      if (p.moving) { turnToward(p, tmp.x - p.x, tmp.z - p.z, dt); stuck = 0; }
      else if (target && (stuck += dt) > 0.3) target = null; // 가구에 막힘
      p.x = tmp.x; p.z = tmp.z;
    } else p.moving = false;
    p.av.position.set(p.x, 0, p.z);

    if (now - lastSent > 100 && (Math.abs(p.x - sentX) > 0.02 || Math.abs(p.z - sentZ) > 0.02)) {
      lastSent = now; sentX = p.x; sentZ = p.z;
      send({ t: 'm', x: toU(p.x), y: toU(p.z) });
    }

    // 문에 다가가면 방 이동
    if (!switching) {
      for (const d of doorLabels) {
        if (Math.hypot(p.x - d.x, p.z - d.z) < PORTAL_R) { switching = true; target = null; send({ t: 'join', room: d.to }); break; }
      }
    }
  }

  // 다른 사람들: 서버가 알려 준 위치로 걸어감
  players.forEach((q) => {
    if (q.id !== myId) {
      const dx = q.sx - q.x, dz = q.sz - q.z, d = Math.hypot(dx, dz);
      if (d > 6) { q.x = q.sx; q.z = q.sz; q.moving = false; }
      else if (d > 0.04) {
        const step = Math.min(d, SPEED * 1.15 * dt);
        q.x += dx / d * step; q.z += dz / d * step;
        q.moving = true; turnToward(q, dx, dz, dt);
      } else q.moving = false;
      q.av.position.set(q.x, 0, q.z);
    }
    animateAvatar(q.av, q.moving, dt);
  });
  npcs.forEach((n) => animateAvatar(n.av, false, dt));
  if (env) env.flicker.forEach((f) => { f.light.intensity = f.base * (0.82 + 0.12 * Math.sin(now * 0.011) + 0.08 * Math.sin(now * 0.027 + 2)); });
  if (marker && marker.material.opacity > 0) { marker.material.opacity = Math.max(0, marker.material.opacity - dt * 1.4); marker.scale.multiplyScalar(1 + dt * 0.8); }

  // 카메라: 내 아바타를 뒤에서 따라감
  if (p) {
    cam.focus.x += (p.x - cam.focus.x) * Math.min(1, dt * 6);
    cam.focus.z += (p.z - cam.focus.z) * Math.min(1, dt * 6);
    const cp = Math.cos(cam.pitch);
    let cx = cam.focus.x + Math.sin(cam.yaw) * cp * cam.dist, cz = cam.focus.z + Math.cos(cam.yaw) * cp * cam.dist;
    if (roomId === 'plaza') { cx = Math.max(-9.7, Math.min(9.7, cx)); cz = Math.max(-9.7, cz); } // 건물 속으로 들어가지 않게
    camera.position.set(cx, cam.focus.y + Math.sin(cam.pitch) * cam.dist, cz);
    camera.lookAt(cam.focus);
    sun.target.position.set(0, 0, 0);
  }
}

const v = new THREE.Vector3();
function place(el, x, y, z, lift) {
  v.set(x, y, z).project(camera);
  if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.3 || Math.abs(v.y) > 1.3) { el.style.display = 'none'; return; }
  el.style.display = '';
  const px = (v.x * 0.5 + 0.5) * innerWidth, py = (-v.y * 0.5 + 0.5) * innerHeight - (lift || 0);
  el.style.transform = `translate(-50%, -100%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
}
function updateLabels(now) {
  players.forEach((p) => {
    place(p.tag, p.x, HEAD_Y, p.z);
    if (p.bubble) {
      const left = p.bubbleUntil - now;
      if (left <= 0) { p.bubble.remove(); p.bubble = null; }
      else { if (left < 400) p.bubble.style.opacity = 0; place(p.bubble, p.x, HEAD_Y, p.z, 30); }
    }
  });
  npcs.forEach((n) => place(n.tag, n.x, HEAD_Y, n.z));
  doorLabels.forEach((d) => place(d.el, d.x, d.y, d.z));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!$('entry').hidden && pv.renderer) {
    const c = $('preview'), w = c.clientWidth, h = c.clientHeight;
    if (w && h) {
      if (c.width !== Math.round(w * pv.renderer.getPixelRatio())) { pv.renderer.setSize(w, h, false); pv.camera.aspect = w / h; pv.camera.updateProjectionMatrix(); }
      pv.avatar.rotation.y = Math.sin(now / 1400) * 0.7;
      animateAvatar(pv.avatar, false, dt);
      pv.renderer.render(pv.scene, pv.camera);
    }
  } else if (renderer && env) {
    update(dt, now);
    renderer.render(scene, camera);
    updateLabels(now);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 자동 테스트에서 상태를 확인하고 조작하기 위한 창구
window.__swimpyo = {
  state: () => { const p = me(); return { room: roomId, players: players.size, me: p && { x: +p.x.toFixed(2), z: +p.z.toFixed(2), moving: p.moving }, draws: renderer && renderer.info.render.calls }; },
  walkTo: setTarget,
  look: (yaw, pitch, dist) => { cam.yaw = yaw; if (pitch != null) cam.pitch = pitch; if (dist != null) cam.dist = dist; }
};
