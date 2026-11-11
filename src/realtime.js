'use strict';
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const R = require('./rooms');

const LIMITS = {
  roomMax: 40,          // 방 하나의 최대 인원
  totalMax: 600,        // 서버 전체 최대 접속
  nameMax: 10,
  chatMax: 80,
  chatGapMs: 700,       // 채팅 최소 간격
  movesPerSec: 15,
  history: 30,          // 방마다 보관하는 최근 채팅 수
  reportGapMs: 5000
};

// 아주 기본적인 욕설 가림. 운영하면서 목록을 늘려 가세요.
const BAD_WORDS = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅄ', '지랄', '좆', '개새끼', '새끼', '꺼져', 'fuck', 'shit'];
function cleanText(text) {
  let out = text;
  for (const w of BAD_WORDS) out = out.split(w).join('*'.repeat(w.length));
  return out;
}

function parseCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

const clampInt = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function attachRealtime(server, db, options) {
  const opts = Object.assign({ now: () => Date.now() }, options);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  const rooms = new Map(R.ROOMS.map((r) => [r.id, { def: r, players: new Map(), history: [] }]));
  let nextId = 1;
  let day = R.kstDay(opts.now());

  const tallyStmt = db.prepare('SELECT choice, COUNT(*) AS n FROM votes WHERE room = ? AND day = ? GROUP BY choice');
  const myVoteStmt = db.prepare('SELECT choice FROM votes WHERE room = ? AND day = ? AND uid = ?');
  const voteStmt = db.prepare(`INSERT INTO votes (room, day, uid, choice) VALUES (?, ?, ?, ?)
    ON CONFLICT (room, day, uid) DO UPDATE SET choice = excluded.choice`);
  const reportStmt = db.prepare('INSERT INTO reports (reporter_uid, target_pid, target_name, room, text) VALUES (?, ?, ?, ?, ?)');

  function tally(roomId) {
    const t = { A: 0, B: 0 };
    for (const row of tallyStmt.all(roomId, day.key)) t[row.choice] = row.n;
    return t;
  }

  const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  function broadcast(room, msg, except) {
    const data = JSON.stringify(msg);
    for (const p of room.players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(data);
  }
  const pub = (p) => ({ id: p.id, pid: p.pid, name: p.name, look: p.look, x: p.x, y: p.y });
  const counts = () => Object.fromEntries([...rooms].map(([id, r]) => [id, r.players.size]));
  const totalPlayers = () => [...rooms.values()].reduce((n, r) => n + r.players.size, 0);

  function sendInit(p) {
    const room = rooms.get(p.room);
    const question = R.questionFor(room.def, day.index);
    send(p.ws, {
      t: 'init', you: p.id, room: p.room,
      players: [...room.players.values()].map(pub),
      history: room.history,
      tally: question ? tally(p.room) : null,
      myVote: question ? ((myVoteStmt.get(p.room, day.key, p.uid) || {}).choice || null) : null
    });
  }

  function leaveRoom(p) {
    const room = rooms.get(p.room);
    if (room && room.players.delete(p.id)) broadcast(room, { t: 'leave', id: p.id });
    p.room = null;
  }

  function joinRoom(p, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    if (p.room === roomId) return sendInit(p);
    if (room.players.size >= LIMITS.roomMax) return send(p.ws, { t: 'err', msg: `${room.def.name}이(가) 꽉 찼어요. 잠시 후 다시 들어가 보세요.` });
    const from = p.room;
    leaveRoom(p);
    // 광장에서는 가운데 아래, 방에서는 휴게 공간(투표 구역 위)에 등장
    const base = room.def.spawn || { x: 400, y: 225 };
    p.x = Math.round(base.x + (Math.random() - 0.5) * 160);
    p.y = Math.round(base.y + (Math.random() - 0.5) * 50);
    p.room = roomId;
    room.players.set(p.id, p);
    sendInit(p);
    broadcast(room, { t: 'join', p: pub(p), from }, p);
  }

  function onHello(p, m) {
    const name = String(m.name == null ? '' : m.name).replace(/\s+/g, ' ').trim().slice(0, LIMITS.nameMax);
    if (!name) return send(p.ws, { t: 'err', msg: '닉네임을 입력해 주세요.' });
    const look = m.look && typeof m.look === 'object' ? m.look : {};
    p.name = cleanText(name);
    p.look = { color: clampInt(look.color, 7), face: clampInt(look.face, 3), acc: clampInt(look.acc, 5) };
    if (p.ready) { // 캐릭터를 다시 꾸민 경우
      const room = rooms.get(p.room);
      if (room) broadcast(room, { t: 'upd', id: p.id, name: p.name, look: p.look });
      return;
    }
    if (totalPlayers() >= LIMITS.totalMax) return send(p.ws, { t: 'err', msg: '지금은 사람이 너무 많아요. 잠시 후 다시 와 주세요.' });
    p.ready = true;
    send(p.ws, { t: 'world', world: R.WORLD, rooms: R.publicRooms(day.index), counts: counts(), day: day.key });
    joinRoom(p, rooms.has(m.room) ? m.room : 'plaza');
    if (!p.room) joinRoom(p, 'plaza'); // 원하던 방이 꽉 찬 경우
  }

  function onMove(p, m) {
    const now = opts.now();
    if (now - p.moveWindow > 1000) { p.moveWindow = now; p.moveCount = 0; }
    if (++p.moveCount > LIMITS.movesPerSec) return;
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const W = R.WORLD;
    p.x = Math.round(clamp(m.x, W.margin, W.w - W.margin));
    p.y = Math.round(clamp(m.y, W.wall + 20, W.h - W.margin));
    const room = rooms.get(p.room);
    broadcast(room, { t: 'm', id: p.id, x: p.x, y: p.y }, p);

    // 투표 구역에 들어서면 그쪽이 내 표
    if (!R.questionFor(room.def, day.index) || p.y < W.voteTop) return;
    const choice = p.x < W.w / 2 ? 'A' : 'B';
    const key = `${p.room}|${day.key}`;
    if (p.votes.get(key) === choice) return;
    voteStmt.run(p.room, day.key, p.uid, choice);
    p.votes.set(key, choice);
    send(p.ws, { t: 'voted', choice });
    broadcast(room, Object.assign({ t: 'tally' }, tally(p.room)));
  }

  function onChat(p, m) {
    const now = opts.now();
    if (now - p.lastChat < LIMITS.chatGapMs) return;
    const text = String(m.text == null ? '' : m.text).replace(/\s+/g, ' ').trim().slice(0, LIMITS.chatMax);
    if (!text) return;
    p.lastChat = now;
    const room = rooms.get(p.room);
    const msg = { t: 'c', id: p.id, pid: p.pid, name: p.name, text: cleanText(text), ts: now };
    room.history.push(msg);
    if (room.history.length > LIMITS.history) room.history.shift();
    broadcast(room, msg);
  }

  function onReport(p, m) {
    const now = opts.now();
    if (now - p.lastReport < LIMITS.reportGapMs) return;
    if (typeof m.pid !== 'string' || !/^[0-9a-f]{12}$/.test(m.pid)) return;
    p.lastReport = now;
    reportStmt.run(p.uid, m.pid, String(m.name || '').slice(0, LIMITS.nameMax), p.room, String(m.text || '').slice(0, LIMITS.chatMax));
    send(p.ws, { t: 'note', msg: '신고가 접수됐어요.' });
  }

  wss.on('connection', (ws, req) => {
    let uid = parseCookie(req.headers.cookie, 'uid');
    if (!uid || !/^[0-9a-f]{32}$/.test(uid)) uid = crypto.randomBytes(16).toString('hex');
    const p = {
      id: nextId++, uid, ws, ready: false, room: null, name: '', look: null, x: 0, y: 0,
      pid: crypto.createHmac('sha256', db.secret).update(uid).digest('hex').slice(0, 12),
      votes: new Map(), lastChat: 0, lastReport: 0, moveWindow: 0, moveCount: 0
    };
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw.toString()); } catch { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'hello') return onHello(p, m);
      if (!p.ready || !p.room) return;
      if (m.t === 'm') onMove(p, m);
      else if (m.t === 'c') onChat(p, m);
      else if (m.t === 'join') joinRoom(p, m.room);
      else if (m.t === 'report') onReport(p, m);
    });
    ws.on('close', () => leaveRoom(p));
    ws.on('error', () => {});
  });

  // 다른 사이트에서 연 웹소켓은 거부
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;
    let ok = req.url === '/ws';
    if (ok && origin) {
      try { ok = new URL(origin).host === req.headers.host; } catch { ok = false; }
    }
    if (!ok) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  // 인원 수 알림, 끊긴 연결 정리, 자정(한국 시간)에 질문 교체
  const tick = setInterval(() => {
    const today = R.kstDay(opts.now());
    const dayChanged = today.key !== day.key;
    if (dayChanged) day = today;
    const c = counts();
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      send(ws, { t: 'counts', counts: c });
    }
    if (dayChanged) {
      for (const room of rooms.values()) {
        for (const p of room.players.values()) {
          send(p.ws, { t: 'world', world: R.WORLD, rooms: R.publicRooms(day.index), counts: c, day: day.key });
          sendInit(p);
        }
      }
    }
  }, opts.tickMs || 5000);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) { if (ws.isAlive) { ws.isAlive = false; ws.ping(); } }
  }, 30000);
  tick.unref();
  heartbeat.unref();

  return {
    counts,
    close() { clearInterval(tick); clearInterval(heartbeat); for (const ws of wss.clients) ws.terminate(); wss.close(); }
  };
}

module.exports = { attachRealtime, LIMITS, cleanText };
