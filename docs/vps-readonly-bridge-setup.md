# Read-only VPS bridge setup checkpoint

This document records the isolated setup checkpoint for the restricted VPS health probe.

- The bridge workflow is `.github/workflows/vps-readonly-bridge.yml`.
- It permits only the fixed `health` command over SSH.
- Repository secrets are configured separately in GitHub settings.
- The bridge is not considered verified until a GitHub Actions run succeeds and returns the health JSON.

No production application or server configuration is changed by this document.
