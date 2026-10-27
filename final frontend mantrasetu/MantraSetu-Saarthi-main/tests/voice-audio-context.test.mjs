import test from 'node:test';
import assert from 'node:assert/strict';
import { unlockVoiceAudio } from '../src/lib/voice-audio-context.ts';

test('speaker and capture contexts are both resumed inside the original click', () => {
  const calls = [];
  const create = rate => ({state:'suspended', resume() { calls.push(['resume',rate]); return new Promise(()=>{}); }});
  const result = unlockVoiceAudio(null,null,create,()=>assert.fail('unexpected error'));
  assert.deepEqual(calls,[['resume',24000],['resume',16000]]);
  assert.ok(result.playback && result.capture);
});
test('an active microphone context is reused instead of replacing its unlocked graph', () => {
  const playback = {state:'running',resume:async()=>{}};
  const capture = {state:'running',resume:async()=>{}};
  const result = unlockVoiceAudio(playback,capture,()=>assert.fail('must reuse'),()=>{});
  assert.equal(result.playback,playback);
  assert.equal(result.capture,capture);
});
test('unsupported capture rates fall back to the device rate without losing activation', () => {
  const rates=[];
  unlockVoiceAudio(null,null,rate=>{
    rates.push(rate);
    if(rate===16000) throw Error('rate unsupported');
    return {state:'running',resume:async()=>{}};
  },()=>{});
  assert.deepEqual(rates,[24000,16000,undefined]);
});
test('resume denial is reported without an unhandled promise rejection', async () => {
  let errors=0;
  unlockVoiceAudio(null,null,()=>({state:'suspended',resume:()=>Promise.reject(Error('denied'))}),()=>errors++);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(errors,2);
});
