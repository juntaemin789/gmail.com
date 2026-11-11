'use strict';
const U = require('./util');
const e = U.escapeHtml;

const SITE = '일감';

function layout({ user, title, body, flash }) {
  const nav = user
    ? `${user.role === 'employer' ? '<a class="btn small" href="/jobs/new">공고 올리기</a>' : ''}
       <a href="/me">${user.role === 'employer' ? '내 공고' : '내 지원'}</a>
       <form method="post" action="/logout" class="inline"><button class="link">로그아웃</button></form>`
    : `<a href="/login">로그인</a><a class="btn small" href="/signup">회원가입</a>`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title ? `${title} - ${SITE}` : `${SITE} - 수수료 없는 일용직 직거래`)}</title>
<meta name="description" content="인력사무소 없이 일용직 일자리를 직접 구하고, 일할 사람을 직접 구하세요.">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header class="site"><div class="inner">
  <a class="logo" href="/">🛠 ${SITE}</a>
  <nav>${nav}</nav>
</div></header>
<main>
${flash ? `<div class="flash">${e(flash)}</div>` : ''}
${body}
</main>
<footer class="site"><div class="inner">
  ${SITE} · 인력사무소 없이 직접 구하는 일용직<br>
  ${SITE}은 구인자와 구직자를 연결하는 게시판이며, 근로계약의 당사자가 아닙니다.
</div></footer>
</body>
</html>`;
}

function stars(avg, count) {
  if (!count) return '<span class="muted">후기 없음</span>';
  return `<span class="stars">★ ${Number(avg).toFixed(1)}</span> <span class="muted">(${count})</span>`;
}

function options(list, selected, placeholder) {
  return (placeholder ? `<option value="">${e(placeholder)}</option>` : '') +
    list.map((v) => `<option${v === selected ? ' selected' : ''}>${e(v)}</option>`).join('');
}

function statusBadge(job) {
  if (job.work_date < U.todayKST()) return '<span class="badge gray">종료</span>';
  if (job.status === 'full') return '<span class="badge gray">모집완료</span>';
  if (job.status === 'closed') return '<span class="badge gray">마감</span>';
  return '<span class="badge green">모집중</span>';
}

function jobCard(job) {
  return `<a class="card job" href="/jobs/${job.id}">
  <div class="job-top">
    <span class="badge">${e(job.category)}</span>
    <span class="muted">${e(job.sido)} ${e(job.sigungu)}</span>
    ${statusBadge(job)}
  </div>
  <h2>${e(job.title)}</h2>
  <div class="job-meta">
    <span>📅 ${e(U.formatDate(job.work_date))} ${e(job.start_time)}~${e(job.end_time)}</span>
    <span>👥 ${job.accepted_count}/${job.headcount}명</span>
  </div>
  <div class="job-bottom">
    <span class="wage">일당 ${e(U.won(job.wage))}</span>
    <span class="muted">${e(job.pay_method)}</span>
  </div>
</a>`;
}

function home({ user, jobs, filters }) {
  const hero = user ? '' : `<section class="hero">
  <h1>인력사무소 없이,<br>일자리와 사람을 직접 연결합니다</h1>
  <p>소개 수수료 0원. 일당은 전부 일한 사람에게.</p>
  <div class="hero-btns">
    <a class="btn" href="/signup?role=worker">일자리 찾기</a>
    <a class="btn outline" href="/signup?role=employer">사람 구하기</a>
  </div>
</section>`;
  return `${hero}
<form class="filters" method="get" action="/">
  <select name="sido" aria-label="지역">${options(U.SIDOS, filters.sido, '전체 지역')}</select>
  <select name="category" aria-label="직종">${options(U.CATEGORIES, filters.category, '전체 직종')}</select>
  <button class="btn small">검색</button>
