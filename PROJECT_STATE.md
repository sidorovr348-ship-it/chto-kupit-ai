# My AI Unified — GLOBAL PROJECT STATE

Last updated: 2026-09-09

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

## Current verified diagnostic — 2026-09-09
Commit b9f5fa4cb9d38cb8a4191c0a1f2b5b2a750a4356 diagnostic workflow succeeded.
- Ollama: active; qwen3:0.6b installed.
- my-ai-unified-legacy: active.
- my-ai-unified: active.
- alice-ai: active.
- Ports 11434, 3021, 3020 and 3011 listening.
- GET /health on 3020 returned ok=true, dispatcher=true, local_ai.ok=true.
- Reported capabilities: chat, vision, image_generation, video, web_search, documents, tables, shopping, voice, code, verification.
- Local Alice endpoint returned a valid response for «Кто тебя создал?». The diagnostic response used fallback=true, so Alice→central AI live routing is NOT yet proven.
- VPS storage is critically low: 716 MB free / 8.6 GB (92% used). RAM available was about 553 MiB and swap was in use. Do not pull large models or create unnecessary files.

## Expected backend health
ok=true, dispatcher=true, local AI available; capabilities chat, vision, image_generation, video, web_search, documents, tables, shopping, voice, code, verification.

## Public network architecture
GitHub Pages frontend -> Cloudflare Quick Tunnel -> VPS 3020.
Quick Tunnel hostname is dynamic and must be discovered after restart.
Correct cloudflared binary: /usr/local/bin/cloudflared.
Protocol: http2.
Quick Tunnel log: /var/log/my-ai-unified-quick-tunnel.log.
Before tunnel restart: truncate the log so an old hostname cannot be reused.

Named tunnel alice-ai / aliceq.ru exists. Do not rotate its token or reinstall cloudflared without necessity. Do not make it the user-facing My AI API unless TLS is independently verified.

## Frontend stabilization
app-fixed.html is the resilient frontend version. It supports chat, voice input, photo, video, text/PDF/DOCX/CSV/TSV/XLSX file input, image-generation responses and shopping result rendering.
API discovery uses ./api.json?t=Date.now() with no-cache and a validated trycloudflare.com URL; fallback is the last verified Quick Tunnel URL.
GET health timeout: 15s. POST timeout: 90s; video/document operations use a longer client timeout.
Moscow time MUST be computed locally with Intl.DateTimeFormat using Europe/Moscow and MUST NOT depend on the API.

## Autonomous release history
The project has a central Dispatcher routing for vision, image_generation, documents, tables, video, shopping, web_search, code, verification and chat.
Local document/table extraction helpers exist for TXT/MD/JSON/XML/HTML/CSV/TSV/PDF/DOCX/XLSX.
Shopping price parsing and cheaper-mode sorting were improved.
Video currently remains a known HTTP 400 limitation until fixed and smoke-tested.

## Alice / «Мой AI»
Published Yandex Alice skill «Мой AI» remains an important existing component and must not be broken or replaced.
Target architecture: Alice -> /alice adapter -> My AI Unified Dispatcher -> model/tool -> Alice.
Keep a fast fallback while the unified route is being proven.
Historical working tests included identity, creator and arithmetic responses, but historical success does not prove current live routing.

## Shopping
«ЧтоКупить AI» is the shopping module, not the whole project. Historical stores: Wildberries, AliExpress, Яндекс Маркет, Ozon, DNS. Puter redirect/auth must never return.

## Cloud.ru external capability layer — decision 2026-09-09
Cloud.ru AI Agents / Agents Space is now a candidate OPTIONAL external capability layer, not a replacement backend.
- Current Cloud.ru documentation confirms AI agents, multi-agent systems, MCP, A2A, triggers, sessions, tracing and Public API.
- One agent system currently supports up to five agents.
- Agents and agent systems can expose public URLs.
- Agents Space is pay-as-you-go; current documentation gives 2 vCPU + 4 GB RAM at 3.84 RUB/hour while an agent is running, plus model token charges. Storage has a 15 GB free tier.
- Cloud.ru Evolution documentation currently advertises a 4,000-bonus starting grant and free-tier services, but this is account-dependent and must be checked before calling the integration free.
- Preview/free models exist in the model catalog, but a free model does not make always-on agent infrastructure free.
- First experiment should be one low-cost/serverless Cloud.ru agent or MCP capability behind a My AI Unified adapter with timeout and fallback.
- Do not migrate the main Dispatcher, Alice, shopping or the whole project to Cloud.ru.
- Detailed plan is in CLOUD_RU_INTEGRATION_PLAN.md.

## Disabled/controlled workflows
pages.yml: disabled duplicate.
deploy-vps.yml: manual-only.
repair-quick-tunnel.yml: disabled duplicate.
repair-cloudflare.yml: disabled duplicate.
my-ai-unified-verify.yml: disabled duplicate.
ci.yml remains normal CI and is not a deployment owner.
repair-my-ai-tunnel.yml is the canonical public-chain owner.
deploy-unified-backend.yml is the canonical backend-code deployment owner.
capability-smoke.yml is the capability regression owner.

## Critical truthfulness rules
Always distinguish: A) repository/history; B) automated workflow; C) user's iPhone/Safari; D) remaining limitation.
Never say everything is fixed until all relevant layers are actually verified.
No system can guarantee every future error; eliminate known failure modes and add monitoring/self-healing where practical.

## Security and exclusions
Do not store API keys, HF_TOKEN, PARALON_API_KEY, SERPER_API_KEY, Cloudflare tokens, SSH keys or passwords in GitHub or archives.
Do not delete backups.
Do not touch VPN/Xray as part of this project.
Do not return to Vercel as a solution.
HF and Cloud.ru are NOT the primary backend. Cloud.ru is an optional external capability layer subject to cost/grant verification.

## User working rules
User is Russian-speaking and non-programmer.
English technical terms in instructions must have Russian translation in parentheses.
Keep actions short and concrete; avoid circular diagnostics and repeated questions.
Prefer automation over manual Termius copying.
Say «готово» only after factual verification.
Checkpoint every 5 assistant messages.
Markers: 🟢 ready, 🟡 process, 🔴 problem, 🔵 next step, 🟣 important decision, ⚪ context.

## Next work priority
1. Verify/fix the canonical public-chain workflow; current run 34390501036 attempt 2 completed with failure, so the exact failing step must be inspected before any claim of deployment success.
2. Verify local chat and public Quick Tunnel chain.
3. Verify Alice public path and determine whether it reaches Dispatcher or still uses fallback.
4. Do not pull a larger model while disk remains near 92% full.
5. Run a controlled Cloud.ru integration experiment only after the current core chain is stable; do not require payment without checking grant/free balance.
6. Fix video HTTP 400 after the core web/Alice chain is stable.
7. Continue iPhone/Safari verification.
8. App Store / Google Play only after the web chain is stable.
