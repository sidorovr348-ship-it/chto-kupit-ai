const test = require('node:test');
const assert = require('node:assert/strict');

let AutonomyOrchestrator;
let ProjectAdapter;
let MergeReadinessGate;

test('autonomy integration modules load', async () => {
  ({ AutonomyOrchestrator } = await import('./autonomy-lab/autonomy-orchestrator.mjs'));
  ({ ProjectAdapter } = await import('./autonomy-lab/project-adapter.mjs'));
  ({ MergeReadinessGate } = await import('./autonomy-lab/merge-readiness-gate.mjs'));
});

test('orchestrator bounds execution and verifies terminal result', async () => {
  const state = { schemaVersion: 1, runs: {} };
  const stateStore = { load: () => state, save: (next) => Object.assign(state, next) };
  const resources = { acquire: () => ({ ok: true }), release: () => {} };
  const orchestrator = new AutonomyOrchestrator({ stateStore, resources });
  const result = await orchestrator.run({
    runId: 'integration-smoke',
    taskId: 'integration-smoke',
    goal: 'bounded smoke test',
    step: async () => ({ ok: true }),
    verify: async ({ output }) => ({ status: output.ok ? 'PASS' : 'REJECT' }),
  });
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(orchestrator.integrity('integration-smoke').status, 'VALID');
});

test('project adapter blocks main and secret-like files', () => {
  const adapter = new ProjectAdapter({ name: 'My AI Unified' });
  assert.equal(adapter.validate({ repo: { fullName: 'sidorovr348-ship-it/chto-kupit-ai' }, branch: 'main', runtime: { nodeMajor: 22 } }).status, 'NOT_READY');
  assert.equal(adapter.validate({ repo: { fullName: 'sidorovr348-ship-it/chto-kupit-ai' }, branch: 'autonomy-integration-2026-09-17', runtime: { nodeMajor: 22 }, files: ['secret.env'] }).status, 'NOT_READY');
});

test('merge readiness requires independent verification evidence', () => {
  const orchestrator = { inspect: () => ({ status: 'ACCEPTED' }), integrity: () => ({ status: 'VALID' }) };
  const adapter = new ProjectAdapter({ name: 'My AI Unified' });
  const gate = new MergeReadinessGate({ orchestrator, adapter });
  const blocked = gate.check({ runId: 'x', repo: { fullName: 'sidorovr348-ship-it/chto-kupit-ai' }, branch: 'autonomy-integration-2026-09-17', runtime: { nodeMajor: 22 }, evidence: [] });
  assert.equal(blocked.status, 'NOT_READY');
  const ready = gate.check({ runId: 'x', repo: { fullName: 'sidorovr348-ship-it/chto-kupit-ai' }, branch: 'autonomy-integration-2026-09-17', runtime: { nodeMajor: 22 }, evidence: ['INDEPENDENT_VERIFICATION'] });
  assert.equal(ready.status, 'READY_TO_INTEGRATE');
});
