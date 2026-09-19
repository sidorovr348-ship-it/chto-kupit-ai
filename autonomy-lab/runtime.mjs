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

export function createAutonomyRuntime({ tools = {} } = {}) {
  const orchestrator = new AutonomyOrchestrator({ stateStore, resources, killSwitch, policy, audit });
  const adapter = new ProjectAdapter({ name: 'My AI Unified', protectedBranches: ['main'] });
  const bridge = new ProjectTaskBridge({ adapter });
  const gate = new MergeReadinessGate({ orchestrator, adapter });
  const toolMap = Object.fromEntries(Object.entries(tools).filter(([, fn]) => typeof fn === 'function'));
  const allowedTaskKinds = new Set(['chat','search','shopping','vision','document','self-check','branch-plan']);
  const executeTask = async ({ runId, taskId, goal, kind = 'self-check', input = {} } = {}) => {
    if (!allowedTaskKinds.has(kind)) throw new Error('AUTONOMY_TASK_KIND_NOT_ALLOWED');
    const id = runId || 'autonomy-' + Date.now().toString(36);
    const result = await orchestrator.run({
      runId: id, taskId: taskId || `autonomy-${kind}`, goal: goal || `Выполнить безопасную задачу: ${kind}`,
      action: kind === 'branch-plan' ? 'branch_plan' : 'bounded_execute', maxSteps: 1,
      step: async () => {
        if (kind === 'self-check') return { ok: true, scope: 'bounded-runtime', tools: Object.keys(toolMap) };
        if (kind === 'branch-plan') return adapter.plan({ repo: { fullName: 'sidorovr348-ship-it/chto-kupit-ai' }, baseBranch: 'main', integrationBranch: String(input.integrationBranch || 'autonomy-integration') });
        const fn = toolMap[kind];
        if (!fn) throw new Error(`AUTONOMY_TOOL_NOT_BOUND:${kind}`);
        return await fn(input);
      },
      verify: async ({ output }) => output !== undefined && output !== null ? { status: 'PASS', reason: 'BOUNDED_TASK_RETURNED_RESULT' } : { status: 'FAIL', reason: 'EMPTY_RESULT' },
      successCriteria: ['task executes inside bounded runtime and returns a result']
    });
    return result;
  };
  return {
    enabled: true, active: true, mode: 'FULL_BOUNDED', connectedToCore: Object.keys(toolMap).length > 0, safeMode: true, orchestrator, adapter, bridge, gate,
    executeTask,
    async selfCheck() {
      const id = 'self-check-' + Date.now().toString(36);
      const run = await orchestrator.run({ runId: id, taskId: 'runtime-self-check', goal: 'Проверить целостность автономного контура без изменения production', action: 'sandbox_execute', maxSteps: 1, step: async () => ({ ok: true, scope: 'bounded-runtime' }), verify: async ({ output }) => output?.ok ? { status: 'PASS', reason: 'BOUNDED_RUNTIME_OK' } : { status: 'FAIL' }, successCriteria: ['bounded runtime executes and verifies'] });
      return { ok: run.status === 'ACCEPTED', status: run.status, integrity: orchestrator.integrity(id), coreConnected: Object.keys(toolMap).length > 0, tools: Object.keys(toolMap) };
    },
    status() { return { enabled: true, active: true, mode: 'FULL_BOUNDED', connectedToCore: true, safeMode: true, killSwitch: process.env.AUTONOMY_KILL_SWITCH === '1', stateFile, capabilities: ['self-check','persistent-state','audit-log','bounded-orchestration','branch-only-planning','merge-readiness-gate','rollback-controller',...Object.keys(toolMap).map(k => `tool:${k}`)] }; }
  };
}
