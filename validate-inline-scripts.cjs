'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('smart-index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if (scripts.length < 2) throw new Error('Expected app and wake-listener inline scripts');
for (let i = 0; i < scripts.length; i++) {
  new vm.Script(scripts[i][1], { filename: 'smart-index.inline-' + (i + 1) + '.js' });
  console.log('INLINE_SCRIPT_SYNTAX_OK ' + (i + 1));
}
