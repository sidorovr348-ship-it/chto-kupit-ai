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
- [x] Add regression tests for model-specific provider output budgets and generation timeouts; observe RED when the policy module is absent (GitHub Actions run 45749934970).
- [x] Increase Qwen text output budget from 192 to 2048 tokens and allow 7 seconds for generation, bounded by the existing 18-second chat deadline; preserve Qwen vision at 1024 tokens / 15 seconds.
- [x] Correct GPT-OSS model matching: the old `/20b$/` suffix check also matched `120b`, incorrectly applying the 20B budget to 120B.
- [x] Full CI on commit `29767ddbb787215e5bbe2b32e7aca8ff7b331ad4`: 60 tests passed, 0 failed (GitHub Actions run 45750004257).
- [ ] Verify actual provider completion and response rendering against a safe staging API; the Vercel preview HTML currently points to production `https://ai.aliceq.ru`, so no API requests were sent from preview.
- [x] Trace UI send → API wrapper → gateway route → provider chain → response renderer.
- [x] Surface degraded/fallback warnings before rendering chat content; timeout fallback now explicitly says no automatic retry was launched and no request was saved.
- [x] Propagate client disconnect and route deadline through `/chat` → dispatcher → text-slot queue → provider fetch; cancelled waiters are removed and client abort does not trip provider cooldown.
- [x] Verify cancellation and slot release with a local HTTP integration test: occupy all four text slots, queue a fifth request, abort the first four, and confirm the fifth starts on the same provider and returns `MOCK_OK_5`.
- [x] Propagate cancellation through chat search provider/fallback fetches, opened-page reads, /search, document AI analysis, vision provider fallbacks, and STT/transcribe; search disconnect has a local HTTP integration test.
- [ ] Finish cancellation for /photo shared vision single-flight, image search, shopping fetches, and document extraction itself.
- [x] Add mocked mobile UI E2E: fake microphone/recognition, `/transcribe`, valid silent TTS audio, five consecutive wake commands, degraded timeout warning, and exactly-one-request/no-auto-retry assertion. GitHub Actions run 45750863159: `MOBILE_E2E_OK`.
- [x] Add regression coverage for sequential wake commands, overlapping text requests, client abort, provider timeout classification, degraded timeout fallback, and no duplicate retry; physical iPhone remains separate.
- [ ] Fix only reproduced defects; preserve existing request/response contracts unless explicitly tested.

## Phase 3 — Voice and hands-free lifecycle

- [x] Trace recorded-voice flow from MediaRecorder → STT → chat → TTS → wake restart.
- [x] Route recorded audio to the dedicated `/transcribe` endpoint instead of `/chat`, avoiding the chat route's shorter 18-second global deadline.
- [x] Keep wake recognition paused until the current TTS promise completes, preventing the microphone from listening to the assistant's own spoken answer.
- [x] Add regression guards for the STT endpoint and TTS-before-relisten ordering; CI: 53 passed, 0 failed (GitHub Actions run 45748953387).
- [ ] Verify actual microphone permission, audio playback, and repeated commands on iPhone Safari; simulated Chromium is not a substitute.
- [x] Trace source-level microphone permission, MediaRecorder/STT, wake recognition state machine, queue, TTS, and listening restart; browser-emulated mobile E2E passed, physical iPhone remains separate.
- [x] Match the repeated-session failure to WebKit Bug 321436 and implement the documented workaround pattern: single-shot sessions, natural onend only, a short speechSynthesis utterance before each iOS recognition session, and no stop()/abort() during normal iOS wake flow.
- [x] Route the iOS manual voice button through the already active SpeechRecognition session rather than opening a competing getUserMedia/MediaRecorder capture.
- [x] Keep the listening indicator unconfirmed until onspeechstart; the idle timer no longer claims the microphone is actively receiving speech.
- [x] Verify simulated failed-request recovery: degraded timeout is shown, one request only, UI returns to listening. Physical iPhone remains unverified.
- [x] Verify one command produces one request and no automatic duplicate retry in mocked mobile E2E; real Safari verification remains open.
- [x] Add repeat-command and failure-recovery regression coverage in mocked mobile E2E: five consecutive wake commands, timeout fallback, no duplicate request, TTS completion, and wake restart.
- [ ] Keep physical iPhone Safari permission/audio/wake tests separate from simulated Playwright checks.

## Phase 4 — Provider and fallback chain

- [x] Centralize model-specific output budgets and timeout selection; unit tests cover Qwen text/vision and GPT-OSS 20B/120B.
- [x] Map the normal text-chat provider order, per-model timeout/cooldown, shared 18-second deadline, concurrency slots, and client-cancellation path. Search/vision/STT routes remain to map.
- [x] Scope provider timeout/abort cooldowns to the affected model instead of blocking every model on the same provider host; a local HTTP integration test simulates a Groq Qwen timeout and verifies the next Groq model succeeds.
- [ ] Test 401, 402, 429, 5xx, empty body, malformed JSON, and exhausted fallback.
- [x] Ensure degraded fallback is explicitly distinguishable from a normal successful AI answer; UI warning and truthful timeout copy are covered by regression tests.
- [ ] Check provider logs contain request correlation and safe metadata, never credentials or personal payloads.

## Phase 5 — Laboratory / autonomy contour

