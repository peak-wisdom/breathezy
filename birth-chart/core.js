// SPDX-License-Identifier: AGPL-3.0-only
export const SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
export const RASHIS=['Mesha','Vrishabha','Mithuna','Karka','Simha','Kanya','Tula','Vrischika','Dhanu','Makara','Kumbha','Meena'];
export const NAKSHATRAS=['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
export const LORDS=['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
export const YEARS=[7,20,6,10,7,18,16,19,17];
export const DAY=86400000;
export const norm=value=>((value%360)+360)%360;
export const sign=longitude=>Math.floor(norm(longitude)/30);
export const navamsa=longitude=>norm(norm(longitude)*9);
export function lunarDetails(longitude){
  const units=norm(longitude)/(360/27),index=Math.min(26,Math.floor(units));
  return {index,name:NAKSHATRAS[index],pada:Math.min(4,Math.floor((units-index)*4)+1),fraction:units-index,lord:LORDS[index%9]};
}
export function degrees(value){
  const seconds=Math.floor((norm(value)%30)*3600+1e-7);
  return Math.floor(seconds/3600)+'°'+String(Math.floor(seconds%3600/60)).padStart(2,'0')+'′'+String(seconds%60).padStart(2,'0')+'″';
}
function zonedParts(stamp,zone){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp));
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
export function birthInstant(date,time,zone,disambiguation='reject'){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}(:\d{2})?$/.test(time))throw new Error('Enter a complete birth date and time.');
  const [y,m,d]=date.split('-').map(Number),[h,min,sec=0]=time.split(':').map(Number);
  const wall=Date.UTC(y,m-1,d,h,min,sec),check=new Date(wall);
  if(y<1900||y>2099||check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d||h>23||min>59||sec>59)throw new Error('Use a valid Gregorian date between 1900 and 2099 and a valid birth time.');
  try{zonedParts(wall,zone);}catch{throw new Error('Choose a valid IANA timezone, such as Asia/Kolkata or America/New_York.');}
  const offsets=new Set();
  for(const hours of [-36,-24,-12,0,12,24,36]){
    const sample=wall+hours*3600000,p=zonedParts(sample,zone);
    offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-sample);
  }
  const candidates=[...offsets].map(offset=>wall-offset).filter(stamp=>{
    const p=zonedParts(stamp,zone);
    return p.year===y&&p.month===m&&p.day===d&&p.hour===h&&p.minute===min&&p.second===sec;
  }).sort((a,b)=>a-b);
  if(!candidates.length)throw new Error('That local time does not exist because the clocks moved forward. Check the recorded time or timezone.');
  if(candidates.length>1&&disambiguation==='reject')throw new Error('That time occurred twice when clocks moved back. Choose First or Second occurrence under Clock-time ambiguity.');
  const stamp=disambiguation==='later'?candidates.at(-1):candidates[0];
  return {stamp,offsetMinutes:(wall-stamp)/60000,utc:new Date(stamp).toISOString()};
}
export function dashas(moon,birth,yearDays=365.25,now=Date.now()){
  const nak=lunarDetails(moon),first=nak.index%9,year=yearDays*DAY;
  const fullStart=birth-nak.fraction*YEARS[first]*year;
  const cycle=Math.max(0,Math.floor((now-fullStart)/(120*year)));
  let start=fullStart+cycle*120*year;
  const periods=[];
  for(let i=0;i<9;i++){
    const lord=(first+i)%9,end=start+YEARS[lord]*year;
    const sub=[];let subStart=start;
    for(let j=0;j<9;j++){
      const child=(lord+j)%9,subEnd=j===8?end:subStart+YEARS[lord]*YEARS[child]/120*year;
      sub.push({lord:LORDS[child],start:subStart,end:subEnd});subStart=subEnd;
    }
    periods.push({lord:LORDS[lord],years:YEARS[lord],start,end,sub});start=end;
  }
  return {periods,cycle,birthLord:LORDS[first],balanceYears:(1-nak.fraction)*YEARS[first],yearDays};
}
export function dateLabel(stamp,zone){return new Intl.DateTimeFormat('en-GB',{timeZone:zone,day:'2-digit',month:'short',year:'numeric'}).format(new Date(stamp));}
