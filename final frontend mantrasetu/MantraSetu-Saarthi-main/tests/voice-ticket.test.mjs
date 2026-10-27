import test from 'node:test';
import assert from 'node:assert/strict';
import { requestVoiceTicketWithRetry } from '../src/lib/voice-ticket.ts';

test('a service waking with 503 gets one retry and returns the real ticket', async () => {
  let calls = 0;
  const result = await requestVoiceTicketWithRetry(async () => {
    if (++calls === 1) throw {status:503,data:{status:'service_unavailable'}};
    return {ticket:'test-ticket'};
  }, () => true, async () => {});
  assert.equal(result.ticket, 'test-ticket');
  assert.equal(calls, 2);
});

test('permanent setup, authentication and rate-limit errors are not retried', async () => {
  for (const error of [{status:503,data:{status:'configuration_required'}},{status:401},{status:429}]) {
    let calls = 0;
    await assert.rejects(requestVoiceTicketWithRetry(async () => {calls++; throw error;}, () => true, async () => {}));
    assert.equal(calls, 1);
  }
});

test('a cancelled attempt cannot reconnect after the wait', async () => {
  let active = true, calls = 0;
  const result = await requestVoiceTicketWithRetry(async () => {calls++; throw {status:503};}, () => active, async () => {active=false;});
  assert.equal(result, null);
  assert.equal(calls, 1);
});

test('persistent temporary failure stops after two requests', async () => {
  let calls = 0;
  await assert.rejects(requestVoiceTicketWithRetry(async () => {calls++; throw {code:'ETIMEDOUT'};}, () => true, async () => {}));
  assert.equal(calls, 2);
});

test('a ticket from a cancelled request is discarded', async () => {
  let active = true;
  assert.equal(await requestVoiceTicketWithRetry(async () => {active=false; return {ticket:'stale'};}, () => active), null);
});
