# My AI Unified — Autonomous Release Checkpoint

Date: 2026-09-09

## Result
The project was independently analyzed, changed, deployed and verified without requiring manual user steps.

## Code changes
- Centralized browser requests through the Dispatcher.
- Hardened routing for chat, vision, image generation, video, web search, documents, tables, shopping, code and verification.
- Added local extraction for TXT/MD/JSON/XML/HTML/CSV/TSV/PDF/DOCX/XLSX.
- Added `/document`, `/table`, `/image` endpoints.
- Improved video frame selection using actual video duration.
- Improved shopping price parsing/sorting.
- Added regression tests for Dispatcher and document extraction.
- Removed the stale hard-coded tunnel fallback from the frontend; the last verified API is persisted locally.
- Added video and file controls to the mobile frontend.
- Pages publication is restricted to frontend artifacts only.

## Deployment
- Backend deployment workflow: `.github/workflows/deploy-unified-backend.yml`.
- Backend deployment run #2: SUCCESS.
- Canonical public-chain workflow: `.github/workflows/repair-my-ai-tunnel.yml`.
- Canonical run #40: SUCCESS.
- Verified stages: VPS backend, local chat, local shopping, Quick Tunnel, public health, public chat, public shopping, GitHub Pages deployment and Pages content verification.
- CI: SUCCESS.

## Current public API
The canonical workflow writes the current temporary Quick Tunnel into `api.json`. At the last successful checkpoint it was:

`https://financing-craft-foundations-referral.trycloudflare.com`

This hostname is temporary and may change on the next tunnel restart.

## Important remaining work
The document/table/image/video additions are implemented and deployed, but they are not yet all individually exercised by the canonical public smoke test. The next hardening pass should add those tests before calling every capability fully end-to-end verified.

Alice/«Мой AI» was deliberately not replaced or broken during this release. It remains a separate integration target for the next phase.

## Truthfulness
Verified means verified by automation. This release does NOT claim that every future error is impossible or that every capability has been manually tested on the user's iPhone. The known unverified areas are explicitly recorded above.
