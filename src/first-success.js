'use strict';

// Run fallback providers concurrently, but abort every losing request as soon as
// one provider returns a usable answer. Tasks must pass the signal to their I/O.
async function firstSuccessful(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    throw new AggregateError([], 'No fallback providers available');
  }
  const controller = new AbortController();
  const pending = tasks.map(task => Promise.resolve().then(() => task(controller.signal)));
  try {
    return await Promise.any(pending);
  } finally {
    controller.abort();
  }
}

module.exports = { firstSuccessful };
