// SPDX-License-Identifier: AGPL-3.0-only
import {SIGNS,RASHIS,sign,degrees,dateLabel} from './core.js';
export const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const ink='#243e34',muted='#657469',line='#b8aa8b',paper='#fffdf7',gold='#8b642e';
const text=(x,y,value,size=28,fill=ink,anchor='start',weight='400')=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${escape(value)}</text>`;
function chunks(values,size){const rows=[];for(let i=0;i<values.length;i+=size)rows.push(values.slice(i,i+size).join('  '));return rows;}
export function chartSVG(chart,division,style='south',extra=''){
  const getSign=p=>division==='D9'?sign(p.navamsa):p.rashi;
  const asc=getSign(chart.points[0]),groups=Array.from({length:12},()=>[]);
  chart.points.forEach(p=>groups[getSign(p)].push(p.short+(p.retrograde?'R':'')));
  let content=`<rect x="1" y="1" width="998" height="998" rx="4" fill="${paper}" stroke="${line}" stroke-width="3"/>`;
  if(style==='south'){
    const cells=[[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[2,3],[1,3],[0,3],[0,2],[0,1],[0,0]];
    cells.forEach(([col,row],s)=>{
      const x=col*250,y=row*250;
      content+=`<rect x="${x+1}" y="${y+1}" width="248" height="248" fill="${s===asc?'#edf3e9':paper}" stroke="${line}" stroke-width="2"/>`;
      content+=text(x+18,y+36,(s+1)+' · '+SIGNS[s],25,gold);
      content+=text(x+18,y+68,'H'+((s-asc+12)%12+1)+(s===asc?' · Lagna':''),21,muted);
      chunks(groups[s],2).forEach((value,i)=>{content+=text(x+125,y+108+i*29,value,29,ink,'middle','500');});
    });
    content+=text(500,450,division==='D1'?'D1 · Rashi':'D9 · Navamsa',44,ink,'middle','600');
    content+=text(500,505,'Lagna: '+SIGNS[asc],29,gold,'middle');
    content+=text(500,555,'Fixed signs · whole-sign houses',23,muted,'middle');
  }else{
    content+=`<path d="M0 0L1000 1000M1000 0L0 1000M500 0L1000 500L500 1000L0 500Z" fill="none" stroke="${line}" stroke-width="3"/>`;
    const centers=[[500,250],[250,115],[112,250],[250,500],[112,750],[250,885],[500,750],[750,885],[888,750],[750,500],[888,250],[750,115]];
    centers.forEach(([x,y],house)=>{
      const s=(asc+house)%12,rows=chunks(groups[s],3);
      content+=text(x,y-35,'H'+(house+1)+' · '+(s+1),24,gold,'middle');
      content+=text(x,y-7,SIGNS[s],22,muted,'middle');
      rows.forEach((value,i)=>{content+=text(x,y+25+i*27,value,25,ink,'middle','500');});
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" ${extra} role="img" aria-label="${division==='D1'?'D1 Rashi':'D9 Navamsa'} chart, ${style==='south'?'South':'North'} Indian layout"><title>${division==='D1'?'D1 Rashi':'D9 Navamsa'} chart</title>${content}</svg>`;
}
export function placementRows(chart){return chart.points.map(p=>[p.name+(p.retrograde?' (R)':''),RASHIS[p.rashi]+' / '+SIGNS[p.rashi],degrees(p.longitude),String(p.house),p.nakshatra.name+' · '+p.nakshatra.pada,SIGNS[sign(p.navamsa)]]);}
function table(x,y,widths,headers,rows,rowHeight=48){
  const total=widths.reduce((a,b)=>a+b,0);
  let output=`<rect x="${x}" y="${y}" width="${total}" height="${rowHeight}" fill="#eaf0e4"/>`;
  let left=x;headers.forEach((label,i)=>{output+=text(left+16,y+rowHeight*.65,label,24,ink,'start','600');left+=widths[i];});
  rows.forEach((row,r)=>{
    const top=y+(r+1)*rowHeight;
    if(r%2===0)output+=`<rect x="${x}" y="${top}" width="${total}" height="${rowHeight}" fill="#f7f6ee"/>`;
    let left=x;row.forEach((value,i)=>{output+=text(left+16,top+rowHeight*.65,value,24);left+=widths[i];});
  });return output;
}
export function reportSVG(chart,selected=0){
  const width=2400,height=3260,zone=chart.input.zone,period=chart.dashas.periods[selected];
  const moon=chart.points.find(p=>p.name==='Moon'),asc=chart.points[0];
  let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="2400" height="3260" fill="${paper}"/>`;
  out+=text(90,100,'VEDIC BIRTH CHART',50,ink,'start','600');
  out+=text(90,158,(chart.input.name||'Birth chart').slice(0,80),35,gold);
  out+=text(90,210,chart.input.date+' · '+chart.input.time+' · '+chart.input.place.slice(0,75),27);
  out+=text(90,252,zone+' · UTC '+chart.instant.utc.replace('T',' ').replace('.000Z','Z')+' · '+chart.input.latitude.toFixed(5)+', '+chart.input.longitude.toFixed(5),25,muted);
  out+=text(90,293,'Lahiri ayanamsa '+chart.ayanamsa.toFixed(6)+'° · Whole-sign houses · '+(chart.input.nodes==='true'?'True':'Mean')+' lunar nodes · Dasha year '+chart.input.yearDays+' days',25,muted);
  out+=text(90,328,'Swiss Ephemeris '+chart.version+' / Moshier · Gregorian calendar · R = retrograde · Asc = Lagna',24,muted);
  const summaries=[['LAGNA',RASHIS[asc.rashi]+' / '+SIGNS[asc.rashi]],['MOON RASHI',RASHIS[moon.rashi]+' / '+SIGNS[moon.rashi]],['BIRTH NAKSHATRA',moon.nakshatra.name+' · Pada '+moon.nakshatra.pada],['DASHA AT BIRTH',chart.dashas.birthLord+' · '+chart.dashas.balanceYears.toFixed(3)+' years left']];
  summaries.forEach(([label,value],i)=>{const x=90+i*560;out+=`<rect x="${x}" y="360" width="540" height="112" rx="12" fill="#edf2e7"/>`;out+=text(x+20,397,label,21,gold);out+=text(x+20,440,value,27,ink,'start','500');});
  out+=text(90,540,'D1 · Rashi',35,ink,'start','600')+text(1230,540,'D9 · Navamsa',35,ink,'start','600');
  out+=chartSVG(chart,'D1',chart.input.style,'x="90" y="570" width="1080" height="1080"');
  out+=chartSVG(chart,'D9',chart.input.style,'x="1230" y="570" width="1080" height="1080"');
  out+=text(90,1720,'Planetary placements',36,ink,'start','600');
  out+=table(90,1755,[250,360,250,140,650,570],['Point','D1 Rashi','Degrees in sign','House','Nakshatra · Pada','D9 sign'],placementRows(chart),49);
  out+=text(90,2375,'Vimshottari mahadashas',34,ink,'start','600');
  out+=text(1230,2375,period.lord+' antardashas',34,ink,'start','600');
  const date=stamp=>dateLabel(stamp,zone);
  out+=table(90,2420,[250,415,415],['Lord','Starts','Ends'],chart.dashas.periods.map(p=>[p.lord,date(p.start),date(p.end)]),46);
  out+=table(1230,2420,[250,415,415],['Lord','Starts','Ends'],period.sub.map(p=>[p.lord,date(p.start),date(p.end)]),46);
  out+=text(90,2965,'Period dates use '+zone+'. The first mahadasha can start before birth; the balance above is the remaining portion at birth.',24,muted);
  out+=text(90,3010,'Displayed 120-year cycle: '+date(chart.dashas.periods[0].start)+' to '+date(chart.dashas.periods.at(-1).end)+'. Boundaries depend on the selected year convention.',24,muted);
  out+=text(90,3055,'D9 signs divide each 30° sign into nine 3°20′ segments. Birth-time accuracy is especially important near sign and Navamsa boundaries.',24,muted);
  out+=`<path d="M90 3120H2310" stroke="${line}"/>`;
  out+=text(90,3180,'STILL / VEDIC CHARTS',23,gold)+text(2310,3180,'D1 + D9 + placements + dashas · one chart sheet',23,muted,'end');
  return out+'</svg>';
}
