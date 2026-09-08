# MY AI UNIFIED — GLOBAL PROJECT ARCHIVE

Last updated: 2026-09-09
Purpose: portable source of truth for continuing the project in a new ChatGPT chat without reconstructing the history piece by piece.

## 1. REAL PRODUCT GOAL

The original and final goal is NOT simply «ЧтоКупить AI» and NOT a collection of separate AI pages.

The target product is **My AI Unified** — one universal assistant. The user should be able to say or write naturally what needs to be done, without choosing a model, mode, or tool. A central Dispatcher (диспетчер/маршрутизатор) determines what capability/model/tool is appropriate and executes the task.

Core interaction principle:

USER → natural voice/text → My AI Unified Dispatcher → required AI/tool → result → user.

Alice is the important voice interface/gateway. The published Yandex skill «Мой AI» is an existing working component and must be preserved. The long-term target is:

Alice → «Мой AI» voice adapter → My AI Unified Dispatcher → selected capability/model/tool → result → Alice voice response → user.

Therefore:
- My AI Unified = central brain/dispatcher.
- Alice = voice interface/gateway, not the brain.
- «Мой AI» in Alice = our published voice skill and an important adapter/component of the unified system.
- «ЧтоКупить AI» = shopping capability/module, not the whole product.

Examples of intended behavior:
- «Найди телевизор 50 дюймов в Москве, сравни цены и скажи, где можно купить сегодня» → shopping/web search.
- «Посмотри эту фотографию и скажи, что это» → vision.
- «Разбери документ» → documents.
- «Проанализируй таблицу» → tables.
- «Напиши код и проверь, работает ли он» → code + verification.
- «Найди свежую информацию» → web search + AI.
- «Поговори со мной» → chat/voice.

Target capability set:
chat, vision/photo, image generation, video, web search, documents/PDF, tables, shopping, voice/TTS, code, verification.

## 2. ARCHITECTURE

Target architecture:

    USER
      │
      ├── text / photo / file / voice
      ↓
    My AI Unified interface OR Alice
      ↓
    Dispatcher (диспетчер)
      ├── Chat AI
      ├── Vision
      ├── Web Search
      ├── Shopping
      ├── Documents
      ├── Tables
      ├── Video
      ├── Image generation
      ├── Code
      └── Verification
      ↓
    result
      ↓
    interface / Alice voice

The system should avoid polling multiple models for every request. Use the primary model for ordinary requests, specialized models/tools for appropriate tasks, and fallback AI only when necessary.

## 3. GITHUB / PROJECT IDENTITY

Repository:
`sidorovr348-ship-it/chto-kupit-ai`

Default branch: `main`

Historical project name: «ЧтоКупить AI».
Current project name: **My AI Unified**.

The old repository was deliberately repurposed instead of creating a mandatory new repository.

GitHub Pages:
`https://sidorovr348-ship-it.github.io/chto-kupit-ai/`

Global project state file:
`PROJECT_STATE.md`

This archive:
`MY_AI_UNIFIED_GLOBAL_ARCHIVE.md`

## 4. IMPORTANT GITHUB HISTORY / MILESTONES

Initial My AI Unified migration:
- `6abbe775edba6d18b93dc685ec5866189aab9612` — replaced index.html with minimal My AI Unified interface: unified chat, voice button, photo, file, reset, POST /chat, Dispatcher display.
- `2adb2739fea8973043ecc0d33acdb21fa534fc` — created `src/capabilities.json`.
- `ccc72d9a19614da5d76f56e9914a6334b6d75da4` — created `src/dispatcher.js`.
- `e58f8768af40d3a5d066980603e98d1776f2a2` — replaced old server.js with unified backend.
- `020fef280ecf1a24150592c0d8d201acce435bbe`, `213fd66b352d5443219af00b5ea9bc8bbbbc52d8`, `a8a26f4bee58c4d21fa309479cb346ebd9b26301`, `ae579e3533841d0e4f054105f9325ca2308492e7` — package/env/tests/CI work.
- `f6d8089149636b2a24a8433127cd19a03272a5f0` — recorded working FFmpeg video module connection.

