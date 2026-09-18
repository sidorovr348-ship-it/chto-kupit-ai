import fs from 'node:fs';
import path from 'node:path';
import { AutonomyOrchestrator } from './autonomy-orchestrator.mjs';
import { ProjectAdapter } from './project-adapter.mjs';
import { ProjectTaskBridge } from './project-task-bridge.mjs';
import { MergeReadinessGate } from './merge-readiness-gate.mjs';

const root = process.env.AUTONOMY_STATE_DIR || path.join(process.cwd(), '.autonomy-state');
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
const stateFile = path.join(root, 'state.json');
const load = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return { schemaVersion: 1, runs: {} }; } };
const save = (state) => { const tmp = stateFile + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 }); fs.renameSync(tmp, stateFile); };
const stateStore = { load, save };
const resources = { acquire: () => ({ ok: true, resource: 'bounded-runtime' }), release: () => {} };
const killSwitch = { check: () => ({ allowed: process.env.AUTONOMY_KILL_SWITCH !== '1', reason: 'AUTONOMY_KILL_SWITCH' }) };
const policy = { authorize(action) { const forbidden = /production|deploy|release|secret|credential|dns|vps|systemctl|self.?modify|write.?main/i.test(String(action)); return forbidden ? { decision: 'REQUIRE_APPROVAL', action } : { decision: 'ALLOW', action }; } };
const audit = { record: (event) => { try { fs.appendFileSync(path.join(root, 'audit.log'), JSON.stringify(event) + '\n', { mode: 0o600 }); } catch {} } };

export function createAutonomyRuntime() {
  const orchestrator = new AutonomyOrchestrator({ stateStore, resources, killSwitch, policy, audit });
  const adapter = new ProjectAdapter({ name: 'My AI Unified', protectedBranches: ['main'] });
  const bridge = new ProjectTaskBridge({ adapter });
  const gate = new MergeReadinessGate({ orchestrator, adapter });
  return {
    enabled: true, active: true, mode: 'FULL_BOUNDED', connectedToCore: true, safeMode: true, orchestrator, adapter, bridge, gate,
    async selfCheck() {
      const id = 'self-check-' + Date.now().toString(36);
      const run = await orchestrator.run({ runId: id, taskId: 'runtime-self-check', goal: 'Проверить целостность автономного контура без изменения production', action: 'sandbox_execute', maxSteps: 1, step: async () => ({ ok: true, scope: 'bounded-runtime' }), verify: async ({ output }) => output?.ok ? { status: 'PASS', reason: 'BOUNDED_RUNTIME_OK' } : { status: 'FAIL' }, successCriteria: ['bounded runtime executes and verifies'] });
      return { ok: run.status === 'ACCEPTED', status: run.status, integrity: orchestrator.integrity(id) };
    },
    status() { return { enabled: true, active: true, mode: 'FULL_BOUNDED', connectedToCore: true, safeMode: true, killSwitch: process.env.AUTONOMY_KILL_SWITCH === '1', stateFile, capabilities: ['self-check','persistent-state','audit-log','bounded-orchestration','branch-only-planning','merge-readiness-gate','rollback-controller'] }; }
  };
}
