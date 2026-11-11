/* 캐릭터 그리기. 좌표 (x, y)는 발밑 가운데. */
(function () {
  'use strict';

  var COLORS = ['#ff8a8a', '#ffb3d1', '#ffc56b', '#ffe066', '#8ed99a', '#7cc7f5', '#b39df5', '#c9ced6'];
  var FACES = ['기본', '웃음', '반짝', '졸림'];
  var ACCS = ['없음', '모자', '리본', '안경', '왕관', '헤드폰'];

  function shade(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amount));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    var b = Math.max(0, Math.min(255, (n & 255) + amount));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }

  /**
   * @param look {color, face, acc}
   * @param o { t: 시간(ms), moving: 걷는 중, dir: 1 오른쪽 / -1 왼쪽 }
   */
  function draw(ctx, x, y, look, o) {
    o = o || {};
    var t = o.t || 0;
    var color = COLORS[look.color] || COLORS[0];
    var dark = shade(color, -55);
    var bob = o.moving ? Math.abs(Math.sin(t / 110)) * 4 : Math.sin(t / 600) * 1.2;
    var step = o.moving ? Math.sin(t / 110) * 5 : 0;
    var dir = o.dir === -1 ? -1 : 1;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ellipse(ctx, x, y + 2, 17, 6); ctx.fill();

    // 발
    ctx.fillStyle = dark;
    ellipse(ctx, x - 9 + step, y - 2, 7, 5); ctx.fill();
    ellipse(ctx, x + 9 - step, y - 2, 7, 5); ctx.fill();

    // 몸
    var by = y - 26 - bob;
    ctx.fillStyle = color; ctx.strokeStyle = dark; ctx.lineWidth = 2.5;
    ellipse(ctx, x, by, 20, 23); ctx.fill(); ctx.stroke();
    // 배 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, x - 6 * dir, by - 9, 7, 5); ctx.fill();

    // 얼굴 (보는 방향으로 살짝 치우침)
    var fx = x + 3 * dir, fy = by - 3;
    ctx.fillStyle = '#2b2b33'; ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    if (look.face === 1) { // 웃음 ^^
      ctx.beginPath(); ctx.arc(fx - 7, fy + 1, 3.5, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(fx + 7, fy + 1, 3.5, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(fx, fy + 6, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    } else if (look.face === 2) { // 반짝
      ellipse(ctx, fx - 7, fy, 4, 4.6); ctx.fill();
      ellipse(ctx, fx + 7, fy, 4, 4.6); ctx.fill();
      ctx.fillStyle = '#fff';
      ellipse(ctx, fx - 8, fy - 1.5, 1.5, 1.5); ctx.fill();
      ellipse(ctx, fx + 6, fy - 1.5, 1.5, 1.5); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy + 6, 2.5, 0, Math.PI); ctx.stroke();
    } else if (look.face === 3) { // 졸림
      ctx.beginPath(); ctx.moveTo(fx - 10, fy); ctx.lineTo(fx - 4, fy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + 4, fy); ctx.lineTo(fx + 10, fy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 2, fy + 7); ctx.lineTo(fx + 2, fy + 7); ctx.stroke();
    } else { // 기본
      ellipse(ctx, fx - 7, fy, 2.6, 3.2); ctx.fill();
      ellipse(ctx, fx + 7, fy, 2.6, 3.2); ctx.fill();
      ctx.beginPath(); ctx.arc(fx, fy + 5, 3, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
    }
    // 볼터치
    ctx.fillStyle = 'rgba(255,90,120,0.35)';
    ellipse(ctx, fx - 12, fy + 5, 3.5, 2.2); ctx.fill();
    ellipse(ctx, fx + 12, fy + 5, 3.5, 2.2); ctx.fill();

    // 꾸미기
    var top = by - 23;
    if (look.acc === 1) { // 모자
      ctx.fillStyle = '#3b5bdb';
      ctx.beginPath(); ctx.arc(x, top + 9, 15, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x + (dir === 1 ? 2 : -24), top + 6, 22, 5, 2.5); ctx.fill();
    } else if (look.acc === 2) { // 리본
      ctx.fillStyle = '#f03e6e';
      ctx.beginPath(); ctx.moveTo(x, top + 6); ctx.lineTo(x - 13, top - 2); ctx.lineTo(x - 13, top + 13); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, top + 6); ctx.lineTo(x + 13, top - 2); ctx.lineTo(x + 13, top + 13); ctx.closePath(); ctx.fill();
      ellipse(ctx, x, top + 6, 4, 4); ctx.fill();
    } else if (look.acc === 3) { // 안경
      ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 2;
      ellipse(ctx, fx - 7, fy, 6, 6); ctx.stroke();
      ellipse(ctx, fx + 7, fy, 6, 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 1, fy); ctx.lineTo(fx + 1, fy); ctx.stroke();
    } else if (look.acc === 4) { // 왕관
      ctx.fillStyle = '#fcc419'; ctx.strokeStyle = '#c98d00'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 13, top + 9); ctx.lineTo(x - 13, top - 4); ctx.lineTo(x - 6, top + 3); ctx.lineTo(x, top - 7);
      ctx.lineTo(x + 6, top + 3); ctx.lineTo(x + 13, top - 4); ctx.lineTo(x + 13, top + 9); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (look.acc === 5) { // 헤드폰
      ctx.strokeStyle = '#343a40'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(x, by - 4, 21, 1.12 * Math.PI, 1.88 * Math.PI); ctx.stroke();
      ctx.fillStyle = '#343a40';
      ctx.beginPath(); ctx.roundRect(x - 25, by - 9, 8, 15, 3); ctx.fill();
      ctx.beginPath(); ctx.roundRect(x + 17, by - 9, 8, 15, 3); ctx.fill();
    }
    return by - 30; // 머리 위 y (말풍선 위치용)
  }

  window.Character = { COLORS: COLORS, FACES: FACES, ACCS: ACCS, draw: draw };
})();
