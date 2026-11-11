'use strict';
const crypto = require('node:crypto');

// 2026년 최저시급. 매년 1월에 확인 후 수정.
const MIN_HOURLY_WAGE = 10320;

const SIDOS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

const CATEGORIES = ['건설·잡부', '철거', '목공·철근', '미장·타일', '전기·설비', '이사·운반',
  '물류·상하차', '청소', '농촌·수확', '행사·스태프', '주방·서빙', '기타'];

const PAY_METHODS = ['당일 현금', '당일 계좌이체', '익일 계좌이체', '주급'];

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, expectedHex) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizePhone(v) {
  const digits = String(v || '').replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

function formatPhone(p) {
  return p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}`
    : `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
}

// 김철수 → 김*수, 홍길 → 홍*
function maskName(name) {
  const chars = Array.from(name);
  if (chars.length <= 1) return name;
  if (chars.length === 2) return chars[0] + '*';
  return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}

// 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
function todayKST(offsetDays) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + (offsetDays || 0) * 86400000);
  return d.toISOString().slice(0, 10);
}

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function formatDate(s) {
  const d = new Date(s + 'T00:00:00Z');
  const day = '일월화수목금토'[d.getUTCDay()];
  let label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${day})`;
  if (s === todayKST()) label += ' 오늘';
  else if (s === todayKST(1)) label += ' 내일';
  return label;
}

function workHours(start, end) {
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) diff += 24 * 60; // 야간 근무
  return diff / 60;
}

// 근로기준법상 휴게시간(4시간당 30분)을 뺀 시간 기준 최저 일당
function minimumDailyWage(start, end) {
  const h = workHours(start, end);
  const breakH = h >= 8 ? 1 : h >= 4 ? 0.5 : 0;
  return Math.ceil((h - breakH) * MIN_HOURLY_WAGE);
}

function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }

module.exports = {
  MIN_HOURLY_WAGE, SIDOS, CATEGORIES, PAY_METHODS,
  escapeHtml, hashPassword, verifyPassword, normalizePhone, formatPhone, maskName,
  todayKST, isValidDate, formatDate, workHours, minimumDailyWage, won
};
