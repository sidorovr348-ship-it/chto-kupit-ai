'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

function mockComposio(assertConfig = true, connected = true, candidate = true, schemaKnown = true) {
  const calls = { execute: [], created: [] };
  return {
    calls,
    load: async () => ({
      Composio: class {
        constructor(options) { assert.equal(options.apiKey, 'test-api-key'); }
        sessions = {
          create: async (userId, config) => {
            assert.equal(userId, 'ey-owner');
            if (assertConfig) {
              assert.deepEqual(config.toolkits, ['github']);
              assert.deepEqual(config.tags, { enabled: ['readOnlyHint'] });
              assert.equal(config.manageConnections, true);
            }
            calls.created.push({ userId, config });
            return {
              authorize: async (toolkit, options) => {
                assert.equal(toolkit, 'github');
                if (options?.callbackUrl) assert.match(options.callbackUrl, /^https:\/\/.+\.vercel\.app\/composio-connect\.html$/);
                return { redirectUrl: 'https://connect.example.test/oauth' };
              },
              toolkits: async () => ({ items: [{ slug: 'github', connection: { isActive: connected, connectedAccount: { status: connected ? 'ACTIVE' : 'INITIATED', id: 'private-id' } } }] }),
              search: async (params) => {
                assert.equal(params.toolkits[0], 'github');
                return { tools: candidate ? [{
                  slug: 'GITHUB_GET_AUTHENTICATED_USER',
                  name: 'Get Authenticated User',
                  description: 'Read the currently authenticated GitHub user profile',
                  tags: ['readOnlyHint'],
                  inputParameters: schemaKnown ? { type: 'object', properties: {}, required: [] } : { type: 'object', properties: {} }
                }] : [{
                  slug: 'GITHUB_DELETE_REPOSITORY',
                  name: 'Delete Repository',
                  description: 'Delete a repository',
                  tags: ['destructiveHint'],
                  inputParameters: { type: 'object', properties: { owner: { type: 'string' } }, required: ['owner'] }
                }] };
              },
              execute: async (slug, args) => {
                calls.execute.push({ slug, args });
                return { resultType: 'completed', data: { login: 'ey-owner', access_token: 'must-not-leak', profile: { name: 'Owner' } } };
              },
              delete: async () => {}
            };
          }
        };
      }
    })
  };
}

async function setup(t, mock) {
  const previous = {
    env: process.env.VERCEL_ENV,
    branch: process.env.VERCEL_GIT_COMMIT_REF,
    owner: process.env.COMPOSIO_OWNER_TOKEN,
    api: process.env.COMPOSIO_API_KEY,
    vercelUrl: process.env.VERCEL_URL
  };
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_GIT_COMMIT_REF = 'feat/unified-open-models-video';
  process.env.COMPOSIO_OWNER_TOKEN = 'test-owner-token';
  process.env.COMPOSIO_API_KEY = 'test-api-key';
  process.env.VERCEL_URL = 'test-preview.vercel.app';
  const app = express();
  require('./composio-preview')(app, { loadComposio: mock.load });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries({
      VERCEL_ENV: previous.env, VERCEL_GIT_COMMIT_REF: previous.branch,
      COMPOSIO_OWNER_TOKEN: previous.owner, COMPOSIO_API_KEY: previous.api,
      VERCEL_URL: previous.vercelUrl
    })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = (path, method = 'GET', token = 'test-owner-token') => fetch(base + path, {
    method, headers: token ? { authorization: 'Bearer ' + token } : {}
  });
  return { call, mock };
}

test('Composio connect is owner-only, Preview-only and GitHub/read-only scoped', async (t) => {
  const mock = mockComposio();
  const { call } = await setup(t, mock);
  assert.equal((await call('/api/composio/github/connect','POST','wrong-token')).status, 401);
  const response = await call('/api/composio/github/connect','POST');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, toolkit: 'github', redirectUrl: 'https://connect.example.test/oauth' });
  assert.deepEqual(mock.calls.created[0].config.toolkits, ['github']);
  assert.deepEqual(mock.calls.created[0].config.tags, { enabled: ['readOnlyHint'] });
});

test('Composio status reports only connection state and does not expose account identifiers', async (t) => {
  const mock = mockComposio();
  const { call } = await setup(t, mock);
  const response = await call('/api/composio/github/status');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, toolkit: 'github', connected: true, status: 'ACTIVE' });
});

test('Composio tools endpoint exposes GitHub tool names but no credentials', async (t) => {
  const mock = mockComposio();
  const { call } = await setup(t, mock);
  const response = await call('/api/composio/github/tools');
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.tools[0].slug, 'GITHUB_GET_AUTHENTICATED_USER');
  assert.equal(JSON.stringify(data).includes('private-id'), false);
  assert.equal(JSON.stringify(data).includes('access_token'), false);
});

test('Composio smoke executes only an authenticated, read-only, zero-input GitHub profile tool', async (t) => {
  const mock = mockComposio();
  const { call } = await setup(t, mock);
  const response = await call('/api/composio/github/smoke','POST');
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.executed, true);
  assert.equal(data.tool, 'GITHUB_GET_AUTHENTICATED_USER');
  assert.deepEqual(mock.calls.execute, [{ slug: 'GITHUB_GET_AUTHENTICATED_USER', args: {} }]);
  assert.equal(JSON.stringify(data).includes('must-not-leak'), false);
});

test('Composio smoke refuses to execute if no safe read-only profile tool is found', async (t) => {
  const mock = mockComposio(true, true, false);
  const { call } = await setup(t, mock);
  const response = await call('/api/composio/github/smoke','POST');
  assert.equal(response.status, 409);
  assert.equal(mock.calls.execute.length, 0);
});

test('Composio smoke refuses execution until GitHub is connected', async (t) => {
  const mock = mockComposio(true, false, true);
  const { call } = await setup(t, mock);
  const response = await call('/api/composio/github/smoke','POST');
  assert.equal(response.status, 409);
  assert.equal(mock.calls.execute.length, 0);
});

test('Composio routes are hidden outside the intended Preview branch', async (t) => {
  const mock = mockComposio();
  const { call } = await setup(t, mock);
  process.env.VERCEL_ENV = 'production';
  assert.equal((await call('/api/composio/github/status')).status, 404);
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_GIT_COMMIT_REF = 'another-branch';
  assert.equal((await call('/api/composio/github/tools')).status, 404);
});

test('Composio smoke fails closed when the tool schema is incomplete', async (t) => {
  const mock = mockComposio(true, true, true, false);
  const { call } = await setup(t, mock);
  const response = await call('/api/composio/github/smoke','POST');
  assert.equal(response.status, 409);
  assert.equal(mock.calls.execute.length, 0);
});
