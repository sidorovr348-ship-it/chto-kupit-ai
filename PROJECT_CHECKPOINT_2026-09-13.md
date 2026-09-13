# My AI Unified — GLOBAL CHECKPOINT

Date: 2026-09-13

## Goal
Working Russian-language mobile application for iPhone + Android: chat, web search, shopping search, image/photo analysis, video, documents, voice input/output, image generation, Alice integration. Final target: real usable app, then App Store / Google Play.

## Current architecture
- GitHub: `sidorovr348-ship-it/chto-kupit-ai`
- VPS: Ubuntu 26.04 LTS
- Node: 22.22.1
- Unified service: `my-ai-unified`, port 3020, `/root/my-ai-unified`
- Env: `/root/my-ai-unified/.local-ai.env`
- Public API: `https://ai.aliceq.ru` / stable alias historically also `https://aliceq.ru`
- Legacy API: `/root/chto-kupit-ai-api`, port 3000 behind nginx — do not break
- Alice service: `/root/alice-ai`, port 3011, Cloudflare named tunnel `alice-ai`, domain `aliceq.ru` — do not break

## AI provider status
- Groq: WORKING. API test returned HTTP 200 for `openai/gpt-oss-120b`.
- Groq GPT-OSS is text-only; it is not the vision provider.
- DeepSeek: key/API may connect but current account returns HTTP 402 / insufficient balance.
- Mistral: API returned HTTP 429 rate limit.
- Z.ai / GLM-5.3-Flash: API key works but returns insufficient balance/resource package.
- Cerebras: rejected because free access required payment method.
- Ollama: too slow for production use.
- OpenRouter: unsuitable/blocked in current setup.
- Gemini: rejected for Russia constraints.
- Alibaba/Qwen: account/payment onboarding blocked.
- Kimi: China phone/real-name requirement.
- SiliconFlow: real-name verification.
- ModelScope: mobile access blocked for token page.

## Last confirmed code change
Commit: `44a01212340b11e20ce6cbc14f16faa04bdf9337`
Message: `Fix Groq GPT-OSS provider and reasoning output`
`local-gateway.js` now uses Groq `openai/gpt-oss-120b` by default and sets low reasoning with reasoning output hidden; completion budget 4000.

## Important deployment finding
The old auxiliary deploy workflows are unreliable because some still use GitHub Raw and/or hit VPS SSH connection resets. A successful Pages deploy does NOT prove the VPS is updated.

The current authoritative deployment workflow file is `.github/workflows/final-vps-deploy.yml`. It is designed to copy the exact gateway from the GitHub checkout directly to the VPS, restart `my-ai-unified`, verify local health/chat/TTS, then verify the public API and publish GitHub Pages.

## Current known limitation
The current `local-gateway.js` still tries DeepSeek/Hugging Face before Groq for text. Because DeepSeek can return 402, this can add delay before Groq. Text routing should be made Groq-first. Vision must remain on a separate vision-capable provider; do not route images to Groq GPT-OSS.

## TTS
Current default voice: `ru-RU-DmitryNeural`. User explicitly wants a more natural human-sounding Russian voice. This is a pending task after core AI connectivity is stabilized.

## Verification rule
Never claim the application is working merely because code is committed or GitHub Pages deployed. A release is considered WORKING only after:
1. VPS service is active;
2. local `/health` succeeds;
3. local `/chat` succeeds with a real AI response;
4. public `/health` succeeds;
5. public `/chat` succeeds;
6. the mobile UI can receive the answer.

## User priority
Do not send the user around in circles. Make concrete changes, verify them, and report only verified facts. If a blocker is external (VPS SSH, provider balance, missing secret), say exactly which blocker prevents completion.
