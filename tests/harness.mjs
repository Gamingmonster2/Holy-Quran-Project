/**
 * Zero-dependency test harness.
 *
 * The Android project used JUnit + Truth; this environment has no package
 * registry, so the tiny surface those tests actually needed (registration,
 * assertions, per-test isolation) is implemented here.
 */
import assert from 'node:assert/strict';

/** @type {{name:string, fn:() => any}[]} */
const registry = [];

/**
 * Register a test. Name it as a sentence describing the behaviour, e.g.
 * ``test('returns empty list when no bookmarks exist', ...)``.
 * @param {string} name
 * @param {() => any} fn
 */
export function test(name, fn) {
  registry.push({ name, fn });
}

/** Forget every registered test (used when a runner re-imports modules). */
export function resetRegistry() {
  registry.length = 0;
}

/**
 * Run everything registered so far.
 * @returns {Promise<{total:number, passed:number, failures:{name:string, error:Error}[],
 *   durationMs:number}>}
 */
export async function runRegistered() {
  const startedAt = performance.now();
  let passed = 0;
  /** @type {{name:string, error:Error}[]} */
  const failures = [];

  for (const { name, fn } of registry) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await fn();
      passed += 1;
    } catch (error) {
      failures.push({ name, error });
    }
  }

  return {
    total: registry.length,
    passed,
    failures,
    durationMs: performance.now() - startedAt,
  };
}

// ------------------------------------------------------------------ assertions

/** @param {unknown} actual @param {unknown} expected @param {string} [message] */
export function assertEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

/** @param {unknown} actual @param {unknown} expected @param {string} [message] */
export function assertDeepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

/** @param {unknown} value @param {string} [message] */
export function assertTrue(value, message) {
  assert.ok(value, message ?? `expected truthy, got ${JSON.stringify(value)}`);
}

/** @param {unknown} value @param {string} [message] */
export function assertFalse(value, message) {
  assert.ok(!value, message ?? `expected falsy, got ${JSON.stringify(value)}`);
}

/** @param {() => any} fn @param {string} [message] */
export function assertThrows(fn, message) {
  assert.throws(fn, undefined, message);
}

/** Await a rejected async call. @param {() => Promise<any>} fn @param {string} [message] */
export async function assertRejects(fn, message) {
  await assert.rejects(fn, undefined, message);
}

/** @param {string} haystack @param {string} needle */
export function assertIncludes(haystack, needle) {
  assert.ok(
    String(haystack).includes(needle),
    `expected ${JSON.stringify(String(haystack).slice(0, 120))} to include ${JSON.stringify(needle)}`,
  );
}

/** @param {number} actual @param {number} expected */
export function assertAtLeast(actual, expected) {
  assert.ok(actual >= expected, `expected ${actual} >= ${expected}`);
}

/**
 * Build a `fetch`-shaped stub from a route table.
 * @param {Record<string, any | (() => any)>} routes url substring → JSON payload
 * @param {{failOn?: string[]}} [options]
 */
export function fakeFetch(routes, options = {}) {
  const calls = [];
  const failOn = options.failOn ?? [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (failOn.some((fragment) => String(url).includes(fragment))) {
      throw new TypeError('network down');
    }
    const key = Object.keys(routes).find((fragment) => String(url).includes(fragment));
    if (!key) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    const value = routes[key];
    const payload = typeof value === 'function' ? value(url) : value;
    return { ok: true, status: 200, json: async () => payload };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

export { assert };
