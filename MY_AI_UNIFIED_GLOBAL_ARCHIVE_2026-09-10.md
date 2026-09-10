# My AI Unified — Global Archive

Date: 2026-09-10

## Goal
Working Russian-language My AI Unified app for iPhone and Android. One assistant with central Dispatcher routing chat, web search, shopping, vision/photo, video, documents, voice, image generation, code, verification and Alice. No Puter redirect/auth. Russian stores first for shopping. Final target is a real installable/publishable mobile app, not only GitHub Pages.

## Current architecture
- GitHub repository: sidorovr348-ship-it/chto-kupit-ai
- GitHub Pages frontend currently uses API base https://ai.aliceq.ru
- VPS: 87.121.63.153
- Unified backend: /root/my-ai-unified, systemd my-ai-unified.service, 127.0.0.1:3020
- Legacy shopping API: /root/chto-kupit-ai-api, port 3000
- Historical controller: /root/chto-kupit-controller, port 3010
- Alice service: /root/alice-ai, port 3011
- Ollama: 127.0.0.1:11434, qwen3:0.6b
- Paralon: https://paraloncloud.com/v1, model qwen3.8-27b
- Cloudflare named tunnel: alice-ai, tunnel ID 536ea937-55d5-4b46-ad52-2fe55750bd9f

## Verified backend state on 2026-09-10
Local http://127.0.0.1:3020/health returns ok=true and dispatcher=true.
Public https://ai.aliceq.ru/health has been observed returning HTTP 200 from a GitHub Actions runner.
Public https://ai.aliceq.ru/chat has been observed returning HTTP 200 and JSON result.
Public https://aliceq.ru/alice has been observed both as HTTP 502 and HTTP 200. On a successful request it returned response text ALISA_OK and session_state.unified=true. Therefore Alice public routing is not yet stable.

## Critical discovered issue
VPS has multiple cloudflared processes, including several quick tunnels:
- systemd named tunnel: /usr/bin/cloudflared --no-autoupdate tunnel run --token-file /etc/cloudflared/token
- old quick tunnel to 127.0.0.1:3011
- quick tunnel to 127.0.0.1:3030
- quick tunnels to 127.0.0.1:3020 (more than one)
These duplicate quick tunnels must be removed from the production path. Only the named alice-ai tunnel should remain for production hostnames.

## Frontend
Current index.html version 2026-09-10.3. API base is https://ai.aliceq.ru. Browser speechSynthesis is still temporary/mechanical and must later be replaced by natural human TTS.

## Product requirements
- Russian UI
- iPhone optimized
- live rear camera, camera on/off
- “Что это?” recognition
- photo/video/gallery recognition
- 4 photos
- video frames around 4/7/10 sec
- OCR
- AI analysis
- voice output with stop
- price search and Russian stores first
- store cards/logos/price indication
- later gallery photos
- exclude VK, Yandex, MAX, Mail.ru, 2GIS and excluded categories already defined in project context

## Historical shopping bugs to preserve for future repair
- Wildberries 595 ₽ parsed as 1
- Markdown links incorrectly emitted
- cheaper mode returned irrelevant AliExpress-like 75 and WB accessory-like 751 for 8849 TANK 4 Pro

## Rule for release
Never call the system ready based only on deployment logs. Ready means real public HTTPS health + public chat + browser frontend chat work from the user's iPhone. Then verify Alice and natural TTS.
