# My AI Unified — GLOBAL PROJECT STATE

Last updated: 2026-09-08

## Purpose
Mobile-first unified AI assistant. Frontend on GitHub Pages; backend on VPS. Target capabilities: chat, vision/photo, image generation, video, web search, documents, tables, shopping, voice, code, verification. Quality and reliability in Russia are priorities.

## Repository
GitHub: sidorovr348-ship-it/chto-kupit-ai
Default branch: main
Pages: https://sidorovr348-ship-it.github.io/chto-kupit-ai/

## Backend
VPS: 87.121.63.153
OS: Ubuntu 26.04 LTS
Node.js: 22.22.1
Project: /root/my-ai-unified
systemd: my-ai-unified.service
Express: 127.0.0.1:3020
Legacy API: /root/chto-kupit-ai-api on port 3000; do not confuse with main backend.

Expected backend health: ok=true, dispatcher=true, adapters paralon/paralon_fallback/serper/video=true; capabilities chat, vision, image_generation, video, web_search, documents, tables, shopping, voice, code, verification.

## Public network architecture
GitHub Pages frontend -> Cloudflare Quick Tunnel -> VPS 3020.
Quick Tunnel hostname is dynamic and must be discovered after restart.
Correct cloudflared binary: /usr/local/bin/cloudflared.
Protocol: http2.
Quick Tunnel log: /var/log/my-ai-unified-quick-tunnel.log.
Before tunnel restart: truncate the log so an old hostname cannot be reused.

Named tunnel alice-ai / ai.aliceq.ru exists, but Safari previously reported an HTTPS trust/secure-connection problem. Do NOT make it the user-facing API unless TLS is independently verified fixed.

## Frontend stabilization
app-fixed.html is the resilient frontend version (2026-09-08-6).
It includes local commands for greetings, identity, Moscow time/date and UI commands. Moscow time MUST be computed locally with Intl.DateTimeFormat using Europe/Moscow and MUST NOT depend on the API.
API discovery uses ./api.json?t=Date.now() with no-cache and a validated trycloudflare.com URL; fallback is the last verified Quick Tunnel URL.
GET health timeout: 15s. POST timeout: 90s.
Current frontend routes: /chat, /shopping, /photo.
PDF is still explicitly not connected; do not claim full document support until implemented.

## Known historical regressions found and fixed
1. Moscow-time local fallback was lost/regressed. Historical fix commit: a5852a974d3ff49d241d22e400cedb2d1c7f87d0.
2. Frontend timeout was increased 30s -> 75s in historical fix 76bc630bb9913a82a6cfbd8a97c4eda708d3a2a; later regressed to 30s. app-fixed uses 90s.
3. API fallback chain existed in cba2243ed30234438ed4cdc00fa9162f3aae5b73. Current app uses dynamic api.json + verified tunnel fallback; broader fallback may still be worth restoring after verifying candidates.
4. Duplicate deployment workflows could race. pages.yml was disabled. deploy-vps.yml was changed to manual-only.
5. Canonical repair workflow was rewritten with concurrency protection and retry logic.
6. Cloudflare Quick Tunnel public health previously hit HTTP 429; canonical workflow now retries aggressively.

## Canonical workflow
.github/workflows/repair-my-ai-tunnel.yml is the intended single owner of public chain repair/deployment.
Canonical rewrite commit: de04f954aa49da69c8119f64755a4156d2c2a3f7.
It has concurrency group my-ai-unified-canonical with cancel-in-progress=true; checks local backend, local chat/shopping/CORS, rebuilds Quick Tunnel, discovers fresh hostname, retries public health/chat/shopping, writes api.json, points index.html to app-fixed.html, commits the verified locator, deploys Pages, then verifies Pages.
Generated commit message: Update verified Quick Tunnel locator.
Do not claim this workflow completed unless its generated commit or workflow run is actually verified.

## Disabled/controlled workflows
pages.yml: disabled duplicate.
deploy-vps.yml: manual-only; no longer auto-runs on every push.
repair-quick-tunnel.yml: disabled duplicate.
repair-cloudflare.yml: disabled duplicate.
my-ai-unified-verify.yml: disabled duplicate.
ci.yml remains normal CI and is not a deployment owner.

## Critical truthfulness rules
Always distinguish:
A) confirmed by repository/history;
B) confirmed by automated workflow;
C) confirmed on the user's iPhone/Safari;
D) known remaining limitations.
Never say everything is fixed until all relevant layers are actually verified.
No system can guarantee every future error; eliminate known failure modes and add monitoring/self-healing where practical.

## Historical app/search details
Shopping integrations tested: Wildberries, AliExpress, Yandex Market, Ozon, DNS.
Historical shopping bug: Wildberries price extraction could turn 595 ₽ into 1; links could arrive as Markdown URLs. These were fixed in the old shopping API work; verify current implementation before claiming.

## Historical infrastructure notes
Cloudflare named tunnel alice-ai: ID 536ea937-55d5-4b46-ad52-2fe55750bd9f; domain aliceq.ru; hostname ai.aliceq.ru.
Alice server historically lived at /root/alice-ai on ports 3010/3011 and exposed /alice; separate from main My AI Unified backend.

## Next work priority
1. Verify canonical workflow completion and resulting index.html/api.json.
2. Verify the public Pages app and local Moscow-time command without API dependence.
3. Verify chat, shopping, photo end-to-end from the public Pages path.
4. Audit backend deployment ownership; if desired, build a single controlled backend deploy path rather than reintroducing competing auto-deploy workflows.
5. Restore a verified multi-endpoint API fallback only where endpoints are actually functional and TLS-safe.
6. Implement PDF/document handling if full document capability is required.
7. Add further self-healing/monitoring only after the single canonical chain is stable.
