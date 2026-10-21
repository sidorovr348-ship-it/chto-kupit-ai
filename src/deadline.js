'use strict';

function createDeadline(timeoutMs, message, code) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = Object.assign(new Error(message), { status: 504, code });
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });
  return {
    promise,
    clear() {
      clearTimeout(timer);
    }
  };
}

module.exports = { createDeadline };
