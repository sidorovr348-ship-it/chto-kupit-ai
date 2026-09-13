# My AI Unified — GLOBAL PROJECT STATE

Last updated: 2026-09-13

## 1. ЦЕЛЬ
My AI Unified — рабочий русскоязычный универсальный помощник для iPhone + Android с последующей публикацией в App Store и Google Play.
Архитектура: пользователь -> Dispatcher (диспетчер/маршрутизатор) -> нужный AI/инструмент -> ответ.
«ЧтоКупить AI» — модуль покупок внутри проекта. Alice — голосовой интерфейс/адаптер.

## 2. ИСТОЧНИК КОДА
GitHub: sidorovr348-ship-it/chto-kupit-ai, main.
GitHub Pages: https://sidorovr348-ship-it.github.io/chto-kupit-ai/
Секреты в GitHub не храним. Историю и резервные копии не удаляем.

## 3. VPS
VPS: 87.121.63.153, Ubuntu 26.04 LTS, Node.js 22.22.1.
My AI Unified: /root/my-ai-unified, 127.0.0.1:3020, my-ai-unified.service.
Alice: /root/alice-ai, 127.0.0.1:3011, alice-ai.service.
VPN/Xray не трогать.

## 4. ФАКТИЧЕСКИЙ КОД MAIN НА 13.09.2026
local-gateway.js в main использует:
- основной текстовый AI: Groq openai/gpt-oss-120b;
- vision (анализ фото): Groq qwen/qwen3.6-27b;
- TTS (озвучивание): node-edge-tts, ru-RU-SvetlanaNeural;
- поиск: Serper;
- запасные текстовые провайдеры: DeepSeek -> Hugging Face -> OpenAI -> Mistral, только если соответствующий ключ реально есть на VPS;
- vision fallback: Hugging Face, только если ключ реально есть;
- /chat поддерживает до 4 изображений;
- /photo принимает до 3 изображений в одном запросе;
- /shopping пока является поисковой выдачей Serper и НЕ считается полноценным магазинным парсером.

## 5. КАНОНИЧЕСКИЙ ДЕПЛОЙ
.github/workflows/emergency-unified-deploy.yml — единственный активный production deploy: push main + ручной запуск.
Есть concurrency (защита от параллельных деплоев).
Workflow делает SSH-проверку с повторными попытками, копирует exact gateway/package, проверяет синтаксис, перезапускает systemd и выполняет локальные smoke-тесты: health/chat/photo/tts.
После этого проверяет публичные /health, /chat, /photo, /tts и Alice.
Старый final-vps-deploy.yml отключён и сам указывает использовать emergency-unified-deploy.yml.
Не менять Cloudflare Tunnel автоматически.

## 6. ЧЕГО НЕЛЬЗЯ СЧИТАТЬ ПРОВЕРЕННЫМ БЕЗ НОВОГО УСПЕШНОГО DEPLOY RUN
1. Полный публичный цикл iPhone/Safari -> ai.aliceq.ru -> backend -> Groq -> ответ.
2. Public /photo после текущей версии.
3. Public /tts после текущей версии.
4. Alice после текущей версии.
5. Shopping с корректной ценой/наличием/российскими магазинами.
6. Video 4/7/10 секунд.
7. PDF/DOCX/XLSX реальное извлечение.
8. Генерация изображений.
9. Живая задняя камера.
10. Нативная упаковка iOS/Android.

## 7. ТЕКУЩИЙ КОНТРОЛЬНЫЙ ВЫВОД
Репозиторий и workflow на месте. Текущий main содержит Groq + Qwen 3.6 + Edge TTS код.
Однако доступными инструментами сейчас нельзя честно подтвердить новый production workflow run и нельзя считать public chain проверенной только по наличию кода.
Нельзя говорить «готово», пока успешный production deploy не подтвердит smoke-тесты.

## 8. СЛЕДУЮЩИЕ ШАГИ
1. Дать emergency-unified-deploy.yml пройти автоматически после этого commit.
2. Проверить фактический workflow/deploy результат.
3. Если успешен — отдельно проверить public chat/photo/tts/Alice.
4. Затем исправить shopping, video и документы.
5. После стабилизации — iPhone frontend, камера, упаковка iOS/Android.

## 9. ПОЛИТИКА ЧЕСТНОСТИ
Всегда разделять: код в GitHub -> workflow/deploy -> публичный API -> iPhone/Safari.
Не считать слой проверенным, пока он реально не прошёл тест.

## 10. РЕЗЕРВ
Контрольное сохранение: /My AI Unified/Checkpoints/2026-09-11/MY_AI_UNIFIED_CHECKPOINT_2026-09-11.md
