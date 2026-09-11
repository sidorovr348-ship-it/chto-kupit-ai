# My AI Unified — GLOBAL PROJECT STATE

Last updated: 2026-09-11

## 1. PURPOSE / FINAL GOAL
My AI Unified is the main project: a real universal Russian-language AI assistant for iPhone + Android, with later publication in Apple App Store and Google Play.
Architecture: user text/voice -> central Dispatcher (диспетчер/маршрутизатор) -> required AI/tool/module -> result.
Alice / «Мой AI» is a voice interface/adapter, not a separate brain.
«ЧтоКупить AI» is a shopping module inside the main project, not the main brain.
The result must be a working product, not a demo or a page that only looks functional.

## 2. REPOSITORY / SOURCE OF TRUTH
GitHub repository: sidorovr348-ship-it/chto-kupit-ai
Default branch: main
GitHub Pages frontend: https://sidorovr348-ship-it.github.io/chto-kupit-ai/
Git history is the primary code backup. Never rewrite/delete history unnecessarily.
Never store API keys, tokens, passwords or SSH keys in the repository.

## 3. CURRENT BACKEND
VPS: 87.121.63.153
OS: Ubuntu 26.04 LTS
Node.js: 22.22.1
Main project: /root/my-ai-unified
systemd: my-ai-unified.service
Main Express listener: 127.0.0.1:3020
Legacy API: /root/chto-kupit-ai-api on port 3000; do not confuse with main backend.
Controller: port 3010.
Alice service: /root/alice-ai, systemd alice-ai.service, listener 127.0.0.1:3011.
Ollama: 127.0.0.1:11434, local reserve model qwen3:0.6b.

## 4. CURRENT DEPLOYMENT TRUTH — 2026-09-11
Latest clean final deploy before the current vision change: run #76, ID 34566551660, commit 400f7bfca71819aaf6b92d7a951af63f322ad643. It succeeded.
Vision implementation was committed after that. The canonical final deploy for the new vision code has NOT yet completed successfully.
The latest failed repair attempt hit an SSH connection reset from GitHub Actions to the VPS on port 22 before remote diagnostics could run. Do not treat that failure as a vision failure.
The canonical final deploy workflow now contains local TTS and Vision smoke tests, but those tests only count as verified when the corresponding workflow run actually passes.

## 5. AI ROUTING
Current proven main chat path historically used:
My AI Unified -> 127.0.0.1:3020 -> ParalonCloud -> qwen3.8-27b.
Local qwen3:0.6b is a reserve/fallback, not the preferred main intelligence.
HF is NOT the main backend and must not be silently restored as the foundation.
Cloud.ru is NOT the main backend and must not replace the Dispatcher.
No new paid AI foundation without explicit user approval.

## 6. DISPATCHER CAPABILITIES
Current central dispatcher routes for:
- chat
- vision
- image_generation
- video
- web_search
- documents
- tables
- shopping
- voice
- code
- verification
Known routing code is in src/dispatcher.js.

## 7. TTS / VOICE — CURRENT STATUS
The frontend has been changed from browser speechSynthesis (механическое системное озвучивание) to backend /tts playback.
Backend local-gateway.js contains a TTS endpoint using node-edge-tts and Russian neural voice ru-RU-DmitryNeural.
package.json includes node-edge-tts.
The canonical final deploy workflow now contains a deterministic /tts smoke test: HTTP request, non-empty MP3 check and audio/MPEG/MP3 type check.
HONEST STATUS: the code and smoke test exist, but the new smoke test is not yet verified by a successful post-change final deploy. iPhone Safari audible playback is also not yet separately verified.

## 8. VISION / PHOTO — CURRENT STATUS
The previous local qwen3:0.6b vision path remains unavailable (501) because that local model is text-only.
A new ParalonCloud qwen3.8-27b multimodal path has been implemented in local-gateway.js for /photo and /chat vision requests, using OpenAI-compatible image_url content. It limits one request to two images because that is the supported request size.
The canonical final deploy workflow now contains a deterministic Vision smoke test using a 1x1 red PNG and expects «красный»/red.
HONEST STATUS: the new Vision implementation is in Git, but its real VPS execution is NOT yet verified because the post-change deployment was interrupted by the SSH connection-reset failure. Do not call Vision production-ready until the smoke test passes.
Future required feature: the product wants up to four photos, so after core Vision is verified the gateway must batch/synthesize four images rather than silently dropping images 3-4.

## 9. FRONTEND / IPHONE
Frontend is a single-page mobile-first application.
Target device context: iPhone 16 Pro Max, iOS 26.6/26.6.1, Safari.
Current app supports text chat, voice input, photo/video/file input, image generation response rendering and shopping rendering.
Current API target is the stable public My AI endpoint configured in the frontend.
Do not claim camera/vision is complete while backend vision is unverified.
Final required product capabilities include rear camera, camera on/off, «Что это?», image/video/gallery recognition, OCR, AI analysis, voice output with stop button, shopping prices and links, Russian stores first.

## 10. SHOPPING MODULE — «ЧТОКУПИТЬ AI»
Shopping is a module inside My AI Unified.
Required: Russian stores first, current prices, real availability, links, store cards/logos and clear price indication.
No Puter auth/redirect.
Known historical bugs that still require regression testing:
- Wildberries 595 ₽ was parsed as 1 ₽ in one case.
- Markdown links were produced incorrectly in one path.
- cheaper mode could return irrelevant accessory/AliExpress-like results for a specific 8849 TANK 4 Pro query.
Do not consider shopping production-ready until these regressions are smoke-tested and fixed.

