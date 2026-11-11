// 실행: node tests/calc.test.js
const assert = require('assert');
const C = require('../assets/calc.js');

// 대출: 1억, 4.5%, 30년 원리금균등 → 월 506,685원
let r = C.loan(100000000, 4.5, 360, 'equal');
assert.strictEqual(r.firstPayment, 506685);
assert.strictEqual(r.schedule[359].balance, 0);

// 만기일시: 매달 이자만, 총이자 = 원금 × 연이율 × 년수
r = C.loan(10000000, 6, 12, 'bullet');
assert.strictEqual(r.firstPayment, 50000);
assert.strictEqual(r.totalInterest, 600000);

// 원금균등: 원금 동일, 총이자는 원리금균등보다 적음
const p = C.loan(100000000, 4.5, 360, 'principal');
assert.ok(p.totalInterest < C.loan(100000000, 4.5, 360, 'equal').totalInterest);

// 퇴직금: 1년 미만은 0원
assert.strictEqual(C.severance(new Date(2025, 0, 1), new Date(2025, 6, 1), 9000000).severancePay, 0);
// 3년 근무, 3개월 900만 원
const s = C.severance(new Date(2023, 0, 2), new Date(2026, 0, 2), 9000000, 0, 0);
assert.ok(s.eligible);
assert.strictEqual(s.serviceDays, 1096);

// 소득세 누진세율 구간
assert.strictEqual(C._internal.progressiveTax(14000000), 840000);
assert.strictEqual(C._internal.progressiveTax(50000000), 6240000);

// 실수령액: 연봉이 오르면 실수령액도 오름, 공제 합계는 항목 합과 같음
const a = C.salary(40000000), b = C.salary(60000000);
assert.ok(b.monthlyNet > a.monthlyNet);
assert.strictEqual(a.totalDeduction, a.pension + a.health + a.longTermCare + a.employment + a.incomeTax + a.localTax);
// 국민연금 상한 적용
assert.strictEqual(C.salary(200000000).pension, C.salary(120000000).pension);

console.log('모든 테스트 통과');
