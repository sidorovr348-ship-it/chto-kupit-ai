import { createHash } from 'node:crypto';

const TERMINAL = new Set(['ACCEPTED', 'FAILED', 'PAUSED', 'MANUAL_REQUIRED']);
const clone = (value) => structuredClone(value);
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class AutonomyOrchestrator {
  constructor({ stateStore, resources, killSwitch = null, policy = null, loop = null, verifier = null, audit = null } = {}) {
    Object.assign(this, { stateStore, resources, killSwitch, policy, loop, verifier, audit });
    this.state = stateStore?.load() || { schemaVersion: 1, runs: {} };
  }

  _save() { this.stateStore?.save(this.state); }
  _run(id) { return this.state.runs[id] || null; }
  _record(run, type, patch = {}) {
    const event = { type, at: new Date().toISOString(), ...patch };
    run.events.push(event);
    run.updatedAt = event.at;
    this.audit?.record({ runId: run.id, type, ...patch });
    this._save();
    return event;
  }
  _assertRunning() {
    const status = this.killSwitch?.check?.();
    if (status && !status.allowed) {
      const error = new Error(`KILL_SWITCH:${status.reason}`);
      error.code = 'KILL_SWITCH';
      throw error;
    }
  }
  _policy(action, context) { return this.policy ? this.policy.authorize(action, context) : { decision: 'ALLOW', action }; }
  _terminal(run, status, result = {}) {
    run.status = status;
    run.result = clone(result);
    this._record(run, 'TERMINAL', { status, result: run.result });
    return clone(run);
  }

  async run({ runId, taskId, goal, action = 'sandbox_execute', step, verify, successCriteria = [], maxSteps = 10, retryableErrors = false, context = {} }) {
    if (!runId) throw new Error('RUN_ID_REQUIRED');
    let run = this._run(runId);
    if (run && TERMINAL.has(run.status)) return clone(run);
    if (!run) {
      run = { schemaVersion: 1, id: runId, taskId, goal, status: 'QUEUED', stepIndex: 0, maxSteps, attempts: 0, successCriteria, context, events: [], createdAt: new Date().toISOString() };
      this.state.runs[runId] = run;
      this._record(run, 'QUEUED', { taskId, goal });
    }
    try {
      this._assertRunning();
      const auth = this._policy(action, { taskId, runId, goal, context });
      if (auth?.decision === 'REQUIRE_APPROVAL') return this._terminal(run, 'MANUAL_REQUIRED', { reason: 'APPROVAL_REQUIRED', action });
      if (auth?.decision !== 'ALLOW') return this._terminal(run, 'PAUSED', { reason: 'POLICY_DENIED', action });
      if (!run.resourceAcquired) {
        const acquired = this.resources?.acquire?.(runId) ?? { ok: true };
        if (!acquired.ok) return this._terminal(run, 'PAUSED', { reason: acquired.reason });
        run.resourceAcquired = true;
        this._record(run, 'RESOURCE_ACQUIRED', { resource: acquired });
      }
      const started = this._latestEvent(run, 'STEP_STARTED', run.stepIndex);
      const completed = this._latestEvent(run, 'STEP_COMPLETED', run.stepIndex);
      if (started && !completed) return this._terminal(run, 'PAUSED', { reason: 'STEP_OUTCOME_AMBIGUOUS', stepIndex: run.stepIndex });
      while (run.stepIndex < run.maxSteps) {
        this._assertRunning();
        const signature = `${run.goal}:${action}:${run.stepIndex}`;
        if (this.loop && !this.loop.allow(signature)) return this._terminal(run, 'PAUSED', { reason: 'LOOP_LIMIT', stepIndex: run.stepIndex });
        run.status = 'RUNNING';
        run.attempts++;
        this._record(run, 'STEP_STARTED', { stepIndex: run.stepIndex, attempt: run.attempts });
        const output = await step({ run: clone(run), stepIndex: run.stepIndex, context });
        run.lastOutput = clone(output);
        this._record(run, 'STEP_COMPLETED', { stepIndex: run.stepIndex, output: run.lastOutput });
        run.stepIndex++;
        this._save();
        break;
      }
      run.status = 'VERIFYING';
      this._record(run, 'VERIFYING', { stepIndex: run.stepIndex });
      this._assertRunning();
      const verification = verify ? await verify({ run: clone(run), output: clone(run.lastOutput), criteria: run.successCriteria, context }) : this.verifier?.verify?.(run.lastOutput, run.successCriteria) || { status: 'UNKNOWN', reason: 'NO_VERIFIER' };
      run.verification = clone(verification);
      this._record(run, 'VERIFICATION', { verification: run.verification });
      if (['ACCEPT', 'PASS', 'VERIFIED'].includes(verification?.status)) return this._terminal(run, 'ACCEPTED', { verification: run.verification, output: run.lastOutput });
      if (verification?.status === 'UNKNOWN') return this._terminal(run, 'PAUSED', { reason: 'VERIFICATION_UNKNOWN', verification: run.verification });
      return this._terminal(run, 'FAILED', { reason: 'VERIFICATION_REJECTED', verification: run.verification });
    } catch (error) {
      this._record(run, 'ERROR', { error: error.code || error.message });
      if (error.code === 'KILL_SWITCH') return this._terminal(run, 'PAUSED', { reason: error.code });
      if (error.code === 'APPROVAL_REQUIRED') return this._terminal(run, 'MANUAL_REQUIRED', { reason: error.code });
      if (retryableErrors) {
        run.status = 'PAUSED';
        run.result = { reason: 'RETRYABLE_ERROR', error: error.code || error.message };
        this._save();
        return clone(run);
      }
      return this._terminal(run, 'FAILED', { reason: error.code || error.message });
    } finally {
      if (run.resourceAcquired && TERMINAL.has(run.status)) {
        this.resources?.release?.(runId);
        run.resourceAcquired = false;
        this._record(run, 'RESOURCE_RELEASED');
      }
    }
  }

  _latestEvent(run, type, stepIndex) { return [...(run.events || [])].reverse().find((event) => event.type === type && (stepIndex === undefined || event.stepIndex === stepIndex)) || null; }
  inspect(runId) { const run = this._run(runId); return run ? clone(run) : null; }
  integrity(runId) { const run = this._run(runId); if (!run) return { status: 'MISSING' }; return { status: 'VALID', runId, count: run.events?.length || 0, digest: hash(run.events || []) }; }
}
