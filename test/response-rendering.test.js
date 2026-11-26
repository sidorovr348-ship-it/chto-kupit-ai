'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('chat UI visibly marks degraded fallback responses before rendering their content', () => {
  const html = fs.readFileSync('smart-index.html', 'utf8');
  const chatStart = html.indexOf("let j=await api('/chat'");
  assert.ok(chatStart >= 0, 'chat request must remain discoverable');
  const warning = html.indexOf('if(j.warning)', chatStart);
  const imageBranch = html.indexOf('if(j.images&&j.images.length)', chatStart);
  assert.ok(warning > chatStart && warning < imageBranch, 'degraded response warning must be rendered before normal result branches');
  assert.ok(html.includes('Основной AI-канал не ответил вовремя'), 'timeout fallback must be clearly identified to the user');
  assert.ok(html.includes('Ответ подготовлен резервным AI-каналом'), 'provider fallback must be identified as degraded');
});
