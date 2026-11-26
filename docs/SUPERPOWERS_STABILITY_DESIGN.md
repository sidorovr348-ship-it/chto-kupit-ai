# Эй — Superpowers: stability-first design

**Статус:** approved by project owner on 2026-11-26  
**Working branch:** `superpowers/stability-audit-2026-11-26`  
**Starting commit:** `fa2932c224438e4eef5f60035659c3d6ca3d205a`  
**Production base at audit start:** `main` / `d36dc3f7babaa46ac8140e7acfd1ec8b606f2f83`

## Goal

Stabilize the existing My AI Unified application before adding capabilities. Preserve its current architecture and public API unless evidence demonstrates that a change is necessary.

The user-visible critical path is:

`iPhone Safari UI → request lifecycle → API gateway → dispatcher/provider/tool → response rendering → TTS / wake-listening recovery`.

Vercel, GitHub Pages, and the VPS are separate deployment surfaces and must be verified independently.

## Non-goals

- No full rewrite or parallel backend.
- No new paid services or runtime dependencies merely to adopt a process.
- No unrelated VPN, Xray, DNS, Cloudflare, firewall, or VPS operating-system changes.
- No production deployment, migration, restart, or destructive operation as part of this audit without a separately reviewed and explicitly approved release step.
- Automated Chromium tests must not be represented as proof of real iPhone Safari microphone, speech-recognition, permission, or audio behavior.

## Working method

1. State the symptom, impact, environment, and measurable acceptance criterion.
2. Inspect current source, tests, workflows, deployment configuration, and recent evidence before editing.
3. Trace failures to their root cause; label unknowns as unknown.
4. Work in this isolated branch; preserve the existing Qwen branch and `main`.
5. For each defect: add a focused regression test first, observe the failing condition where execution is available, make the smallest fix, then rerun focused and full tests.
6. Review the diff for contract changes, security, resource use, retries, deadlines, and rollback.
7. Record checks as PASS / FAIL / BLOCKED / NOT RUN with commit SHA and environment.
8. Do not call a feature fixed solely because CI or deployment is green.

## Acceptance evidence levels

- **L1 — Source:** syntax, unit tests, static contract checks.
- **L2 — Build/deploy:** exact commit and deployment state.
- **L3 — Live service:** real HTTP request/response checks for the exact deployment and production alias.
- **L4 — User journey:** actual iPhone Safari interaction, including repeated voice commands and audible response.

L1–L3 do not replace L4. If physical-device access is unavailable, L4 remains NOT RUN and must be completed by the user.

## Stability priorities

1. Test coverage and deployment preflight completeness.
2. Chat request lifecycle: deadlines, cancellation, duplicate submissions, queueing, and response integrity.
3. Voice: microphone permission, STT, wake-word state machine, repeated commands, TTS playback, and recovery after failure.
4. Provider routing: invalid credentials, quota/rate limits, slow/empty/malformed responses, fallback, concurrency, and observability.
5. Laboratory/autonomy initialization and self-check isolation from normal chat.
6. Photo, documents, search, memory, and other existing features.
7. Independent release audit and controlled preview acceptance.

## Release boundary

Changes remain in this branch and preview until review is complete. Do not merge to `main`, deploy the VPS, or replace production aliases without an explicit release decision. A rollback must identify the exact prior commit/deployment and the verified rollback procedure.
