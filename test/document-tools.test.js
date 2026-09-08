const test = require('node:test');
const assert = require('node:assert/strict');
const { extractDocumentText } = require('../src/document-tools');

test('extracts UTF-8 text files', async () => {
  const result = await extractDocumentText(Buffer.from('Привет\n123', 'utf8'), 'note.txt');
  assert.equal(result.kind, 'text');
  assert.match(result.text, /Привет/);
});

test('extracts CSV as a table without external services', async () => {
  const result = await extractDocumentText(Buffer.from('name,price\nphone,100', 'utf8'), 'items.csv');
  assert.equal(result.kind, 'table');
  assert.match(result.text, /name,price/);
  assert.match(result.text, /phone,100/);
});
