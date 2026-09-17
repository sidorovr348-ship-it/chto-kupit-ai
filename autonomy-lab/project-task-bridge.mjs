import { ProjectAdapter } from './project-adapter.mjs';

export class ProjectTaskBridge {
  constructor({ adapter = new ProjectAdapter({ name: 'My AI Unified' }), executor, verifier } = {}) {
    this.adapter = adapter;
    this.executor = executor;
    this.verifier = verifier;
  }

  plan({ taskId, goal, baseBranch = 'main', integrationBranch, files = [], runtime = { nodeMajor: 22 }, repo = { fullName: 'sidorovr348-ship-it/chto-kupit-ai' } } = {}) {
    const validation = this.adapter.validate({ repo, branch: integrationBranch, runtime, files });
    if (validation.status !== 'READY') return { status: 'BLOCKED', validation };
    const plan = this.adapter.plan({ repo, baseBranch, integrationBranch });
    return {
      status: 'PLANNED',
      taskId,
      goal,
      plan,
      policy: { writeMode: 'BRANCH_ONLY', productionMutation: false, protectedBase: baseBranch },
    };
  }

  async execute(plan, context = {}) {
    if (!plan || plan.status !== 'PLANNED') throw new Error('PLAN_REQUIRED');
    if (plan.plan.productionMutation !== false) throw new Error('PRODUCTION_MUTATION_BLOCKED');
    if (plan.plan.baseBranch === plan.plan.integrationBranch) throw new Error('INTEGRATION_BRANCH_MUST_DIFFER');
    if (typeof this.executor !== 'function') throw new Error('EXECUTOR_REQUIRED');
    const output = await this.executor({ plan, context });
    const verification = typeof this.verifier === 'function'
      ? await this.verifier({ plan, output, context })
      : { status: 'UNKNOWN', reason: 'INDEPENDENT_VERIFIER_REQUIRED' };
    return { output, verification };
  }
}
