import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { hasCalculatedChart, localDateInputValue, serviceErrorMessage } from '../src/lib/service-results.ts';

test('metadata and empty chart placeholders cannot be treated as a calculated kundali', () => {
  assert.equal(hasCalculatedChart({ message: 'Saved', kundali_id: 'test-id' }), false);
  assert.equal(hasCalculatedChart({ houses: Array.from({ length: 12 }, () => ({})) }), false);
  assert.equal(hasCalculatedChart({ houses: [{ sign: 'Aries', planets: ['Sun'] }] }), true);
});

test('missing service setup is described without exposing internal configuration', () => {
  const message = serviceErrorMessage({ status: 'configuration_required', missing: ['MONGODB_URI'] });
  assert.match(message, /temporarily unavailable/i);
  assert.doesNotMatch(message, /MONGODB_URI|configuration_required/);
});

test('backend validation and business errors stay visible', () => {
  assert.equal(serviceErrorMessage({ detail: 'Please sign in first.' }), 'Please sign in first.');
  assert.equal(serviceErrorMessage({ message: 'No timings found.' }), 'No timings found.');
  assert.match(serviceErrorMessage({ detail: [{ msg: 'required' }] }), /jaankari/);
  assert.equal(serviceErrorMessage({}), null);
});

test('date inputs use the visitor local day at the India UTC boundary', () => {
  const helperUrl = new URL('../src/lib/service-results.ts', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { localDateInputValue } from ${JSON.stringify(helperUrl)}; console.log(localDateInputValue(new Date('2026-10-26T19:00:00Z')))`],
    { env: { ...process.env, TZ: 'Asia/Kolkata' }, encoding: 'utf8' });
  assert.equal(output.trim(), '2026-10-27');
  assert.equal(localDateInputValue(new Date(2026, 0, 2, 12)), '2026-01-02');
});
