const clipboardy = require("clipboardy");

async function waitForClipboard(expected, options = {}) {
  const timeoutMs = options.timeoutMs ?? 3000;
  const intervalMs = options.intervalMs ?? 25;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const current = await clipboardy.read();
    if (current === expected) {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const current = await clipboardy.read();
  throw new Error(
    `Clipboard did not reach the expected state within ${timeoutMs}ms.\n` +
      `Expected: ${JSON.stringify(expected)}\n` +
      `Current: ${JSON.stringify(current)}`
  );
}

/**
 * Sets a known clipboard baseline and waits until the OS clipboard matches it.
 */
async function establishClipboardBaseline(options = {}) {
  const baseline =
    options.baseline ??
    `secrez-clipboard-${process.pid}-${Date.now()}\n`;

  if (options.drainClipboardQueue) {
    await options.drainClipboardQueue();
  }

  await clipboardy.write(baseline);
  await waitForClipboard(baseline, options);
  return baseline;
}

/**
 * Waits until the clipboard matches the test baseline again.
 * If it does not recover in time, forces the baseline and waits once more.
 */
async function ensureClipboardBaseline(baseline, options = {}) {
  if (options.drainClipboardQueue) {
    await options.drainClipboardQueue();
  }

  try {
    await waitForClipboard(baseline, options);
  } catch (e) {
    await clipboardy.write(baseline);
    await waitForClipboard(baseline, {
      ...options,
      timeoutMs: options.forceTimeoutMs ?? 1000,
    });
  }
}

/**
 * Shared clipboard state for a test suite.
 * Call setUp in beforeEach and tearDown in afterEach.
 */
function createClipboardTestContext(options = {}) {
  let clipboardBaseline;

  return {
    getBaseline() {
      return clipboardBaseline;
    },
    async setUp() {
      clipboardBaseline = await establishClipboardBaseline(options);
    },
    async tearDown(tearDownOptions = {}) {
      if (!clipboardBaseline) {
        return;
      }
      await ensureClipboardBaseline(clipboardBaseline, {
        ...options,
        ...tearDownOptions,
      });
    },
  };
}

module.exports = {
  waitForClipboard,
  establishClipboardBaseline,
  ensureClipboardBaseline,
  createClipboardTestContext,
};
