# Autonomy Lab integration

This directory is an isolated control layer for bounded autonomous execution.

- Production integration is active through `local-gateway.js`, which creates the bounded runtime and exposes status, self-check and task-bridge endpoints.
- No production mutation is performed by the autonomy runtime itself.
- The runtime is integrated as ESM (`.mjs`) while the CommonJS application remains unchanged.
- Tasks are explicitly bounded to allowed kinds; production/deploy/release/secret/DNS/VPS/systemctl/self-modification actions require approval or are blocked by policy.
- Main-branch mutation is protected by the project adapter; planning uses a separate integration branch and requires independent verification.
- Release control requires a readiness gate and manual approval for production promotion.
- Runtime state and audit events are stored with restrictive local permissions.

The standalone Autonomy Lab v0.22 suite was validated before integration: 88/88 tests passed.
