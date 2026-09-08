const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');
const BACKUP = path.join(ROOT, `server.js.before-supervisor-${Date.now()}.bak`);
let source = fs.readFileSync(SERVER, 'utf8');

if (!source.includes("require('./supervisor')")) {
  fs.copyFileSync(SERVER, BACKUP);
  source = source.replace(
    "const { dispatch, getCapability } = require('./src/dispatcher');",
    "const { dispatch, getCapability } = require('./src/dispatcher');\nconst { attach: attachSupervisor } = require('./supervisor');"
  );
  if (!source.includes("require('./supervisor')")) throw new Error('Не удалось добавить Supervisor в server.js');
  source = source.replace(
    "if (!process.env.VERCEL) {",
    "attachSupervisor(app);\n\nif (!process.env.VERCEL) {"
  );
  fs.writeFileSync(SERVER, source);
  console.log(`Supervisor подключён. Резервная копия: ${BACKUP}`);
} else {
  console.log('Supervisor уже подключён. Изменений не требуется.');
}

execFileSync(process.execPath, ['--check', SERVER], { stdio: 'inherit' });
console.log('server.js: синтаксис OK');
