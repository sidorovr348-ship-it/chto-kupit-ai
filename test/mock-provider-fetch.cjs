'use strict';

const originalFetch = global.fetch;
let providerCall = 0;

global.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  if (String(url).startsWith('https://google.serper.dev/search') && process.env.MOCK_SEARCH_HANG === '1') {
    process.stdout.write('MOCK_SEARCH_STARTED\\n');
    await new Promise((resolve, reject) => {
      const signal = init.signal;
      const onAbort = () => {
        signal?.removeEventListener('abort', onAbort);
        process.stdout.write('MOCK_SEARCH_ABORTED\\n');
        const error = new Error('mock search request aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
  if (String(url).startsWith('https://api.groq.com/openai/v1/audio/transcriptions')) {
    process.stdout.write('MOCK_STT_STARTED\\n');
    await new Promise((resolve, reject) => {
      const signal = init.signal;
      const onAbort = () => {
        signal?.removeEventListener('abort', onAbort);
        process.stdout.write('MOCK_STT_ABORTED\\n');
        const error = new Error('mock STT request aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
  if (!String(url).startsWith('https://api.groq.com/openai/v1/chat/completions')) {
    return originalFetch(input, init);
  }

  const id = ++providerCall;
  process.stdout.write('MOCK_PROVIDER_STARTED:' + id + '\n');

  if (id === 1 && process.env.MOCK_FIRST_PROVIDER_TIMEOUT === '1') {
    process.stdout.write('MOCK_PROVIDER_TIMEOUT:' + id + '\\n');
    const error = new Error('mock provider timeout');
    error.name = 'AbortError';
    throw error;
  }

  if (id <= 4 && process.env.MOCK_FIRST_PROVIDER_TIMEOUT !== '1') {
    await new Promise((resolve, reject) => {
      const signal = init.signal;
      const onAbort = () => {
        signal?.removeEventListener('abort', onAbort);
        process.stdout.write('MOCK_PROVIDER_ABORTED:' + id + '\n');
        const error = new Error('mock provider request aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  process.stdout.write('MOCK_PROVIDER_RETURNED:' + id + '\n');
  return new Response(JSON.stringify({
    choices: [{ message: { content: 'MOCK_OK_' + id }, finish_reason: 'stop' }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
};
