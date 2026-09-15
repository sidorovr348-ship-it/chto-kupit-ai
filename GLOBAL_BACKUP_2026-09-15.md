# Global backup — 2026-09-15

This marker preserves the verified starting point before the next repair pass.

- Repository: sidorovr348-ship-it/chto-kupit-ai
- Branch: main
- Starting commit: 2feb3715c4835398e52e877c9cbd2dbe28383776
- Existing backend: local-gateway.js
- Existing frontend: index.html
- Production API: https://ai.aliceq.ru
- Pages app: https://sidorovr348-ship-it.github.io/chto-kupit-ai/

## Truth status at backup time

The application was NOT certified as fully ready.

Known evidence:
- API health/search/shopping/photo/document/TTS checks passed in the latest authoritative verification attempt.
- Browser verification failed because the workflow installed the Playwright browser but did not install the `playwright` Node package required by browser-smoke.mjs.
- Production health reported imageGeneration=false because only the OpenAI image provider was wired and no OpenAI key was configured.

This file is a restore/reference marker. No credentials or tokens are stored here.
