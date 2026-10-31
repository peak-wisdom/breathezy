(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const key = 'still-memory-v1';
  let state = {length:5, sequence:'', answer:'', phase:'idle', revealUntil:0, outcome:'', correct:0, checked:0};
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && Number.isInteger(saved.length) && saved.length >= 3 && saved.length <= 12 && typeof saved.sequence === 'string' && (saved.sequence === '' || /^\d{3,12}$/.test(saved.sequence)) && typeof saved.answer === 'string' && ['idle','reveal','recall','result'].includes(saved.phase) && Number.isFinite(saved.revealUntil) && ['','correct','wrong'].includes(saved.outcome) && Number.isInteger(saved.correct) && saved.correct >= 0 && Number.isInteger(saved.checked) && saved.checked >= saved.correct && (saved.phase === 'idle' || saved.sequence.length >= 3)) state = saved;
  } catch { storageUnavailable(); }
  function storageUnavailable() { $('storageNote').textContent = 'Play works for this visit. Browser storage is unavailable.'; }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { storageUnavailable(); }
  }
  function render() {
    $('length').value = state.length;
    $('answer').value = state.answer;
    $('answer').disabled = state.phase !== 'recall';
    $('check').disabled = state.phase !== 'recall';
    $('ready').hidden = state.phase !== 'reveal';
    $('sequence').textContent = state.phase === 'reveal' ? state.sequence.split('').join(' ') : state.phase === 'idle' ? 'Ready to play?' : '• '.repeat(state.sequence.length).trim();
    $('hint').textContent = state.phase === 'reveal' ? 'Memorize these digits. They hide after 5 seconds.' : state.phase === 'recall' ? 'Type the digits in the same order, then press Check.' : state.phase === 'result' ? 'Choose New sequence for another round.' : 'The numbers appear for 5 seconds.';
    $('feedback').textContent = state.outcome === 'correct' ? '✓ Correct! You remembered every digit.' : state.outcome === 'wrong' ? 'Not quite — the correct sequence was ' + state.sequence + '. Try another round.' : '';
    $('score').textContent = state.correct + ' correct / ' + state.checked + ' checked';
  }
  function hideSequence(focus = false) {
    if (state.phase !== 'reveal') return;
    state.phase = 'recall'; save(); render();
    if (focus) $('answer').focus();
  }
  function checkDeadline() {
    if (state.phase === 'reveal' && Date.now() >= state.revealUntil) hideSequence();
  }
  $('newSequence').addEventListener('click', () => {
    let sequence = '';
    while (sequence.length < state.length) {
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      for (const byte of bytes) if (byte < 250 && sequence.length < state.length) sequence += String(byte % 10);
    }
    Object.assign(state, {sequence, answer:'', phase:'reveal', revealUntil:Date.now()+5000, outcome:''});
    save(); render();
  });
  $('ready').addEventListener('click', () => hideSequence(true));
  $('length').addEventListener('change', () => {
    state.length = Number($('length').value); save();
    if (state.phase !== 'idle') $('feedback').textContent = 'Length saved for the next sequence.';
  });
  $('answer').addEventListener('input', () => {state.answer = $('answer').value; save();});
  $('answerForm').addEventListener('submit', event => {
    event.preventDefault(); checkDeadline();
    if (state.phase !== 'recall') return;
    const answer = $('answer').value.replace(/\s/g, '');
    if (!/^\d+$/.test(answer) || answer.length !== state.sequence.length) {
      $('feedback').textContent = 'Enter all ' + state.sequence.length + ' digits using numbers only.';
      $('answer').focus(); return;
    }
    state.answer = $('answer').value;
    state.outcome = answer === state.sequence ? 'correct' : 'wrong';
    state.checked++;
    if (state.outcome === 'correct') state.correct++;
    state.phase = 'result'; save(); render();
  });
  checkDeadline(); render();
  setInterval(checkDeadline, 200);
  window.addEventListener('focus', checkDeadline);
  document.addEventListener('visibilitychange', checkDeadline);
})();
