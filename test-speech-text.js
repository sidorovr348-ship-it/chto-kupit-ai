'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {sanitizeSpeechText}=require('./src/speech-text');

test('removes Markdown decoration while preserving spoken content',()=>{
 const result=sanitizeSpeechText('# Выбор ноутбука\n\nБюджет: **100 000 рублей**.\n- *Для работы*\n- [Модель](https://example.com)');
 assert.equal(result,'Выбор ноутбука. Бюджет: 100 000 рублей. Для работы. Модель');
});

test('keeps code content but removes code fences and inline backticks',()=>{
 assert.equal(sanitizeSpeechText('Команда: `npm test`\n```js\nconst ok = true;\n```'),'Команда: npm test. const ok = true;');
});

test('normalizes tables, URLs and repeated punctuation',()=>{
 const result=sanitizeSpeechText('| Модель | Цена |\n| --- | --- |\n| X | 100 000 ₽ |\nСайт: https://example.com/a');
 assert.equal(result,'Модель, Цена. X, 100 000 ₽. Сайт: ссылка');
});

test('returns an empty string for empty input',()=>assert.equal(sanitizeSpeechText('  '),''));

test('preserves multiplication and underscore identifiers',()=>{
 assert.equal(sanitizeSpeechText('Формула 2*2=4, поле user_name.'),'Формула 2*2=4, поле user_name.');
});
