# Эй — Superpowers: stability-first execution plan

**Design:** [SUPERPOWERS_STABILITY_DESIGN.md](SUPERPOWERS_STABILITY_DESIGN.md)  
**Status:** in progress  
**Branch:** `superpowers/stability-audit-2026-11-26`

## Phase 0 — Baseline and safety

- [x] Record production/main SHA and isolated starting branch.
- [x] Preserve the existing Qwen working branch.
- [x] Confirm no production mutation is required for this audit.
- [x] Capture exact current CI status; preview status tracked separately by exact commit.
- [x] Inventory test files: CI and deploy preflight now share full Node test discovery; live acceptance workflows remain separate.

## Phase 1 — Make deployment preflight run the complete test suite

- [x] Add a regression assertion that `npm test` must use Node's full test discovery.
- [x] Observe the exact regression assertion fail against the hand-picked npm test script (GitHub Actions run 45748351451).
- [x] Change `package.json` test script to `node --test`.
- [x] Run complete suite through `npm test`: 49 passed, 0 failed (GitHub Actions run 45748448495).
- [x] Confirm CI and deploy preflight both invoke `npm test`; a regression test enforces this.

## Phase 2 — Chat request lifecycle

- [x] Trace UI send → API wrapper → gateway → provider response parsing for the normal text path.
- [x] Add unit coverage for provider output truncation (`finish_reason: length`) and empty successful responses.
- [x] Treat provider-declared truncation as an incomplete result and continue the fallback chain; do not mark the provider unavailable for this condition.
- [x] Verify source integration and full suite: 53 passed, 0 failed (GitHub Actions run 45748721539).
- [ ] Trace UI send → API wrapper → gateway route → provider chain → response renderer.
- [ ] Verify absolute deadlines, abort propagation, disconnect handling, queue slot release, and timeout response semantics.
- [ ] Add regression tests for second/third sequential requests, overlapping requests, abort, and provider timeout.
- [ ] Fix only reproduced defects; preserve existing request/response contracts unless explicitly tested.

## Phase 3 — Voice and hands-free lifecycle

- [x] Trace recorded-voice flow from MediaRecorder → STT → chat → TTS → wake restart.
- [x] Route recorded audio to the dedicated `/transcribe` endpoint instead of `/chat`, avoiding the chat route's shorter 18-second global deadline.
- [x] Keep wake recognition paused until the current TTS promise completes, preventing the microphone from listening to the assistant's own spoken answer.
- [x] Add regression guards for the STT endpoint and TTS-before-relisten ordering; CI: 53 passed, 0 failed (GitHub Actions run 45748953387).
- [ ] Verify actual microphone permission, audio playback, and repeated commands on iPhone Safari; simulated Chromium is not a substitute.
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

- 2026-11-26: isolated branch created from Qwen fix branch; test-first checks exposed the hand-picked test list and CI/deploy command mismatch. Updated `npm test` to full discovery and aligned CI to invoke it. Final CI: 49/49 tests passed.
- 2026-11-26: added a shared provider-response validator. Provider-declared output truncation now enters the fallback chain rather than being returned as a complete answer; empty successful responses are rejected. CI: 53/53 tests passed. Live provider behavior and real iPhone journey remain unverified.
- 2026-11-26: corrected recorded-voice routing to `/transcribe` and held wake listening until TTS completion. Regression guards passed in CI (53/53); physical iPhone Safari behavior remains NOT RUN.
