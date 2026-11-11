'use strict';
/*
 * 방 정의 (서버 쪽: 이름, 주제, 등장 위치, 문 위치).
 * 방의 생김새(가구, 조명)는 public/scenes.js에 있습니다.
 *
 * 좌표: 가로·세로 0~800. 40이 1미터라서 방 하나는 20m × 20m 입니다.
 * 화면에서는 (x - 400) / 40 이 동서 방향, (y - 400) / 40 이 남북 방향(위가 북쪽)입니다.
 */
const WORLD = { size: 800, margin: 24, scale: 40 };

const EXIT = [{ to: 'plaza', x: 400, y: 770 }];
const INDOOR_SPAWN = { x: 400, y: 640 };

const ROOMS = [
  {
    id: 'plaza', name: '광장', group: '모두', desc: '건물 문으로 걸어 들어가 보세요',
    spawn: { x: 400, y: 610 },
    portals: [
      { to: 'cafe', x: 250, y: 36 }, { to: 'lounge', x: 550, y: 36 },
      { to: 'pcroom', x: 36, y: 300 }, { to: 'pocha', x: 36, y: 560 },
      { to: 'study', x: 764, y: 300 }, { to: 'rooftop', x: 764, y: 560 }
    ]
  },
  {
    id: 'cafe', name: '카페 쉼표', group: '직장인', desc: '커피 한 잔 하면서 회사 얘기',
    spawn: INDOOR_SPAWN, portals: EXIT,
    topics: ['요즘 회사에서 제일 힘든 건?', '점심 뭐 먹었어요?', '퇴근하고 뭐 하세요?', '이직, 해 본 사람?', '월요병 극복하는 법', '최고의 상사 vs 최악의 상사']
  },
  {
    id: 'lounge', name: '고민 라운지', group: '연애·고민 상담', desc: '소파에 앉아 털어놓는 연애와 고민 얘기',
    spawn: INDOOR_SPAWN, portals: EXIT,
    topics: ['요즘 제일 큰 고민은?', '썸인지 아닌지 헷갈릴 때', '연락 문제로 싸워 본 적 있나요?', '이별 후 극복하는 법', '좋아하는 사람에게 먼저 다가가는 법', '친구와 멀어졌을 때']
  },
  {
    id: 'pcroom', name: 'PC방', group: '게이머', desc: '게임 얘기라면 밤새도 모자란 사람들',
    spawn: INDOOR_SPAWN, portals: EXIT,
    topics: ['요즘 하는 게임은?', '인생 게임 하나만 꼽는다면', '같이 할 사람 구해요', '과금, 어디까지 해 봤나요?', '최악의 팀원 썰', '기대되는 신작']
  },
  {
    id: 'pocha', name: '포장마차', group: '먹는 게 낙인 사람', desc: '오늘 뭐 먹지? 맛집과 야식 얘기',
    spawn: INDOOR_SPAWN, portals: EXIT,
    topics: ['오늘 저녁 뭐 먹을까요?', '우리 동네 숨은 맛집', '야식 최애 메뉴', '혼밥 어디까지 해 봤나요?', '소울푸드 하나만 고른다면', '실패 없는 배달 메뉴']
  },
  {
    id: 'study', name: '스터디룸', group: '대학생·취준생', desc: '수업, 과제, 취업 준비 얘기',
    spawn: INDOOR_SPAWN, portals: EXIT,
    topics: ['요즘 뭐 공부해요?', '집중 안 될 때 어떻게 하나요?', '취업 준비 어디까지 왔나요?', '조별 과제 썰', '자격증, 뭐가 도움 됐나요?', '시험 기간 버티는 법']
  },
  {
    id: 'rooftop', name: '루프탑', group: '돈 모으는 사람', desc: '야경 보면서 하는 솔직한 돈 얘기',
    spawn: INDOOR_SPAWN, portals: EXIT,
    topics: ['월급 관리 어떻게 하세요?', '요즘 어디에 투자하나요?', '내 집 마련, 가능할까요?', '가장 잘한 소비와 후회하는 소비', '부업 해 본 사람?', '1억 모으기, 얼마나 걸렸나요?']
  }
];

const BY_ID = new Map(ROOMS.map((r) => [r.id, r]));

// 한국 시간 기준 날짜 번호와 YYYY-MM-DD
function kstDay(now) {
  const ms = (now == null ? Date.now() : now) + 9 * 3600 * 1000;
  return { index: Math.floor(ms / 86400000), key: new Date(ms).toISOString().slice(0, 10) };
}

// 방마다 이야깃거리를 하루에 하나씩 돌아가며 사용
function topicFor(room, dayIndex) {
  return room.topics ? room.topics[dayIndex % room.topics.length] : null;
}

function publicRooms(dayIndex) {
  return ROOMS.map((r) => ({
    id: r.id, name: r.name, group: r.group, desc: r.desc, portals: r.portals, topic: topicFor(r, dayIndex)
  }));
}

module.exports = { WORLD, ROOMS, BY_ID, kstDay, topicFor, publicRooms };
