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

## 4. VERIFIED DEPLOYMENT STATE — 2026-09-11
Canonical final deploy workflow: .github/workflows/final-vps-deploy.yml
Latest clean final deploy: run #76, ID 34566551660, commit 400f7bfca71819aaf6b92d7a951af63f322ad643.
Run #76 completed successfully. Deployment updated the main gateway, restarted the service, and passed the workflow's server/public/Alice/Pages checks.
Commit 400f7bfca71819aaf6b92d7a951af63f322ad643 also changed .github/workflows/repair-now.yml to workflow_dispatch only, stopping the previous automatic repair-workflow race.
Earlier production repair run 34566372516 failed; do not treat it as successful.

IMPORTANT TRUTH: successful deployment proves the deployed code and workflow checks, but it does NOT by itself prove every capability on the user's iPhone.

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
The code is deployed successfully in run #76.
HONEST STATUS: the deployment is confirmed, but a dedicated end-to-end test that generates a real MP3 and verifies audible playback has NOT yet been completed. Therefore do not claim «живой голос полностью проверен» until that test passes.
Required next action: add/execute a deterministic /tts smoke test that verifies HTTP success, non-zero MP3 bytes/content-type and, if possible, the public route; then verify in iPhone Safari.

## 8. VISION / PHOTO — CURRENT STATUS
Current local-ai.js callVision() intentionally returns HTTP 501 because the installed local qwen3:0.6b model is text-only and cannot analyze images.
Therefore photo recognition is NOT currently working end-to-end.
Do not fake success and do not route to an unapproved HF foundation.
Next preferred investigation: determine whether the already-used ParalonCloud qwen3.8-27b endpoint supports multimodal/image_url content. If yes, implement vision through the existing paid backend rather than adding another foundation. If no, present the exact required option to the user before adding another provider.

## 9. FRONTEND / IPHONE
Frontend is a single-page mobile-first application.
Target device context: iPhone 16 Pro Max, iOS 26.6/26.6.1, Safari.
Current app supports text chat, voice input, photo/video/file input, image generation response rendering and shopping rendering.
Current API target is the stable public My AI endpoint configured in the frontend.
Do not claim camera/vision is complete while backend vision remains 501.
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
Current deployment workflow confirms Alice path checks, but full live Alice -> central Dispatcher routing should still be treated as a separate capability to prove, not assumed from fallback responses.

## 13. CLOUDFLARE / PUBLIC CHAIN
Main frontend/public chain has historically used GitHub Pages -> Cloudflare Quick Tunnel -> VPS 3020.
Quick Tunnel hostname can be dynamic; do not hard-code stale tunnel URLs.
Correct cloudflared binary: /usr/local/bin/cloudflared.
Protocol: http2.
Named alice-ai tunnel is separate and must remain stable.

## 14. SECURITY / DO-NOT-TOUCH
Never store secrets in GitHub or archives.
Do not delete backups.
Do not touch VPN/Xray as part of My AI Unified work.
Do not return to Vercel as the default solution.
Do not introduce VK, Yandex, MAX, Mail.ru or 2GIS into the product.
Do not silently reintroduce HF as the main backend.
Do not silently add Cloud.ru as the main backend.
Do not break the published Alice skill.
Do not rotate tunnel tokens without necessity.

## 15. RESOURCE CONSTRAINT
A previous diagnostic reported critically low VPS disk (~716 MB free of 8.6 GB) and low available RAM with swap use.
Before installing large models/packages or creating large backups, check free disk/RAM first.
Do not pull large models while disk remains near critical level.

## 16. USER WORKING RULES
User is Russian-speaking and does not know English.
Every English technical term in instructions must be followed by Russian translation in parentheses).
User wants short, direct, concrete actions and real results, not long plans.
Prefer automated GitHub/VPS workflows over manual Termius copying.
Never say «готово» unless the relevant layer has actually been verified.
Always distinguish: repository/history vs workflow/deployment vs public API vs user's iPhone/Safari vs remaining limitation.
Archive/checkpoint marker every 5 assistant messages:
🟢 ready; 🟡 process; 🔴 problem; 🔵 next step; 🟣 important decision; ⚪ context.

## 17. CURRENT PRIORITY QUEUE
1. Verify real /tts audio generation with a deterministic smoke test; then verify playback on iPhone Safari.
2. Fix vision/photo recognition without using an unapproved main backend; first test ParalonCloud multimodal capability.
3. Stabilize shopping parsing, relevance and Russian-store-first results.
4. Fix video HTTP 400 and implement required frame processing.
5. Prove Alice -> Dispatcher live routing while preserving fast fallback.
6. Continue mobile/iPhone verification.
7. Only after core chain is stable: package for App Store / Google Play.

## 18. BACKUP POLICY
Every significant working milestone must be represented by:
A) a Git commit in main;
B) this PROJECT_STATE.md updated with factual status;
C) no secrets in either.
Never delete old working commits or backups unless explicitly requested.

## 19. HONEST PROJECT STATUS
🟢 Code repository and Git history are preserved.
🟢 Latest clean final deployment #76 succeeded.
🟢 Main backend/public checks from deployment succeeded.
🟢 Alice service/path checks from deployment succeeded.
🟢 Pages deployment succeeded.
🟡 Neural TTS code is deployed; real MP3 end-to-end verification remains.
🔴 Vision/photo backend remains unavailable (501).
🟡 Shopping and video still have known issues requiring regression/fixes.