Infrastructure/frontend stabilization around 2026-09-08:
- `a5852a974d3ff49d241d22e400cedb2d1c7f87d0` — restored local Moscow time fallback.
- `76bc630bb9913a82a6cfbd8a97c4eda708d3a2a` — historical frontend timeout increase.
- `cba2243ed30234438ed4cdc00fa9162f3aae5b73` — historical API fallback chain.
- `0d62d0e96c1e76aeeace04c392365a635d595992` — restored proven Quick Tunnel frontend path.
- `387d8b27b9a560798fd114a7ee108eb284595248` — hardened full-chain verification against transient Quick Tunnel HTTP 429.
- `3dd3e8f5539ab2147826f79683b370bb4125d2a7` — made full-chain tunnel verification self-healing.
- `31410748bc8351d23cbdc4b0bab8c0a34b31a731` — disabled duplicate Quick Tunnel repair workflow.
- `cbf3faf8d0f770b18d71145818ee5a8c494cd582` — disabled competing Cloudflare tunnel workflow.
- `b3d0513f32c51ae3bb9e3b2427bc3ed7f19ab673` — disabled competing live verification workflow.
- `680626dd5496a942552eb0460ec4a7adb2f87867` — added resilient My AI Unified frontend.
- `77529e9b77fa763c7105db7d7ca1c9cfe542ec30` — switched My AI Unified to resilient frontend.
- `72e57f20fc29dc396345c8c512c91b51d69bda4b` — restored full app and kept current Quick Tunnel.
- `8c214440fcce5e0c02575aa4e5a0daeb3a71821b` — disabled duplicate GitHub Pages deploy workflow.
- `14ede8780ea6a11a68cafd613f4305bd705c6c79` — made competing VPS deploy workflow manual-only.
- `de04f954aa49da69c8119f64755a4156d2c2a3f7` — canonical full-chain repair workflow made race-safe.
- `6c1e5efaaf317cb8332583606463ad31dfc5f7c2` — global project checkpoint.
- `3c402473b508626541b5c8a1c70d8b81e81d0bf6` — latest recorded commit as of 2026-09-08: `Update verified Quick Tunnel locator`.

## 5. CURRENT VERIFIED REPOSITORY LOCATOR

At the time of this archive, `api.json` contains:
`https://victory-result-barbara-revealed.trycloudflare.com`
with `verified: full-chain`.

Important: Quick Tunnel hostnames are temporary/dynamic. Never assume this hostname will remain valid after a restart. The canonical workflow is designed to discover and verify a fresh hostname.

## 6. FRONTEND

Current resilient frontend file:
`app-fixed.html`
Version noted in project history: `2026-09-08-6`.

Important frontend behavior:
- mobile-first, intended especially for iPhone/Safari;
- local greeting/identity/UI commands;
- Moscow time/date computed locally using `Intl.DateTimeFormat` with `Europe/Moscow`, so this command does not depend on the API;
- API discovery reads `./api.json?t=Date.now()` with cache-busting;
- GET health timeout 15 seconds;
- POST timeout 90 seconds;
- routes used by frontend: `/chat`, `/shopping`, `/photo`;
- text-like files can be sent through chat path;
- PDF is explicitly NOT fully connected; do not claim full document/PDF support until implemented and verified;
- voice uses browser Web Speech API and speech synthesis/fallback behavior;
- settings are stored locally.

Do not regress the local Moscow-time behavior.

## 7. CANONICAL DEPLOYMENT / SELF-HEALING WORKFLOW

File:
`.github/workflows/repair-my-ai-tunnel.yml`

This is intended to be the single owner of the public repair/deployment chain.

