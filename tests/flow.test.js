'use strict';
// 실행: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../src/db');
const { createApp } = require('../server');
const U = require('../src/util');

let server, base, db;

before(async () => {
  db = openDb(':memory:');
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// 쿠키를 기억하는 간단한 클라이언트
function client() {
  const jar = {};
  const call = async (method, url, form) => {
    const res = await fetch(base + url, {
      method,
      redirect: 'manual',
      headers: {
        cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {})
      },
      body: form ? new URLSearchParams(form).toString() : undefined
    });
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(';')[0].split('=');
      if (v) jar[k] = v; else delete jar[k];
    }
    return { status: res.status, location: res.headers.get('location'), text: await res.text() };
  };
  return { get: (u) => call('GET', u), post: (u, f) => call('POST', u, f || {}) };
}

const signup = (c, phone, name, role) =>
  c.post('/signup', { name, phone, password: 'password1', role, agree: '1' });

const jobForm = (over) => ({
  title: '철거 보조 1명', category: '철거', sido: '서울', sigungu: '송파구', address: '비밀주소 101동',
  work_date: U.todayKST(1), start_time: '08:00', end_time: '17:00', wage: '160000', headcount: '1',
  pay_method: '당일 현금', description: '안전화 필수', ...over
});

test('util: 최저 일당, 이름 가리기, 전화번호 검증', () => {
  assert.strictEqual(U.minimumDailyWage('08:00', '17:00'), 8 * U.MIN_HOURLY_WAGE);
  assert.strictEqual(U.workHours('19:00', '04:00'), 9);
  assert.strictEqual(U.maskName('김철수'), '김*수');
  assert.strictEqual(U.normalizePhone('010-1234-5678'), '01012345678');
  assert.strictEqual(U.normalizePhone('02-123-4567'), null);
});

test('공고 등록 → 지원 → 채용 확정 → 연락처 공개 → 후기까지', async () => {
  const boss = client(), worker = client(), other = client(), guest = client();

  assert.strictEqual((await signup(boss, '01011112222', '박사장', 'employer')).status, 303);
  assert.strictEqual((await signup(worker, '01033334444', '김일꾼', 'worker')).status, 303);
  await signup(other, '01055556666', '이대기', 'worker');

  // 같은 번호로 중복 가입 불가
  assert.strictEqual((await signup(client(), '01011112222', '가짜', 'worker')).status, 400);

  // 구직자는 공고를 올릴 수 없음
  assert.strictEqual((await worker.post('/jobs', jobForm())).status, 403);

  // 최저임금 미만 일당은 거부
  const low = await boss.post('/jobs', jobForm({ wage: '50000' }));
  assert.strictEqual(low.status, 400);
  assert.match(low.text, /최저임금/);

  const created = await boss.post('/jobs', jobForm());
  assert.strictEqual(created.status, 303);
  const jobUrl = created.location;

  // 목록에 보이고, 비로그인 사용자에게는 주소·전화번호가 보이지 않음
  assert.match((await guest.get('/')).text, /철거 보조 1명/);
  const publicView = (await guest.get(jobUrl)).text;
  assert.doesNotMatch(publicView, /비밀주소/);
  assert.doesNotMatch(publicView, /1111-2222/);

  // 지원
  assert.strictEqual((await worker.post(`${jobUrl}/apply`, { message: '경력 3년' })).status, 303);
  await other.post(`${jobUrl}/apply`);
  const pending = (await worker.get(jobUrl)).text;
  assert.match(pending, /지원 완료/);
  assert.doesNotMatch(pending, /비밀주소/);

  // 구인자 화면: 지원자 2명. 확정 전에는 지원자 전화번호가 보이지 않음
  const ownerView = (await boss.get(jobUrl)).text;
  assert.match(ownerView, /지원자 2명/);
  assert.match(ownerView, /경력 3년/);
  assert.doesNotMatch(ownerView, /3333-4444/);

  const apps = db.prepare('SELECT id, worker_id FROM applications ORDER BY id').all();

  // 다른 사람은 채용 확정을 누를 수 없음
  assert.strictEqual((await other.post(`/applications/${apps[0].id}/accept`)).status, 404);

  // 채용 확정 → 정원 1명이 차서 모집완료
  await boss.post(`/applications/${apps[0].id}/accept`);
  assert.strictEqual(db.prepare('SELECT status FROM jobs').get().status, 'full');
  assert.match((await boss.get(jobUrl)).text, /3333-4444/);

  // 정원 초과 확정 불가
  await boss.post(`/applications/${apps[1].id}/accept`);
  assert.strictEqual(db.prepare('SELECT status FROM applications WHERE id = ?').get(apps[1].id).status, 'applied');

  // 확정된 구직자에게만 주소와 구인자 전화번호 공개
  const confirmed = (await worker.get(jobUrl)).text;
  assert.match(confirmed, /비밀주소/);
  assert.match(confirmed, /1111-2222/);
  assert.doesNotMatch((await other.get(jobUrl)).text, /비밀주소/);

  // 근무일 전에는 후기 불가
  await worker.post(`/applications/${apps[0].id}/review`, { rating: '5' });
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 0);

  // 근무일이 지난 뒤 서로 후기 1회씩
  db.prepare('UPDATE jobs SET work_date = ?').run(U.todayKST(-1));
  await worker.post(`/applications/${apps[0].id}/review`, { rating: '5', comment: '입금 빨라요' });
  await worker.post(`/applications/${apps[0].id}/review`, { rating: '1' }); // 중복은 무시
  await boss.post(`/applications/${apps[0].id}/review`, { rating: '4', comment: '성실합니다' });
  assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n, 2);

  const profile = (await guest.get(`/users/${apps[0].worker_id}`)).text;
  assert.match(profile, /성실합니다/);
  assert.match(profile, /김\*꾼/);
  assert.doesNotMatch(profile, /김일꾼/);
});

