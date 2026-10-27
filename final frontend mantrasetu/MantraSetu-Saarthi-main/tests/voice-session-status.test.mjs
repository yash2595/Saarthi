import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceSessionStatus, voiceTicketErrorMessage } from '../src/lib/voice-session-status.ts';

const ready = {enabled:true,connected:true,sessionReady:true,microphoneReady:true,error:null};
test('voice is ready only after transport, handshake and microphone succeed', () => {
  assert.equal(voiceSessionStatus(ready).phase, 'ready');
  assert.equal(voiceSessionStatus({...ready,enabled:false}).phase, 'off');
  assert.equal(voiceSessionStatus({...ready,connected:false}).phase, 'connecting');
  assert.equal(voiceSessionStatus({...ready,sessionReady:false}).phase, 'connecting');
  assert.equal(voiceSessionStatus({...ready,microphoneReady:false}).phase, 'microphone');
});
test('an error overrides stale ready/listening state and goes away when voice is stopped', () => {
  const input = {...ready,error:'Service unavailable'};
  assert.equal(voiceSessionStatus(input).phase, 'failed');
  assert.equal(voiceSessionStatus(input).message, input.error);
  assert.equal(voiceSessionStatus({...input,enabled:false}).phase, 'off');
});
test('setup failures and slow starts explain why the assistant cannot speak', () => {
  assert.match(voiceTicketErrorMessage({status:'configuration_required'}), /setup abhi poora nahi/);
  assert.match(voiceTicketErrorMessage(undefined,'ECONNABORTED'), /samay lag raha/);
  assert.match(voiceTicketErrorMessage(), /connection nahi/);
});
