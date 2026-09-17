# My AI Unified — autonomy integration contract

Repository: `sidorovr348-ship-it/chto-kupit-ai`

Verified compatibility boundary:
- Node.js major version 20 or newer.
- The production repository is CommonJS; this module therefore uses `.mjs` and a local `package.json` with `type: module`.
- Main runtime remains `local-gateway.js`.
- The existing application is not imported by or modified by the autonomy module.

Safety boundary:
- Integration is branch-first; `main` is protected by the adapter.
- The module contains no production secrets and does not access VPS, DNS, Alice, production APIs, or deployment credentials.
- The autonomy orchestrator requires bounded steps, policy checks, kill-switch checks, persisted state, verification, and terminal audit events.
- A critical action can be stopped for approval by the host policy.
- Independent verification is required by the merge-readiness gate before a future activation.

Activation rule:
This merge makes the control layer available in the repository. It does not grant it permission to mutate production. Any future wiring into `local-gateway.js`, deployment workflows, VPS, DNS, Alice, secrets, or production data requires a separate reviewed change and independent verification.
