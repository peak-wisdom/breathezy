// SPDX-License-Identifier: AGPL-3.0-only
import {SIGNS,RASHIS,sign,dateLabel,birthInstant} from './core.js';
import {calculate} from './engine.js';
import {escape,chartSVG,reportSVG,placementRows} from './report.js';
const $=id=>document.getElementById(id),key='still-birth-details-v1';
const ids=['name','birthDate','birthTime','place','latitude','longitude','zone','ambiguity','style','nodes','yearDays'];
let chart=null,selected=0,busy=false,exporting=false,search=null;
const defaultZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Etc/UTC';
$('zone').value=defaultZone;
const zones=Intl.supportedValuesOf?Intl.supportedValuesOf('timeZone'):['Asia/Kolkata','Asia/Dubai','America/New_York','America/Los_Angeles','Europe/London','Etc/UTC'];
zones.forEach(zone=>{const option=document.createElement('option');option.value=zone;$('zones').append(option);});
try{
  const saved=JSON.parse(localStorage.getItem(key));
  if(saved&&ids.every(id=>typeof saved[id]==='string')){ids.forEach(id=>{$(id).value=saved[id];});$('remember').checked=true;}
}catch{$('status').textContent='Browser storage is unavailable. You can still generate a chart without saving your details.';}
function saveDetails(){
  try{
    if($('remember').checked)localStorage.setItem(key,JSON.stringify(Object.fromEntries(ids.map(id=>[id,$(id).value]))));
    else localStorage.removeItem(key);
  }catch{$('status').textContent='Browser storage is unavailable. Details will not be saved.';}
}
function controls(){
  $('birthForm').querySelectorAll('input,select,button').forEach(node=>{node.disabled=busy||exporting;});
  $('generateChart').textContent=busy?'Calculating…':'Generate birth chart';
  $('downloadChart').disabled=!chart||busy||exporting;
  $('dashaSelect').disabled=busy||exporting;
}
$('birthForm').addEventListener('input',event=>{
  saveDetails();
  if(event.target.id==='remember')return;
  if(chart){chart=null;controls();$('status').textContent='Details changed. Generate again to update the chart and download.';}
});
$('birthForm').addEventListener('change',event=>{
  saveDetails();
  if(event.target.id!=='remember'&&chart){chart=null;controls();$('status').textContent='Details changed. Generate again to update the chart and download.';}
});
$('findPlace').addEventListener('click',async()=>{
  const query=$('place').value.trim();
  if(query.length<2){$('placeStatus').textContent='Enter at least two characters of the birthplace.';return;}
  if(search)search.abort();search=new AbortController();
  $('placeResults').replaceChildren();$('placeStatus').textContent='Searching places…';
  try{
    const response=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(query)+'&count=8&language=en&format=json',{signal:search.signal});
    if(!response.ok)throw new Error('Search failed');
    const data=await response.json();
    const places=data.results||[];
    $('placeStatus').textContent=places.length?'Select the correct place; verify its coordinates and timezone.':'No matches. Try a larger nearby town or enter coordinates and timezone manually.';
    places.forEach(place=>{
      const item=document.createElement('li'),button=document.createElement('button');button.type='button';
      const label=[place.name,place.admin1,place.country].filter(Boolean).join(', ');
      button.textContent=label+' · '+place.latitude.toFixed(4)+', '+place.longitude.toFixed(4);
      button.addEventListener('click',()=>{
        $('place').value=label;$('latitude').value=place.latitude;$('longitude').value=place.longitude;
        if(place.timezone)$('zone').value=place.timezone;
        $('placeResults').replaceChildren();$('placeStatus').textContent='Place selected. Check the timezone against the birth record.';
        chart=null;saveDetails();controls();
      });item.append(button);$('placeResults').append(item);
    });
  }catch(error){if(error.name!=='AbortError')$('placeStatus').textContent='Place search is unavailable. Enter latitude, longitude, and timezone manually.';}
});
function input(){
  return {name:$('name').value.trim(),date:$('birthDate').value,time:$('birthTime').value,place:$('place').value.trim(),latitude:Number($('latitude').value),longitude:Number($('longitude').value),zone:$('zone').value.trim(),disambiguation:$('ambiguity').value,style:$('style').value,nodes:$('nodes').value,yearDays:Number($('yearDays').value)};
}
function htmlTable(headers,rows,current=-1){return '<table><thead><tr>'+headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map((row,index)=>'<tr'+(index===current?' class="current-period"':'')+'>'+row.map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
function renderDashas(){
  if(!chart)return;
  const zone=chart.input.zone,now=Date.now(),period=chart.dashas.periods[selected];
  const rows=periods=>periods.map(p=>[p.lord,dateLabel(p.start,zone),dateLabel(p.end,zone)]);
  $('mahadashas').innerHTML=htmlTable(['Lord','Starts','Ends'],rows(chart.dashas.periods),chart.dashas.periods.findIndex(p=>p.start<=now&&now<p.end));
  $('antardashas').innerHTML=htmlTable(['Lord','Starts','Ends'],rows(period.sub),period.sub.findIndex(p=>p.start<=now&&now<p.end));
  $('antarTitle').textContent=period.lord+' antardashas';
}
function render(){
  const moon=chart.points.find(p=>p.name==='Moon'),asc=chart.points[0];
  const summaries=[['Lagna',RASHIS[asc.rashi]+' / '+SIGNS[asc.rashi]],['Moon rashi',RASHIS[moon.rashi]+' / '+SIGNS[moon.rashi]],['Birth nakshatra',moon.nakshatra.name+' · pada '+moon.nakshatra.pada],['Dasha at birth',chart.dashas.birthLord+' · '+chart.dashas.balanceYears.toFixed(3)+' years remaining']];
  $('summary').innerHTML=summaries.map(([label,value])=>'<div><span>'+escape(label)+'</span><strong>'+escape(value)+'</strong></div>').join('');
  $('conventions').textContent='UTC instant: '+chart.instant.utc+' | Birthplace: '+chart.input.latitude.toFixed(5)+', '+chart.input.longitude.toFixed(5)+' | '+chart.input.zone+' | Lahiri ayanamsa: '+chart.ayanamsa.toFixed(6)+'° | Whole-sign houses | '+(chart.input.nodes==='true'?'True':'Mean')+' nodes | Swiss Ephemeris '+chart.version+' / Moshier';
  $('d1').innerHTML=chartSVG(chart,'D1',chart.input.style);$('d9').innerHTML=chartSVG(chart,'D9',chart.input.style);
  $('placements').innerHTML=htmlTable(['Point','D1 Rashi','Degrees','House','Nakshatra · Pada','D9 sign'],placementRows(chart));
  $('dashaNote').textContent='Year convention: '+chart.input.yearDays+' days. Dates use the birthplace timezone. The first mahadasha can begin before birth; the balance above is the remaining part at birth. The displayed cycle covers today (or the birth cycle for a future birth). Highlighted periods are active today.';
  $('dashaSelect').replaceChildren();
  chart.dashas.periods.forEach((p,index)=>{const option=document.createElement('option');option.value=index;option.textContent=p.lord+' · '+dateLabel(p.start,chart.input.zone)+' to '+dateLabel(p.end,chart.input.zone);$('dashaSelect').append(option);});
  selected=Math.max(0,chart.dashas.periods.findIndex(p=>p.start<=Date.now()&&Date.now()<p.end));$('dashaSelect').value=selected;renderDashas();
  $('results').hidden=false;
}
$('birthForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!$('birthForm').reportValidity())return;
  const birth=input();
  try{birthInstant(birth.date,birth.time,birth.zone,birth.disambiguation);}catch(error){$('status').textContent=error.message;return;}
  busy=true;controls();$('status').textContent='Loading the astronomical engine and calculating your chart…';
  try{
    chart=await calculate(birth);render();saveDetails();$('status').textContent='Chart ready. Review the birth details, then download both charts and tables as one PNG.';
  }catch(error){chart=null;$('status').textContent=error.message;}
  finally{busy=false;controls();}
});
$('dashaSelect').addEventListener('change',()=>{if(chart){selected=Number($('dashaSelect').value);renderDashas();}});
$('example').addEventListener('click',()=>{
  const example={name:'Example chart',birthDate:'1990-05-15',birthTime:'14:30:00',place:'Mumbai, India',latitude:'19.076',longitude:'72.8777',zone:'Asia/Kolkata',ambiguity:'reject',style:'south',nodes:'mean',yearDays:'365.25'};
  ids.forEach(id=>{$(id).value=example[id];});chart=null;$('results').hidden=true;saveDetails();controls();$('status').textContent='Example details filled. Press Generate birth chart to calculate.';
});
$('forget').addEventListener('click',()=>{
  $('birthForm').reset();$('zone').value=defaultZone;$('remember').checked=false;
  try{localStorage.removeItem(key);}catch{}
  if(search)search.abort();$('placeResults').replaceChildren();$('placeStatus').textContent='';chart=null;$('results').hidden=true;controls();$('status').textContent='Birth details cleared from the form and browser storage.';
});
$('downloadChart').addEventListener('click',async()=>{
  if(!chart||exporting)return;
  exporting=true;controls();$('status').textContent='Preparing your complete chart image…';
  let svgUrl;
  try{
    const svg=reportSVG(chart,selected);svgUrl=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=svgUrl;});
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=3260;const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');context.drawImage(image,0,0);
    const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw new Error('PNG export failed');
    const url=URL.createObjectURL(png),link=document.createElement('a');link.href=url;link.download='still-vedic-chart-'+chart.input.date+'.png';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('status').textContent='Complete 2400 × 3260 chart PNG download requested.';
  }catch{$('status').textContent='Image export could not finish. Try again with other tabs closed.';}
  finally{if(svgUrl)URL.revokeObjectURL(svgUrl);exporting=false;controls();}
});
controls();
