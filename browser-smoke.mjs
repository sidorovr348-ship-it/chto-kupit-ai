import { chromium } from 'playwright';

const PAGE = process.env.APP_URL || 'https://sidorovr348-ship-it.github.io/chto-kupit-ai/';
const API = process.env.API_URL || 'https://ai.aliceq.ru';

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
});
const context = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(`${PAGE}?smoke=${Date.now()}`, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForSelector('#send');
if (!(await page.title()).includes('My AI Unified')) throw new Error('wrong title');

const health = await page.evaluate(async api => { const r = await fetch(`${api}/health?browser_smoke=${Date.now()}`); return { status: r.status, body: await r.json() }; }, API);
if (health.status !== 200 || !health.body.ok) throw new Error(`health failed: ${JSON.stringify(health)}`);

await page.locator('#input').fill('Кто ты? Ответь одним коротким предложением.');
await page.locator('#send').click();
await page.waitForFunction(() => [...document.querySelectorAll('#chat .msg.ai')].some(x => !x.textContent.includes('⏳') && x.textContent.trim().length > 20), null, { timeout: 90000 });

await page.locator('#camera').click();
await page.waitForFunction(() => document.querySelector('#cameraBox')?.style.display === 'block' && document.querySelector('#cam')?.videoWidth > 0, null, { timeout: 15000 });
await page.locator('#camOff').click();

const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8Cf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8Cf//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8Cf//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEABj8Cf//Z', 'base64');
await page.locator('#photoInput').setInputFiles({ name: 'smoke.jpg', mimeType: 'image/jpeg', buffer: jpeg });
await page.waitForFunction(() => [...document.querySelectorAll('#chat .msg.ai')].some(x => !x.textContent.includes('⏳') && !x.textContent.includes('Готов. Напиши') && x.textContent.trim().length > 20), null, { timeout: 120000 });

if (errors.length) throw new Error(errors.join('\n'));
console.log('BROWSER_SMOKE_OK');
await browser.close();
