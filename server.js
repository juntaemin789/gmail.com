'use strict';
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const compression = require('compression');
const { openDb } = require('./src/db');
const { attachRealtime } = require('./src/realtime');

function createServer(db, options) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    // 회원가입 없이도 채팅 숨기기·신고 대상을 구분하기 위한 익명 식별 쿠키
    if (!/(?:^|;\s*)uid=[0-9a-f]{32}(?:;|$)/.test(req.headers.cookie || '')) {
      const attrs = [`uid=${crypto.randomBytes(16).toString('hex')}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=31536000'];
      if (req.secure) attrs.push('Secure');
      res.setHeader('Set-Cookie', attrs.join('; '));
    }
    next();
  });

  app.use(compression());
  app.get('/healthz', (req, res) => res.type('text').send('ok'));
  // 3D 라이브러리(three.js)는 설치된 패키지에서 바로 제공
  app.use('/vendor', express.static(path.join(__dirname, 'node_modules', 'three', 'build'), { maxAge: '7d' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use((req, res) => res.status(404).type('text').send('페이지를 찾을 수 없습니다.'));

  const server = http.createServer(app);
  const realtime = attachRealtime(server, db, options);
  server.realtime = realtime;
  server.on('close', () => realtime.close());
  return server;
}

if (require.main === module) {
  // Railway에서 볼륨을 붙이면 RAILWAY_VOLUME_MOUNT_PATH가 자동으로 설정됨 → 데이터가 유지되는 그곳에 저장
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  const dbPath = process.env.DB_PATH || path.join(volume || path.join(__dirname, 'data'), 'swimpyo.db');
  console.log(`데이터 파일: ${dbPath}`);
  const port = Number(process.env.PORT) || 3000;
  createServer(openDb(dbPath)).listen(port, () => console.log(`쉼표 서버 실행 중: http://localhost:${port}`));
}

module.exports = { createServer };
