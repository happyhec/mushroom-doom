import test from 'node:test';
import assert from 'node:assert/strict';
import { BANTER_LINES, PlumberBanter } from '../src/banter.js';

function harness() {
  let time = 0;
  const lines = [];
  const banter = new PlumberBanter({ onLine: line => lines.push(line), now: () => time, random: () => 0 });
  return { banter, lines, advance: ms => { time += ms; } };
}

function fakeSpeech(t) {
  const previousSynthesis = globalThis.speechSynthesis;
  const previousUtterance = globalThis.SpeechSynthesisUtterance;
  const spoken = [];
  let canceled = 0;
  const english = { lang: 'en-US', localService: true, default: true };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.speechSynthesis = {
    speaking: false, pending: false,
    getVoices: () => [{ lang: 'de-DE', localService: true }, english],
    speak: utterance => { spoken.push(utterance); },
    cancel: () => { canceled++; },
  };
  t.after(() => {
    if (previousSynthesis === undefined) delete globalThis.speechSynthesis;
    else globalThis.speechSynthesis = previousSynthesis;
    if (previousUtterance === undefined) delete globalThis.SpeechSynthesisUtterance;
    else globalThis.SpeechSynthesisUtterance = previousUtterance;
  });
  return { spoken, english, canceled: () => canceled };
}

test('routine banter uses one global cooldown across different combat events', () => {
  const h = harness();
  assert.ok(h.banter.play('killGoomba'));
  assert.equal(h.banter.play('ammo'), null);
  h.advance(6999);
  assert.equal(h.banter.play('hurt'), null);
  h.advance(1);
  assert.ok(h.banter.play('armor'));
  assert.equal(h.lines.length, 2);
});

test('small event pools rotate without repeating any of the previous five lines', () => {
  const h = harness();
  for (let i = 0; i < 25; i++) {
    const lastFive = h.lines.slice(-5);
    const next = h.banter.play('health');
    assert.ok(next);
    assert.equal(lastFive.includes(next), false);
    h.advance(7000);
  }
});

test('major story beats bypass cooldown and use the requested level setting', () => {
  const h = harness();
  h.banter.play('kill');
  assert.match(h.banter.play('levelStart', { level: 1 }), /pipes|plumbing/i);
  assert.match(h.banter.play('levelStart', { level: 2 }), /midnight|haunted/i);
  assert.ok(h.banter.play('bossIntro'));
  assert.equal(h.banter.play('killGoomba'), null);
});

test('disabled speech and mute retain captions while preventing voice output', t => {
  const speech = fakeSpeech(t);
  const h = harness();
  h.banter.setEnabled(false);
  const disabledLine = h.banter.play('levelStart');
  assert.equal(h.lines.at(-1), disabledLine);
  assert.equal(speech.spoken.length, 0);
  h.banter.setEnabled(true);
  h.banter.setMuted(true);
  assert.ok(h.banter.play('levelClear'));
  assert.equal(speech.spoken.length, 0);
  h.banter.setMuted(false);
  h.banter.setVolume(.8);
  h.banter.play('finalWin');
  assert.equal(speech.spoken.length, 1);
  assert.equal(speech.spoken[0].voice, speech.english);
  assert.equal(speech.spoken[0].volume, .8 * .65);
});

test('speech never accumulates stale ordinary lines, and priority replaces old speech', t => {
  const speech = fakeSpeech(t);
  const h = harness();
  h.banter.play('kill');
  globalThis.speechSynthesis.speaking = true;
  h.advance(7000);
  h.banter.play('ammo');
  assert.equal(h.lines.length, 2);
  assert.equal(speech.spoken.length, 1);
  h.banter.play('bossIntro');
  assert.equal(speech.canceled(), 1);
  assert.equal(speech.spoken.length, 2);
  h.banter.stop();
  assert.equal(speech.canceled(), 2);
});

test('speech failures leave the caption and game-facing return value intact', t => {
  fakeSpeech(t);
  globalThis.speechSynthesis.speak = () => { throw new Error('Browser speech unavailable'); };
  const h = harness();
  const line = h.banter.play('secret');
  assert.ok(line);
  assert.deepEqual(h.lines, [line]);
  assert.equal(h.banter.utterance, null);
});

test('reset allows fresh campaign banter and unknown events do not consume cooldown', () => {
  const h = harness();
  assert.equal(h.banter.play('unknown'), null);
  const first = h.banter.play('killKoopa');
  h.banter.reset();
  assert.equal(h.banter.play('killKoopa'), first);
  assert.ok(Object.values(BANTER_LINES).flat().length >= 30);
});
