'use strict';
// 서버 없이 열 수 있는 미리보기 파일(preview.html)을 만듭니다. 실행: npm run build:html
// 3D 라이브러리와 모든 코드·디자인을 파일 하나에 담고, 혼자 둘러보는 모드로 동작합니다.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const R = require('../src/rooms');

const root = path.join(__dirname, '..');
const pub = (f) => path.join(root, 'public', f);

// 브라우저용 주소(/avatar.js 등)를 실제 파일 위치로 바꿔 줌
const paths = {
  '/vendor/three.module.js': path.join(root, 'node_modules/three/build/three.module.js'),
  '/avatar.js': pub('avatar.js'),
  '/scenes.js': pub('scenes.js')
};
const resolveLocal = {
  name: 'resolve-local',
  setup(build) { build.onResolve({ filter: /^\// }, (args) => (paths[args.path] ? { path: paths[args.path] } : null)); }
};

async function main() {
const result = await esbuild.build({
  entryPoints: [pub('app.js')], bundle: true, format: 'iife', minify: true, write: false, legalComments: 'none',
  plugins: [resolveLocal]
});
const bundle = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const offline = JSON.stringify({ world: R.WORLD, rooms: R.ROOMS }).replace(/</g, '\\u003c');
const css = fs.readFileSync(pub('style.css'), 'utf8');
let html = fs.readFileSync(pub('index.html'), 'utf8');
html = html
  .replace('<link rel="stylesheet" href="/style.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="/app.js"></script>', () => `<script>window.__SWIMPYO_OFFLINE__ = ${offline};</script>\n<script>${bundle}</script>`);
if (html.includes('/app.js') || html.includes('/style.css')) throw new Error('index.html 구조가 바뀌어 합치지 못했습니다.');

const out = path.join(root, 'preview.html');
fs.writeFileSync(out, html);
console.log(`만들었습니다: ${out} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
