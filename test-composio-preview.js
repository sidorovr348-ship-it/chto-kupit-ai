'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');
const express = require('express');

test('Composio GitHub connect is owner-only and Preview-branch-only', async () => {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === '@composio/core') {
      return { Composio: class {
        sessions = { create: async (userId) => {
          assert.equal(userId, 'ey-owner');
          return { authorize: async (toolkit) => {
            assert.equal(toolkit, 'github');
            return { redirectUrl: 'https://connect.example.test/oauth' };
          }};
        }};
      }};
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  const previous = {
    env: process.env.VERCEL_ENV,
    branch: process.env.VERCEL_GIT_COMMIT_REF,
    owner: process.env.COMPOSIO_OWNER_TOKEN,
    api: process.env.COMPOSIO_API_KEY
  };

  const app = express();
  require('./composio-preview')(app);
  const server = app.listen(0, '127.0.0.1');

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const url = 'http://127.0.0.1:' + server.address().port + '/api/composio/github/connect';
    const call = (token) => fetch(url, {
      method: 'POST',
      headers: token ? { authorization: 'Bearer ' + token } : {}
    });

    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_GIT_COMMIT_REF = 'feat/unified-open-models-video';
    process.env.COMPOSIO_OWNER_TOKEN = 'test-owner-token';
    process.env.COMPOSIO_API_KEY = 'test-api-key';
    assert.equal((await call('test-owner-token')).status, 404);

    process.env.VERCEL_ENV = 'preview';
    assert.equal((await call()).status, 401);
    assert.equal((await call('wrong-token')).status, 401);

    process.env.VERCEL_GIT_COMMIT_REF = 'another-branch';
    assert.equal((await call('test-owner-token')).status, 404);

    process.env.VERCEL_GIT_COMMIT_REF = 'feat/unified-open-models-video';
    delete process.env.COMPOSIO_API_KEY;
    assert.equal((await call('test-owner-token')).status, 503);

    process.env.COMPOSIO_API_KEY = 'test-api-key';
    const response = await call('test-owner-token');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      toolkit: 'github',
      redirectUrl: 'https://connect.example.test/oauth'
    });
  } finally {
    server.close();
    Module._load = originalLoad;
    for (const [key, value] of Object.entries({
      VERCEL_ENV: previous.env,
      VERCEL_GIT_COMMIT_REF: previous.branch,
      COMPOSIO_OWNER_TOKEN: previous.owner,
      COMPOSIO_API_KEY: previous.api
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
