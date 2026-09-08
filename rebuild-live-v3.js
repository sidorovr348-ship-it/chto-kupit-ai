const fs=require('fs');
const {execFileSync}=require('child_process');
const ROOT='/root/my-ai-unified';
const SERVER=`${ROOT}/server.js`;
const DISPATCHER=`${ROOT}/src/dispatcher.js`;
if(!fs.existsSync(SERVER)) throw new Error(`Не найден ${SERVER}`);
execFileSync('git',['fetch','origin','main'],{cwd:ROOT,stdio:'inherit'});
const backup=`${SERVER}.before-rebuild-v3-${Date.now()}.bak`;
fs.copyFileSync(SERVER,backup);
execFileSync('git',['checkout','origin/main','--','src/dispatcher.js'],{cwd:ROOT,stdio:'inherit'});
let s=fs.readFileSync(SERVER,'utf8');
if(!s.includes("const { attach: attachSupervisor, diagnostics } = require('./supervisor');")){
  s=s.replace("const { attach: attachSupervisor } = require('./supervisor');","const { attach: attachSupervisor, diagnostics } = require('./supervisor');");
}
if(!s.includes("const { diagnostics } = require('./supervisor');")){
  s=s.replace("const app = express();","const app = express();\nconst { diagnostics } = require('./supervisor');");
}
if(!s.includes("app.get('/diagnostics'")){
  const marker="app.post('/chat', async (req, res) => {";
  if(!s.includes(marker)) throw new Error('Не найден безопасный якорь /chat');
  const route=`app.get('/diagnostics', async (req, res) => {\n  try {\n    const result = await diagnostics();\n    res.set('Cache-Control','no-store');\n    res.json({ ok: result.ok, route: 'verification', result: result.ok ? 'Проверка завершена: сервер, интернет и тесты работают.' : 'Проверка завершена: обнаружена проблема.', diagnostics: result });\n  } catch (error) {\n    res.status(500).json({ ok:false, route:'verification', result:'Диагностика завершилась ошибкой.', error:error.message });\n  }\n});\n\n`;
  s=s.replace(marker,route+marker);
}
if(!s.includes("if (route === 'verification')")){
  const marker="    if (route === 'shopping') return res.json({ ok: true, route, results: await searchShopping(userPrompt, location, 'find') });";
  if(!s.includes(marker)) throw new Error('Не найден shopping-якорь');
  const block=`    if (route === 'verification') {\n      const result = await diagnostics();\n      return res.json({ ok: result.ok, route, result: result.ok ? 'Проверка завершена: критических проблем не обнаружено.' : 'Проверка завершена: обнаружена проблема. Автоматическое изменение кода без проверки запрещено.', diagnostics: result });\n    }\n`;
  s=s.replace(marker,marker+'\n'+block);
}
fs.writeFileSync(SERVER,s);
execFileSync(process.execPath,['--check',SERVER],{cwd:ROOT,stdio:'inherit'});
execFileSync('npm',['test'],{cwd:ROOT,stdio:'inherit'});
console.log(`REBUILD_V3_OK backup=${backup}`);