It:
1. checks `my-ai-unified.service` on the VPS;
2. waits for local `/health`;
3. verifies `dispatcher=true`;
4. verifies capabilities: chat, vision, image_generation, video, web_search, documents, tables, shopping, voice, code, verification;
5. verifies adapters: paralon, paralon_fallback, serper, video;
6. tests local `/chat`, `/shopping`, and CORS OPTIONS `/chat`;
7. truncates the Quick Tunnel log before restart so an old hostname cannot be reused;
8. runs `/usr/local/bin/cloudflared` with HTTP/2 to `127.0.0.1:3020`;
9. discovers the fresh `trycloudflare.com` hostname;
10. retries public `/health` up to 120 iterations because transient 429s have occurred;
11. tests public `/chat` and `/shopping`;
12. writes the verified hostname to `api.json`;
13. rewrites `index.html` to open `app-fixed.html` with cache busting;
14. commits the verified locator;
15. deploys GitHub Pages;
16. verifies the Pages deployment.

Concurrency group:
`my-ai-unified-canonical`
with `cancel-in-progress=true`.

Do not claim the workflow succeeded merely because the file exists. Verify the actual workflow run or generated locator commit.

Competing deployment/repair workflows were intentionally disabled to prevent races.

## 8. VPS — MAIN MY AI UNIFIED

VPS:
`87.121.63.153`

OS:
Ubuntu 26.04 LTS

Node.js:
22.22.1

Main project:
`/root/my-ai-unified`

Systemd service:
`my-ai-unified.service`

Express:
`127.0.0.1:3020`

Legacy shopping/old API:
`/root/chto-kupit-ai-api`
port `3000`
service `chto-kupit-ai-api.service`

Historical controller:
`chto-kupit-controller.service` → port `3010`

Alice service:
`alice-ai.service` → port `3011`

Do not confuse ports 3000, 3010, 3011 and 3020.

Historical main `/health` expected/verified state:
`ok=true`, `dispatcher=true`, adapters `paralon=true`, `paralon_fallback=true`, `serper=true`, `video=true`; capabilities include chat, vision, image_generation, video, web_search, documents, tables, shopping, voice, code, verification.

This is historical verified state, not a promise of the current VPS state. Re-check before claiming it is currently live.

## 9. AI PROVIDERS / MODELS

Main historical unified backend provider:
ParalonCloud OpenAI-compatible API:
`https://paraloncloud.com/v1`

Historical main model:
`qwen3.8-27b`

Historical Alice API response actually returned:
`Qwen/Qwen3-4B-AWQ`

Older project experiments also used Hugging Face Router:
`https://router.huggingface.co/v1/chat/completions`

Models tested historically:
- `openai/gpt-oss-120b:fastest`
- `Qwen/Qwen2.5-VL-72B-Instruct`

A Zippo lighter image was successfully analyzed through the older Hugging Face/Vision path.

Do not state that OpenAI, Gemini, DeepSeek, or other providers are currently connected unless verified from the current backend configuration.

Never store or publish API keys/tokens in GitHub or this archive.

## 10. ALICE / «МОЙ AI» — CRITICAL PART OF THE PRODUCT

Published Yandex Dialogs skill:
`Мой AI`

The skill was successfully published and the user received Yandex confirmation email.

Voice:
Alice, male voice assigned/published.

Historical webhook:
`https://aliceq.ru/alice`

Alice project:
`/root/alice-ai`

Alice Node.js service:
`alice-ai.service`

Port:
`127.0.0.1:3011`

Cloudflare named tunnel:
Name `alice-ai`
ID `536ea937-55d5-4b46-ad52-2fe55750bd9f`

Domain:
`aliceq.ru`

Historical chain was actually verified:
Alice → «Мой AI» → aliceq.ru → Cloudflare → alice-ai → ParalonCloud → Qwen → Alice.

Control tests that passed:
- «Кто тебя создал?» → «Меня создал Roman.»
- «Как тебя зовут?» → «Мой AI»
- «216 плюс 15? Ответь только числом.» → `231`

Session history was implemented through `session_id` and a follow-up was able to recall the earlier result.

The Alice system instruction explicitly defined:
- AI is called «Мой AI»;
- it is not Alice;
- Alice is the voice interface;
- creator is Roman;
- do not claim Alibaba Cloud created the AI;
- do not reveal `<think>`.