## 11. VIDEO / DOCUMENTS / TABLES
Documents/tables extraction helpers exist for TXT/MD/JSON/XML/HTML/CSV/TSV/PDF/DOCX/XLSX.
Video support exists in routing but a prior HTTP 400 limitation is known; it needs a focused fix and smoke test after core stability.

## 12. ALICE / «МОЙ AI»
Published Yandex Alice skill «Мой AI» must not be broken or replaced.
Named Cloudflare tunnel: alice-ai
Tunnel ID: 536ea937-55d5-4b46-ad52-2fe55750bd9f
Domain: aliceq.ru
DNS root CNAME points to the named tunnel.
Do not rotate its token or reinstall cloudflared unnecessarily.
Alice chain: Alice -> /alice adapter -> Alice service :3011 -> ParalonCloud -> qwen3.8-27b -> Alice, with fast fallback where required by webhook timing.
Current deployment workflow contains Alice local/public checks, but live central Dispatcher routing should still be treated as a separate capability to prove, not assumed from fallback responses.

## 13. PENDING QUESTIONS TO RETURN TO AFTER CORE STABILITY
1. Should ChatGPT/OpenAI be added as a real runtime AI provider in My AI Unified, rather than assuming the ChatGPT model used in this chat is automatically inside the app? Inspect the repository first and distinguish code adapter vs configured/working provider.
2. Should Gemini be added as a real runtime AI provider/module? Inspect repository/config first; do not claim it is active unless an actual adapter and working credentials/configuration are present.
3. If both are added, decide their exact role in the Dispatcher (primary, fallback, specialist or verification) without replacing the currently proven core or adding a new paid foundation without explicit approval.
These questions are intentionally saved so they are not forgotten. Return to them only after finishing the current deployment/Vision/TTS work.

## 14. CLOUDFLARE / PUBLIC CHAIN
Main frontend/public chain has historically used GitHub Pages -> Cloudflare Quick Tunnel -> VPS 3020.
Quick Tunnel hostname can be dynamic; do not hard-code stale tunnel URLs.
Correct cloudflared binary: /usr/local/bin/cloudflared.
Protocol: http2.
Named alice-ai tunnel is separate and must remain stable.

## 15. SECURITY / DO-NOT-TOUCH
Never store secrets in GitHub or archives.
Do not delete backups.
Do not touch VPN/Xray as part of My AI Unified work.
Do not return to Vercel as the default solution.
Do not introduce VK, Yandex, MAX, Mail.ru or 2GIS into the product.
Do not silently reintroduce HF as the main backend.
Do not silently add Cloud.ru as the main backend.
Do not break the published Alice skill.
Do not rotate tunnel tokens without necessity.

## 16. RESOURCE CONSTRAINT
A previous diagnostic reported critically low VPS disk (~716 MB free of 8.6 GB) and low available RAM with swap use.
Before installing large models/packages or creating large backups, check free disk/RAM first.
Do not pull large models while disk remains near critical level.

## 17. USER WORKING RULES
User is Russian-speaking and does not know English.
Every English technical term in instructions must be followed by Russian translation in parentheses).
User wants short, direct, concrete actions and real results, not long plans.
Prefer automated GitHub/VPS workflows over manual Termius copying.
Never say «готово» unless the relevant layer has actually been verified.
Always distinguish: repository/history vs workflow/deployment vs public API vs user's iPhone/Safari vs remaining limitation.
Archive/checkpoint marker every 5 assistant messages:
🟢 ready; 🟡 process; 🔴 problem; 🔵 next step; 🟣 important decision; ⚪ context.

## 18. CURRENT PRIORITY QUEUE
1. Finish the post-vision final deployment and verify the Vision + TTS smoke tests.
2. If SSH reset recurs, harden the deploy connection/retry path rather than changing unrelated project architecture.
3. After core stability, verify shopping parsing, relevance and Russian-store-first results.
4. Fix video HTTP 400 and implement required frame processing.
5. Prove Alice -> Dispatcher live routing while preserving fast fallback.
6. Continue mobile/iPhone verification.
7. Only after core chain is stable: return to the saved ChatGPT/OpenAI + Gemini integration questions.
8. Only after core chain is stable: package for App Store / Google Play.

## 19. BACKUP POLICY
Every significant working milestone must be represented by:
A) a Git commit in main;
B) this PROJECT_STATE.md updated with factual status;
C) no secrets in either.
Never delete old working commits or backups unless explicitly requested.

## 20. HONEST PROJECT STATUS
🟢 Code repository and Git history are preserved.
🟢 Latest clean pre-vision final deployment #76 succeeded.
🟢 Main backend/public checks from that deployment succeeded.
🟢 Alice service/path checks from that deployment succeeded.
🟢 Pages deployment succeeded.
🟡 Post-vision final deployment pending verification because GitHub Actions hit an SSH connection reset.
🟡 Neural TTS code and smoke test are in the repository; post-change verification remains.
🟡 ParalonCloud Vision code and smoke test are in the repository; post-change verification remains.
🟡 Shopping and video still have known issues requiring regression/fixes.
