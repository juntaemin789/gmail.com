'use strict';
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { openDb } = require('./src/db');
const U = require('./src/util');
const V = require('./src/views');

const SESSION_DAYS = 30;

const STATS_SQL = `
  (SELECT AVG(rating) FROM reviews r WHERE r.reviewee_id = u.id) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.reviewee_id = u.id) AS review_count,
  (SELECT COUNT(*) FROM applications a2 JOIN jobs j2 ON j2.id = a2.job_id
    WHERE a2.worker_id = u.id AND a2.status = 'accepted' AND j2.work_date < :today) AS done_count`;

const JOB_SQL = `
  SELECT j.*,
    (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'accepted') AS accepted_count,
    (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'applied') AS pending_count
  FROM jobs j`;

function createApp(db) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // ---- 쿠키·세션·플래시 ----
  app.use((req, res, next) => {
    const cookies = {};
    for (const part of (req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) {
        try { cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* 잘못된 쿠키 무시 */ }
      }
    }
    req.cookies = cookies;

    res.setCookie = (name, value, maxAgeSec) => {
      const attrs = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
      if (req.secure) attrs.push('Secure');
      res.append('Set-Cookie', attrs.join('; '));
    };

    req.user = null;
    if (cookies.sid) {
      req.user = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`).get(cookies.sid, Date.now()) || null;
    }

    res.flash = (msg) => res.setCookie('flash', msg, 60);
    res.page = (title, body, status) => {
      const flash = cookies.flash;
      if (flash) res.setCookie('flash', '', 0);
      res.status(status || 200).send(V.layout({ user: req.user, title, body, flash }));
    };
    res.back = (msg, to) => { if (msg) res.flash(msg); res.redirect(303, to); };
    next();
  });

  // ---- 다른 사이트에서 보낸 POST 차단 (CSRF) ----
  app.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    const origin = req.headers.origin;
    if (origin) {
      let host = null;
      try { host = new URL(origin).host; } catch { /* 형식 오류 */ }
      if (host !== req.headers.host) return res.page('오류', V.message('요청을 처리할 수 없습니다', '잘못된 요청입니다.'), 403);
    }
    next();
  });

  const requireLogin = (req, res, next) => (req.user ? next() : res.redirect(303, `/login?next=${encodeURIComponent(req.originalUrl)}`));
  const requireRole = (role) => (req, res, next) => {
    if (!req.user) return res.redirect(303, '/login');
    if (req.user.role !== role) {
      return res.page('권한 없음', V.message('이용할 수 없는 기능입니다',
        role === 'employer' ? '구인자 계정으로만 공고를 올릴 수 있습니다.' : '구직자 계정으로만 지원할 수 있습니다.'), 403);
    }
    next();
  };
  const notFound = (res) => res.page('찾을 수 없음', V.message('페이지를 찾을 수 없습니다', '주소가 바뀌었거나 삭제된 페이지입니다.'), 404);
  const idParam = (v) => (/^\d{1,12}$/.test(v) ? Number(v) : 0);
  const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

  function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, userId, Date.now() + SESSION_DAYS * 86400000);
    res.setCookie('sid', token, SESSION_DAYS * 86400);
  }

  function userStats(id) {
    return db.prepare(`SELECT ${STATS_SQL} FROM users u WHERE u.id = :id`).get({ id, today: U.todayKST() });
  }

  const safeNext = (v) => (typeof v === 'string' && /^\/(?![/\\])/.test(v) ? v : '/');

  // ---- 홈: 일자리 목록 ----
  app.get('/', (req, res) => {
    const filters = {
      sido: U.SIDOS.includes(req.query.sido) ? req.query.sido : '',
      category: U.CATEGORIES.includes(req.query.category) ? req.query.category : ''
    };
    let sql = `${JOB_SQL} WHERE j.status = 'open' AND j.work_date >= ?`;
    const params = [U.todayKST()];
    if (filters.sido) { sql += ' AND j.sido = ?'; params.push(filters.sido); }
    if (filters.category) { sql += ' AND j.category = ?'; params.push(filters.category); }
    sql += ' ORDER BY j.work_date, j.start_time, j.id DESC LIMIT 100';
    res.page('', V.home({ user: req.user, jobs: db.prepare(sql).all(...params), filters }));
  });

  // ---- 회원가입·로그인 ----
  app.get('/signup', (req, res) => {
    if (req.user) return res.redirect(303, '/');
    res.page('회원가입', V.signup({ values: { role: req.query.role } }));
  });

  app.post('/signup', (req, res) => {
    const b = req.body || {};
    const values = { name: text(b.name, 20), phone: text(b.phone, 20), role: b.role };
    const fail = (error) => res.page('회원가입', V.signup({ values, error }), 400);
    const phone = U.normalizePhone(b.phone);
    if (!values.name) return fail('이름을 입력해 주세요.');
    if (!phone) return fail('휴대폰 번호를 정확히 입력해 주세요. (예: 01012345678)');
    if (typeof b.password !== 'string' || b.password.length < 8 || b.password.length > 100) return fail('비밀번호는 8자 이상이어야 합니다.');
    if (b.role !== 'worker' && b.role !== 'employer') return fail('가입 유형을 선택해 주세요.');
    if (b.agree !== '1') return fail('약관에 동의해 주세요.');
    if (db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone)) return fail('이미 가입된 번호입니다. 로그인해 주세요.');

    const { hash, salt } = U.hashPassword(b.password);
    const info = db.prepare('INSERT INTO users (phone, pw_hash, pw_salt, name, role) VALUES (?, ?, ?, ?, ?)')
      .run(phone, hash, salt, values.name, b.role);
    startSession(res, Number(info.lastInsertRowid));
    res.back('가입을 환영합니다!', b.role === 'employer' ? '/jobs/new' : '/');
  });

  app.get('/login', (req, res) => {
    if (req.user) return res.redirect(303, '/');
    res.page('로그인', V.login({ next: safeNext(req.query.next) }));
  });

  const loginFails = new Map(); // ip → { count, resetAt }
  app.post('/login', (req, res) => {
    const b = req.body || {};
    const now = Date.now();
    const rec = loginFails.get(req.ip);
    if (rec && rec.resetAt > now && rec.count >= 10) {
      return res.page('로그인', V.login({ next: safeNext(req.query.next), error: '로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도해 주세요.' }), 429);
    }
    const phone = U.normalizePhone(b.phone);
    const user = phone && db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user || typeof b.password !== 'string' || !U.verifyPassword(b.password, user.pw_salt, user.pw_hash)) {
      if (!rec || rec.resetAt <= now) loginFails.set(req.ip, { count: 1, resetAt: now + 15 * 60000 });
      else rec.count++;
      return res.page('로그인', V.login({ next: safeNext(req.query.next), values: { phone: text(b.phone, 20) }, error: '휴대폰 번호 또는 비밀번호가 맞지 않습니다.' }), 401);
    }
    loginFails.delete(req.ip);
    startSession(res, user.id);
    res.redirect(303, safeNext(req.query.next));
  });

  app.post('/logout', (req, res) => {
    if (req.cookies.sid) db.prepare('DELETE FROM sessions WHERE token = ?').run(req.cookies.sid);
    res.setCookie('sid', '', 0);
    res.redirect(303, '/');
  });

  // ---- 공고 ----
  app.get('/jobs/new', requireRole('employer'), (req, res) => {
    res.page('공고 올리기', V.jobForm({ values: { sido: req.user.sido } }));
  });

  app.post('/jobs', requireRole('employer'), (req, res) => {
    const b = req.body || {};
    const v = {
      title: text(b.title, 60), category: b.category, sido: b.sido, sigungu: text(b.sigungu, 20),
      address: text(b.address, 100), work_date: text(b.work_date, 10),
      start_time: text(b.start_time, 5), end_time: text(b.end_time, 5),
      wage: String(b.wage || '').replace(/[^\d]/g, '').slice(0, 9), headcount: text(b.headcount, 3),
      pay_method: b.pay_method, description: text(b.description, 1000)
    };
    const fail = (error) => res.page('공고 올리기', V.jobForm({ values: v, error }), 400);
    const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
    const wage = Number(v.wage);
    const headcount = Number(v.headcount);

    if (v.title.length < 2) return fail('제목을 2자 이상 입력해 주세요.');
    if (!U.CATEGORIES.includes(v.category)) return fail('직종을 선택해 주세요.');
    if (!U.SIDOS.includes(v.sido) || !v.sigungu) return fail('근무 지역을 입력해 주세요.');
    if (!v.address) return fail('상세 주소를 입력해 주세요.');
    if (!U.isValidDate(v.work_date) || v.work_date < U.todayKST() || v.work_date > U.todayKST(60)) {
      return fail('근무일은 오늘부터 60일 이내로 선택해 주세요.');
    }
    if (!timeOk(v.start_time) || !timeOk(v.end_time) || v.start_time === v.end_time) return fail('근무 시간을 확인해 주세요.');
    if (!Number.isInteger(headcount) || headcount < 1 || headcount > 100) return fail('모집 인원은 1~100명으로 입력해 주세요.');
    if (!U.PAY_METHODS.includes(v.pay_method)) return fail('지급 방식을 선택해 주세요.');
    const minWage = U.minimumDailyWage(v.start_time, v.end_time);
    if (!wage || wage < minWage) return fail(`일당이 최저임금보다 적습니다. 이 근무 시간의 최저 일당은 ${U.won(minWage)}입니다.`);
    if (wage > 5000000) return fail('일당을 확인해 주세요.');

    const info = db.prepare(`INSERT INTO jobs
      (employer_id, title, category, sido, sigungu, address, work_date, start_time, end_time, wage, headcount, pay_method, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(req.user.id, v.title, v.category, v.sido, v.sigungu, v.address, v.work_date,
        v.start_time, v.end_time, wage, headcount, v.pay_method, v.description);
    res.back('공고가 등록됐습니다.', `/jobs/${info.lastInsertRowid}`);
  });

  app.get('/jobs/:id', (req, res) => {
    const job = db.prepare(`${JOB_SQL} WHERE j.id = ?`).get(idParam(req.params.id));
    if (!job) return notFound(res);
    const today = U.todayKST();
    const employer = db.prepare(`SELECT u.name, u.phone, ${STATS_SQL} FROM users u WHERE u.id = :id`)
      .get({ id: job.employer_id, today });
    let application = null;
    let applicants = [];
    if (req.user && req.user.id === job.employer_id) {
      applicants = db.prepare(`SELECT a.id, a.status, a.message, a.worker_id,
          u.name, u.phone, u.intro, u.safety_cert, ${STATS_SQL},
          (SELECT 1 FROM reviews r WHERE r.application_id = a.id AND r.reviewer_id = :me) AS reviewed
        FROM applications a JOIN users u ON u.id = a.worker_id
        WHERE a.job_id = :job
        ORDER BY CASE a.status WHEN 'applied' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, a.id`)
        .all({ job: job.id, me: req.user.id, today });
    } else if (req.user) {
      application = db.prepare('SELECT * FROM applications WHERE job_id = ? AND worker_id = ?').get(job.id, req.user.id) || null;
    }
    res.page(job.title, V.jobDetail({ user: req.user, job, employer, application, applicants, today }));
  });

  app.post('/jobs/:id/close', requireLogin, (req, res) => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(idParam(req.params.id));
    if (!job || job.employer_id !== req.user.id) return notFound(res);
    db.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").run(job.id);
    res.back('공고를 마감했습니다.', `/jobs/${job.id}`);
  });

  // ---- 지원 ----
  app.post('/jobs/:id/apply', requireRole('worker'), (req, res) => {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(idParam(req.params.id));
    if (!job) return notFound(res);
    const to = `/jobs/${job.id}`;
    if (job.status !== 'open' || job.work_date < U.todayKST()) return res.back('모집이 끝난 공고입니다.', to);
    const message = text(req.body && req.body.message, 200);
    const existing = db.prepare('SELECT * FROM applications WHERE job_id = ? AND worker_id = ?').get(job.id, req.user.id);
    if (!existing) {
      db.prepare('INSERT INTO applications (job_id, worker_id, message) VALUES (?, ?, ?)').run(job.id, req.user.id, message);
    } else if (existing.status === 'canceled') {
      db.prepare("UPDATE applications SET status = 'applied', message = ? WHERE id = ?").run(message, existing.id);
    } else {
      return res.back('이미 지원한 공고입니다.', to);
    }
    res.back('지원했습니다. 채용이 확정되면 연락처가 공개됩니다.', to);
  });

  // 지원 건 + 공고를 함께 불러오기
  function loadApplication(id) {
    return db.prepare(`SELECT a.*, j.employer_id, j.headcount, j.work_date, j.status AS job_status
      FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`).get(idParam(id));
  }

  app.post('/applications/:id/accept', requireLogin, (req, res) => {
    const a = loadApplication(req.params.id);
    if (!a || a.employer_id !== req.user.id) return notFound(res);
    const to = `/jobs/${a.job_id}`;
    if (a.status !== 'applied') return res.back('이미 처리된 지원입니다.', to);
    const accepted = db.prepare("SELECT COUNT(*) AS n FROM applications WHERE job_id = ? AND status = 'accepted'").get(a.job_id).n;
    if (accepted >= a.headcount) return res.back('모집 인원이 이미 다 찼습니다.', to);
    db.prepare("UPDATE applications SET status = 'accepted' WHERE id = ?").run(a.id);
    if (accepted + 1 >= a.headcount && a.job_status === 'open') {
      db.prepare("UPDATE jobs SET status = 'full' WHERE id = ?").run(a.job_id);
    }
    res.back('채용을 확정했습니다. 상대방에게 연락처와 주소가 공개됩니다.', to);
  });

  app.post('/applications/:id/reject', requireLogin, (req, res) => {
    const a = loadApplication(req.params.id);
    if (!a || a.employer_id !== req.user.id) return notFound(res);
    if (a.status === 'applied') db.prepare("UPDATE applications SET status = 'rejected' WHERE id = ?").run(a.id);
    res.back(null, `/jobs/${a.job_id}`);
  });

  app.post('/applications/:id/cancel', requireLogin, (req, res) => {
    const a = loadApplication(req.params.id);
    if (!a || a.worker_id !== req.user.id) return notFound(res);
    const to = `/jobs/${a.job_id}`;
    if (a.work_date < U.todayKST() || (a.status !== 'applied' && a.status !== 'accepted')) return res.back('취소할 수 없는 지원입니다.', to);
    db.prepare("UPDATE applications SET status = 'canceled' WHERE id = ?").run(a.id);
    // 인원이 다 찼던 공고라면 자리가 났으니 다시 모집
    if (a.status === 'accepted' && a.job_status === 'full') db.prepare("UPDATE jobs SET status = 'open' WHERE id = ?").run(a.job_id);
    res.back('지원을 취소했습니다.', to);
  });

  // ---- 후기 (근무일 이후, 채용 확정된 건만, 서로 1회) ----
  app.post('/applications/:id/review', requireLogin, (req, res) => {
    const a = loadApplication(req.params.id);
    const me = req.user.id;
    if (!a || (a.worker_id !== me && a.employer_id !== me)) return notFound(res);
    const to = a.worker_id === me ? '/me' : `/jobs/${a.job_id}`;
    if (a.status !== 'accepted' || a.work_date > U.todayKST()) return res.back('근무일 이후에 후기를 남길 수 있습니다.', to);
    const rating = Number(req.body && req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.back('별점을 선택해 주세요.', to);
    const reviewee = a.worker_id === me ? a.employer_id : a.worker_id;
    const info = db.prepare(`INSERT OR IGNORE INTO reviews (application_id, reviewer_id, reviewee_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)`).run(a.id, me, reviewee, rating, text(req.body.comment, 300));
    res.back(info.changes ? '후기를 남겼습니다.' : '이미 후기를 남겼습니다.', to);
  });

  // ---- 내 페이지·프로필 ----
  app.get('/me', requireLogin, (req, res) => {
    const today = U.todayKST();
    const stats = userStats(req.user.id);
    if (req.user.role === 'employer') {
      const jobs = db.prepare(`${JOB_SQL} WHERE j.employer_id = ? ORDER BY j.work_date DESC, j.id DESC LIMIT 200`).all(req.user.id);
      return res.page('내 공고', V.meEmployer({ user: req.user, stats, jobs }));
    }
    const applications = db.prepare(`SELECT a.id, a.status, a.job_id,
        j.title, j.work_date, j.start_time, j.end_time, j.wage, j.sido, j.sigungu, j.address,
        e.phone AS employer_phone,
        (SELECT 1 FROM reviews r WHERE r.application_id = a.id AND r.reviewer_id = a.worker_id) AS reviewed
      FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users e ON e.id = j.employer_id
      WHERE a.worker_id = ? ORDER BY j.work_date DESC, a.id DESC LIMIT 200`).all(req.user.id);
    res.page('내 지원', V.meWorker({ user: req.user, stats, applications, today }));
  });

  app.post('/me', requireLogin, (req, res) => {
    const b = req.body || {};
    const name = text(b.name, 20);
    if (!name) return res.back('이름을 입력해 주세요.', '/me');
    db.prepare('UPDATE users SET name = ?, sido = ?, intro = ?, safety_cert = ? WHERE id = ?')
      .run(name, U.SIDOS.includes(b.sido) ? b.sido : '', text(b.intro, 300),
        req.user.role === 'worker' && b.safety_cert === '1' ? 1 : 0, req.user.id);
    res.back('프로필을 저장했습니다.', '/me');
  });

  app.get('/users/:id', (req, res) => {
    const id = idParam(req.params.id);
    const target = db.prepare('SELECT id, name, role, sido, intro, safety_cert FROM users WHERE id = ?').get(id);
    if (!target) return notFound(res);
    const reviews = db.prepare('SELECT rating, comment, created_at FROM reviews WHERE reviewee_id = ? ORDER BY id DESC LIMIT 30').all(id);
    res.page('프로필', V.profile({ target, stats: userStats(id), reviews }));
  });

  app.use((req, res) => notFound(res));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send(V.layout({ user: null, title: '오류', body: V.message('문제가 발생했습니다', '잠시 후 다시 시도해 주세요.') }));
  });

  return app;
}

if (require.main === module) {
  const db = openDb(process.env.DB_PATH || path.join(__dirname, 'data', 'ilgam.db'));
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const port = Number(process.env.PORT) || 3000;
  createApp(db).listen(port, () => console.log(`일감 서버 실행 중: http://localhost:${port}`));
}

module.exports = { createApp };
