const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatch } = require('../src/dispatcher');

test('routes image input to vision', () => {
  assert.equal(dispatch({ prompt: 'что это?', hasImage: true }), 'vision');
});

test('routes video input to video', () => {
  assert.equal(dispatch({ prompt: 'посмотри ролик', hasVideo: true }), 'video');
});

test('routes documents to documents', () => {
  assert.equal(dispatch({ prompt: 'прочитай PDF', hasFile: true }), 'documents');
});

test('routes current information to web search', () => {
  assert.equal(dispatch({ prompt: 'найди актуальные новости сегодня' }), 'web_search');
});

test('routes buying requests to shopping', () => {
  assert.equal(dispatch({ prompt: 'найди где купить товар' }), 'shopping');
});

test('routes programming requests to code', () => {
  assert.equal(dispatch({ prompt: 'напиши код на Python' }), 'code');
});

test('routes ordinary conversation to chat', () => {
  assert.equal(dispatch({ prompt: 'расскажи анекдот' }), 'chat');
});
