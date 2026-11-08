'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const deploy=fs.readFileSync('scripts/deploy-vps.sh','utf8');
const rollback=fs.readFileSync('scripts/rollback-vps.sh','utf8');

test('deployment checks actual SSH root privileges, not the VPS_USER secret',()=>{
 assert.ok(deploy.includes('REMOTE_UID=$(ssh_vps "root@$VPS_HOST" "id -u")'));
 assert.ok(rollback.includes('REMOTE_UID=$(ssh_vps "root@$VPS_HOST" "id -u")'));
 assert.ok(!deploy.includes('VPS_USER must be root'));
 assert.ok(!rollback.includes('VPS_USER must be root'));
 assert.ok(!deploy.includes('VPS_USER'));
});

test('backup archive is created before live files are mutated',()=>{
 const backup=deploy.indexOf("tar -czf '$BACKUP_ARCHIVE'");
 const mutation=deploy.indexOf('DEPLOY_MUTATED=1');
 assert.ok(backup>=0&&mutation>backup);
 assert.ok(deploy.indexOf('backup_archive=$BACKUP_ARCHIVE')<mutation);
});

test('failed deployment restores the archived source and restarts only the app service',()=>{
 assert.ok(deploy.includes('rollback_deploy()'));
 assert.ok(deploy.includes("tar -xzf '$BACKUP_ARCHIVE' -C '$WORKDIR'"));
 assert.ok(deploy.includes('systemctl restart my-ai-unified'));
});

test('external rollback restores package lock and reinstalls locked dependencies',()=>{
 assert.ok(rollback.includes("tar -xzf '$BACKUP_ARCHIVE' -C '$WORKDIR'"));
 assert.ok(rollback.includes('npm ci --omit=dev'));
 assert.ok(rollback.includes('systemctl restart my-ai-unified'));
});

test('deployment stages complete source and autonomy trees before copying',()=>{
 assert.ok(deploy.includes('scp_vps -r src/.'));
 assert.ok(deploy.includes('scp_vps -r autonomy-lab/.'));
 assert.ok(deploy.includes("cp -a '$STAGING'/src/. src/"));
 assert.ok(deploy.includes("cp -a '$STAGING'/autonomy-lab/. autonomy-lab/"));
});

test('deployment checks free disk space and inodes before creating a backup',()=>{
 const preflight=deploy.indexOf('FREE_KB=');
 const backup=deploy.indexOf("tar -czf '$BACKUP_ARCHIVE'");
 assert.ok(preflight>=0&&backup>preflight);
 assert.ok(deploy.includes('df -Pk'));
 assert.ok(deploy.includes('df -Pi'));
 assert.ok(deploy.includes('180000'));
 assert.ok(deploy.includes('10000'));
});

test('100-case acceptance checks the current chat timeout implementation',()=>{
 const html=fs.readFileSync('smart-index.html','utf8');
 const acceptance=fs.readFileSync('acceptance-100.mjs','utf8');
 assert.ok(html.includes("api('/chat',body,48000,requestController.signal)"));
 assert.ok(html.includes('timer=setTimeout(()=>controller.abort(),to)'));
 assert.ok(acceptance.includes("api('/chat',body,48000,requestController.signal)"));
 assert.ok(acceptance.includes('timer=setTimeout(()=>controller.abort(),to)'));
 assert.ok(!acceptance.includes('const deadline=Date.now()+to'));
});

test('deployment preserves the VPS legacy CloudRU module referenced by its legacy server.js',()=>{
 const preserve=deploy.indexOf("cp -a '$WORKDIR/src/cloudru-agent.js' '$STAGING/src/cloudru-agent.js'");
 const liveCopy=deploy.indexOf("cp -a '$STAGING'/src/. src/");
 assert.ok(preserve>=0&&liveCopy>preserve);
 assert.ok(deploy.includes("tar -czf '$BACKUP_ARCHIVE' local-gateway.js"));
});

const productionWorkflow=fs.readFileSync('.github/workflows/production-deploy-v2.yml','utf8');
test('workflow-only edits do not trigger another production VPS deployment',()=>{
 assert.ok(productionWorkflow.includes("paths-ignore:"));
 for(const p of ['.github/workflows/authoritative-production-verify.yml','.github/workflows/mobile-e2e.yml','.github/workflows/production-deploy-v2.yml'])assert.ok(productionWorkflow.includes(p));
});