- [x] Find and reproduce a false-green self-check: it returned `ok:true` even when `connectedToCore:false` and no core tools were bound.
- [x] Make self-check healthy only when the bounded runtime passes and at least one core tool is actually connected; return an explicit `AUTONOMY_CORE_TOOLS_NOT_BOUND` reason otherwise.
- [x] Add regression coverage for the disconnected-core case.
- [x] Require `coreConnected:true` in production deployment and 35x acceptance workflows; the full-capability E2E already asserts core connectivity.
- [x] CI: 55 passed, 0 failed (GitHub Actions run 45749263780).
- [ ] Verify the live production self-check reports `coreConnected:true`; not run because no production deploy is authorized in this workstream.
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
- [x] Verify the Vercel preview for commit c129b9515422ba824328e7d61cfb3aed0675792d; static HTML fetched. This preview is stale relative to the current branch HEAD and points at the production API, so it is not used for interactive acceptance. No API requests were sent from preview.
- [ ] Prepare a user-operated iPhone Safari acceptance checklist.
- [ ] Report PASS / FAIL / BLOCKED / NOT RUN, residual risks, and exact rollback point.
- [ ] Stop before production merge/deploy pending an explicit release decision.

## Change log

- 2026-11-26: isolated branch created from Qwen fix branch; test-first checks exposed the hand-picked test list and CI/deploy command mismatch. Updated `npm test` to full discovery and aligned CI to invoke it. Final CI: 49/49 tests passed.
- 2026-11-26: added a shared provider-response validator. Provider-declared output truncation now enters the fallback chain rather than being returned as a complete answer; empty successful responses are rejected. CI: 53/53 tests passed. Live provider behavior and real iPhone journey remain unverified.
- 2026-11-26: corrected recorded-voice routing to `/transcribe` and held wake listening until TTS completion. Regression guards passed in CI (53/53); physical iPhone Safari behavior remains NOT RUN.
- 2026-11-26: fixed autonomy self-check false-green when no core tools are bound; deployment and 35x acceptance now require `coreConnected:true`. CI: 55/55 tests passed. Live production self-check remains NOT RUN.

- 2026-11-26: added tested provider policy: Qwen text 2048 tokens / 7 seconds, Qwen vision 1024 tokens / 15 seconds; corrected GPT-OSS 120B classification. RED was observed before adding the policy module. Full CI: 60/60 tests passed. Production and VPS remain untouched.

- 2026-11-26: traced the full text UI/API/provider/renderer path. Added visible degraded-mode warnings and corrected timeout copy so it no longer claims a request was saved; regression tests observed RED before the UI change. Diagnostic frontend version now identifies this audited build. CI: 62/62 tests passed on commit `603df3958799f65443bea5a382c968c7ac7fa21e`. Vercel preview HTML uses the production API base; no preview API requests were made. Client-disconnect cancellation remains an open item.

- 2026-11-26: isolated mocked mobile UI E2E passed (`MOBILE_E2E_OK`, run 45750863159). It exercises microphone recording/transcription, Web Audio decode/finish using silent mock audio, five sequential wake commands, timeout warning, no automatic duplicate request, and wake resumption. All API calls are intercepted in Playwright; no production API requests are sent. CI on the same commit: 62/62 tests passed. Real iPhone Safari remains NOT RUN.

- 2026-11-26: fixed a cancellation/circuit-breaker defect. Previously, the Groq fallback chain added client-aborted requests to the 30-second per-model `textModelBlockedUntil` map; this could suppress the next request even though the provider was healthy. Client/route cancellation now exits before the cooldown is applied. Added a local HTTP integration test that occupies all four provider slots, queues a fifth request, aborts the first four, and verifies the fifth is admitted and succeeds. Test passed in 0.44 seconds.
- 2026-11-26: latest branch commit `54ab9a9aa3898ff28826b9caab41a790e43c0784`: GitHub CI **70/70 passed** (run 45751863913); Autonomy bridge verification SUCCESS (run 45751863927); mocked mobile UI E2E **MOBILE_E2E_OK** (run 45751863872). E2E includes five sequential wake commands, manual mic recording and mocked transcription, silent TTS audio decode/finish, degraded timeout warning, no automatic duplicate request, and wake resumption. It is browser emulation with mock API, not physical iPhone Safari.
- 2026-11-26: Vercel preview for the exact latest branch commit is READY; static HTML fetch confirms `2026-11-26-superpowers-stability-1`, fallback warning, and `/transcribe` path. The preview's API base remains production; no UI API calls were sent from preview. Production `main` remains at `d36dc3f7babaa46ac8140e7acfd1ec8b606f2f83`; no VPS, production deployment, secrets, DNS, or Cloudflare changes were made.

- 2026-11-26: matched the repeated iOS Safari SpeechRecognition failure to WebKit Bug 321436. The iOS wake loop now uses single-shot sessions, waits for natural session end, primes each new session with a short speechSynthesis utterance, and avoids stop/abort in normal wake flow. Manual iOS dictation reuses the same recognizer. Mocked E2E verifies five sequential commands, manual dictation, no forced stop/abort, no duplicate retry, and no false green listening status. This is not physical iPhone verification.
- 2026-11-26: corrected provider circuit scope so one model timeout no longer blocks the whole provider host. Added an integration test that simulates a timeout on the first Groq model and verifies that the next model on the same provider returns a valid response.
- 2026-11-26: propagated client cancellation through chat search, all six fallback search fetches, public-page reads, the standalone /search route, and document AI analysis. Added an HTTP integration test that disconnects during Serper search and confirms the provider fetch is aborted. /photo shared single-flight, image search, shopping fetches, and document extraction itself remain open.
- 2026-11-26: checkpoint commit 6e982a338b927d21f818ea906a2a2a94f63c4c6a: GitHub CI 81/81 passed, Autonomy bridge verification SUCCESS, mocked mobile UI E2E MOBILE_E2E_OK. Physical iPhone Safari and live production-provider acceptance remain NOT RUN.