</form>
<h2 class="section-title">모집 중인 일자리 <span class="muted">${jobs.length}건</span></h2>
${jobs.length ? jobs.map(jobCard).join('') : `<div class="card empty">조건에 맞는 일자리가 아직 없습니다.${
    user && user.role === 'employer' ? ' <a href="/jobs/new">첫 공고를 올려 보세요.</a>' : ''}</div>`}`;
}

function field(label, input, hint) {
  return `<label>${label}${input}</label>${hint ? `<div class="hint">${hint}</div>` : ''}`;
}

function errorBox(error) {
  return error ? `<div class="error">${e(error)}</div>` : '';
}

function signup({ values, error }) {
  const v = values || {};
  const role = v.role === 'employer' ? 'employer' : 'worker';
  return `<h1>회원가입</h1>
<form class="card" method="post" action="/signup">
  ${errorBox(error)}
  <div class="role-pick">
    <label class="radio"><input type="radio" name="role" value="worker"${role === 'worker' ? ' checked' : ''}> 일자리를 찾아요</label>
    <label class="radio"><input type="radio" name="role" value="employer"${role === 'employer' ? ' checked' : ''}> 일할 사람을 구해요</label>
  </div>
  ${field('이름', `<input name="name" maxlength="20" required value="${e(v.name)}">`)}
  ${field('휴대폰 번호', `<input name="phone" inputmode="numeric" placeholder="01012345678" required value="${e(v.phone)}">`,
    '채용이 확정된 상대방에게만 공개됩니다.')}
  ${field('비밀번호', '<input name="password" type="password" minlength="8" required>', '8자 이상')}
  <label class="check"><input type="checkbox" name="agree" value="1" required> 이용약관과 개인정보 수집·이용에 동의합니다</label>
  <button class="btn block">가입하기</button>
  <p class="muted center">이미 계정이 있나요? <a href="/login">로그인</a></p>
</form>`;
}

function login({ values, error, next }) {
  return `<h1>로그인</h1>
<form class="card" method="post" action="/login?next=${encodeURIComponent(next || '/')}">
  ${errorBox(error)}
  ${field('휴대폰 번호', `<input name="phone" inputmode="numeric" required value="${e(values && values.phone)}">`)}
  ${field('비밀번호', '<input name="password" type="password" required>')}
  <button class="btn block">로그인</button>
  <p class="muted center">처음이신가요? <a href="/signup">회원가입</a></p>
</form>`;
}

function jobForm({ values, error }) {
  const v = values || {};
  return `<h1>공고 올리기</h1>
<form class="card" method="post" action="/jobs">
  ${errorBox(error)}
  ${field('제목', `<input name="title" maxlength="60" required placeholder="예: 아파트 현장 자재 정리 2명" value="${e(v.title)}">`)}
  <div class="row">
    ${field('직종', `<select name="category" required>${options(U.CATEGORIES, v.category, '선택')}</select>`)}
    ${field('모집 인원', `<input name="headcount" type="number" min="1" max="100" required value="${e(v.headcount || 1)}">`)}
  </div>
  <div class="row">
    ${field('시·도', `<select name="sido" required>${options(U.SIDOS, v.sido, '선택')}</select>`)}
    ${field('시·군·구', `<input name="sigungu" maxlength="20" required placeholder="예: 강남구" value="${e(v.sigungu)}">`)}
  </div>
  ${field('상세 주소', `<input name="address" maxlength="100" required placeholder="예: 테헤란로 123 신축현장 정문" value="${e(v.address)}">`,
    '채용을 확정한 사람에게만 공개됩니다.')}
  ${field('근무일', `<input name="work_date" type="date" required min="${U.todayKST()}" max="${U.todayKST(60)}" value="${e(v.work_date || U.todayKST(1))}">`)}
  <div class="row">
    ${field('시작 시간', `<input name="start_time" type="time" required value="${e(v.start_time || '07:00')}">`)}
    ${field('종료 시간', `<input name="end_time" type="time" required value="${e(v.end_time || '17:00')}">`)}
  </div>
  <div class="row">
    ${field('일당 (원)', `<input name="wage" inputmode="numeric" required placeholder="예: 160000" value="${e(v.wage)}">`)}
    ${field('지급 방식', `<select name="pay_method" required>${options(U.PAY_METHODS, v.pay_method || U.PAY_METHODS[0])}</select>`)}
  </div>
  <div class="hint">최저시급(${U.won(U.MIN_HOURLY_WAGE)}) 미만의 일당은 등록할 수 없습니다.</div>
  ${field('상세 내용', `<textarea name="description" rows="5" maxlength="1000" placeholder="하는 일, 준비물(안전화 등), 식사 제공 여부, 우대 사항">${e(v.description)}</textarea>`)}
  <button class="btn block">공고 등록</button>
