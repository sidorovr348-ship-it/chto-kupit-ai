export class ReleaseController {
  constructor({ gate, deploy = null, rollback = null } = {}) {
    Object.assign(this, { gate, deploy, rollback });
  }

  authorize({ target = 'staging', readiness, approval = false } = {}) {
    if (!['staging', 'canary', 'production'].includes(target)) {
      return { status: 'BLOCKED', reason: 'UNKNOWN_TARGET' };
    }
    if (readiness !== 'READY_TO_INTEGRATE') {
      return { status: 'BLOCKED', reason: 'READINESS_GATE_NOT_PASSED' };
    }
    if (target === 'production' && !approval) {
      return { status: 'MANUAL_REQUIRED', reason: 'PRODUCTION_APPROVAL_REQUIRED' };
    }
    return { status: 'AUTHORIZED', target };
  }

  async promote({ target = 'staging', readiness, approval = false, artifact } = {}) {
    const decision = this.authorize({ target, readiness, approval });
    if (decision.status !== 'AUTHORIZED') return decision;
    if (typeof this.deploy !== 'function') throw new Error('DEPLOYER_REQUIRED');
    const result = await this.deploy({ target, artifact });
    return { status: 'PROMOTED', target, result };
  }

  async rollbackToLastKnownGood({ target = 'staging', artifact } = {}) {
    if (typeof this.rollback !== 'function') throw new Error('ROLLBACK_HANDLER_REQUIRED');
    return { status: 'ROLLED_BACK', target, result: await this.rollback({ target, artifact }) };
  }
}