test('확정된 구직자가 취소하면 공고가 다시 모집중으로', async () => {
  const boss = client(), worker = client();
  await signup(boss, '01077770001', '최사장', 'employer');
  await signup(worker, '01077770002', '정일꾼', 'worker');
  const jobUrl = (await boss.post('/jobs', jobForm({ title: '취소 테스트 공고' }))).location;
  const jobId = Number(jobUrl.split('/').pop());
  await worker.post(`${jobUrl}/apply`);
  const app = db.prepare('SELECT id FROM applications WHERE job_id = ?').get(jobId);
  await boss.post(`/applications/${app.id}/accept`);
  assert.strictEqual(db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId).status, 'full');
  await worker.post(`/applications/${app.id}/cancel`);
  assert.strictEqual(db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId).status, 'open');
});

test('로그인: 틀린 비밀번호 거부, 다른 사이트에서 온 POST 차단, 외부 주소로 리다이렉트 안 함', async () => {
  const c = client();
  await signup(c, '01088880001', '로그인', 'worker');
  await c.post('/logout');
  assert.strictEqual((await c.post('/login', { phone: '01088880001', password: 'wrongpass' })).status, 401);
  const ok = await c.post('/login?next=//evil.example', { phone: '01088880001', password: 'password1' });
  assert.strictEqual(ok.status, 303);
  assert.strictEqual(ok.location, '/');

  const res = await fetch(base + '/logout', { method: 'POST', headers: { origin: 'https://evil.example' }, redirect: 'manual' });
  assert.strictEqual(res.status, 403);
});

test('입력값의 HTML은 그대로 출력되지 않음 (XSS 방지)', async () => {
  const boss = client();
  await signup(boss, '01099990001', '<b>x</b>', 'employer');
  const url = (await boss.post('/jobs', jobForm({ title: '<script>alert(1)</script>' }))).location;
  const html = (await boss.get(url)).text;
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
});
