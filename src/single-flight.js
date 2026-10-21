'use strict';

function createSingleFlight(task) {
  if (typeof task !== 'function') throw new TypeError('TASK_MUST_BE_FUNCTION');
  let inFlight = null;
  return (...args) => {
    if (inFlight) return inFlight;
    const work = Promise.resolve().then(() => task(...args));
    const tracked = work.finally(() => {
      if (inFlight === tracked) inFlight = null;
    });
    inFlight = tracked;
    return tracked;
  };
}

module.exports = { createSingleFlight };
