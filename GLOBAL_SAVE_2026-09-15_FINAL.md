# My AI Unified — global save 2026-09-15

## Current production state
- Repository: sidorovr348-ship-it/chto-kupit-ai
- Latest verification/fix commit: d4969685c452bff1acef92d9b5df1ba9a1797f47
- Production deployment run: 34944598343 — success
- Public photo smoke run: 34944598432 — success
- Alice connection run: 34944598338 — success
- Public integration test run: 34944598373 — success
- GitHub Pages artifact from production deploy: 10386815565

## Verified capabilities
- VPS backend deployment and restart
- Public /health
- Public /chat
- Public /photo
- Public /tts
- Frontend publication
- Clean answers without source/evidence lists
- Direct Moscow-time response in the frontend
- Alice endpoint/dispatcher connection verification

## Critical user requirement
The app must not show technical source lists such as «Источник: …» in normal answers. Internet search remains an internal mechanism.

## Important honesty rule
Do not call the project fully ready merely because CI is green. Final readiness requires production verification plus real end-user/browser verification; physical iPhone camera/microphone behavior cannot be remotely manipulated by CI.

## Current frontend production protections
- Clean UI patch is applied before validation and Pages publication.
- Moscow time uses Europe/Moscow directly for time-only questions.
- Photo backend has an independent public smoke test using a real image payload.

## Known limitation to preserve
- CI proves the public photo API works, but cannot prove a physical iPhone Safari camera permission/session in the user's hand.
- Alice verification proves the central and public Alice contracts respond successfully; it does not claim every possible Alice semantic route has been exhaustively tested.