Known historical NLP limitation:
a continuation such as «прибавь к этому 15» once produced `216 +` while the direct arithmetic wording produced `231`. This was a model/NLP quality issue, not a connectivity failure.

Known historical Yandex timing limitation:
to guarantee webhook response time, the Alice server temporarily used fast predefined answers for main test phrases. Waiting synchronously for a full AI response could cause Yandex to report that the webhook did not answer in time. This is an old architectural limitation and must be re-tested before assuming the current Alice service behaves the same way.

Backups historically created:
- `/root/alice-ai/server.js.backup-2026-08-30`
- `/root/alice-ai/server.js.backup-before-identity-2026-08-30`
- other timing/Yandex backups including `server.js.before-timing`, `server.js.before-yandex-log`, `server.js.final-backup`.

IMPORTANT DECISION:
Do not destroy or casually replace the published working Alice skill. The correct path is to preserve the existing skill and gradually turn its `/alice` backend into an adapter to the central My AI Unified Dispatcher.

Target future architecture:
Alice → `/alice` adapter → My AI Unified Dispatcher → selected capability/model/tool → response → Alice.

The old direct Alice → Qwen path should remain as a fallback until the unified path is proven.

## 11. CLOUDFLARE / ALICE INFRASTRUCTURE

Named tunnel:
`alice-ai`
ID `536ea937-55d5-4b46-ad52-2fe55750bd9f`

Historical `aliceq.ru` DNS CNAME:
`@` → `536ea937-55d5-4b46-ad52-2fe55750bd9f.cfargotunnel.com`
Proxy: Proxied
TTL: Auto

Cloudflare dashboard historically showed tunnel Healthy with one replica and several QUIC connections.

Historical problem:
Cloudflare dashboard route creation for Published Application (опубликованное приложение) behaved inconsistently and showed `Multi-level subdomains require Advanced Certificate Manager`; navigation sometimes showed `Refresh the page to try again`. The route `aliceq.ru → http://127.0.0.1:3011` was not consistently confirmed in that archive.

Do not Rotate token, reinstall cloudflared, or replace the named tunnel without a concrete reason and backup.

There is also a separate **Quick Tunnel** used for the main My AI Unified public frontend. Do not confuse it with the named Alice tunnel.

## 12. WHAT «ЧТОКУПИТЬ AI» ALREADY CONTRIBUTED

Original product:
mobile-first iPhone-oriented web app:
Camera/gallery → product image → AI identification → search actual offers/prices in Russia.

Stores historically integrated/tested:
- Wildberries
- AliExpress
- Yandex Market
- Ozon
- DNS

Older API:
`/root/chto-kupit-ai-api`, port 3000.

Historical AI:
Hugging Face Router and Vision models.

Historical shopping fixes:
- Wildberries price extraction could incorrectly turn `595 ₽` into `1`; extraction logic was fixed in old work.
- links could arrive as Markdown-wrapped URLs instead of plain URLs; this was fixed in old work.
- these fixes must be verified against the current implementation before claiming they still exist.

The old shopping app also had camera diagnostics and UI versions. Safari camera issues included `NotAllowedError`. HTTPS, Secure Context and `getUserMedia` were available; the problem was associated with Safari/iOS camera permission. Do not break a working iPhone camera path while refactoring.

## 13. MEDIA / VIDEO

FFmpeg was installed on the VPS; historical version:
8.0.1.

ImageMagick:
7.1.2.

Media directories were created:
- `media/input`
- `media/output`
- `media/temp`

The unified project historically connected a working FFmpeg video module and the health model expected `video=true`.

There are many server.js video backups. Do not delete backups.

## 14. DOCUMENTS / PDF

The intended product includes documents/PDF and tables.

Current frontend explicitly says PDF is not fully connected.
Therefore:
- do not tell the user PDF/document support is complete;
- document capability remains a target/incomplete area until end-to-end verification.

## 15. SECURITY / OPERATING RULES

Never put secrets, tokens or API keys into GitHub, public files, or chat archives.

Do not expose `HF_TOKEN`, `PARALON_API_KEY`, `SERPER_API_KEY`, Cloudflare tokens, SSH keys or similar secrets.

