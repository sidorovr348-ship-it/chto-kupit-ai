# MY AI UNIFIED — GLOBAL SAVE — 2026-09-10

## FINAL GOAL
One working Russian-language assistant for iPhone + Android. Natural text/voice request → central Dispatcher (диспетчер/маршрутизатор) → correct capability/tool/model → result.

Target capabilities: chat, web search, shopping, photo/vision, video, files/documents, tables, image generation, code, verification, voice/TTS (озвучивание текста).

Alice is a voice interface/adapter. The published Yandex skill «Мой AI» must be preserved. «ЧтоКупить AI» is the shopping module, not the final product.

## REPOSITORY
GitHub: `sidorovr348-ship-it/chto-kupit-ai`
Branch: `main`
Pages: `https://sidorovr348-ship-it.github.io/chto-kupit-ai/`

Existing historical archives/checkpoints remain in the repository. This file is the current global save and source of truth for continuation.

## CURRENT BACKEND
VPS: `87.121.63.153`
OS: Ubuntu 26.04 LTS
Node: 22.22.1
Main app: `/root/my-ai-unified`
Systemd: `my-ai-unified.service`
Main API: `127.0.0.1:3020`
Legacy shopping API: `/root/chto-kupit-ai-api`, port 3000
Historical controller: port 3010
Alice service: `/root/alice-ai`, port 3011
Ollama: `127.0.0.1:11434`

`local-gateway.js` uses the central Dispatcher and exposes `/health`, `/chat`, `/photo`, `/alice`.

Historical provider: ParalonCloud OpenAI-compatible API, model `qwen3.8-27b`. Do not publish secrets.

## ALICE
Published Yandex skill: `Мой AI`.
Webhook: `https://aliceq.ru/alice`
Named Cloudflare tunnel: `alice-ai`
Tunnel ID: `536ea937-55d5-4b46-ad52-2fe55750bd9f`

Historical successful tests included identity and arithmetic, and session history. Existing Alice implementation and backups must not be destroyed.

Target: Alice → `/alice` adapter → central Dispatcher → selected capability/model/tool → Alice response.

## CRITICAL LIVE ISSUE
On 2026-09-10 the user opened the live GitHub Pages app and received:
`AI не подключён: Fetch is aborted`
`Не удалось получить ответ: Load failed`
Safari also showed an unsafe HTTPS connection warning.

Therefore the public chain is currently considered BROKEN even though older GitHub Actions logs claimed success.

Current frontend directly uses `https://ai.aliceq.ru`.

Do NOT declare the application ready until the actual browser-accessible chain is verified:
GitHub Pages → HTTPS → `ai.aliceq.ru` → Cloudflare → VPS `3020` → Dispatcher → response.

## CLOUDFLARE IMPORTANT FACT
Historical diagnostics indicate `cloudflared` runs as a token-based named tunnel service. Do NOT blindly replace it with a local YAML configuration, rotate the token, or create another competing tunnel.

Desired public API:
`ai.aliceq.ru` → Cloudflare → `http://127.0.0.1:3020`

Desired Alice:
`aliceq.ru/alice` → Cloudflare → Alice/unified adapter.

## DEPLOYMENT
`.github/workflows/final-vps-deploy.yml` currently:
1. deploys `local-gateway.js` and `src/local-ai.js` to VPS;
2. restarts `my-ai-unified`;
3. verifies local health/chat;
4. verifies public `ai.aliceq.ru/health` and `/chat`;
5. verifies public `aliceq.ru/alice`;
6. deploys GitHub Pages.

Known failure of process: old workflow verification was not sufficient to guarantee the user's real iPhone browser worked. Future completion claims must be based on fresh end-to-end evidence.

## IMMEDIATE REPAIR ORDER
1. Inspect the actual `cloudflared` systemd command and named tunnel routing on the VPS.
2. Check DNS for `aliceq.ru` and `ai.aliceq.ru` from the VPS and an external resolver.
3. Repair the named Cloudflare route/DNS/TLS without destroying the existing Alice skill.
4. Verify public `/health` and `/chat`.
5. Open the Pages app and verify chat from Safari.
6. Only after that implement natural human-sounding Russian TTS.
7. Then continue photo/video/shopping/document and other modules.

## NATURAL VOICE
Current browser `speechSynthesis` is temporary and mechanical. User explicitly requires a natural human-sounding Russian voice with stop control. This is next after the public API is stable.

## SHOPPING REQUIREMENTS
Russian stores first; actual availability; prices and links; product recognition from live rear iPhone camera, gallery and video; OCR; 4 photos; video frames around 4/7/10 seconds; voice output and stop; store cards/logos/price indication.

Known historical bugs: Wildberries price parsing (`595 ₽` becoming `1`), Markdown links, irrelevant accessory results in cheaper mode.

## USER OPERATING RULES
- Be honest: never say «готово» without current real verification.
- Do not make the user repeat completed work.
- Prefer automation over asking the user to run server commands.
- If asking the user to open something, provide a direct link immediately.
- Keep instructions short and action-oriented.
- Any English technical term in instructions must immediately have Russian translation in parentheses).
- Preserve backups and working historical components.

## STATUS
🟡 PROCESS / 🔴 PUBLIC CONNECTION BLOCKER.

This save records the full known project architecture, history, infrastructure, current failure, and next repair order so the work can continue without losing context.
