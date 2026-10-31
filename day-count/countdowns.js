(() => {
  'use strict';
  const key = 'still-countdowns-v1';
  const legacyKey = 'still-countdown-date';
  const $ = id => document.getElementById(id);
  let serial = 0;
  const newEntry = (date = '') => ({id:'date-' + Date.now() + '-' + serial++, label:'', date});
  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4,}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return Number.isFinite(date.getTime()) && year > 0 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  function calendarDay(date) {
    const day = new Date(0);
    day.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    return day.getTime();
  }
  let entries = [newEntry()];
  let removed = null;
  let storageOK = true;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved) || !saved.every(item => item && typeof item.label === 'string' && typeof item.date === 'string' && (item.date === '' || parseDate(item.date)))) throw new Error('Invalid countdown data');
      entries = saved.map(item => ({...newEntry(item.date), label:item.label}));
    } else {
      const legacy = localStorage.getItem(legacyKey);
      if (parseDate(legacy)) entries = [newEntry(legacy)];
    }
  } catch {
    storageOK = false;
    $('storageNotice').textContent = 'Saved dates could not be loaded. New edits will try to save again.';
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(entries));
      storageOK = true;
      $('storageNotice').textContent = 'Dates and labels saved in this browser.';
    } catch {
      storageOK = false;
      $('storageNotice').textContent = 'Changes work for this visit, but browser storage is unavailable. They may not survive closing this page.';
    }
  }
  const views = new Map();
  function updateResults() {
    const today = new Date();
    const min = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
    entries.forEach(entry => {
      const view = views.get(entry.id);
      if (!view) return;
      view.date.min = min;
      const target = parseDate(entry.date);
      if (!target) {
        view.number.textContent = '—';
        view.message.textContent = 'Choose a date to start your countdown.';
        view.caption.textContent = '';
        return;
      }
      const days = Math.round((calendarDay(target) - calendarDay(today))/86400000);
      view.number.textContent = String(Math.abs(days));
      view.message.textContent = days === 0 ? "It's today!" : days < 0 ? (days === -1 ? 'day ago' : 'days ago') : (days === 1 ? 'day to go' : 'days to go');
      view.caption.textContent = target.toLocaleDateString(undefined, {weekday:'long',year:'numeric',month:'long',day:'numeric'});
    });
  }
  function render(focusId) {
    $('countdowns').replaceChildren();
    views.clear();
    $('empty').hidden = entries.length !== 0;
    $('undo').hidden = !removed;
    entries.forEach((entry, index) => {
      const card = document.createElement('section');
      card.className = 'countdown-card';
      card.setAttribute('aria-labelledby', entry.id + '-heading');
      card.innerHTML = '<div class="card-heading"><h2></h2><button class="remove" type="button">Remove</button></div><label class="label-title">Label</label><input class="label-input" type="text" placeholder="e.g. Summer trip" autocomplete="off"><label class="date-title">Choose your date</label><input class="date-input" type="date"><div class="result" role="status" aria-live="polite"><div class="day-number">—</div><div class="day-message"></div><p class="date-caption"></p></div>';
      const heading = card.querySelector('h2');
      heading.id = entry.id + '-heading'; heading.textContent = 'Countdown ' + (index+1);
      const label = card.querySelector('.label-input');
      label.id = entry.id + '-label'; label.value = entry.label;
      card.querySelector('.label-title').htmlFor = label.id;
      const date = card.querySelector('.date-input');
      date.id = entry.id + '-date'; date.value = entry.date;
      card.querySelector('.date-title').htmlFor = date.id;
      const remove = card.querySelector('.remove');
      const updateName = () => remove.setAttribute('aria-label', 'Remove ' + (entry.label.trim() || 'countdown ' + (index+1)));
      updateName();
      label.addEventListener('input', () => {entry.label = label.value; updateName(); save();});
      date.addEventListener('input', () => {entry.date = date.value; save(); updateResults();});
      remove.addEventListener('click', () => {
        removed = {entry, index}; entries.splice(index, 1); save(); render(); $('undo').focus();
      });
      views.set(entry.id, {label, date, number:card.querySelector('.day-number'), message:card.querySelector('.day-message'), caption:card.querySelector('.date-caption')});
      $('countdowns').append(card);
    });
    updateResults();
    if (focusId) views.get(focusId)?.label.focus();
  }
  $('addDate').addEventListener('click', () => {
    const entry = newEntry(); entries.push(entry); save(); render(entry.id);
  });
  $('undo').addEventListener('click', () => {
    if (!removed) return;
    const {entry, index} = removed; entries.splice(index, 0, entry); removed = null; save(); render(entry.id);
  });
  // Save the migrated single date only after it has been loaded successfully.
  if (storageOK) save();
  render();
  setInterval(updateResults, 30000);
  window.addEventListener('focus', updateResults);
  document.addEventListener('visibilitychange', updateResults);
})();