External purchases, deletions, publication actions, messages and consequential infrastructure changes require user confirmation where applicable.

Do not modify VPN/Xray unless specifically working on that task. The VPN is separate infrastructure and should not be casually changed during My AI Unified work.

Do not delete backups.

## 16. WORKING STYLE REQUIRED FOR FUTURE CHATS

The user is Russian-speaking and not a programmer.

Instructions must be:
- short;
- concrete;
- one meaningful action at a time when manual work is required;
- English technical terms accompanied by Russian translation in parentheses;
- no circular diagnostics;
- no repeated requests for information already in this archive;
- do not ask the user to redo work that is already recorded;
- use automation/tools whenever possible instead of making the user manually copy large outputs from Termius;
- do not say «Готово» until the relevant layer is actually tested.

Because the user can be interrupted by phone calls, keep persistent checkpoints.

Checkpoint rule:
every 5 assistant messages.

Markers:
🟢 ready/done
🟡 process
🔴 problem
🔵 next step
🟣 important decision
⚪ context

## 17. TRUTHFULNESS / VERIFICATION RULE

Always separate:
A) confirmed by repository/history;
B) confirmed by automated workflow;
C) confirmed on the user's iPhone/Safari;
D) known limitation/unverified state.

A historical successful test is not automatically proof of current availability.

Never claim «everything is fixed» without end-to-end verification.

## 18. CURRENT PRIORITY / CORRECT NEXT ROADMAP

Do NOT restart from «ЧтоКупить AI» or spend the next work cycle on cosmetic Safari issues unless they block the main goal.

Priority:
1. Verify the current canonical GitHub Actions result and current public Pages locator.
2. Verify the actual main My AI Unified backend health and dispatcher state.
3. Verify public end-to-end chat, shopping and photo.
4. Verify the current Alice skill/webhook without breaking the existing working path.
5. Build the Alice `/alice` adapter to the central My AI Unified Dispatcher.
6. Keep the old Alice direct-AI path as fallback until the unified path is proven.
7. Make natural-language routing reliable across chat, web, shopping, vision, video, documents, tables, code and verification.
8. Solve Alice/Yandex response-time architecture properly (fast acknowledgement/async or another compliant design) instead of relying indefinitely on canned test answers.
9. Add PDF/document and other missing capabilities only after the core unified path is stable.
10. Later package the product for App Store / Google Play if desired.

## 19. NEW-CHAT START INSTRUCTION

When this archive is available in a new chat, begin with:

«Продолжаем My AI Unified по MY_AI_UNIFIED_GLOBAL_ARCHIVE.md. Это не новый проект. Сначала используй архив как источник контекста, затем проверь только актуальное состояние. Не заставляй меня повторять историю. Помни: My AI Unified — центральный Dispatcher, Alice/«Мой AI» — голосовой интерфейс/адаптер, «ЧтоКупить AI» — только shopping-модуль. Не ломай существующую Alice-связку и не начинай с нуля.»

Then verify the current repository/workflow/backend state before changing anything.

## 20. FINAL STATUS AT ARCHIVE CREATION

🟢 The project has a persistent global state in GitHub (`PROJECT_STATE.md`) and this more comprehensive historical archive.

🟢 The repository currently records a verified full-chain Quick Tunnel locator in `api.json`.

🟢 The canonical repair workflow exists and is designed to be the single owner of public-chain repair/deployment.

🟢 The published Alice skill «Мой AI» and its historical working architecture are preserved in the project context.

🟡 The complete final product — one universal My AI Unified brain behind both the web interface and Alice voice interface — is NOT yet declared finished.

🟡 Current end-to-end state of every capability must be re-verified before claiming production readiness.

🔴 The main unfinished architectural milestone is the real integration:
Alice → My AI Unified Dispatcher → correct tool/model → Alice response.

🔵 That integration is the next major product milestone, after confirming the current public/backend state.

🟣 The central product identity must never again be reduced to «ЧтоКупить AI»: it is **My AI Unified**, with Alice as the voice gateway and shopping as one module.
