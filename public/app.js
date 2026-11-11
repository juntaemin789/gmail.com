(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var C = window.Character;
  var SPEED = 250;                 // 캐릭터 이동 속도 (1초에 움직이는 거리)
  var EXIT = { x: 90, y: 170 };    // 방 안의 "광장으로" 문
  var NPC_POS = { x: 655, y: 225 };
  var PORTAL_R = 40;
  var CHAR_SCALE = 1.5;         // 휴대폰에서도 잘 보이도록 캐릭터를 키움

  // ---------- 저장된 내 정보 ----------
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ } }

  var profile = load('swimpyo.profile', null);
  var draft = profile ? { name: profile.name, look: Object.assign({}, profile.look) }
    : { name: '', look: { color: Math.floor(Math.random() * 8), face: 0, acc: 0 } };
  var blocked = new Set(load('swimpyo.blocked', []));

  // ---------- 상태 ----------
  var ws = null, connected = false, switching = false;
  var world = { w: 800, h: 800, wall: 110, voteTop: 330, margin: 24 };
  var rooms = new Map();       // 방 정보
  var counts = {};
  var cur = { id: null, players: new Map(), tally: null, myVote: null };
  var myId = null;
  var keys = {};
  var lastSent = 0, pendingSend = null;
  var npcBubbleUntil = 0;

  // ---------- 입장 화면 ----------
  var preview = $('preview').getContext('2d');
  function drawPreview(ts) {
    if ($('entry').hidden) return;
    preview.clearRect(0, 0, 200, 200);
    preview.save();
    preview.translate(100, 150); preview.scale(2.6, 2.6);
    C.draw(preview, 0, 0, draft.look, { t: ts, moving: false, dir: 1 });
    preview.restore();
    requestAnimationFrame(drawPreview);
  }

  function buildPicks(containerId, count, key, label) {
    var box = $(containerId);
    box.textContent = '';
    for (var i = 0; i < count; i++) {
      (function (i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', label(i));
        if (key === 'color') {
          b.className = 'swatch';
          b.style.background = C.COLORS[i];
        } else {
          b.className = 'opt';
          var cv = document.createElement('canvas');
          cv.width = 96; cv.height = 96;
          b.appendChild(cv);
        }
        b.addEventListener('click', function () { draft.look[key] = i; refreshPicks(); });
        box.appendChild(b);
      })(i);
    }
  }

  function refreshPicks() {
    ['color', 'face', 'acc'].forEach(function (key) {
      var box = $(key + 'Picks');
      Array.prototype.forEach.call(box.children, function (b, i) {
        b.classList.toggle('on', draft.look[key] === i);
        var cv = b.querySelector('canvas');
        if (!cv) return;
        var g = cv.getContext('2d');
        var look = Object.assign({}, draft.look); look[key] = i;
        g.clearRect(0, 0, 96, 96);
        g.save(); g.translate(48, 82); g.scale(1.45, 1.45);
        C.draw(g, 0, 0, look, { t: 0 });
        g.restore();
      });
    });
  }

  function showEntry() {
    $('entry').hidden = false;
    $('nameInput').value = draft.name;
    $('enterBtn').textContent = connected ? '저장하기' : '입장하기';
    refreshPicks();
    requestAnimationFrame(drawPreview);
  }

  buildPicks('colorPicks', C.COLORS.length, 'color', function (i) { return '색깔 ' + (i + 1); });
  buildPicks('facePicks', C.FACES.length, 'face', function (i) { return '표정 ' + C.FACES[i]; });
  buildPicks('accPicks', C.ACCS.length, 'acc', function (i) { return '꾸미기 ' + C.ACCS[i]; });
  showEntry();

  $('entryForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 10);
    if (!name) return;
    draft.name = name;
    profile = { name: name, look: Object.assign({}, draft.look) };
    save('swimpyo.profile', profile);
    $('entry').hidden = true;
    $('game').hidden = false;
    resize();
    if (connected) send({ t: 'hello', name: profile.name, look: profile.look });
    else connect();
  });

  $('editBtn').addEventListener('click', showEntry);

  // ---------- 서버 연결 ----------
  function send(msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }

  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = function () {
      connected = true;
      toast('');
      send({ t: 'hello', name: profile.name, look: profile.look, room: cur.id || 'plaza' });
    };
    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      var h = handlers[m.t];
      if (h) h(m);
    };
    ws.onclose = function () {
      connected = false;
      toast('연결이 끊겼어요. 다시 연결하는 중…', true);
      setTimeout(connect, 2000);
    };
  }

  function addPlayer(p) {
    cur.players.set(p.id, {
      id: p.id, pid: p.pid, name: p.name, look: p.look,
      x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 1, moving: false, bubble: null
    });
  }

  var handlers = {
    world: function (m) {
      world = m.world;
      rooms = new Map(m.rooms.map(function (r) { return [r.id, r]; }));
      counts = m.counts;
    },
    init: function (m) {
      switching = false;
      myId = m.you;
      cur.id = m.room;
      cur.players = new Map();
      m.players.forEach(addPlayer);
      cur.tally = m.tally;
      cur.myVote = m.myVote;
      var room = rooms.get(cur.id);
      $('log').textContent = '';
      m.history.forEach(function (c) { addChat(c, true); });
      addSystem(room.emoji + ' ' + room.name + '에 들어왔어요. ' + room.desc);
      if (room.question) addSystem('📢 오늘의 질문: ' + room.question.q);
      npcBubbleUntil = performance.now() + 9000;
      renderHeader();
      renderQuestion();
      renderRoomCards();
    },
    join: function (m) {
      addPlayer(m.p);
      if (!blocked.has(m.p.pid)) addSystem(m.p.name + '님이 들어왔어요.');
      renderHeader();
    },
    leave: function (m) { cur.players.delete(m.id); renderHeader(); },
    m: function (m) {
      var p = cur.players.get(m.id);
      if (p) { p.tx = m.x; p.ty = m.y; }
    },
    upd: function (m) {
      var p = cur.players.get(m.id);
      if (p) { p.name = m.name; p.look = m.look; }
    },
    c: function (m) {
      if (blocked.has(m.pid)) return;
      addChat(m);
      var p = cur.players.get(m.id);
      if (p) p.bubble = { text: m.text, until: performance.now() + 5000 };
    },
    tally: function (m) { cur.tally = { A: m.A, B: m.B }; renderQuestion(); },
    voted: function (m) { cur.myVote = m.choice; renderQuestion(); },
    counts: function (m) { counts = m.counts; renderHeader(); if (!$('roomsPanel').hidden) renderRoomCards(); },
    err: function (m) {
      toast(m.msg);
      if (switching) { switching = false; var r = rooms.get(cur.id); setTarget(400, r && r.portals ? 540 : 230); }
    },
    note: function (m) { toast(m.msg); }
  };

  // ---------- 화면 위쪽: 방 이름, 질문, 투표 버튼 ----------
  function renderHeader() {
    var room = rooms.get(cur.id);
    if (!room) return;
    $('roomTitle').textContent = room.emoji + ' ' + room.name + ' · ' + cur.players.size + '명';
    document.documentElement.style.setProperty('--accent', room.theme.dark ? '#5b5bd6' : room.theme.accent);
  }

  function renderQuestion() {
    var room = rooms.get(cur.id);
    var q = room && room.question;
    $('choices').hidden = !q;
    if (!q) {
      $('qtext').textContent = '문으로 걸어 들어가면 방으로 이동해요';
      $('qhint').textContent = '화면을 누르면 그곳으로 걸어가요. 방마다 주제가 달라요.';
      return;
    }
    $('qtext').textContent = 'Q. ' + q.q;
    var t = cur.tally || { A: 0, B: 0 };
    var total = t.A + t.B;
    var pa = total ? Math.round(t.A * 100 / total) : 50;
    var show = !!cur.myVote;
    [['btnA', 'A', q.a, pa, room.theme.a], ['btnB', 'B', q.b, 100 - pa, room.theme.b]].forEach(function (d) {
      var b = $(d[0]);
      b.querySelector('.txt').textContent = d[1] + '. ' + d[2];
      b.querySelector('.pct').textContent = show ? d[3] + '%' : '';
      b.querySelector('.fill').style.width = show ? d[3] + '%' : '0';
      b.style.setProperty('--c', d[4]);
      b.classList.toggle('mine', cur.myVote === d[1]);
    });
    $('qhint').textContent = show
      ? '총 ' + total + '명 참여 · 반대쪽으로 걸어가면 표가 바뀌어요'
      : '버튼을 누르거나 바닥의 A/B 구역으로 걸어가면 투표돼요. 투표하면 결과가 보여요.';
  }

  $('btnA').addEventListener('click', function () { setTarget(200 + rand(90), 560 + rand(120)); });
  $('btnB').addEventListener('click', function () { setTarget(600 + rand(90), 560 + rand(120)); });
  function rand(range) { return (Math.random() - 0.5) * range; }

  // ---------- 방 목록 ----------
  function renderRoomCards() {
    var box = $('roomCards');
    box.textContent = '';
    rooms.forEach(function (r) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'room-card' + (r.id === cur.id ? ' here' : '');
      card.style.setProperty('--rc', r.theme.dark ? r.theme.trim : r.theme.accent);
      var head = document.createElement('div'); head.className = 'rc-head';
      var name = document.createElement('b'); name.textContent = r.emoji + ' ' + r.name;
      var group = document.createElement('span'); group.className = 'chip'; group.textContent = r.group;
      var count = document.createElement('span'); count.className = 'rc-count';
      count.textContent = (counts[r.id] || 0) + '명' + (r.id === cur.id ? ' · 지금 여기' : '');
      head.appendChild(name); head.appendChild(group); head.appendChild(count);
      var desc = document.createElement('div'); desc.className = 'rc-desc';
      desc.textContent = r.question ? 'Q. ' + r.question.q + ' — ' + r.question.a + ' vs ' + r.question.b : r.desc;
      card.appendChild(head); card.appendChild(desc);
      card.addEventListener('click', function () {
        $('roomsPanel').hidden = true;
        if (r.id !== cur.id) { switching = true; send({ t: 'join', room: r.id }); }
      });
      box.appendChild(card);
    });
  }
  $('roomsBtn').addEventListener('click', function () { renderRoomCards(); $('roomsPanel').hidden = false; });
  $('roomsClose').addEventListener('click', function () { $('roomsPanel').hidden = true; });
  $('roomsPanel').addEventListener('click', function (e) { if (e.target === $('roomsPanel')) $('roomsPanel').hidden = true; });

  // ---------- 채팅 ----------
  function trimLog() {
    var log = $('log');
    while (log.children.length > 120) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function addSystem(text) {
    var row = document.createElement('div');
    row.className = 'sys'; row.textContent = text;
    $('log').appendChild(row); trimLog();
  }
  function addChat(m, old) {
    if (blocked.has(m.pid)) return;
    var row = document.createElement('div');
    row.className = 'msg' + (old ? ' old' : '');
    var name = document.createElement('button');
    name.type = 'button'; name.className = 'who'; name.textContent = m.name;
    var mine = m.id === myId;
    if (mine) name.classList.add('me');
    else name.addEventListener('click', function () { openUserMenu(m); });
    var text = document.createElement('span'); text.textContent = m.text;
    row.appendChild(name); row.appendChild(text);
    $('log').appendChild(row); trimLog();
  }
  $('chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = $('chatInput').value.trim();
    if (!text) return;
    send({ t: 'c', text: text });
    $('chatInput').value = '';
  });

  var menuTarget = null;
  function openUserMenu(m) { menuTarget = m; $('userMenuName').textContent = m.name; $('userMenu').hidden = false; }
  $('userMenuClose').addEventListener('click', function () { $('userMenu').hidden = true; });
  $('blockBtn').addEventListener('click', function () {
    blocked.add(menuTarget.pid); save('swimpyo.blocked', Array.from(blocked));
    $('userMenu').hidden = true; toast(menuTarget.name + '님의 채팅을 숨겼어요.');
  });
  $('reportBtn').addEventListener('click', function () {
    send({ t: 'report', pid: menuTarget.pid, name: menuTarget.name, text: menuTarget.text });
    $('userMenu').hidden = true;
  });

  var toastTimer = null;
  function toast(text, sticky) {
    var el = $('status');
    clearTimeout(toastTimer);
    el.textContent = text; el.hidden = !text;
    if (text && !sticky) toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }

  // ---------- 이동 ----------
  function me() { return cur.players.get(myId); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function setTarget(x, y) {
    var p = me();
    if (!p || switching) return;
    p.tx = clamp(x, world.margin, world.w - world.margin);
    p.ty = clamp(y, world.wall + 20, world.h - world.margin);
    var now = performance.now();
    var go = function () { lastSent = performance.now(); pendingSend = null; send({ t: 'm', x: Math.round(p.tx), y: Math.round(p.ty) }); };
    if (now - lastSent > 90) go();
    else if (!pendingSend) pendingSend = setTimeout(go, 90 - (now - lastSent));
  }

  var canvas = $('world'), ctx = canvas.getContext('2d'), scale = 1;
  function resize() {
    var stage = $('stage');
    var size = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
    if (size <= 0) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = canvas.style.height = size + 'px';
    canvas.width = canvas.height = Math.round(size * dpr);
    scale = canvas.width / world.w;
  }
  window.addEventListener('resize', resize);

  canvas.addEventListener('pointerdown', function (e) {
    var r = canvas.getBoundingClientRect();
    setTarget((e.clientX - r.left) / r.width * world.w, (e.clientY - r.top) / r.height * world.h);
    if (document.activeElement === $('chatInput')) $('chatInput').blur(); // 화면을 누르면 다시 방향키로 이동 가능
  });

  var KEYMAP = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  window.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === 'Enter' && !typing && !$('game').hidden && $('entry').hidden) { $('chatInput').focus(); e.preventDefault(); return; }
    if (e.key === 'Escape') { $('chatInput').blur(); return; }
    if (typing) return;
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYMAP[k]) { keys[k] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { delete keys[e.key.length === 1 ? e.key.toLowerCase() : e.key]; });
  window.addEventListener('blur', function () { keys = {}; });

  function update(dt) {
    var p = me();
    if (p) {
      var dx = 0, dy = 0;
      for (var k in keys) { dx += KEYMAP[k][0]; dy += KEYMAP[k][1]; }
      if (dx || dy) setTarget(p.x + dx * 60, p.y + dy * 60);
    }
    cur.players.forEach(function (q) {
      var ddx = q.tx - q.x, ddy = q.ty - q.y;
      var dist = Math.hypot(ddx, ddy);
      q.moving = dist > 1;
      if (!q.moving) return;
      if (Math.abs(ddx) > 2) q.dir = ddx > 0 ? 1 : -1;
      var stepLen = Math.min(dist, SPEED * dt);
      q.x += ddx / dist * stepLen; q.y += ddy / dist * stepLen;
    });
    // 문 위에 올라서면 방 이동
    if (p && !switching) {
      var room = rooms.get(cur.id);
      var doors = room && room.portals ? room.portals : [{ to: 'plaza', x: EXIT.x, y: EXIT.y }];
      for (var i = 0; i < doors.length; i++) {
        if (Math.hypot(p.x - doors[i].x, p.y - doors[i].y) < PORTAL_R) {
          switching = true;
          send({ t: 'join', room: doors[i].to });
          break;
        }
      }
    }
  }

  // ---------- 그리기 ----------
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function wrap(text, maxWidth, maxLines) {
    var lines = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var next = line + text[i];
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line); line = text[i] === ' ' ? '' : text[i];
        if (lines.length === maxLines) { lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; return lines; }
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  function emoji(e, x, y, size) {
    ctx.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e, x, y);
  }
  var FONT = '"Apple SD Gothic Neo",Pretendard,"Malgun Gothic",sans-serif';

  function drawDoor(px, py, theme, icon, label, sub) {
    var x = 0, y = 0;
    ctx.save(); ctx.translate(px, py); ctx.scale(1.3, 1.3);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x, y + 44, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = theme.wall; ctx.strokeStyle = theme.trim; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(x - 46, y - 50, 92, 96, [40, 40, 10, 10]); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; emoji(icon, x, y - 14, 38);
    ctx.font = 'bold 15px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = theme.dark ? '#fff' : '#1f2430';
    ctx.fillText(label, x, y + 20);
    if (sub) { ctx.font = '12px ' + FONT; ctx.globalAlpha = 0.85; ctx.fillText(sub, x, y + 36); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  function drawRoom(room) {
    var th = room.theme, W = world;
    // 바닥
    ctx.fillStyle = th.floor; ctx.fillRect(0, 0, W.w, W.h);
    ctx.fillStyle = th.floor2;
    for (var ty = 0; ty < 10; ty++) for (var tx = 0; tx < 10; tx++) if ((tx + ty) % 2) ctx.fillRect(tx * 80, W.wall + ty * 80, 80, 80);

    // 투표 구역
    if (room.question) {
      ctx.fillStyle = rgba(th.a, 0.26); ctx.fillRect(0, W.voteTop, W.w / 2, W.h - W.voteTop);
      ctx.fillStyle = rgba(th.b, 0.26); ctx.fillRect(W.w / 2, W.voteTop, W.w / 2, W.h - W.voteTop);
      ctx.strokeStyle = th.dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
      ctx.beginPath(); ctx.moveTo(0, W.voteTop); ctx.lineTo(W.w, W.voteTop);
      ctx.moveTo(W.w / 2, W.voteTop); ctx.lineTo(W.w / 2, W.h); ctx.stroke();
      ctx.setLineDash([]);
      [['A', room.question.a, 200, th.a], ['B', room.question.b, 600, th.b]].forEach(function (z) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(z[3], th.dark ? 0.9 : 0.75);
        ctx.font = '900 150px ' + FONT; ctx.globalAlpha = 0.35; ctx.fillText(z[0], z[2], 520); ctx.globalAlpha = 1;
        ctx.font = 'bold 30px ' + FONT;
        ctx.fillStyle = th.dark ? '#fff' : '#1f2430';
        wrap(z[1], 340, 3).forEach(function (line, i) { ctx.fillText(line, z[2], 665 + i * 38); });
      });
      // 휴게 공간 러그
      ctx.fillStyle = rgba(th.trim, 0.22);
      ctx.beginPath(); ctx.ellipse(380, 235, 170, 62, 0, 0, Math.PI * 2); ctx.fill();
    }

    // 벽
    ctx.fillStyle = th.wall; ctx.fillRect(0, 0, W.w, W.wall);
    ctx.fillStyle = th.trim; ctx.fillRect(0, W.wall - 10, W.w, 10);

    ctx.fillStyle = '#000';
    room.decor.forEach(function (d) { emoji(d.e, d.x, d.y, d.s); });

    if (room.portals) {
      room.portals.forEach(function (pt) {
        var target = rooms.get(pt.to);
        if (target) drawDoor(pt.x, pt.y, target.theme, target.emoji, target.name, target.group + ' · ' + (counts[pt.to] || 0) + '명');
      });
    } else {
      var plaza = rooms.get('plaza');
      drawDoor(EXIT.x, EXIT.y, plaza.theme, '🚪', '광장으로', '');
    }
  }

  function drawTag(x, y, text, highlight) {
    ctx.font = 'bold 19px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width + 18;
    ctx.fillStyle = highlight ? '#1f2430' : 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y + 9, w, 27, 13.5); ctx.fill();
    ctx.fillStyle = highlight ? '#fff' : '#1f2430';
    ctx.fillText(text, x, y + 23);
  }

  function drawBubble(x, topY, text, alpha) {
    ctx.font = '20px ' + FONT;
    var lines = wrap(text, 270, 3);
    var w = 0;
    lines.forEach(function (l) { w = Math.max(w, ctx.measureText(l).width); });
    w += 26;
    var h = lines.length * 26 + 16;
    var bx = clamp(x - w / 2, 6, world.w - w - 6), by = Math.max(6, topY - h - 10);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, 12); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, by + h - 1); ctx.lineTo(x, by + h + 8); ctx.lineTo(x + 6, by + h - 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1f2430'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    lines.forEach(function (l, i) { ctx.fillText(l, bx + 13, by + 21 + i * 26); });
    ctx.globalAlpha = 1;
  }

  function render(ts) {
    var room = rooms.get(cur.id);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (!room) { ctx.fillStyle = '#e9ecf2'; ctx.fillRect(0, 0, world.w, world.h); return; }
    drawRoom(room);

    var list = Array.from(cur.players.values());
    if (room.npc) list.push({ npc: true, x: NPC_POS.x, y: NPC_POS.y, look: room.npc.look, name: '안내 · ' + room.npc.name, dir: -1 });
    list.sort(function (a, b) { return a.y - b.y; });

    var bubbles = [];
    list.forEach(function (p) {
      var isMe = p.id === myId && !p.npc;
      if (isMe) { // 내 발밑 표시
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 36, 13, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(CHAR_SCALE, CHAR_SCALE);
      var head = p.y + C.draw(ctx, 0, 0, p.look, { t: ts + (p.id || 0) * 137, moving: p.moving, dir: p.dir }) * CHAR_SCALE;
      ctx.restore();
      drawTag(p.x, p.y, p.name, isMe);
      if (p.npc && ts < npcBubbleUntil) bubbles.push([p.x, head, room.npc.line, 1]);
      if (p.bubble) {
        var left = p.bubble.until - ts;
        if (left <= 0) p.bubble = null;
        else bubbles.push([p.x, head, p.bubble.text, Math.min(1, left / 400)]);
      }
    });
    bubbles.forEach(function (b) { drawBubble(b[0], b[1], b[2], b[3]); });
  }

  var lastFrame = performance.now();
  function frame(ts) {
    var dt = Math.min(0.1, (ts - lastFrame) / 1000);
    lastFrame = ts;
    if (!$('game').hidden) { update(dt); render(ts); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 자동 테스트에서 상태를 확인하기 위한 창구
  window.__swimpyo = { state: function () { return { room: cur.id, players: cur.players.size, myVote: cur.myVote, tally: cur.tally, me: me() }; }, setTarget: setTarget };
})();
