# My AI Unified — глобальный контрольный пункт

Дата: 2026-09-07

## Архитектура
- iPhone → Cloudflare → `ai.aliceq.ru` → My AI Unified на VPS `127.0.0.1:3020`.
- `aliceq.ru` → старый Alice-сервис `127.0.0.1:3011`. Не менять без отдельного решения.
- My AI Unified — мозг/диспетчер.
- Alice — интерфейс голосового ввода/вывода.

## Рабочее состояние
- `my-ai-unified.service`: active/running.
- Порт `3020`: listening.
- Локальный `/health`: HTTP 200.
- Публичный `https://ai.aliceq.ru/health`: HTTP 200.
- Обычный `/chat`: HTTP 200, route `chat`.
- Web search через Serper: HTTP 200, route `web_search`.
- Исправлена критическая ошибка маршрутизации: `/chat` теперь получает текст пользователя из `messages`, если отдельный `prompt` не передан.

## Git checkpoints
- `9d803d5` — identity/system prompt fix.
- `605ecda795b6d37510c1b24b39ae53fb18ca5a71` — Fix chat routing from message history.
- `d88e15265f2e02c5b805e35352b77f836cf5ca4e` — Add AI synthesis for web search results.

## Текущий шаг
Web search теперь должен:
1. выполнить поиск через Serper;
2. передать найденные результаты Paralon;
3. получить нормальный ответ на русском;
4. вернуть `result` + список `sources`.

На VPS после этого коммита нужно выполнить `git pull` и перезапустить `my-ai-unified.service`, затем проверить публичный `/chat` с запросом актуальной информации.

## Следующие проверки
После успешного web search проверить по очереди:
1. chat
2. web search
3. shopping
4. code
5. photo/vision
6. documents
7. video
8. voice/STT
9. verification
10. image generation — только после подтверждения реально работающего адаптера, не считать capability в `capabilities.json` доказательством работы.

## Известная проблема
6 сентября зафиксирована ошибка STT/faster-whisper при обработке входного `.webm`: `InvalidDataError: Invalid data found when processing input`. Это историческая ошибка и требует отдельного ремонта voice/STT.

## Важные ограничения
- Не использовать Puter.
- Не использовать Zapier.
- Не использовать Custom GPT Actions.
- Не строить полноценный Custom MCP.
- Не трогать старые сервисы `:3000`, `:3010`, `:3011` без необходимости.
- Не восстанавливать VPS stash `backup-before-my-ai-unified-fix` без отдельного решения.

## Env
- `PARALON_API_KEY`: установлен.
- `SERPER_API_KEY`: установлен.
- `PARALON_BASE_URL`: не задан, используется default `https://paraloncloud.com/v1`.
- `PARALON_MODEL`: не задан, используется default `qwen3.8-27b`.
