'use strict';
// 화면 확인용 예시 데이터. 실행: npm run seed  (실제 운영 DB에는 실행하지 마세요)
const path = require('node:path');
const { openDb } = require('./db');
const U = require('./util');

const db = openDb(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'ilgam.db'));
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
  console.log('이미 데이터가 있어 예시 데이터를 넣지 않았습니다.');
  process.exit(0);
}

function addUser(phone, name, role, sido, intro, safety) {
  const { hash, salt } = U.hashPassword('test1234');
  return Number(db.prepare(`INSERT INTO users (phone, pw_hash, pw_salt, name, role, sido, intro, safety_cert)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(phone, hash, salt, name, role, sido, intro, safety).lastInsertRowid);
}

const boss1 = addUser('01011110001', '박현장', 'employer', '서울', '주거 리모델링 전문 인테리어 업체입니다.', 0);
const boss2 = addUser('01011110002', '이물류', 'employer', '경기', '수도권 물류센터 운영', 0);
const w1 = addUser('01022220001', '김철수', 'worker', '서울', '철거·잡부 5년, 안전화 보유', 1);
const w2 = addUser('01022220002', '최영희', 'worker', '경기', '물류 상하차 2년', 0);

const addJob = db.prepare(`INSERT INTO jobs
  (employer_id, title, category, sido, sigungu, address, work_date, start_time, end_time, wage, headcount, pay_method, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const jobs = [
  [boss1, '아파트 리모델링 철거 보조 2명', '철거', '서울', '송파구', '올림픽로 300 OO아파트 101동', 1, '08:00', '17:00', 170000, 2, '당일 계좌이체', '폐자재 운반과 현장 정리입니다.\n안전화 필수, 점심 제공.'],
  [boss1, '상가 인테리어 자재 양중', '건설·잡부', '서울', '마포구', '양화로 45 2층', 2, '07:00', '16:00', 160000, 3, '당일 현금', '석고보드, 타일 양중. 엘리베이터 사용 가능.'],
  [boss2, '물류센터 야간 상하차', '물류·상하차', '경기', '이천시', '마장면 서이천로 123', 1, '19:00', '04:00', 150000, 5, '익일 계좌이체', '택배 상하차. 셔틀버스 운행, 야식 제공.'],
  [boss2, '창고 이전 짐 나르기', '이사·운반', '경기', '용인시', '기흥구 동백중앙로 16', 3, '09:00', '15:00', 110000, 2, '당일 계좌이체', '박스 위주라 어렵지 않습니다.'],
  [boss1, '준공 청소 (완료된 예시)', '청소', '서울', '강동구', '천호대로 1000', -3, '09:00', '18:00', 130000, 1, '당일 계좌이체', '']
];
const ids = jobs.map((j) => {
  const row = j.slice();
  row[6] = U.todayKST(j[6]);
  return Number(addJob.run(...row).lastInsertRowid);
});

const apply = db.prepare('INSERT INTO applications (job_id, worker_id, status, message) VALUES (?, ?, ?, ?)');
apply.run(ids[0], w1, 'applied', '철거 경력 5년입니다. 내일 바로 가능합니다.');
apply.run(ids[2], w2, 'applied', '');
const done = Number(apply.run(ids[4], w1, 'accepted', '').lastInsertRowid);
db.prepare("UPDATE jobs SET status = 'full' WHERE id = ?").run(ids[4]);
const review = db.prepare('INSERT INTO reviews (application_id, reviewer_id, reviewee_id, rating, comment) VALUES (?, ?, ?, ?, ?)');
review.run(done, boss1, w1, 5, '시간 약속 잘 지키고 일을 꼼꼼하게 하십니다.');
review.run(done, w1, boss1, 5, '일당 당일에 바로 입금해 주셨어요.');

console.log('예시 데이터를 넣었습니다. 모든 계정의 비밀번호는 test1234 입니다.');
console.log('구인자: 01011110001, 01011110002 / 구직자: 01022220001, 01022220002');
