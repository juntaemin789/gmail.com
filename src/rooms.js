'use strict';
/*
 * 방 정의. 방을 추가하려면 ROOMS에 항목을 하나 더 넣고 광장(plaza)의 portals에 문을 추가하면 됩니다.
 * 좌표계: 가로 800 × 세로 800. 위쪽(y < 110)은 벽, y >= VOTE_TOP 은 투표 구역(왼쪽 A / 오른쪽 B).
 */
const WORLD = { w: 800, h: 800, wall: 110, voteTop: 330, margin: 24 };

const ROOMS = [
  {
    id: 'plaza', name: '광장', emoji: '⛲', group: '모두', desc: '문으로 걸어 들어가면 방으로 이동해요',
    theme: { floor: '#bfe3a8', floor2: '#b3dc9a', wall: '#8ecae6', trim: '#6aaed1', accent: '#2f855a', dark: false },
    decor: [
      { e: '⛲', x: 400, y: 400, s: 84 }, { e: '🌳', x: 60, y: 420, s: 64 }, { e: '🌳', x: 740, y: 420, s: 64 },
      { e: '🌷', x: 265, y: 330, s: 30 }, { e: '🌼', x: 535, y: 330, s: 30 }, { e: '🪑', x: 300, y: 500, s: 36 },
      { e: '🪑', x: 500, y: 500, s: 36 }, { e: '☁️', x: 150, y: 50, s: 54 }, { e: '☁️', x: 620, y: 62, s: 44 }, { e: '☀️', x: 400, y: 50, s: 46 }
    ],
    portals: [
      { to: 'office', x: 130, y: 230 }, { to: 'love', x: 400, y: 200 }, { to: 'game', x: 670, y: 230 },
      { to: 'food', x: 130, y: 640 }, { to: 'campus', x: 400, y: 680 }, { to: 'money', x: 670, y: 640 }
    ],
    spawn: { x: 400, y: 540 }
  },
  {
    id: 'office', name: '탕비실', emoji: '☕', group: '직장인', desc: '회사 얘기, 월급 얘기, 퇴근하고 싶은 얘기',
    theme: { floor: '#efe3cf', floor2: '#e8d9c0', wall: '#c9b79c', trim: '#a8926f', accent: '#8a5a2b', a: '#3b82c4', b: '#d9822b', dark: false },
    decor: [
      { e: '☕', x: 250, y: 70, s: 44 }, { e: '🗄️', x: 350, y: 66, s: 50 }, { e: '🖨️', x: 460, y: 70, s: 46 },
      { e: '🪴', x: 740, y: 150, s: 46 }, { e: '🛋️', x: 330, y: 230, s: 60 }, { e: '🍪', x: 420, y: 250, s: 26 }, { e: '🕘', x: 560, y: 50, s: 36 }
    ],
    npc: { name: '김대리', look: { color: 5, face: 3, acc: 3 }, line: '커피 한 잔 하면서 골라 보세요. 왼쪽이 A, 오른쪽이 B예요.' },
    questions: [
      { q: '둘 중 하나만 고른다면?', a: '월 500, 주 6일 출근', b: '월 300, 주 4일 출근' },
      { q: '더 견디기 힘든 상사는?', a: '일은 잘하는데 성격이 최악', b: '착한데 일을 전부 떠넘김' },
      { q: '평생 한 가지만 가능하다면?', a: '재택근무, 대신 연봉 20% 삭감', b: '매일 출근, 연봉 그대로' },
      { q: '점심시간, 더 좋은 건?', a: '팀원들과 맛집 탐방', b: '혼자 조용히 먹고 낮잠' },
      { q: '회식에 대한 내 생각은?', a: '가끔은 있어야 친해진다', b: '회식비를 그냥 나눠 줬으면' },
      { q: '퇴사할 때 더 중요한 건?', a: '다음 직장을 구하고 나간다', b: '일단 나가서 쉬고 생각한다' }
    ]
  },
  {
    id: 'love', name: '연애상담소', emoji: '💌', group: '연애·썸 고민러', desc: '썸, 연애, 이별. 남 얘기가 제일 재밌죠',
    theme: { floor: '#ffe4ec', floor2: '#ffd6e2', wall: '#f7a8c0', trim: '#e07a9c', accent: '#c2376b', a: '#e0527f', b: '#7c5cc4', dark: false },
    decor: [
      { e: '💐', x: 240, y: 72, s: 46 }, { e: '🕯️', x: 330, y: 74, s: 36 }, { e: '🖼️', x: 450, y: 54, s: 44 },
      { e: '🧸', x: 740, y: 160, s: 44 }, { e: '🛋️', x: 320, y: 232, s: 60 }, { e: '💌', x: 430, y: 250, s: 28 }, { e: '🎀', x: 560, y: 58, s: 34 }
    ],
    npc: { name: '연애박사', look: { color: 1, face: 1, acc: 2 }, line: '오늘의 고민, 어느 쪽인가요? 마음 가는 쪽에 서 보세요.' },
    questions: [
      { q: '애인의 이성 친구와 단둘이 술, 괜찮다?', a: '믿으니까 괜찮다', b: '절대 안 된다' },
      { q: '더 서운한 건?', a: '기념일을 잊어버림', b: '아플 때 연락이 없음' },
      { q: '연락 스타일, 나는?', a: '틈날 때마다 자주', b: '할 말 있을 때만' },
      { q: '첫 만남 계산은?', a: '반반이 깔끔하다', b: '한 명이 내고 다음에 번갈아' },
      { q: '헤어진 애인과 친구로 지낼 수 있다?', a: '충분히 가능하다', b: '불가능하다' },
      { q: '더 끌리는 사람은?', a: '말이 잘 통하는 사람', b: '외모가 내 취향인 사람' }
    ]
  },
  {
    id: 'game', name: '오락실', emoji: '🕹️', group: '게이머', desc: '게임 얘기라면 밤새도 모자란 사람들',
    theme: { floor: '#1d1b3a', floor2: '#242150', wall: '#120f2b', trim: '#7c3aed', accent: '#a78bfa', a: '#22d3ee', b: '#f472b6', dark: true },
    decor: [
      { e: '🕹️', x: 240, y: 70, s: 48 }, { e: '👾', x: 340, y: 60, s: 42 }, { e: '🖥️', x: 450, y: 70, s: 48 },
      { e: '🎧', x: 560, y: 64, s: 36 }, { e: '🎮', x: 330, y: 240, s: 44 }, { e: '🥤', x: 430, y: 250, s: 30 }, { e: '🏆', x: 740, y: 160, s: 42 }
    ],
    npc: { name: '고인물', look: { color: 6, face: 2, acc: 5 }, line: '한 판 쉬고 골라 봐. 발 디딘 쪽이 네 표야.' },
    questions: [
      { q: '더 화나는 팀원은?', a: '실력은 없는데 말이 많음', b: '잘하는데 혼자만 플레이' },
      { q: '게임할 때 나는?', a: '스토리를 전부 본다', b: '스킵하고 바로 플레이' },
      { q: '평생 하나만 해야 한다면?', a: 'PC 게임', b: '모바일 게임' },
      { q: '과금에 대한 생각은?', a: '재미있으면 돈 쓸 수 있다', b: '무과금이 자존심이다' },
      { q: '더 좋은 게임은?', a: '짧지만 완성도 높은 게임', b: '끝없이 할 게 많은 게임' },
      { q: '지고 있을 때 나는?', a: '끝까지 한다', b: '빠르게 다음 판 간다' }
    ]
  },
  {
    id: 'food', name: '야식당', emoji: '🍜', group: '먹는 게 낙인 사람', desc: '오늘 뭐 먹지? 인류 최대의 난제',
    theme: { floor: '#ffe9c7', floor2: '#ffdfae', wall: '#e9a15a', trim: '#c97a2e', accent: '#b4541a', a: '#d9480f', b: '#2f9e44', dark: false },
    decor: [
      { e: '🍜', x: 240, y: 70, s: 46 }, { e: '🍗', x: 335, y: 70, s: 42 }, { e: '🏮', x: 450, y: 50, s: 44 },
      { e: '🍺', x: 550, y: 72, s: 38 }, { e: '🍚', x: 330, y: 245, s: 34 }, { e: '🥢', x: 420, y: 250, s: 30 }, { e: '🍢', x: 740, y: 160, s: 42 }
    ],
    npc: { name: '주방이모', look: { color: 2, face: 1, acc: 1 }, line: '어서 와요! 먹고 싶은 쪽으로 가서 서 봐요.' },
    questions: [
      { q: '탕수육은?', a: '부어 먹는다 (부먹)', b: '찍어 먹는다 (찍먹)' },
      { q: '평생 하나만 먹어야 한다면?', a: '치킨', b: '피자' },
      { q: '민트초코는?', a: '맛있다', b: '치약 맛이다' },
      { q: '라면 끓일 때?', a: '면 먼저', b: '스프 먼저' },
      { q: '더 참기 힘든 건?', a: '평생 매운 음식 금지', b: '평생 단 음식 금지' },
      { q: '파인애플 피자는?', a: '충분히 맛있다', b: '과일은 따로 먹자' }
    ]
  },
  {
    id: 'campus', name: '동아리방', emoji: '🎸', group: '대학생·취준생', desc: '수업, 과제, 취업. 공강 시간에 들르는 곳',
    theme: { floor: '#dcecff', floor2: '#cde2fb', wall: '#8fb4e3', trim: '#5f8fca', accent: '#2457a6', a: '#2f6fed', b: '#0f9d8a', dark: false },
    decor: [
      { e: '📚', x: 240, y: 70, s: 46 }, { e: '🎸', x: 335, y: 66, s: 46 }, { e: '🪧', x: 450, y: 62, s: 42 },
      { e: '🧃', x: 430, y: 250, s: 28 }, { e: '🛋️', x: 325, y: 232, s: 60 }, { e: '🎒', x: 740, y: 160, s: 42 }, { e: '📌', x: 560, y: 54, s: 30 }
    ],
    npc: { name: '동방지기', look: { color: 4, face: 0, acc: 1 }, line: '공강이야? 오늘 주제 보고 편한 쪽에 앉아.' },
    questions: [
      { q: '조별 과제, 더 싫은 조원은?', a: '연락이 안 되는 사람', b: '의견만 내고 안 하는 사람' },
      { q: '수업 시간표는?', a: '아침에 몰아 듣고 오후 자유', b: '늦게 시작해서 저녁까지' },
      { q: '첫 직장으로 더 나은 곳은?', a: '연봉 높은 중소기업', b: '연봉 낮은 대기업' },
      { q: '시험 공부 스타일은?', a: '미리미리 조금씩', b: '전날 벼락치기' },
      { q: '대학 생활에서 더 중요한 건?', a: '학점', b: '경험과 사람' },
      { q: '전공을 다시 고를 수 있다면?', a: '지금 전공 그대로', b: '무조건 다른 전공' }
    ]
  },
  {
    id: 'money', name: '머니 옥상', emoji: '🌙', group: '돈 모으는 사람', desc: '월급, 저축, 투자. 옥상에서 하는 솔직한 돈 얘기',
    theme: { floor: '#26324a', floor2: '#2c3a56', wall: '#111a2e', trim: '#e8b923', accent: '#f6d860', a: '#f59f00', b: '#4dabf7', dark: true },
    decor: [
      { e: '🌙', x: 250, y: 50, s: 44 }, { e: '🏙️', x: 400, y: 70, s: 64 }, { e: '⭐', x: 545, y: 40, s: 26 },
      { e: '📈', x: 330, y: 240, s: 40 }, { e: '🪙', x: 425, y: 252, s: 28 }, { e: '🪴', x: 740, y: 160, s: 44 }, { e: '⭐', x: 170, y: 34, s: 20 }
    ],
    npc: { name: '옥상선배', look: { color: 3, face: 3, acc: 4 }, line: '바람 좀 쐬면서 골라 봐. 정답은 없으니까.' },
    questions: [
      { q: '지금 1억이 생긴다면?', a: '전부 예금·적금', b: '전부 투자' },
      { q: '더 나은 선택은?', a: '지금 10억 받기', b: '매달 500만 원 평생 받기' },
      { q: '내 집 마련은?', a: '대출을 받아서라도 사야 한다', b: '평생 전월세도 괜찮다' },
      { q: '월급이 오르면?', a: '저축을 늘린다', b: '삶의 질을 올린다' },
      { q: '돈 얘기, 친구끼리 연봉 공개는?', a: '서로 알면 도움 된다', b: '모르는 게 낫다' },
      { q: '더 후회되는 건?', a: '사고 싶은 걸 참은 것', b: '충동적으로 산 것' }
    ]
  }
];

const BY_ID = new Map(ROOMS.map((r) => [r.id, r]));

// 한국 시간 기준 날짜 번호와 YYYY-MM-DD
function kstDay(now) {
  const ms = (now == null ? Date.now() : now) + 9 * 3600 * 1000;
  return { index: Math.floor(ms / 86400000), key: new Date(ms).toISOString().slice(0, 10) };
}

// 방마다 질문 목록을 하루에 하나씩 돌아가며 사용
function questionFor(room, dayIndex) {
  if (!room.questions) return null;
  return room.questions[dayIndex % room.questions.length];
}

// 클라이언트에 보내는 방 정보 (오늘의 질문 포함)
function publicRooms(dayIndex) {
  return ROOMS.map((r) => ({
    id: r.id, name: r.name, emoji: r.emoji, group: r.group, desc: r.desc, theme: r.theme,
    decor: r.decor, portals: r.portals || null, npc: r.npc || null, question: questionFor(r, dayIndex)
  }));
}

module.exports = { WORLD, ROOMS, BY_ID, kstDay, questionFor, publicRooms };
