'use strict';
// 실행: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const WebSocket = require('ws');
const { openDb } = require('../src/db');
const { createServer } = require('../server');
const R = require('../src/rooms');
const { cleanText } = require('../src/realtime');

let server, port, db;

before(async () => {
  db = openDb(':memory:');
  server = createServer(db);
  await new Promise((r) => server.listen(0, r));
  port = server.address().port;
});
after(() => { server.realtime.close(); server.closeAllConnections(); server.close(); });

// 받은 메시지를 쌓아 두고 원하는 종류가 올 때까지 기다리는 테스트용 접속
function connect(uid, headers) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: Object.assign(uid ? { cookie: `uid=${uid}` } : {}, headers) });
  const queue = [];
  const waiters = [];
  const opened = new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  opened.catch(() => {});
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    const i = waiters.findIndex((w) => w.type === m.t);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m);
    else queue.push(m);
  });
  const c = {
    ws, opened,
    send: (m) => ws.send(JSON.stringify(m)),
    next(type, ms) {
      const i = queue.findIndex((m) => m.t === type);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { type, resolve };
        waiters.push(w);
        setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); reject(new Error(`'${type}' 메시지가 오지 않음`)); } }, ms || 1500);
      });
    },
    none: async (type, ms) => { await new Promise((r) => setTimeout(r, ms || 250)); return !queue.some((m) => m.t === type); },
    async enter(name, room) {
      await opened;
      c.send({ t: 'hello', name, look: { color: 2, face: 1, acc: 4 }, room });
      const world = await c.next('world');
      const init = await c.next('init');
      return { world, init };
    }
  };
  return c;
}
const uid = (n) => String(n).padStart(32, '0');

test('방 정의: 광장의 문은 모두 실제 방으로 이어지고, 방마다 질문과 테마가 있다', () => {
  const plaza = R.BY_ID.get('plaza');
  for (const p of plaza.portals) assert.ok(R.BY_ID.has(p.to), p.to);
  const themed = R.ROOMS.filter((r) => r.id !== 'plaza');
  assert.strictEqual(themed.length, plaza.portals.length);
  for (const r of themed) {
    assert.ok(r.questions.length >= 5, r.id);
    assert.ok(r.theme.a && r.theme.b && r.group && r.npc, r.id);
    // 등장 위치(휴게 공간)가 투표 구역 밖이어야 들어오자마자 투표되지 않음
    assert.ok(225 + 25 < R.WORLD.voteTop);
  }
  assert.strictEqual(new Set(themed.map((r) => r.theme.floor)).size, themed.length);
});

test('질문은 한국 시간 기준으로 하루에 하나씩 바뀐다', () => {
  const room = R.BY_ID.get('food');
  const d1 = R.kstDay(Date.UTC(2026, 0, 1, 14, 59)); // 한국 1월 1일 23:59
  const d2 = R.kstDay(Date.UTC(2026, 0, 1, 15, 0));  // 한국 1월 2일 00:00
  assert.strictEqual(d1.key, '2026-01-01');
  assert.strictEqual(d2.key, '2026-01-02');
  assert.notDeepStrictEqual(R.questionFor(room, d1.index), R.questionFor(room, d2.index));
  assert.strictEqual(R.questionFor(R.BY_ID.get('plaza'), d1.index), null);
});

test('입장하면 광장에서 시작하고, 방을 옮기면 서로 보인다', async () => {
  const a = connect(uid(1)), b = connect(uid(2));
  const ea = await a.enter('철수');
  assert.strictEqual(ea.init.room, 'plaza');
  assert.strictEqual(ea.world.rooms.length, 7);
  assert.strictEqual(ea.init.tally, null);

  const eb = await b.enter('  영희  ', 'food');
  assert.strictEqual(eb.init.room, 'food');
  assert.deepStrictEqual(eb.init.tally, { A: 0, B: 0 });
  assert.strictEqual(eb.init.players[0].name, '영희');

  a.send({ t: 'join', room: 'food' });
  const init = await a.next('init');
  assert.strictEqual(init.players.length, 2);
  const joined = await b.next('join');
  assert.strictEqual(joined.p.name, '철수');
  assert.deepStrictEqual(joined.p.look, { color: 2, face: 1, acc: 4 });

  a.ws.close();
  assert.strictEqual((await b.next('leave')).id, init.you);
  b.ws.close();
});

