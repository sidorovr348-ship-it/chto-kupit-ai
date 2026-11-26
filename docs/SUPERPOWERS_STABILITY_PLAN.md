# Эй — Superpowers: stability-first execution plan

**Design:** [SUPERPOWERS_STABILITY_DESIGN.md](SUPERPOWERS_STABILITY_DESIGN.md)  
**Status:** in progress  
**Branch:** `superpowers/stability-audit-2026-11-26`

## Phase 0 — Baseline and safety

- [x] Record production/main SHA and isolated starting branch.
- [x] Preserve the existing Qwen working branch.
- [x] Confirm no production mutation is required for this audit.
- [ ] Capture exact current CI and preview status for the audit branch.
- [ ] Inventory all test files and map them to CI, deploy preflight, and acceptance workflows.

## Phase 1 — Make deployment preflight run the complete test suite

- [x] Add a regression assertion that `npm test` must use Node's full test discovery.
- [ ] Observe the regression test fail against the current package script.
- [ ] Change `package.json` test script to `node --test`.
- [ ] Run the complete test suite and verify the discovered test inventory.
- [ ] Confirm deploy preflight now executes the same test discovery as CI.

## Phase 2 — Chat request lifecycle

- [ ] Trace UI send → API wrapper → gateway route → provider chain → response renderer.
- [ ] Verify absolute deadlines, abort propagation, disconnect handling, queue slot release, and timeout response semantics.
- [ ] Add regression tests for second/third sequential requests, overlapping requests, abort, and provider timeout.
- [ ] Fix only reproduced defects; preserve existing request/response contracts unless explicitly tested.

## Phase 3 — Voice and hands-free lifecycle

- [ ] Trace microphone permission, MediaRecorder/STT, wake recognition state machine, queue, TTS, and listening restart.
- [ ] Verify a failed request cannot leave the UI permanently busy or listening state falsely green.
- [ ] Verify one voice command produces one request; no automatic duplicate retry after disconnect.
- [ ] Add repeat-command and failure-recovery regression coverage.
- [ ] Keep physical iPhone Safari permission/audio/wake tests separate from simulated Playwright checks.

## Phase 4 — Provider and fallback chain

- [ ] Map provider order, per-provider timeout, shared deadline, circuit-breaker, and concurrency behavior.
- [ ] Test 401, 402, 429, 5xx, timeout, empty body, malformed JSON, and exhausted fallback.
- [ ] Ensure degraded fallback is explicitly distinguishable from a normal successful AI answer.
- [ ] Check provider logs contain request correlation and safe metadata, never credentials or personal payloads.

## Phase 5 — Laboratory / autonomy contour

- [ ] Map async initialization, status, self-check, task admission, watchdog, and chat isolation.
- [ ] Verify failed or slow lab initialization does not block normal chat or health.
- [ ] Verify self-check deadlines and single-flight behavior.
- [ ] Keep destructive fault-injection workflow manual and out of normal acceptance concurrency.

## Phase 6 — Existing capability regression

- [ ] Verify photo, documents/ZIP, search, shopping, memory, image generation, TTS, STT, and Alice API contracts.
- [ ] Audit acceptance tests for hidden retries, permissive assertions, stale fixtures, and false positives.
- [ ] Separate deterministic tests from provider-dependent live checks.

## Phase 7 — Independent review and release readiness

- [ ] Run full unit/integration suite, syntax checks, browser E2E, and live read-only API probes.
- [ ] Review exact diff independently against this design and plan.
- [ ] Verify preview deployment uses the reviewed commit.
- [ ] Prepare a user-operated iPhone Safari acceptance checklist.
- [ ] Report PASS / FAIL / BLOCKED / NOT RUN, residual risks, and exact rollback point.
- [ ] Stop before production merge/deploy pending an explicit release decision.

## Change log

- 2026-11-26: isolated branch created from Qwen fix branch; first regression assertion added for full test discovery.
