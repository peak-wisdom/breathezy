(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const key='still-fractal-settings-v1';
  const ids=['fractal','palette','size','detail','zoom','rotation','shift','background','seed','amoled'];
  const sizes=['1920x1080','2560x1440','3840x2160','1080x1920','1440x2560','2160x3840','2048x2048'];
  const fractals=['julia','mandelbrot','ship','tricorn','celtic','buffalo','cubic','newton'], palettes=['nebula','ocean','ember','forest','mono','aurora','sunset','candy','glacier','copper','lavender','rainbow'];
  let settings={fractal:'julia',palette:'nebula',size:matchMedia('(max-width:640px)').matches?'1080x1920':'1920x1080',detail:400,zoom:1,rotation:0,shift:0,background:'#090d20',seed:'42',amoled:false};
  let worker=null, generated=null, dirty=true, exporting=false;
  function valid(s) {
    return s && (s.amoled === undefined || typeof s.amoled === 'boolean') && fractals.includes(s.fractal) && palettes.includes(s.palette) && sizes.includes(s.size) && [160,400,800].includes(s.detail) && Number.isInteger(s.zoom) && s.zoom>=1 && s.zoom<=40 && ['rotation','shift'].every(id=>Number.isInteger(s[id]) && s[id]>=0 && s[id]<=360) && /^#[0-9a-f]{6}$/i.test(s.background) && /^\d{1,10}$/.test(s.seed);
  }
  try {const saved=JSON.parse(localStorage.getItem(key));if(valid(saved))settings={...saved,amoled:saved.amoled===true};}
  catch {$('saveNotice').textContent='Settings work for this visit. Browser storage is unavailable.';}
  function save() {
    if(!valid(settings))return;
    try {localStorage.setItem(key,JSON.stringify(settings));}
    catch {$('saveNotice').textContent='Settings work for this visit. Browser storage is unavailable.';}
  }
  function read() {
    ids.forEach(id=>{settings[id]=id==='amoled'?$(id).checked:['detail','zoom','rotation','shift'].includes(id)?Number($(id).value):$(id).value;});
  }
  function sync() {
    ids.forEach(id=>{if(id==='amoled')$(id).checked=settings.amoled;else $(id).value=settings[id];});
    $('zoomValue').textContent=settings.zoom+'×';
    $('rotationValue').textContent=settings.rotation+'°';
    $('shiftValue').textContent=settings.shift+'°';
  }
  function controls() {
    const busy=Boolean(worker)||exporting;
    [...ids,'generate','surprise','newSeed'].forEach(id=>{$(id).disabled=busy;});
    $('background').disabled=busy||settings.amoled;
    $('cancel').hidden=!worker;
    $('download').disabled=busy||!generated||dirty;
    $('generate').textContent=worker?'Generating…':'Generate wallpaper';
  }
  function changed() {
    read(); save();
    $('zoomValue').textContent=settings.zoom+'×';$('rotationValue').textContent=settings.rotation+'°';$('shiftValue').textContent=settings.shift+'°';
    dirty=true; controls();
    $('status').textContent='Settings updated. Generate to apply them.';
  }
  ids.forEach(id=>$(id).addEventListener('input',changed));
  function seed() {return String(crypto.getRandomValues(new Uint32Array(1))[0]);}
  $('newSeed').addEventListener('click',()=>{$('seed').value=seed();changed();});
  function stop() {
    if(worker){worker.terminate();worker=null;}
    $('progress').hidden=true;controls();
  }
  function fail() {
    dirty=true;stop();$('status').textContent='Rendering could not finish. Try Standard detail or a smaller wallpaper size.';
  }
  function generate() {
    if(worker||exporting||!$('wallpaperSettings').reportValidity())return;
    read();if(!valid(settings)){$('status').textContent='Check the settings and enter a seed of 1–10 digits.';return;}
    save();
    if(!window.Worker){$('status').textContent='This browser cannot run the renderer. Try a current browser with Web Worker support.';return;}
    const snapshot={...settings};
    const [width,height]=snapshot.size.split('x').map(Number);
    $('progress').value=0;$('progress').hidden=false;
    $('status').textContent='Rendering '+width+' × '+height+' pixels…';
    try {
      worker=new Worker('render-worker.js?v=3');controls();
      worker.onmessage=event=>{
        const message=event.data;
        if(message.type==='progress'){$('progress').value=message.progress;return;}
        if(message.type==='error'){fail();return;}
        if(message.type!=='complete')return;
        try {
          const canvas=$('canvas');canvas.width=width;canvas.height=height;
          const context=canvas.getContext('2d');
          if(!context)throw new Error('Canvas unavailable');
          context.putImageData(new ImageData(new Uint8ClampedArray(message.pixels),width,height),0,0);
          canvas.hidden=false;$('placeholder').hidden=true;
          generated={settings:snapshot,width,height};dirty=false;
          $('imageInfo').textContent=width+' × '+height+' · PNG'+(snapshot.amoled?' · AMOLED':'')+' · Seed '+snapshot.seed;
          $('status').textContent='Your wallpaper is ready. Download the full-resolution PNG.';
          stop();
        } catch {fail();}
      };
      worker.onerror=fail;
      worker.postMessage({width,height,settings:snapshot});
    } catch {fail();}
  }
  $('wallpaperSettings').addEventListener('submit',event=>{event.preventDefault();generate();});
  $('surprise').addEventListener('click',()=>{
    const values=crypto.getRandomValues(new Uint32Array(5));
    settings.fractal=fractals[values[0]%fractals.length];settings.palette=palettes[values[1]%palettes.length];
    settings.seed=String(values[2]);settings.zoom=['julia','newton'].includes(settings.fractal)?1:1+values[3]%4;
    settings.rotation=values[4]%360;settings.shift=values[2]%360;
    sync();dirty=true;save();generate();
  });
  $('cancel').addEventListener('click',()=>{stop();$('status').textContent='Generation cancelled. Adjust your settings and try again.';});
  $('download').addEventListener('click',()=>{
    if(!generated||dirty||worker||exporting)return;
    exporting=true;controls();$('status').textContent='Preparing your PNG download…';
    try {
      $('canvas').toBlob(blob=>{
        exporting=false;controls();
        if(!blob){$('status').textContent='PNG export failed. Try generating a smaller wallpaper.';return;}
        const url=URL.createObjectURL(blob), link=document.createElement('a');
        link.href=url;link.download='still-'+generated.settings.fractal+(generated.settings.amoled?'-amoled':'')+'-'+generated.settings.seed+'-'+generated.width+'x'+generated.height+'.png';
        document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
        $('status').textContent='PNG download requested. Your wallpaper is full resolution.';
      },'image/png');
    } catch {exporting=false;controls();$('status').textContent='PNG export failed. Try generating a smaller wallpaper.';}
  });
  window.addEventListener('pagehide',()=>{if(worker)stop();});
  sync();controls();
})();