</form>`;
}

function reviewForm(applicationId, targetLabel) {
  return `<form class="review-form" method="post" action="/applications/${applicationId}/review">
  <select name="rating" required aria-label="별점">
    <option value="5">★★★★★ 최고예요</option><option value="4">★★★★ 좋아요</option>
    <option value="3">★★★ 보통</option><option value="2">★★ 별로예요</option><option value="1">★ 나빠요</option>
  </select>
  <input name="comment" maxlength="300" placeholder="${e(targetLabel)} 후기 (선택)">
  <button class="btn small">후기 남기기</button>
</form>`;
}

function applicantRow(a, job, today) {
  const info = `<div class="applicant-head">
    <a href="/users/${a.worker_id}"><b>${e(a.name)}</b></a> ${stars(a.avg_rating, a.review_count)}
    <span class="muted">· 완료 ${a.done_count}건</span>
    ${a.safety_cert ? '<span class="badge green">안전교육 이수</span>' : ''}
  </div>
  ${a.intro ? `<div class="muted">${e(a.intro)}</div>` : ''}
  ${a.message ? `<div class="quote">“${e(a.message)}”</div>` : ''}`;
  let actions = '';
  if (a.status === 'applied') {
    actions = `<div class="actions">
      <form method="post" action="/applications/${a.id}/accept" class="inline"><button class="btn small">채용 확정</button></form>
      <form method="post" action="/applications/${a.id}/reject" class="inline"><button class="btn small outline">거절</button></form>
    </div>`;
  } else if (a.status === 'accepted') {
    actions = `<div class="actions"><span class="badge green">채용 확정</span>
      <a class="btn small outline" href="tel:${e(a.phone)}">📞 ${e(U.formatPhone(a.phone))}</a></div>
      ${job.work_date <= today ? (a.reviewed ? '<div class="muted">후기 작성 완료</div>' : reviewForm(a.id, '근무자')) : ''}`;
  } else if (a.status === 'rejected') {
    actions = '<div class="actions"><span class="badge gray">거절함</span></div>';
  } else {
    actions = '<div class="actions"><span class="badge gray">지원 취소됨</span></div>';
  }
  return `<div class="applicant">${info}${actions}</div>`;
}

function jobDetail({ user, job, employer, application, applicants, today }) {
  const isOwner = user && user.id === job.employer_id;
  const past = job.work_date < today;
  const hours = U.workHours(job.start_time, job.end_time);
  let action = '';

  if (isOwner) {
    action = `<section class="card">
  <h2>지원자 ${applicants.length}명</h2>
  ${applicants.length ? applicants.map((a) => applicantRow(a, job, today)).join('') : '<p class="muted">아직 지원자가 없습니다.</p>'}
