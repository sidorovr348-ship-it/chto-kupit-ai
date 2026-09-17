const test = require('node:test');
const assert = require('node:assert/strict');

test('bridge plans only on a separate integration branch', async () => {
  const { ProjectTaskBridge } = await import('./autonomy-lab/project-task-bridge.mjs');
  const bridge = new ProjectTaskBridge();
  const blocked = bridge.plan({ taskId: 't1', goal: 'safe change', baseBranch: 'main', integrationBranch: 'main' });
  assert.equal(blocked.status, 'BLOCKED');
  const planned = bridge.plan({ taskId: 't1', goal: 'safe change', baseBranch: 'main', integrationBranch: 'autonomy-bridge-2026-09-17' });
  assert.equal(planned.status, 'PLANNED');
  assert.equal(planned.plan.productionMutation, false);
  assert.equal(planned.plan.writeMode, 'BRANCH_ONLY');
});

test('bridge requires an executor and independent verifier', async () => {
  const { ProjectTaskBridge } = await import('./autonomy-lab/project-task-bridge.mjs');
  const bridge = new ProjectTaskBridge({
    executor: async () => ({ changed: ['README.md'], branch: 'autonomy-bridge-2026-09-17' }),
    verifier: async ({ output }) => ({ status: output.branch === 'autonomy-bridge-2026-09-17' ? 'PASS' : 'REJECT' }),
  });
  const plan = bridge.plan({ taskId: 't2', goal: 'bounded test change', baseBranch: 'main', integrationBranch: 'autonomy-bridge-2026-09-17' });
  const result = await bridge.execute(plan);
  assert.equal(result.verification.status, 'PASS');
});

test('bridge rejects production mutation', async () => {
  const { ProjectTaskBridge } = await import('./autonomy-lab/project-task-bridge.mjs');
  const bridge = new ProjectTaskBridge({ executor: async () => ({ ok: true }) });
  const plan = bridge.plan({ taskId: 't3', goal: 'test', baseBranch: 'main', integrationBranch: 'autonomy-bridge-2026-09-17' });
  plan.plan.productionMutation = true;
  await assert.rejects(() => bridge.execute(plan), /PRODUCTION_MUTATION_BLOCKED/);
});
