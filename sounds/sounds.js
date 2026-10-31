(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const channels = ['rain','ocean','forest','crickets','white'];
  const defaults = {rain:45, ocean:20, forest:0, crickets:0, white:0, master:40, sleep:0};
  const key = 'still-sound-mix-v1';
  let mix = {...defaults};
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && [...channels,'master'].every(id => Number.isInteger(saved[id]) && saved[id] >= 0 && saved[id] <= 100) && [0,5,15,30,60].includes(saved.sleep)) mix = saved;
  } catch { $('saveStatus').textContent = 'Mix works for this visit. Browser storage is unavailable.'; }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(mix)); }
    catch { $('saveStatus').textContent = 'Mix works for this visit. Browser storage is unavailable.'; }
  }
  let context, master, gate, compressor;
  let playing = false, busy = false, deadline = 0;
  const gains = {};
  function bufferFor(id) {
    const rate = 22050, duration = 24;
    const buffer = context.createBuffer(1, rate*duration, rate);
    const data = buffer.getChannelData(0);
    let brown = 0, soft = 0;
    for (let i=0; i<data.length; i++) {
      const t = i/rate, noise = Math.random()*2-1;
      brown = (brown + noise*0.025)/1.025;
      soft += (noise-soft)*0.16;
      let sample = 0;
      if (id === 'white') sample = noise*0.28;
      if (id === 'rain') sample = (noise*0.14 + soft*0.7)*(0.85+0.15*Math.sin(2*Math.PI*t/8));
      if (id === 'ocean') sample = (brown*3+soft*0.1)*(0.35+0.65*Math.pow((1+Math.sin(2*Math.PI*t/8))/2,2));
      if (id === 'forest') {
        sample = brown*1.6;
        const chirp = t%6;
        if (chirp>1 && chirp<1.55) {
          const x = chirp-1;
          sample += Math.sin(2*Math.PI*(1700*x+900*x*x))*Math.pow(Math.sin(Math.PI*x/0.55),2)*0.17;
        }
        if (chirp>2.2 && chirp<2.45) {
          const x = chirp-2.2;
          sample += Math.sin(2*Math.PI*(2400*x-1300*x*x))*Math.pow(Math.sin(Math.PI*x/0.25),2)*0.12;
        }
      }
      if (id === 'crickets') {
        // Two overlapping pulse trains mimic an evening cricket chorus.
        for (const [period,offset,freq,amp] of [[1.5,0,4300,0.19],[2,0.6,3600,0.11]]) {
          const cycle = (t+offset)%period;
          const pulse = cycle%0.075;
          if (cycle<0.375 && pulse<0.04) sample += Math.sin(2*Math.PI*freq*t)*Math.pow(Math.sin(Math.PI*pulse/0.04),2)*amp;
        }
      }
      // Fade both ends to silence to avoid clicks at the loop boundary.
      const fade = Math.min(1,t/0.04,(duration-t)/0.04);
      data[i] = sample*Math.max(0,fade);
    }
    return buffer;
  }
  function createAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Audio unavailable');
    context = new Audio();
    master = context.createGain(); gate = context.createGain(); compressor = context.createDynamicsCompressor();
    master.gain.value = mix.master/100*0.65;
    compressor.threshold.value = -18; compressor.ratio.value = 4;
    master.connect(gate); gate.connect(compressor); compressor.connect(context.destination);
    channels.forEach(id => {
      const source = context.createBufferSource();
      source.buffer = bufferFor(id); source.loop = true;
      const gain = context.createGain(); gain.gain.value = mix[id]/100;
      source.connect(gain); gain.connect(master); source.start(); gains[id] = gain;
    });
    context.addEventListener('statechange', () => {
      if (playing && context.state !== 'running') $('status').textContent = 'Audio paused by your browser. Press Resume audio to continue.';
      render();
    });
  }
  function levels() {
    if (!context) return;
    channels.forEach(id => gains[id].gain.setTargetAtTime(mix[id]/100, context.currentTime, 0.08));
    master.gain.setTargetAtTime(mix.master/100*0.65, context.currentTime, 0.08);
  }
  function scheduleSleep() {
    if (!context) return;
    gate.gain.cancelScheduledValues(context.currentTime);
    gate.gain.setValueAtTime(1, context.currentTime);
    deadline = playing && mix.sleep ? Date.now()+mix.sleep*60000 : 0;
    if (deadline) {
      const end = context.currentTime + mix.sleep*60;
      gate.gain.setValueAtTime(1, end-5);
      gate.gain.linearRampToValueAtTime(0, end);
    }
    renderSleep();
  }
  function renderSleep() {
    $('sleepStatus').textContent = deadline ? 'Fades out in ' + Math.ceil(Math.max(0,deadline-Date.now())/60000) + ' minute(s).' : mix.sleep ? 'Fades out '+mix.sleep+' minutes after you press Play.' : 'Choose a sleep timer to fade out automatically.';
  }
  function render() {
    [...channels,'master'].forEach(id => {$(id).value=mix[id]; $(id+'-value').textContent=mix[id]+'%'; $(id).setAttribute('aria-valuetext', mix[id]+' percent');});
    $('sleep').value = mix.sleep;
    $('play').disabled = busy;
    $('play').textContent = busy ? 'Starting…' : playing && context?.state !== 'running' ? 'Resume audio' : playing ? 'Pause mix' : 'Play mix';
    $('play').setAttribute('aria-pressed', String(playing && context?.state === 'running'));
    renderSleep();
  }
  function playbackMessage() {
    return mix.master === 0 || channels.every(id=>mix[id]===0) ? 'Playing silently. Raise a sound and master volume to listen.' : 'Your mix is playing.';
  }
  $('play').addEventListener('click', async () => {
    if (busy) return;
    busy = true; render();
    try {
      if (playing && context?.state === 'running') {
        await context.suspend(); playing = false; scheduleSleep(); $('status').textContent='Mix paused.';
      } else {
        if (!context) createAudio();
        await context.resume();
        if (context.state !== 'running') throw new Error('Audio blocked');
        playing = true; levels(); scheduleSleep(); $('status').textContent=playbackMessage();
      }
    } catch {
      playing = false;
      if (context) { try { await context.close(); } catch {} context=undefined; }
      deadline = 0;
      $('status').textContent='Could not start audio. Try Play again or use a browser with Web Audio support.';
    } finally { busy=false; render(); }
  });
  [...channels,'master'].forEach(id => $(id).addEventListener('input', () => {
    mix[id]=Number($(id).value); levels(); save(); render(); if(playing) $('status').textContent=playbackMessage();
  }));
  $('sleep').addEventListener('change', () => {mix.sleep=Number($('sleep').value);save();scheduleSleep();render();});
  $('resetMix').addEventListener('click', () => {mix={...defaults};save();levels();scheduleSleep();render();$('status').textContent=playing?playbackMessage():'Default mix restored.';});
  setInterval(async () => {
    if (playing && deadline && Date.now()>=deadline) {
      playing=false; deadline=0;
      try { await context.suspend(); } catch {}
      $('status').textContent='Sleep timer finished. Your mix has stopped.'; render();
    } else renderSleep();
  }, 1000);
  render();
})();
