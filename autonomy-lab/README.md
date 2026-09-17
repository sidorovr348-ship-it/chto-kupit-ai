# Autonomy Lab integration

This directory is an isolated control layer for bounded autonomous execution.

- No production mutation is performed by this module.
- It is integrated as ESM (`.mjs`) so the CommonJS application remains unchanged.
- The first repository integration is deliberately non-invasive: the module is available to future adapters but is not imported by `local-gateway.js`.
- `main`, VPS, DNS, Alice, secrets and production APIs are not changed by this module.
- Any future activation must add an explicit project adapter, independent verification, and a separate release gate.

The standalone Autonomy Lab v0.22 suite was validated before integration: 88/88 tests passed.
