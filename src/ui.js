const svg = (body, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons = {
  mushroom: svg('<path d="M3 13c0-6 3.8-10 9-10s9 4 9 10H3Z"/><path d="M7 13v4c0 3 2 4 5 4s5-1 5-4v-4"/><path d="M10 16v2m4-2v2"/><circle cx="12" cy="7" r="2"/><path d="M3.8 9.5a2 2 0 0 1 3.5 1.3M20.2 9.5a2 2 0 0 0-3.5 1.3"/>', 'brand-icon'),
  arrow: svg('<path d="M4 12h16m-6-6 6 6-6 6"/>'),
  play: svg('<path d="m8 5 11 7-11 7V5Z"/>'),
  sound: svg('<path d="m11 4-5 4H3v8h3l5 4V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>'),
  muted: svg('<path d="m11 4-5 4H3v8h3l5 4V4Z"/><path d="m16 9 6 6m0-6-6 6"/>'),
  fullscreen: svg('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'),
  book: svg('<path d="M12 6c-3-3-7-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2v15Z"/>'),
  settings: svg('<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#142012"/><circle cx="16" cy="17" r="3" fill="#142012"/>'),
  target: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="1"/>'),
  flame: svg('<path d="M12 2c2 6-4 7-2 11 3 0 4-3 4-5 4 4 6 7 4 11-2 4-9 4-12 0-3-5 2-9 6-17Z"/>'),
  castle: svg('<path d="M3 21V5h4V2h3v5h4V2h3v3h4v16H3Z"/><path d="M9 21v-5a3 3 0 0 1 6 0v5M6 10h2m8 0h2"/>'),
  heart: svg('<path d="M20.5 4.5a5 5 0 0 0-7 0L12 6l-1.5-1.5a5 5 0 0 0-7 7L12 20l8.5-8.5a5 5 0 0 0 0-7Z"/>'),
  shield: svg('<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>'),
  pause: svg('<path d="M8 4v16M16 4v16"/>'),
  map: svg('<path d="m2 5 7-3 6 3 7-3v17l-7 3-6-3-7 3V5Zm7-3v17M15 5v17"/>'),
  close: svg('<path d="m5 5 14 14M5 19 19 5"/>'),
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const escape = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);
const timeText = seconds => `${Math.floor((Number(seconds) || 0) / 60).toString().padStart(2, '0')}:${Math.floor((Number(seconds) || 0) % 60).toString().padStart(2, '0')}`;

export function createUI(callbacks = {}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('mushroom-doom-settings') || '{}') || {}; } catch { /* Local storage is optional. */ }
  const settings = {
    volume: saved.volume == null ? .55 : clamp(saved.volume, 0, 1),
    sensitivity: saved.sensitivity == null ? 1 : clamp(saved.sensitivity, .25, 2.5),
    quality: ['high', 'low'].includes(saved.quality) ? saved.quality : 'high',
    voice: saved.voice !== false,
    aimAssist: saved.aimAssist !== false,
  };
  let difficulty = 'normal', mode = 'loading', modalType = null, muted = false;
  let lastState = {}, toastTimer, hitTimer, banterTimer, previousFocus;
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="scene" aria-label="Mushroom Kingdom game world"></div>
    <div class="vignette"></div><div class="grain"></div>
    <div class="damage-flash" id="damage-flash"></div><div class="pickup-flash" id="pickup-flash"></div>
    <div id="loading" role="status"><span>MUSHROOM DOOM</span><div class="load-bar"></div><span class="load-sub">OPENING THE GATES</span></div>
    <main id="menu">
      <header class="topbar">
        <div class="wordmark">${icons.mushroom}<div>MUSHROOM DOOM<small>A KINGDOM REIMAGINED</small></div></div>
        <div class="top-right"><div class="build-tag"><span class="status-dot"></span>CAMPAIGN / 3 CHAPTERS</div><div class="top-actions">
          <button class="icon-button" id="mute-button" aria-label="Mute audio" title="Mute audio" aria-pressed="false">${icons.sound}</button>
          <button class="icon-button" id="fullscreen-button" aria-label="Toggle fullscreen" title="Fullscreen">${icons.fullscreen}</button>
        </div></div>
      </header>
      <section class="main-menu" aria-label="Main menu">
        <div class="eyebrow">EPISODE 01 · A MUSHROOM KINGDOM NIGHTMARE</div>
        <h1 class="title"><span class="mushroom">MUSHROOM</span><span class="doom">DOOM</span></h1>
        <p class="tagline">THE KINGDOM HAS FALLEN.</p>
        <p class="intro">The pipes run hot. The castle has fallen.<br>One plumber. No extra lives.</p>
        <div class="difficulty-label" id="difficulty-label">CHOOSE YOUR PUNISHMENT</div>
        <div class="difficulty" role="group" aria-labelledby="difficulty-label">
          <button data-difficulty="easy" aria-pressed="false">TOURIST</button>
          <button data-difficulty="normal" class="active" aria-pressed="true">HURT ME PLENTY</button>
          <button data-difficulty="hard" aria-pressed="false">NIGHTMARE</button>
        </div>
        <button class="primary" id="start-button"><span>${icons.play}ENTER THE KINGDOM</span>${icons.arrow}</button>
        <div class="menu-secondary"><button class="text-button" id="guide-button">${icons.book}FIELD MANUAL</button><button class="text-button" id="settings-button">${icons.settings}SETTINGS</button></div>
      </section>
      <div class="vertical-label">OLD-SCHOOL SOUL. NEW-WORLD HELL.</div>
      <aside class="scene-label"><div class="micro">01 / YOUR FIRST DESCENT</div><h2>THE ASHEN COURTYARD</h2><p>Some kingdoms aren't worth saving. This one is.</p><div class="level-index"><b></b><i></i><i></i><span>01 — 03</span></div></aside>
      <footer class="menu-bottom"><div class="feature-strip"><span class="feature">${icons.target}FAST. BRUTAL. FIRST PERSON.</span><span class="feature">${icons.flame}2 WEAPONS</span><span class="feature">${icons.castle}3 LEVEL CAMPAIGN</span></div><span class="fan-note">AN UNOFFICIAL FAN-MADE TRIBUTE<br>BUILT FOR THE LOVE OF THE CLASSICS</span></footer>
    </main>
    <section id="hud" class="hidden" aria-label="Game status">
      <div class="hud-top"><div class="objective"><div class="micro" id="mission-label">LEVEL 1 / 3 · CURRENT OBJECTIVE</div><strong id="objective-text">Find the Power Star and open the warp gate.</strong><div class="key-status" id="key-status">☆ POWER STAR: MISSING</div></div><div><div class="level-name" id="zone-name">THE ASHEN COURTYARD</div><div class="kill-count"><span id="kills">0</span> / <span id="total">13</span> ELIMINATED &nbsp; <span id="timer">00:00</span></div><div class="hud-tools"><button class="icon-button" id="map-button" aria-label="Toggle map" title="Map (Tab)">${icons.map}</button><button class="icon-button" id="pause-button" aria-label="Pause game" title="Pause (Esc)">${icons.pause}</button></div></div></div>
      <div class="crosshair" id="crosshair"></div>
      <div class="boss-health hidden" id="boss-health"><span>BOWSER · KING OF ASH</span><div class="boss-bar"><i id="boss-bar"></i></div></div>
      <div id="automap" class="hidden"><canvas id="map-canvas" width="430" height="600" aria-label="Level map"></canvas></div>
      <div class="hud-bottom"><div class="vitals"><div class="stat health"><div class="stat-value">${icons.heart}<span id="health-value">100</span></div><div class="micro">HEALTH</div></div><div class="stat"><div class="stat-value">${icons.shield}<span id="armor-value">0</span></div><div class="micro">SHELL ARMOR</div></div></div><div><div class="weapon-select"><span id="weapon-one" class="selected">[1] SHOTGUN</span><span id="weapon-two">[2] FIRE FLOWER</span></div><div class="ammo-panel"><div class="ammo-num"><b id="ammo-value">40</b><span id="ammo-unit"> / SHELLS</span></div><div class="weapon-name" id="weapon-name">KINGDOM SHOTGUN</div></div></div></div>
      <div class="hud-hint" id="hud-hint">WASD MOVE · MOUSE AIM · CLICK FIRE<br>1 / 2 WEAPONS · TAB MAP · ESC PAUSE</div>
      <div class="mobile-controls"><div class="touch-stick idle" id="touch-stick" aria-hidden="true"><i id="touch-knob"></i></div><button class="touch-btn touch-fire" data-touch="Fire" aria-label="Fire weapon (drag to aim)">FIRE</button><button class="touch-btn touch-use" data-touch="KeyE" aria-label="Use portal">USE</button><button class="touch-btn touch-switch" data-touch="Switch" aria-label="Switch weapon">1 / 2</button><div class="rotate-hint">↻ ROTATE TO LANDSCAPE</div></div>
    </section>
    <div class="toast" id="toast" role="status" aria-live="polite" style="opacity:0"></div>
    <div id="banter-line" class="hidden" role="status" aria-live="polite"><span class="banter-label">THE PLUMBER</span><span class="banter-text" id="banter-text"></span></div>
    <div class="modal-backdrop hidden" id="modal-backdrop"><section class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"></section></div>`;
  const el = id => document.getElementById(id);
  const on = (id, callback) => el(id).addEventListener('click', event => { event.stopPropagation(); callback(event); });
  const text = (id, value) => { const target = el(id), next = String(value); if (target.textContent !== next) target.textContent = next; };
  const call = (name, ...args) => callbacks[name]?.(...args);
  function saveSettings() { try { localStorage.setItem('mushroom-doom-settings', JSON.stringify(settings)); } catch { /* Browser privacy modes can disable storage. */ } call('onSettings', { ...settings }); }
  on('start-button', () => call('onStart'));
  on('guide-button', () => showModal('help'));
  on('settings-button', () => showModal('settings'));
  on('fullscreen-button', () => call('onFullscreen'));
  on('pause-button', () => call('onPause'));
  on('map-button', () => call('onMap'));
  on('mute-button', () => {
    muted = !muted;
    el('mute-button').innerHTML = muted ? icons.muted : icons.sound;
    el('mute-button').setAttribute('aria-label', muted ? 'Unmute audio' : 'Mute audio');
    el('mute-button').setAttribute('title', muted ? 'Unmute audio' : 'Mute audio');
    el('mute-button').setAttribute('aria-pressed', String(muted));
    call('onMute', muted);
  });
  document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => {
    difficulty = button.dataset.difficulty;
    document.querySelectorAll('[data-difficulty]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    call('onDifficulty', difficulty);
  }));
  document.querySelectorAll('[data-touch]').forEach(button => {
    // The FIRE button doubles as a look pad: hold it and slide to aim while shooting.
    let drag = null;
    button.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId); drag = { x: event.clientX, y: event.clientY }; call('onTouch', button.dataset.touch, true); });
    if (button.dataset.touch === 'Fire') button.addEventListener('pointermove', event => { if (!drag) return; event.preventDefault(); event.stopPropagation(); call('onTouchLook', event.clientX - drag.x, event.clientY - drag.y); drag = { x: event.clientX, y: event.clientY }; });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(eventName, event => { event.preventDefault(); event.stopPropagation(); drag = null; call('onTouch', button.dataset.touch, false); });
  });
  const closeModal = () => { if (mode === 'paused' || mode === 'pause') showModal('pause'); else hideModal(); };
  el('modal-backdrop').addEventListener('click', event => { if (event.target === el('modal-backdrop') && ['help', 'settings'].includes(modalType)) closeModal(); });
  el('modal-backdrop').addEventListener('pointerdown', event => event.stopPropagation());
  document.addEventListener('keydown', event => {
    if (!modalType) return;
    if (event.code === 'Escape' && ['help', 'settings'].includes(modalType)) { event.preventDefault(); event.stopImmediatePropagation(); closeModal(); }
    if (event.code === 'Tab') {
      const items = [...el('modal').querySelectorAll('button, input, select, [tabindex="0"]')];
      if (!items.length) return;
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === el('modal'))) { last.focus(); event.preventDefault(); }
      else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
    }
  }, true);

  function hideModal() {
    modalType = null;
    el('modal-backdrop').classList.add('hidden');
    if (mode === 'menu') previousFocus?.focus?.();
  }
  function showModal(type, data = {}) {
    if (type === 'guide') type = 'help';
    if (type === 'paused') type = 'pause';
    const d = { ...lastState, ...data };
    const levelNumber = d.levelNumber || (Number(d.levelIndex) || 0) + 1;
    const levelCount = d.levelCount || 3;
    if (!modalType) previousFocus = document.activeElement;
    modalType = type;
    const title = type === 'help' ? 'THE FIELD MANUAL' : type === 'settings' ? 'MAKE IT YOURS.' : type === 'pause' ? 'TAKE A BREATHER.' : type === 'win' ? 'THE KINGDOM ENDURES.' : type === 'briefing' ? (d.levelName || 'THE ASHEN COURTYARD') : type === 'levelcomplete' ? 'COURSE CLEAR.' : 'NO EXTRA LIVES.';
    const eyebrow = type === 'help' ? 'KNOW YOUR WAY THROUGH HELL' : type === 'settings' ? 'FIELD CONFIGURATION' : type === 'pause' ? `LEVEL ${levelNumber} / ${levelCount} · CAMPAIGN PAUSED` : type === 'win' ? `CAMPAIGN COMPLETE · ${levelCount} OF ${levelCount}` : type === 'briefing' ? `CHAPTER ${String(levelNumber).padStart(2, '0')} / ${String(levelCount).padStart(2, '0')} · MISSION BRIEFING` : type === 'levelcomplete' ? `LEVEL ${levelNumber} / ${levelCount} · COMPLETE` : `LEVEL ${levelNumber} / ${levelCount} · THE KINGDOM WAITS`;
    const canClose = type === 'settings' || type === 'help';
    let content = `<div class="modal-top"><span class="micro">${escape(eyebrow)}</span>${canClose ? `<button id="modal-close" class="icon-button" aria-label="Close dialog">${icons.close}</button>` : ''}</div><h2 id="modal-title">${escape(title)}</h2>`;
    if (type === 'help') {
      const controls = [['Move', 'W A S D'], ['Aim', 'MOUSE'], ['Fire', 'LEFT CLICK'], ['Sprint', 'SHIFT'], ['Weapons', '1 / 2'], ['Use portal', 'E'], ['Map', 'TAB'], ['Pause', 'ESC']];
      content += `<p>Fight through three levels: the Ashen Courtyard, Infernal Pipeworks, and Midnight Citadel. Find each level’s Power Star, then use its warp gate to continue. Defeat Bowser in the final citadel to save the kingdom.</p><div class="controls-grid">${controls.map(([label, key]) => `<div class="control"><span>${label}</span><span class="key">${key}</span></div>`).join('')}</div><p class="guide-tip">Keep moving. Strafe around fireballs, grab red mushrooms for health, and collect green shells for armor. The shotgun hits hardest up close. Your supplies carry into the next level.</p><p>Arrow keys also turn. If mouse capture is unavailable, drag to look. On touchscreens, put your left thumb anywhere on the left side to move (push to the edge to sprint) and drag the right side to aim. Hold FIRE and slide it to aim while shooting.</p><button class="primary" id="modal-done"><span>GOT IT. LET’S GO.</span>${icons.arrow}</button>`;
    } else if (type === 'settings') {
      content += `<div class="setting"><label for="volume">Master volume <output id="volume-label">${Math.round(settings.volume * 100)}%</output></label><input id="volume" type="range" min="0" max="100" step="1" value="${Math.round(settings.volume * 100)}"></div><div class="setting"><label for="sensitivity">Look sensitivity <output id="sensitivity-label">${settings.sensitivity.toFixed(2)}×</output></label><input id="sensitivity" type="range" min="25" max="250" step="5" value="${Math.round(settings.sensitivity * 100)}"></div><div class="setting"><label for="quality">Graphics quality</label><select id="quality"><option value="high">HD — cinematic lighting + detail</option><option value="low">Performance — lighter rendering</option></select></div><div class="setting"><label for="aim-assist">Touch aim assist <input id="aim-assist" type="checkbox" ${settings.aimAssist ? 'checked' : ''}></label><p>On touchscreens, your aim drifts gently onto nearby enemies while you hold FIRE.</p></div><div class="setting"><label for="voice">Spoken plumber banter <input id="voice" type="checkbox" ${settings.voice ? 'checked' : ''}></label><p>Subtitles stay on. Spoken lines use your browser’s available voice.</p></div><p>Your settings are saved on this device.</p><button class="primary" id="modal-done"><span>BACK TO THE KINGDOM</span>${icons.arrow}</button>`;
    } else if (type === 'pause') {
      content += `<p>The fire can wait a moment.<br>Your run will continue right where you left it.</p><button class="primary" id="modal-resume"><span>${icons.play}RESUME CAMPAIGN</span>${icons.arrow}</button><button class="secondary" id="modal-settings">SETTINGS</button><button class="secondary" id="modal-help">FIELD MANUAL</button><button class="secondary" id="modal-menu">RETURN TO TITLE</button>`;
    } else if (type === 'briefing') {
      const stages = ['ASHEN COURTYARD', 'INFERNAL PIPEWORKS', 'MIDNIGHT CITADEL'];
      content += `<div class="campaign-route" aria-label="Campaign progress">${stages.map((name, index) => `<div class="campaign-stage${index === levelNumber - 1 ? ' active' : index < levelNumber - 1 ? ' complete' : ''}"${index === levelNumber - 1 ? ' aria-current="step"' : ''}><span>${index < levelNumber - 1 ? '✓' : String(index + 1).padStart(2, '0')}</span><strong>${name}</strong></div>`).join('')}</div>${d.levelSubtitle ? `<p class="micro">${escape(d.levelSubtitle)}</p>` : ''}<p>${escape(d.briefing || 'Bowser has sealed the kingdom’s warp network. Find the Power Star, force open the gate, and take back the road to the castle.')}</p><p class="guide-tip briefing-objective"><strong>YOUR MISSION</strong><br>${escape(d.objective || 'Find the Power Star. Reach the warp gate. Press E to continue.')}</p><button class="primary" id="modal-begin"><span>${icons.play}${levelNumber === 1 ? 'START THE CAMPAIGN' : 'ENTER LEVEL ' + levelNumber}</span>${icons.arrow}</button><button class="secondary" id="modal-menu">RETURN TO TITLE</button>`;
    } else if (type === 'levelcomplete') {
      content += `<p><strong>${escape(d.levelName || 'The course')}</strong> is behind you. The next gate is open. Catch your breath, then keep going.</p><div class="score-grid"><div><strong>${escape(d.kills || 0)} / ${escape(d.total || 0)}</strong><span>ELIMINATED</span></div><div><strong>${timeText(d.elapsed)}</strong><span>LEVEL TIME</span></div><div><strong>${d.secretFound ? '1 / 1' : '0 / 1'}</strong><span>SECRETS</span></div></div><p class="guide-tip">UP NEXT<br><strong>${escape(d.nextLevelName || 'THE NEXT CHAPTER')}</strong><br>Health is restored. Armor and ammunition carry over, with a minimum supply for the next chapter.</p><button class="primary" id="modal-next"><span>NEXT LEVEL</span>${icons.arrow}</button><button class="secondary" id="modal-menu">RETURN TO TITLE</button>`;
    } else {
      const campaignWin = type === 'win';
      content += `<p>${campaignWin ? 'Three levels. Three stolen stars. One very expensive plumbing bill. Bowser has fallen, the warp network is restored, and the Mushroom Kingdom finally gets a quiet night.' : 'Even heroes meet the business end of a fireball. Take a breath, change your approach, and try this level again. Your earlier victories are safe.'}</p><div class="score-grid"><div><strong>${escape(campaignWin ? (d.campaignKills ?? d.kills ?? 0) : (d.kills || 0))} / ${escape(campaignWin ? (d.campaignTotal ?? d.total ?? 0) : (d.total || 0))}</strong><span>ELIMINATED</span></div><div><strong>${timeText(campaignWin ? (d.campaignElapsed ?? d.elapsed) : d.elapsed)}</strong><span>${campaignWin ? 'CAMPAIGN TIME' : 'LEVEL TIME'}</span></div><div><strong>${campaignWin ? levelCount + ' / ' + levelCount : (d.keys || d.key ? '1 / 1' : '0 / 1')}</strong><span>${campaignWin ? 'LEVELS CLEARED' : 'POWER STAR'}</span></div></div><button class="primary" id="${campaignWin ? 'modal-new-campaign' : 'modal-restart'}"><span>${campaignWin ? 'PLAY AGAIN' : 'TRY AGAIN'}</span>${icons.arrow}</button><button class="secondary" id="modal-menu">RETURN TO TITLE</button>`;
    }
    el('modal').innerHTML = content;
    el('modal-backdrop').classList.remove('hidden');
    if (canClose) { on('modal-close', closeModal); on('modal-done', closeModal); }
    if (type === 'settings') {
      el('quality').value = settings.quality;
      el('volume').addEventListener('input', event => { settings.volume = Number(event.target.value) / 100; text('volume-label', `${Math.round(settings.volume * 100)}%`); saveSettings(); });
      el('sensitivity').addEventListener('input', event => { settings.sensitivity = Number(event.target.value) / 100; text('sensitivity-label', `${settings.sensitivity.toFixed(2)}×`); saveSettings(); });
      el('quality').addEventListener('change', event => { settings.quality = event.target.value; saveSettings(); });
      el('voice').addEventListener('change', event => { settings.voice = event.target.checked; saveSettings(); });
      el('aim-assist').addEventListener('change', event => { settings.aimAssist = event.target.checked; saveSettings(); });
    }
    if (type === 'pause') { on('modal-resume', () => call('onResume')); on('modal-settings', () => showModal('settings')); on('modal-help', () => showModal('help')); }
    if (el('modal-menu')) on('modal-menu', () => call('onMenu'));
    if (el('modal-restart')) on('modal-restart', () => call('onRestart'));
    if (el('modal-begin')) on('modal-begin', () => call('onBeginLevel'));
    if (el('modal-next')) on('modal-next', () => call('onNextLevel'));
    if (el('modal-new-campaign')) on('modal-new-campaign', () => call(callbacks.onNewCampaign ? 'onNewCampaign' : 'onStart'));
    el('modal').focus({ preventScroll: true });
  }

  function setMode(next, data) {
    mode = next;
    if (data) lastState = { ...lastState, ...data };
    el('loading').classList.toggle('hidden', next !== 'loading');
    el('menu').classList.toggle('hidden', next !== 'menu');
    el('hud').classList.toggle('hidden', ['menu', 'loading', 'briefing'].includes(next));
    if (next !== 'playing') clearBanter();
    if (['pause', 'paused'].includes(next)) showModal('pause');
    else if (['win', 'dead', 'briefing', 'levelcomplete'].includes(next)) showModal(next);
    else hideModal();
  }
  function update(state) {
    lastState = { ...lastState, ...state };
    const s = lastState;
    text('health-value', Math.ceil(clamp(s.health ?? 100, 0, 999)));
    text('armor-value', Math.ceil(clamp(s.armor ?? 0, 0, 999)));
    text('ammo-value', Math.max(0, Math.floor(Number(s.ammo) || 0)).toString().padStart(2, '0'));
    text('kills', s.kills || 0); text('total', s.total || 13); text('timer', timeText(s.elapsed));
    const flower = s.weapon === 'fireflower' || s.weapon === 1 || s.weapon === 2;
    text('weapon-name', s.weaponName || (flower ? 'FIRE FLOWER CANNON' : 'KINGDOM SHOTGUN'));
    text('ammo-unit', flower ? ' / EMBERS' : ' / SHELLS');
    el('weapon-one').classList.toggle('selected', !flower); el('weapon-two').classList.toggle('selected', flower);
    text('key-status', s.keys || s.key ? '★ POWER STAR: ACQUIRED' : '☆ POWER STAR: MISSING');
    if (s.zone) text('zone-name', s.zone);
    if (s.objective) text('objective-text', s.objective);
    text('mission-label', `LEVEL ${s.levelNumber || (Number(s.levelIndex) || 0) + 1} / ${s.levelCount || 3} · CURRENT OBJECTIVE`);
    if (s.hint) text('hud-hint', s.hint);
    const showBoss = s.bossHealth != null && s.bossHealth > 0;
    el('boss-health').classList.toggle('hidden', !showBoss);
    if (showBoss) el('boss-bar').style.width = `${clamp(s.bossHealth / (s.bossMax || 1) * 100, 0, 100)}%`;
    if ('mapOpen' in s) el('automap').classList.toggle('hidden', !s.mapOpen);
  }
  function toast(message) {
    clearTimeout(toastTimer); text('toast', message); el('toast').style.opacity = '1';
    toastTimer = setTimeout(() => { el('toast').style.opacity = '0'; }, 2600);
  }
  function hit() { clearTimeout(hitTimer); el('crosshair').classList.add('hit'); hitTimer = setTimeout(() => el('crosshair').classList.remove('hit'), 140); }
  function say(message) {
    clearBanter();
    if (mode === 'win' || mode === 'levelcomplete') {
      const caption = document.createElement('p');
      caption.className = 'modal-banter';
      caption.setAttribute('role', 'status');
      caption.setAttribute('aria-live', 'polite');
      caption.textContent = message;
      el('modal').insertBefore(caption, el('modal').querySelector('.primary'));
    } else {
      text('banter-text', message); el('banter-line').classList.remove('hidden');
    }
    banterTimer = setTimeout(clearBanter, 4500);
  }
  function clearBanter() { clearTimeout(banterTimer); el('banter-line').classList.add('hidden'); el('modal').querySelector('.modal-banter')?.remove(); }
  function flash(id, strength, duration) {
    const node = el(id);
    node.getAnimations?.().forEach(a => a.cancel());
    if (node.animate) node.animate([{ opacity: strength }, { opacity: 0 }], { duration, easing: 'ease-out' });
  }
  return { update, setMode, toast, hit, say, clearBanter, damage: () => flash('damage-flash', .75, 400), pickup: () => flash('pickup-flash', .5, 350), showModal, hideModal, settings, get difficulty() { return difficulty; } };
}
