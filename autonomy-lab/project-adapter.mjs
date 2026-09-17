export class ProjectAdapter {
  constructor({ name, protectedBranches = ['main'], requiredNodeMajor = 20 } = {}) {
    this.name = name || 'unknown-project';
    this.protectedBranches = new Set(protectedBranches);
    this.requiredNodeMajor = requiredNodeMajor;
  }

  validate({ repo, branch, runtime, files = [] } = {}) {
    const reasons = [];
    if (!repo?.fullName) reasons.push('REPOSITORY_ID_MISSING');
    if (this.protectedBranches.has(branch)) reasons.push('PROTECTED_BRANCH');
    if (runtime?.nodeMajor && runtime.nodeMajor < this.requiredNodeMajor) reasons.push('NODE_RUNTIME_TOO_OLD');
    if (files.some((file) => /(^|\/)(\.env|.*secret.*|.*token.*|.*key.*)$/i.test(file))) reasons.push('SECRET_LIKE_FILE_IN_SCOPE');
    return { status: reasons.length ? 'NOT_READY' : 'READY', reasons, contract: { name: this.name, protectedBranches: [...this.protectedBranches], requiredNodeMajor: this.requiredNodeMajor } };
  }

  plan({ repo, baseBranch = 'main', integrationBranch = 'autonomy-integration' } = {}) {
    if (integrationBranch === baseBranch) throw new Error('INTEGRATION_BRANCH_MUST_DIFFER');
    return { repo: repo?.fullName, baseBranch, integrationBranch, writeMode: 'BRANCH_ONLY', productionMutation: false, requiresIndependentVerification: true };
  }
}
