// Original lines written for this fan game. No borrowed dialogue or voice model.
export const BANTER_LINES = Object.freeze({
  killGoomba: [
    'You picked the wrong plumber to truffle with.',
    'That mushroom had a terrible attitude.',
    'Somebody order the extra crispy mushroom?',
    'Next time, try growing a personality.',
    'One less fungus among us.',
    'I prefer my mushrooms without teeth.',
  ],
  killKoopa: [
    'Your shell warranty just expired.',
    'That armor was clearly a rental.',
    'Shell shock. No extra charge.',
    'Tell your insurance it was a plumbing accident.',
    'A hard shell. A soft business plan.',
    'Keep the shell. I need a new sink.',
  ],
  killBoo: [
    'Ghost problem? I charge extra for exorcisms.',
    'You are haunting the wrong contractor.',
    'Even your afterlife needs maintenance.',
    'Consider this house professionally de-booed.',
    'Put that on your paranormal inspection report.',
    'Go haunt somebody with a smaller toolbox.',
  ],
  kill: [
    'This kingdom needs a plumber. And a demolition permit.',
    'Another blockage cleared.',
    'That is going on the invoice.',
    'I do repairs. You provide the spare parts.',
    'No appointment? No problem.',
    'The callout fee just went up.',
    'Quality service. Questionable methods.',
    'I should have charged by the monster.',
  ],
  shotgun: [
    'Meet the pressure washer.',
    'Two barrels. One very thorough inspection.',
    'This is the industrial plunger.',
  ],
  flower: [
    'Gardening just got a lot more interesting.',
    'That is one spicy flower arrangement.',
    'Fresh flowers. Terminal allergies.',
  ],
  health: [
    'Finally. A mushroom with employee benefits.',
    'Lunch break. Dangerously nutritious.',
    'I am billing this as a medical expense.',
  ],
  armor: [
    'Safety first. Revenge a very close second.',
    'Protective equipment. Slightly pre-owned.',
    'A shell beats the company health plan.',
  ],
  ammo: [
    'Now that is a proper tool kit.',
    'Restocked. The noise complaints can resume.',
    'Who needs coins when you have cartridges?',
  ],
  empty: [
    'Great. The loud wrench is out of batteries.',
    'I knew I should have brought the bigger tool bag.',
    'That click was not in the service manual.',
  ],
  key: [
    'Five stars. Finally, a decent customer review.',
    'A star-shaped key. Very subtle security system.',
    'Shiny. This better cover the overtime.',
  ],
  secret: [
    'Hidden supplies? I am calling that a tip.',
    'Every castle has a maintenance cupboard.',
    'Found the emergency plumber fund.',
  ],
  hurt: [
    'That is coming out of your deposit.',
    'Excuse me. I am trying to do a job here.',
    'The customer is definitely not always right.',
  ],
  bossIntro: [
    'Bowser. Your boiler inspection is overdue.',
    'Big shell. Bigger repair bill.',
    'I found the landlord. Of course he breathes fire.',
  ],
  bossKill: [
    'Castle repaired. Landlord replaced.',
    'That is what happens when you ignore the maintenance requests.',
    'Keep the crown. I am taking my lunch break.',
  ],
  levelClear: [
    'Another floor cleared. Still no elevator.',
    'Next stop. Hopefully somewhere with normal plumbing.',
    'The pipes are clear. The paperwork is a nightmare.',
  ],
  finalWin: [
    'Kingdom saved. Somebody else can fix the toilets.',
    'Three levels of overtime. This princess better tip.',
    'The kingdom is open for business. I am closed for the weekend.',
  ],
  retro: [
    'Great. Now I am getting paid in pixels.',
    'Less resolution. Same unreasonable callout fee.',
    'My mustache has lost half its polygons.',
  ],
});

const LEVEL_START = [
  ['Nice castle. Shame about the infestation.', 'First the courtyard. Then the very overdue invoice.'],
  ['I said unclog the pipes. Not summon a volcano.', 'Finally, actual plumbing. Somehow that makes it worse.'],
  ['Midnight callout. Triple rates. No exceptions.', 'A haunted castle. The estate agent called it character.'],
];
const PRIORITY_EVENTS = new Set(['levelStart', 'levelClear', 'finalWin', 'bossIntro', 'bossKill', 'retro']);

/**
 * Caption-first game banter. `enabled` controls optional browser speech only.
 * `now` is an injectable millisecond clock; `random` returns a number in [0, 1).
 */
export class PlumberBanter {
  constructor({ onLine = () => {}, now = () => Date.now(), random = Math.random } = {}) {
    this.onLine = onLine;
    this.now = now;
    this.random = random;
    this.enabled = true;
    this.muted = false;
    this.volume = .55;
    this.cooldownMs = 7000;
    this.lastPlayedAt = -Infinity;
    this.recent = [];
    this.utterance = null;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) this.stop();
  }

  setVolume(value) {
    const number = Number(value);
    this.volume = Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
    if (this.volume === 0) this.stop();
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (this.muted) this.stop();
  }

  play(event, context = {}) {
    const pool = event === 'levelStart'
      ? LEVEL_START[Math.max(0, Math.min(2, Math.floor(Number(context.level) || 0)))]
      : BANTER_LINES[event];
    if (!pool) return null;
    const priority = PRIORITY_EVENTS.has(event);
    const currentTime = this.now();
    if (!priority && currentTime - this.lastPlayedAt < this.cooldownMs) return null;

    // Use fresh generic banter when a small situational pool has been exhausted.
    // This keeps the last five captions distinct, even after repeated pickups.
    let choices = pool.filter(line => !this.recent.includes(line));
    if (!choices.length) choices = BANTER_LINES.kill.filter(line => !this.recent.includes(line));
    const sample = Math.max(0, Math.min(.999999, Number(this.random()) || 0));
    const line = choices[Math.floor(sample * choices.length)];
    this.recent.push(line);
    if (this.recent.length > 5) this.recent.shift();
    this.lastPlayedAt = currentTime;
    this.onLine(line);
    this.speak(line, priority);
    return line;
  }

  speak(line, priority) {
    const synthesis = globalThis.speechSynthesis;
    const Utterance = globalThis.SpeechSynthesisUtterance;
    if (!this.enabled || this.muted || this.volume <= 0 || !synthesis || typeof Utterance !== 'function') return;
    try {
      // Never build a queue of stale combat commentary.
      if (synthesis.speaking || synthesis.pending) {
        if (!priority) return;
        synthesis.cancel();
      }
      const utterance = new Utterance(line);
      const voices = typeof synthesis.getVoices === 'function' ? synthesis.getVoices() : [];
      const english = voices.filter(voice => /^en(?:-|_)/i.test(voice.lang || '') || voice.lang === 'en');
      const voice = english.find(item => item.localService && item.default)
        || english.find(item => item.localService)
        || english.find(item => item.default)
        || english[0];
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'en-US';
      utterance.pitch = .8;
      utterance.rate = .98;
      utterance.volume = this.volume * .65;
      const clear = () => { if (this.utterance === utterance) this.utterance = null; };
      utterance.onend = clear;
      utterance.onerror = clear;
      this.utterance = utterance;
      synthesis.speak(utterance);
    } catch {
      // Captions already appeared; speech availability must never affect play.
      this.utterance = null;
    }
  }

  stop() {
    if (this.utterance) {
      try { globalThis.speechSynthesis?.cancel(); } catch { /* Speech is optional. */ }
      this.utterance = null;
    }
  }

  reset() {
    this.stop();
    this.lastPlayedAt = -Infinity;
    this.recent = [];
  }
}
