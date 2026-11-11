'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    -- 한 사람(uid)은 방마다 하루에 한 표. 자리를 옮기면 표가 바뀜.
    CREATE TABLE IF NOT EXISTS votes (
      room TEXT NOT NULL,
      day TEXT NOT NULL,
      uid TEXT NOT NULL,
      choice TEXT NOT NULL CHECK (choice IN ('A','B')),
      PRIMARY KEY (room, day, uid)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY,
      reporter_uid TEXT NOT NULL,
      target_pid TEXT NOT NULL,
      target_name TEXT NOT NULL,
      room TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 공개용 사용자 번호(pid)를 만들 때 쓰는 비밀값. 처음 한 번만 생성.
  let secret = db.prepare("SELECT value FROM meta WHERE key = 'secret'").get();
  if (!secret) {
    secret = { value: crypto.randomBytes(32).toString('hex') };
    db.prepare("INSERT INTO meta (key, value) VALUES ('secret', ?)").run(secret.value);
  }
  db.secret = secret.value;
  return db;
}

module.exports = { openDb };