</section>
${!past && job.status !== 'closed' ? `<form method="post" action="/jobs/${job.id}/close"
  onsubmit="return confirm('공고를 마감할까요? 더 이상 지원을 받지 않습니다.')"><button class="btn outline block">공고 마감하기</button></form>` : ''}`;
  } else if (!user) {
    action = `<a class="btn block" href="/login?next=/jobs/${job.id}">로그인하고 지원하기</a>`;
  } else if (user.role === 'worker') {
    const st = application && application.status;
    if (st === 'accepted') {
      action = `<section class="card confirmed">
  <h2>✅ 채용이 확정됐어요</h2>
  <p><b>근무지</b> ${e(job.sido)} ${e(job.sigungu)} ${e(job.address)}</p>
  <p><b>담당자</b> ${e(employer.name)} <a class="btn small outline" href="tel:${e(employer.phone)}">📞 ${e(U.formatPhone(employer.phone))}</a></p>
  ${past ? '' : `<form method="post" action="/applications/${application.id}/cancel"
    onsubmit="return confirm('확정된 일을 취소할까요? 잦은 취소는 후기에 반영될 수 있습니다.')"><button class="link">못 가게 됐어요 (취소)</button></form>`}
</section>`;
    } else if (st === 'applied') {
      action = `<section class="card">
  <h2>지원 완료</h2>
  <p class="muted">구인자가 확인 후 채용을 확정하면 연락처와 상세 주소가 공개됩니다.</p>
  <form method="post" action="/applications/${application.id}/cancel"><button class="btn outline small">지원 취소</button></form>
</section>`;
    } else if (st === 'rejected') {
      action = '<div class="card empty">이번 공고는 다른 분이 채용되었습니다.</div>';
    } else if (past || job.status !== 'open') {
      action = '<div class="card empty">모집이 끝난 공고입니다.</div>';
    } else {
      action = `<form class="card" method="post" action="/jobs/${job.id}/apply">
  ${field('한마디 (선택)', '<input name="message" maxlength="200" placeholder="예: 현장 경력 3년, 안전화 있습니다">')}
  <button class="btn block">지원하기</button>
</form>`;
    }
  }

  return `<article class="card">
  <div class="job-top">
    <span class="badge">${e(job.category)}</span>
    ${statusBadge(job)}
  </div>
  <h1>${e(job.title)}</h1>
  <div class="wage big">일당 ${e(U.won(job.wage))} <span class="muted">· ${e(job.pay_method)}</span></div>
  <dl>
    <dt>근무일</dt><dd>${e(U.formatDate(job.work_date))}</dd>
    <dt>시간</dt><dd>${e(job.start_time)} ~ ${e(job.end_time)} (${hours}시간)</dd>
    <dt>지역</dt><dd>${e(job.sido)} ${e(job.sigungu)} <span class="muted">· 상세 주소는 채용 확정 후 공개</span></dd>
    <dt>인원</dt><dd>${job.accepted_count}/${job.headcount}명 확정</dd>
    <dt>구인자</dt><dd><a href="/users/${job.employer_id}">${e(U.maskName(employer.name))}</a> ${stars(employer.avg_rating, employer.review_count)}</dd>
  </dl>
  ${job.description ? `<p class="desc">${e(job.description)}</p>` : ''}
</article>
${action}`;
}

const APP_STATUS = {
  applied: '<span class="badge">확인 대기</span>',
  accepted: '<span class="badge green">채용 확정</span>',
  rejected: '<span class="badge gray">미채용</span>',
  canceled: '<span class="badge gray">취소함</span>'
};

function profileForm(user) {
  return `<details class="card">
  <summary>내 프로필 수정</summary>
  <form method="post" action="/me">
    ${field('이름', `<input name="name" maxlength="20" required value="${e(user.name)}">`)}
    ${field('주 활동 지역', `<select name="sido">${options(U.SIDOS, user.sido, '선택 안 함')}</select>`)}
    ${field(user.role === 'worker' ? '경력·자기소개' : '업체 소개',
      `<textarea name="intro" rows="3" maxlength="300" placeholder="${user.role === 'worker' ? '예: 철거 5년, 1톤 트럭 보유' : '예: OO인테리어, 주거 리모델링 전문'}">${e(user.intro)}</textarea>`)}
    ${user.role === 'worker' ? `<label class="check"><input type="checkbox" name="safety_cert" value="1"${user.safety_cert ? ' checked' : ''}> 건설업 기초안전보건교육을 이수했습니다</label>` : ''}
    <button class="btn small">저장</button>
  </form>
