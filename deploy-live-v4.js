const fs=require('fs');
const {execFileSync}=require('child_process');
const ROOT='/root/my-ai-unified';
const files=['server.js','src/dispatcher.js'];
for(const f of files){if(!fs.existsSync(`${ROOT}/${f}`))throw new Error(`Не найден ${ROOT}/${f}`)}
execFileSync('git',['fetch','origin','main'],{cwd:ROOT,stdio:'inherit'});
const backup=`${ROOT}/server.js.before-v4-${Date.now()}.bak`;
fs.copyFileSync(`${ROOT}/server.js`,backup);
for(const f of files)execFileSync('git',['checkout','origin/main','--',f],{cwd:ROOT,stdio:'inherit'});
execFileSync(process.execPath,['--check','server.js'],{cwd:ROOT,stdio:'inherit'});
execFileSync('npm',['test'],{cwd:ROOT,stdio:'inherit'});
execFileSync('systemctl',['restart','my-ai-unified.service'],{stdio:'inherit'});
console.log(`DEPLOY_V4_OK backup=${backup}`);
