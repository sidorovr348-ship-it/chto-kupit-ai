'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('chat client disconnect is propagated through dispatch, slot admission, and provider fetch', () => {
  const source = fs.readFileSync('local-gateway.js', 'utf8');
  assert.match(source, /const requestAbortController=new AbortController\(\)/, 'chat route must own a cancellation controller');
  assert.match(source, /if\(!res\.writableEnded\)requestAbortController\.abort\(\)/, 'only a disconnected client may cancel active work');
  assert.match(source, /async function smartDispatch\(m,externalSignal=null\)/, 'dispatcher must accept the client signal');
  assert.match(source, /return ask\(m,false,externalSignal\)/, 'normal chat must pass cancellation to ask');
  assert.match(source, /async function askInternal\(messages,vision=false,externalSignal=null\)/, 'ask must accept cancellation');
  assert.match(source, /acquireTextSlot\(hardDeadline,externalSignal\)/, 'queued requests must be removable when the client disconnects');
  assert.match(source, /createProviderCancellation\(timeout,externalSignal\)/, 'provider fetch must combine client cancellation with its own timeout');
  assert.match(source, /cancellation\.source\(\)==='client'/, 'client cancellation must be distinguished from provider timeout');
});