</details>`;
}

function meWorker({ user, stats, applications, today }) {
  const rows = applications.map((a) => `<div class="card">
  <div class="job-top">${APP_STATUS[a.status]} <span class="muted">${e(U.formatDate(a.work_date))} ${e(a.start_time)}~${e(a.end_time)}</span></div>
  <h2><a href="/jobs/${a.job_id}">${e(a.title)}</a></h2>
  <div class="job-bottom"><span class="wage">일당 ${e(U.won(a.wage))}</span><span class="muted">${e(a.sido)} ${e(a.sigungu)}</span></div>
  ${a.status === 'accepted' ? `<p>📍 ${e(a.address)} · <a href="tel:${e(a.employer_phone)}">📞 ${e(U.formatPhone(a.employer_phone))}</a></p>` : ''}
  ${a.status === 'accepted' && a.work_date <= today ? (a.reviewed ? '<div class="muted">후기 작성 완료</div>' : reviewForm(a.id, '구인자')) : ''}
</div>`).join('');
  return `<h1>${e(user.name)}님</h1>
<p class="lead">${stars(stats.avg_rating, stats.review_count)} · 완료 ${stats.done_count}건 · <a href="/users/${user.id}">공개 프로필 보기</a></p>
${profileForm(user)}
<h2 class="section-title">내 지원 내역</h2>
${rows || '<div class="card empty">아직 지원한 일자리가 없습니다. <a href="/">일자리 보러 가기</a></div>'}`;
}

function meEmployer({ user, stats, jobs }) {
  const rows = jobs.map((j) => `<a class="card job" href="/jobs/${j.id}">
  <div class="job-top">${statusBadge(j)} <span class="muted">${e(U.formatDate(j.work_date))}</span></div>
  <h2>${e(j.title)}</h2>
  <div class="job-bottom">
    <span>확정 ${j.accepted_count}/${j.headcount}명</span>
    ${j.pending_count ? `<span class="badge">새 지원자 ${j.pending_count}명</span>` : '<span class="muted">대기 중인 지원자 없음</span>'}
  </div>
</a>`).join('');
  return `<h1>${e(user.name)}님</h1>
<p class="lead">${stars(stats.avg_rating, stats.review_count)} · <a href="/users/${user.id}">공개 프로필 보기</a></p>
${profileForm(user)}
<h2 class="section-title">내 공고</h2>
<a class="btn block" href="/jobs/new">+ 새 공고 올리기</a>
${rows || '<div class="card empty">아직 올린 공고가 없습니다.</div>'}`;
}

function profile({ target, stats, reviews }) {
  return `<section class="card">
  <h1>${e(U.maskName(target.name))} <span class="badge">${target.role === 'worker' ? '구직자' : '구인자'}</span></h1>
  <p>${stars(stats.avg_rating, stats.review_count)}${target.role === 'worker' ? ` · 완료 ${stats.done_count}건` : ''}
    ${target.sido ? ` · ${e(target.sido)}` : ''}
    ${target.safety_cert ? ' <span class="badge green">안전교육 이수</span>' : ''}</p>
  ${target.intro ? `<p class="desc">${e(target.intro)}</p>` : ''}
</section>
<h2 class="section-title">받은 후기</h2>
${reviews.length ? reviews.map((r) => `<div class="card review">
  <span class="stars">${'★'.repeat(r.rating)}</span><span class="muted">${'★'.repeat(5 - r.rating)}</span>
  ${r.comment ? `<p>${e(r.comment)}</p>` : ''}
  <div class="muted">${e(r.created_at.slice(0, 10))}</div>
</div>`).join('') : '<div class="card empty">아직 받은 후기가 없습니다.</div>'}`;
}

function message(title, text) {
  return `<div class="card empty"><h1>${e(title)}</h1><p>${e(text)}</p><a class="btn" href="/">홈으로</a></div>`;
}

module.exports = { layout, home, signup, login, jobForm, jobDetail, meWorker, meEmployer, profile, message };
