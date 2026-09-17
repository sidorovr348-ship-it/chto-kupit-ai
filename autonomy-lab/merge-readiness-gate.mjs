export class MergeReadinessGate {
  constructor({ orchestrator, adapter } = {}) {
    Object.assign(this, { orchestrator, adapter });
  }

  check({ runId, repo, branch, runtime, files = [], integrationBranch = 'autonomy-integration', evidence = [] } = {}) {
    const checks = [];
    const run = this.orchestrator?.inspect(runId);
    checks.push({ name: 'orchestrator_terminal', ok: !!run && run.status === 'ACCEPTED' });
    checks.push({ name: 'orchestrator_integrity', ok: this.orchestrator?.integrity(runId)?.status === 'VALID' });
    const project = this.adapter.validate({ repo, branch, runtime, files });
    checks.push({ name: 'project_adapter', ok: project.status === 'READY', details: project });
    const plan = this.adapter.plan({ repo, baseBranch: branch, integrationBranch });
    checks.push({ name: 'separate_integration_branch', ok: plan.baseBranch !== plan.integrationBranch, details: plan });
    checks.push({ name: 'external_evidence', ok: evidence.includes('INDEPENDENT_VERIFICATION') });
    return { status: checks.every((check) => check.ok) ? 'READY_TO_INTEGRATE' : 'NOT_READY', checks };
  }
}
