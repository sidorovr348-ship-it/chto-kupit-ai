# My AI Unified — GLOBAL PROJECT STATE

Last updated: 2026-09-14

## ЦЕЛЬ
Рабочий русскоязычный универсальный помощник для iPhone + Android с последующей публикацией в App Store и Google Play. «ЧтоКупить AI» — модуль покупок. Alice — голосовой адаптер.

## КОД
GitHub: sidorovr348-ship-it/chto-kupit-ai, main.
Основной AI: Groq openai/gpt-oss-120b.
Vision: Groq qwen/qwen3.6-27b.
TTS: node-edge-tts, ru-RU-SvetlanaNeural.
Поиск: Serper.
Документы: PDF/DOCX/XLSX/XLS + текстовые форматы.
Генерация изображений: OpenAI API при наличии ключа на VPS; без ключа функция честно сообщает, что не настроена.

## VPS
My AI Unified: /root/my-ai-unified, 127.0.0.1:3020, my-ai-unified.service.
Публичный API: https://ai.aliceq.ru
Alice: /root/alice-ai, 127.0.0.1:3011, alice-ai.service, https://aliceq.ru/alice
VPN/Xray не трогать.

## UI
index.html — мобильный web-интерфейс: чат, поиск, товары, до 5 фото, задняя камера, снимок, video-кадры 4/7/10 сек, документы, генерация изображения, голосовой ввод, TTS и stop.
Важно: это пока мобильное web-приложение, а не подписанный нативный пакет iOS/Android.

## ПРОВЕРКИ
В main есть обязательный source smoke-test перед production deploy: node --check + node --test test-local-gateway.js.
Отдельный CI ранее подтвердил 13 тестов, публичный /photo через qwen/qwen3.6-27b и публичный /tts с валидным MP3.
Новый production deploy запускается этим commit; после него результат нужно проверять фактически.

## ЧЕСТНЫЙ СТАТУС
Нельзя считать iPhone/Safari камеру, video, shopping, документы, image generation и нативную упаковку полностью проверенными только по наличию кода. Каждый слой подтверждается отдельным реальным тестом.

## ПРАВИЛА
Не хранить секреты в GitHub. Не удалять резервные копии. Не менять Cloudflare Tunnel автоматически. Не использовать VK, Yandex, MAX, Mail.ru, 2GIS, Puter или Pollinations для обхода требований проекта.
