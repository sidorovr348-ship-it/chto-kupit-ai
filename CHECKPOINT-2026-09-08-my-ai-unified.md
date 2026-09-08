# Контрольная точка My AI Unified — 08.09.2026

## Состояние
- Frontend: GitHub Pages, `app.html` — версия `2026-09-08-4`.
- Простые команды работают локально без сервера: «Кто ты?» и время Москвы.
- Backend: `https://ai.aliceq.ru`, My AI Unified на порту 3020 через постоянный Cloudflare Tunnel `alice-ai`.
- Backend dispatcher tests: 7/7 успешно.
- Health/diagnostics ранее подтверждали Node.js, интернет, Serper и Paralon.

## Текущая проблема
Запрос «Найди в Москве цену на айфон 17 про» из браузера заканчивается через 30 секунд ошибкой `сервер не ответил вовремя`.

## Найденная причина для исправления
В текущем `server.js` функция `searchShopping()` использует обычный `https://google.serper.dev/search` и фильтрует organic-результаты по доменам. Это не настоящий Shopping API и может зависать/возвращать неподходящие результаты.

## Следующий шаг
Исправить `searchShopping()` на `https://google.serper.dev/shopping`, добавить жёсткий таймаут внешнего запроса и нормализацию результатов. Затем обновить backend, перезапустить сервис, проверить `/health`, прямой `/shopping` и фронтенд-команду поиска товара.

## Что НЕ менять
- VPN/Xray/Reality.
- Старый Alice server на 3011.
- Cloudflare Tunnel `alice-ai` без необходимости.
- Vercel/Quick Tunnel.

## Последний frontend commit
`a5852a974d3ff49d241d22e400cedb2d1c7f87d0`

## Последний server.js blob SHA
`8c8281c43e4d30e5649c3100ef6a132c2d4ca79d`
