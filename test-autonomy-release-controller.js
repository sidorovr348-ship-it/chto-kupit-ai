const test = require('node:test');
const assert = require('node:assert/strict');

test('release controller permits bounded staging promotion only after readiness', async () => {
  const { ReleaseController } = await import('./autonomy-lab/release-controller.mjs');
  const deployed = [];
  const controller = new ReleaseController({ deploy: async ({ target }) => { deployed.push(target); return { ok: true }; } });
  const blocked = await controller.promote({ target: 'staging', readiness: 'NOT_READY', artifact: 'a1' });
  assert.equal(blocked.status, 'BLOCKED');
  const promoted = await controller.promote({ target: 'staging', readiness: 'READY_TO_INTEGRATE', artifact: 'a1' });
  assert.equal(promoted.status, 'PROMOTED');
  assert.deepEqual(deployed, ['staging']);
});

test('production promotion always requires explicit approval', async () => {
  const { ReleaseController } = await import('./autonomy-lab/release-controller.mjs');
  const controller = new ReleaseController({ deploy: async () => ({ ok: true }) });
  const blocked = await controller.promote({ target: 'production', readiness: 'READY_TO_INTEGRATE' });
  assert.equal(blocked.status, 'MANUAL_REQUIRED');
  const approved = await controller.promote({ target: 'production', readiness: 'READY_TO_INTEGRATE', approval: true });
  assert.equal(approved.status, 'PROMOTED');
});

test('release controller can roll back to last known good artifact', async () => {
  const { ReleaseController } = await import('./autonomy-lab/release-controller.mjs');
  const controller = new ReleaseController({ rollback: async ({ target }) => ({ target, restored: true }) });
  const result = await controller.rollbackToLastKnownGood({ target: 'canary', artifact: 'known-good' });
  assert.equal(result.status, 'ROLLED_BACK');
  assert.equal(result.result.restored, true);
});