test('투표 구역에 서면 투표되고, 반대쪽으로 가면 표가 바뀌며, 한 사람은 한 표다', async () => {
  const a = connect(uid(3)), b = connect(uid(4));
  await a.enter('가', 'office');
  await b.enter('나', 'office');
  await a.next('join');

  // 휴게 공간에서는 투표되지 않음
  a.send({ t: 'm', x: 300, y: 200 });
  assert.strictEqual((await b.next('m')).y, 200);
  assert.ok(await a.none('voted'));

  a.send({ t: 'm', x: 150, y: 600 });
  assert.strictEqual((await a.next('voted')).choice, 'A');
  assert.deepStrictEqual(await b.next('tally'), { t: 'tally', A: 1, B: 0 });

  b.send({ t: 'm', x: 650, y: 600 });
  assert.strictEqual((await b.next('voted')).choice, 'B');
  await a.next('tally'); await a.next('tally');

  a.send({ t: 'm', x: 700, y: 500 });
  assert.strictEqual((await a.next('voted')).choice, 'B');
  assert.deepStrictEqual(await b.next('tally'), { t: 'tally', A: 1, B: 1 }); // b 자신의 투표 알림
  assert.deepStrictEqual(await b.next('tally'), { t: 'tally', A: 0, B: 2 });
  assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM votes WHERE room = 'office'").get().n, 2);

  // 같은 사람(같은 쿠키)이 다시 접속하면 내 표가 기억되어 있음
  a.ws.close();
  const again = connect(uid(3));
  assert.strictEqual((await again.enter('가', 'office')).init.myVote, 'B');
  again.ws.close(); b.ws.close();
});

test('좌표는 방 안으로 제한되고 잘못된 값은 무시된다', async () => {
  const a = connect(uid(5)), b = connect(uid(6));
  await a.enter('가', 'game'); await b.enter('나', 'game'); await a.next('join');
  a.send({ t: 'm', x: -9999, y: 99999 });
  const m = await b.next('m');
  assert.strictEqual(m.x, R.WORLD.margin);
  assert.strictEqual(m.y, R.WORLD.h - R.WORLD.margin);
  a.send({ t: 'm', x: 'abc', y: null });
  a.ws.send('not json');
  assert.ok(await b.none('m'));
  a.ws.close(); b.ws.close();
});

test('채팅은 같은 방에만 전달되고, 길이 제한·도배 방지·욕설 가림이 적용된다', async () => {
  const a = connect(uid(7)), b = connect(uid(8)), other = connect(uid(9));
  await a.enter('가', 'love'); await b.enter('나', 'love'); await other.enter('다', 'money');
  a.send({ t: 'c', text: '  안녕 ' + 'ㅋ'.repeat(200) });
  const c = await b.next('c');
  assert.strictEqual(c.name, '가');
  assert.strictEqual(c.text.length, 80);
  assert.match(c.pid, /^[0-9a-f]{12}$/);
  a.send({ t: 'c', text: '바로 또 보냄' }); // 너무 빨라서 무시
  assert.ok(await b.none('c'));
  assert.ok(await other.none('c', 50));
  assert.strictEqual(cleanText('야 시발 뭐야'), '야 ** 뭐야');

  // 나중에 들어온 사람은 최근 대화를 볼 수 있음
  const late = connect(uid(10));
  assert.strictEqual((await late.enter('라', 'love')).init.history.length, 1);
  [a, b, other, late].forEach((x) => x.ws.close());
});

test('닉네임 없이는 입장할 수 없고, 입장 전 메시지는 무시된다', async () => {
  const a = connect(uid(11));
  await a.opened;
  a.send({ t: 'c', text: '입장 전' });
  a.send({ t: 'hello', name: '   ', look: {} });
  assert.match((await a.next('err')).msg, /닉네임/);
  a.send({ t: 'hello', name: '<b>이름</b>이아주아주길다', look: { color: 99, face: -1, acc: 'x' } });
  const init = await a.next('init');
  assert.strictEqual(init.players[0].name.length, 10);
  assert.deepStrictEqual(init.players[0].look, { color: 0, face: 0, acc: 0 });
  a.ws.close();
});

test('신고는 기록되고, 다른 사이트에서 연 웹소켓은 거부된다', async () => {
  const a = connect(uid(12));
  await a.enter('가', 'campus');
  a.send({ t: 'report', pid: 'abcdef012345', name: '나쁜사람', text: '문제의 말' });
  assert.match((await a.next('note')).msg, /신고/);
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM reports').get().n, 1);
  a.ws.close();

  const evil = connect(null, { origin: 'https://evil.example' });
  await assert.rejects(evil.opened);
});

test('웹 페이지가 열리고 익명 쿠키가 발급된다', async () => {
  const res = await fetch(`http://127.0.0.1:${port}/`);
  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('set-cookie'), /^uid=[0-9a-f]{32}; Path=\/; HttpOnly/);
  assert.match(await res.text(), /쉼표/);
  assert.strictEqual((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
});
