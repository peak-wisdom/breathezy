// SPDX-License-Identifier: AGPL-3.0-only
import {norm,sign,navamsa,lunarDetails,birthInstant,dashas} from './core.js';
let enginePromise;
export function loadEngine(){
  if(!enginePromise)enginePromise=(async()=>{
    const lib=await import('https://cdn.jsdelivr.net/npm/@swisseph/browser@1.4.0/dist/swisseph-browser.js');
    const swe=new lib.SwissEphemeris();await swe.init();swe.setSiderealMode(lib.SiderealMode.Lahiri);
    return {swe,lib};
  })().catch(error=>{enginePromise=null;throw new Error('The ephemeris could not load. Check your internet connection and try Generate again.');});
  return enginePromise;
}
export async function calculate(input){
  const instant=birthInstant(input.date,input.time,input.zone,input.disambiguation);
  if(!Number.isFinite(input.latitude)||Math.abs(input.latitude)>=90||!Number.isFinite(input.longitude)||Math.abs(input.longitude)>180)throw new Error('Enter latitude between −90 and 90 and longitude between −180 and 180.');
  const {swe,lib}=await loadEngine();
  const jd=swe.dateToJulianDay(new Date(instant.stamp));
  const flags=lib.CalculationFlag.MoshierEphemeris|lib.CalculationFlag.Speed|lib.CalculationFlag.Sidereal;
  const ayanamsa=swe.getAyanamsaExUt(jd,lib.CalculationFlag.MoshierEphemeris);
  const houses=swe.calculateHouses(jd,input.latitude,input.longitude,lib.HouseSystem.WholeSign);
  const ascendant=norm(houses.ascendant-ayanamsa);
  if(!Number.isFinite(ascendant))throw new Error('An ascendant could not be calculated for these coordinates. Check the birthplace.');
  const bodies=[['Sun','Su',lib.Planet.Sun],['Moon','Mo',lib.Planet.Moon],['Mars','Ma',lib.Planet.Mars],['Mercury','Me',lib.Planet.Mercury],['Jupiter','Ju',lib.Planet.Jupiter],['Venus','Ve',lib.Planet.Venus],['Saturn','Sa',lib.Planet.Saturn],['Rahu','Ra',input.nodes==='true'?lib.LunarPoint.TrueNode:lib.LunarPoint.MeanNode]];
  const planets=bodies.map(([name,short,id])=>{
    const position=swe.calculatePosition(jd,id,flags);
    if(!(position.flags&lib.CalculationFlag.MoshierEphemeris)||!Number.isFinite(position.longitude))throw new Error('The ephemeris did not return a valid planetary position.');
    return {name,short,longitude:norm(position.longitude),retrograde:position.longitudeSpeed<0,speed:position.longitudeSpeed};
  });
  const rahu=planets.find(p=>p.name==='Rahu');
  planets.push({name:'Ketu',short:'Ke',longitude:norm(rahu.longitude+180),retrograde:rahu.retrograde,speed:rahu.speed});
  const points=[{name:'Lagna',short:'Asc',longitude:ascendant,retrograde:false},...planets].map(p=>({...p,rashi:sign(p.longitude),house:(sign(p.longitude)-sign(ascendant)+12)%12+1,navamsa:navamsa(p.longitude),nakshatra:lunarDetails(p.longitude)}));
  const moon=planets.find(p=>p.name==='Moon');
  return {input:{...input},instant,jd,ayanamsa,ascendant,points,dashas:dashas(moon.longitude,instant.stamp,input.yearDays),version:swe.version()};
}
