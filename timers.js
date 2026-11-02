(() => {
  'use strict';
  const key = 'still-active-timers-v1';
  const freshFocus = () => ({mode:'focus', running:false, remaining:1500000, deadline:0, completed:false, sessions:0, settings:{focus:25, break:5}});
  let state = {focus:freshFocus(), breathing:null};
  let storageAvailable = true;
  let loadedFocus = false;
  const soundKey = 'still-timer-sound-v1';
  const playedKey = 'still-timer-chimes-v1';
  let soundEnabled = true, audio = null;
  const playedHere = new Set(), pendingChimes = new Set();
  try { soundEnabled = localStorage.getItem(soundKey) !== 'off'; } catch {}
  function unlockSound() {
    if (!soundEnabled) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    } catch { /* The visual completion remains available without audio. */ }
  }
  document.addEventListener('pointerdown', unlockSound, {passive:true});
  document.addEventListener('keydown', unlockSound);
  function playChime() {
    if (!soundEnabled || audio?.state !== 'running') return false;
    try {
      const start = audio.currentTime;
      [523.25,659.25,783.99].forEach((frequency,i) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const at = start + i * 0.24;
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.18, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.8);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(at); oscillator.stop(at + 0.85);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
      return true;
    } catch { return false; }
  }
  function completionSound(kind, token, endedAt) {
    // Do not play old alarms when returning long after a timer ended.
    if (Date.now() - endedAt > 60000 || !soundEnabled || audio?.state !== 'running' || playedHere.has(token) || pendingChimes.has(token)) return;
    pendingChimes.add(token);
    const claim = () => {
      let played = {};
      try { played = JSON.parse(localStorage.getItem(playedKey)) || {}; } catch {}
      if (played[kind] === token || playedHere.has(token)) return;
      if (playChime()) {
        playedHere.add(token); played[kind] = token;
        try { localStorage.setItem(playedKey, JSON.stringify(played)); } catch {}
      }
    };
    // Serialize claims so multiple open app tabs do not all ring together.
    if (navigator.locks?.request) navigator.locks.request('still-timer-chime', claim).catch(() => {}).finally(() => pendingChimes.delete(token));
    else { try { claim(); } finally { pendingChimes.delete(token); } }
  }
  const validFocus = f => f && ['focus','break'].includes(f.mode) && typeof f.running === 'boolean' && typeof f.completed === 'boolean' && Number.isFinite(f.remaining) && f.remaining >= 0 && Number.isFinite(f.deadline) && Number.isInteger(f.sessions) && f.sessions >= 0 && Number.isInteger(f.settings?.focus) && f.settings.focus >= 1 && f.settings.focus <= 120 && Number.isInteger(f.settings?.break) && f.settings.break >= 1 && f.settings.break <= 60;
  const validBreathing = b => b && typeof b.running === 'boolean' && typeof b.complete === 'boolean' && Number.isFinite(b.total) && b.total >= 0 && Number.isFinite(b.anchor) && Array.isArray(b.durations) && b.durations.length === 4 && b.durations.every((n,i) => Number.isInteger(n) && n >= (i === 3 ? 0 : 1) && n <= 60) && Number.isInteger(b.cycleLimit) && b.cycleLimit >= 0 && b.cycleLimit <= 999;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || sessionStorage.getItem(key));
    const f = saved?.focus;
    if (f && ['focus','break'].includes(f.mode) && typeof f.running === 'boolean' && typeof f.completed === 'boolean' && Number.isFinite(f.remaining) && f.remaining >= 0 && Number.isFinite(f.deadline) && Number.isInteger(f.sessions) && f.sessions >= 0 && Number.isInteger(f.settings?.focus) && f.settings.focus >= 1 && f.settings.focus <= 120 && Number.isInteger(f.settings?.break) && f.settings.break >= 1 && f.settings.break <= 60) { state.focus = f; loadedFocus = true; }
    const b = saved?.breathing;
    if (b && typeof b.running === 'boolean' && typeof b.complete === 'boolean' && Number.isFinite(b.total) && b.total >= 0 && Number.isFinite(b.anchor) && Array.isArray(b.durations) && b.durations.length === 4 && b.durations.every((n,i) => Number.isInteger(n) && n >= (i === 3 ? 0 : 1) && n <= 60) && Number.isInteger(b.cycleLimit) && b.cycleLimit >= 0 && b.cycleLimit <= 999) state.breathing = b;
  } catch { storageAvailable = false; }
  if (!loadedFocus) {
    try {
      const settings = JSON.parse(localStorage.getItem('still-focus-settings'));
      if (Number.isInteger(settings?.focus) && settings.focus >= 1 && settings.focus <= 120 && Number.isInteger(settings?.break) && settings.break >= 1 && settings.break <= 60) {
        state.focus.settings = settings; state.focus.remaining = settings.focus*60000;
      }
    } catch { /* Defaults remain usable without device storage. */ }
  }
  function save(part) {
    try {
      const latest = JSON.parse(localStorage.getItem(key));
      if (part && latest) state = {...latest, [part]:state[part]};
      localStorage.setItem(key, JSON.stringify(state));
    }
    catch { storageAvailable = false; }
  }
  function tick() {
    // Another already-open app tab may have started, paused or reset a timer.
    try {
      const latest = JSON.parse(localStorage.getItem(key));
      if (validFocus(latest?.focus)) state.focus = latest.focus;
      if (validBreathing(latest?.breathing)) state.breathing = latest.breathing;
    } catch { /* Continue using in-memory timers when storage is unavailable. */ }
    const f = state.focus;
    if (f.running) {
      f.remaining = Math.max(0, f.deadline - Date.now());
      if (f.remaining === 0) {
        f.running = false; f.completed = true;
        if (f.mode === 'focus') f.sessions++;
        save('focus');
      }
    }
    const b = state.breathing;
    if (b?.running && b.cycleLimit > 0) {
      const limit = b.cycleLimit * b.durations.reduce((a,c) => a+c, 0) * 1000;
      if (b.total + Date.now() - b.anchor >= limit) {
        b.completedAt = b.anchor + limit - b.total;
        b.total = limit; b.running = false; b.complete = true; save('breathing');
      }
    }
    if (f.completed && f.deadline > 0) completionSound('focus', 'focus:'+f.mode+':'+f.deadline, f.deadline);
    if (b?.complete && b.cycleLimit > 0) {
      const limit = b.cycleLimit * b.durations.reduce((a,c) => a+c, 0) * 1000;
      if (Number.isFinite(b.completedAt)) completionSound('breathing', 'breathing:'+b.anchor+':'+limit, b.completedAt);
    }
  }
  // Migrate existing open-tab sessions to durable browser storage.
  save();
  const listeners = new Set();
  function notify() { tick(); listeners.forEach(fn => fn()); }
  window.addEventListener('storage', event => {
    if (event.key === soundKey) {
      soundEnabled = event.newValue !== 'off'; listeners.forEach(fn => fn()); return;
    }
    if (event.key !== key) return;
    notify();
    window.dispatchEvent(new Event('still-timers-sync'));
  });
  function focusAction(action, settings) {
    tick();
    const f = state.focus;
    if (action === 'toggle') {
      if (f.running) f.running = false;
      else {
        if (f.completed) { f.remaining = f.settings[f.mode]*60000; f.completed = false; }
        f.deadline = Date.now() + f.remaining; f.running = true;
      }
    } else {
      if (action === 'settings') f.settings = settings;
      if (action === 'focus' || action === 'break') {
        if (f.mode === action) return;
        f.mode = action;
      }
      f.running = false; f.completed = false; f.remaining = f.settings[f.mode]*60000;
    }
    save('focus'); notify();
  }
  window.StillTimers = {
    get focus() { tick(); return state.focus; },
    get breathing() { tick(); return state.breathing; },
    get storageAvailable() { return storageAvailable; },
    setBreathing(value) { state.breathing = value; save('breathing'); notify(); },
    focusAction,
    get soundEnabled() { return soundEnabled; },
    toggleSound() {
      soundEnabled = !soundEnabled;
      try { localStorage.setItem(soundKey, soundEnabled ? 'on' : 'off'); } catch {}
      if (soundEnabled) unlockSound();
      listeners.forEach(fn => fn());
    },
    async testSound() {
      unlockSound();
      try { if (audio?.state === 'suspended') await audio.resume(); } catch {}
      return playChime();
    },
    subscribe(fn) { listeners.add(fn); fn(); },
    format(ms) { const s = Math.ceil(ms/1000); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
  };
  // A deadline continues to advance even when the browser suspends this page.
  tick();
  window.addEventListener('pageshow', event => {
    // Back/Forward may restore an old page snapshot with stale timer controls.
    if (event.persisted) window.location.reload();
    else notify();
  });
  document.addEventListener('visibilitychange', notify);
  setInterval(notify, 250);
  // Keep timing edits as drafts without applying them to an active session.
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm') || document.getElementById('settings');
    if (!form) return;
    const draftKey = 'still-timing-draft-' + form.id;
    const fields = Array.from(form.querySelectorAll('input[type="number"]'));
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      if (draft && typeof draft === 'object') fields.forEach(field => {
        if (typeof draft[field.id] === 'string') field.value = draft[field.id];
      });
    } catch { /* Applied settings remain usable without a saved draft. */ }
    form.addEventListener('input', () => {
      try { localStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(fields.map(field => [field.id, field.value])))); }
      catch { /* Saving applied settings reports unavailable storage separately. */ }
    });
    function clearDraft() {
      try { localStorage.removeItem(draftKey); } catch {}
    }
    form.addEventListener('submit', () => { if (form.checkValidity()) clearDraft(); });
    for (const id of ['defaults','boxPreset','relaxPreset']) document.getElementById(id)?.addEventListener('click', clearDraft);
  });
  const focusPage = document.body.dataset.app === 'focus-timer';
  if (!focusPage) {
    const style = document.createElement('style');
    style.textContent = `#still-mini{position:fixed;right:16px;bottom:16px;z-index:1000;width:260px;max-width:calc(100vw - 32px);padding:18px;border:1px solid #b4eed560;border-radius:20px;background:#102720;color:#eef8f4;box-shadow:0 12px 48px #0006;font:14px system-ui,sans-serif;text-align:left}#still-mini[hidden]{display:none}#still-mini strong{display:block;font-size:36px;font-weight:400;font-variant-numeric:tabular-nums;margin:8px 0}#still-mini .mini-actions{display:flex;gap:8px;align-items:center}#still-mini button,#still-mini a{width:auto;margin:0;padding:8px 12px;border:1px solid #ffffff40;border-radius:9px;background:transparent;color:#b4eed5;text-decoration:none;font:13px system-ui,sans-serif}#still-mini button{cursor:pointer}#still-mini :focus-visible{outline:3px solid #b4eed5;outline-offset:3px}body.still-has-mini{padding-bottom:220px}`;
    document.head.append(style);
    const mini = document.createElement('aside');
    mini.id = 'still-mini'; mini.setAttribute('aria-label','Focus timer mini player');
    mini.innerHTML = '<div id="mini-label"></div><strong id="mini-time" role="timer" aria-label="Time remaining"></strong><div class="mini-actions"><button id="mini-toggle" type="button">Pause</button><a id="mini-open">Open timer</a></div><button id="mini-sound" type="button" style="margin-top:10px">Sound on</button>';
    document.body.append(mini);
    document.getElementById('mini-open').href = new URL('focus-timer/', document.currentScript.src).href;
    document.getElementById('mini-toggle').addEventListener('click', () => focusAction('toggle'));
    document.getElementById('mini-sound').addEventListener('click', () => window.StillTimers.toggleSound());
    window.StillTimers.subscribe(() => {
      const f = state.focus;
      const visible = f.running || f.completed || f.remaining < f.settings[f.mode]*60000;
      mini.hidden = !visible; document.body.classList.toggle('still-has-mini', visible);
      document.getElementById('mini-label').textContent = (f.mode === 'focus' ? 'Focus' : 'Break') + (f.completed ? ' complete' : f.running ? ' in progress' : ' paused');
      document.getElementById('mini-time').textContent = window.StillTimers.format(f.remaining);
      document.getElementById('mini-toggle').textContent = f.completed ? 'Start again' : f.running ? 'Pause' : 'Resume';
      document.getElementById('mini-sound').textContent = soundEnabled ? 'Sound on' : 'Sound off';
      document.getElementById('mini-sound').setAttribute('aria-pressed', String(soundEnabled));
    });
  }
})();
