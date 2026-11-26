'use strict';

function createProviderCancellation(timeoutMs, externalSignal = null) {
  const controller = new AbortController();
  let abortSource = null;
  let timer = null;

  const abortFromClient = () => {
    if (abortSource !== null) return;
    abortSource = 'client';
    controller.abort(externalSignal?.reason || new Error('Client disconnected'));
  };

  if (externalSignal?.aborted) {
    abortFromClient();
  } else if (externalSignal) {
    externalSignal.addEventListener('abort', abortFromClient, { once: true });
  }

  if (!controller.signal.aborted && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    timer = setTimeout(() => {
      if (abortSource !== null) return;
      abortSource = 'timeout';
      controller.abort(new Error('Provider timeout'));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    source: () => abortSource,
    clear() {
      if (timer) clearTimeout(timer);
      timer = null;
      externalSignal?.removeEventListener('abort', abortFromClient);
    }
  };
}

function createClientCancellationError() {
  return Object.assign(new Error('CHAT_REQUEST_CANCELLED'), {
    status: 499,
    code: 'CHAT_REQUEST_CANCELLED'
  });
}

module.exports = { createProviderCancellation, createClientCancellationError };
