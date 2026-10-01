// „გაანათე თბილისი“ eligibility: how much of Tbilisi a person has lit and what they still need for the grand prize.
// Uses the same share function as the gift gate (giftRules.cityShare), so the page and the box never disagree.
import {CAMPAIGN} from './autopilot.js';
import {cityShare} from './giftRules.js';

/** A walk paints a ~100 m wide strip: 1 km of new street ≈ 0.1 km². */
export const KM2_PER_STREET_KM=0.1;
const round=(n,d=3)=>Math.round(n*10**d)/10**d;
const streetKm=(percent,areaKm2)=>Math.ceil(Math.max(0,percent)/100*areaKm2/KM2_PER_STREET_KM);

/** Pure view of the eligibility page for one share and one moment. */
export function grandView({share,lang='ka',now=Date.now(),campaign=CAMPAIGN}){
 const L=v=>(lang==='en'?v?.en:v?.ka)||v?.ka||'';
 const g=campaign.grand,drop=new Date(g.dropAt),end=new Date(drop.getTime()+g.hours*3600_000),areaKm2=campaign.area.km2;
 const percent=Math.max(0,Number(share?.percent)||0),need=g.minPercent;
 const levels=campaign.levels.map(l=>({id:l.id,name:L(l.name),percent:l.percent,reached:percent+1e-9>=l.percent,unlocks:L(l.unlocks)}));
 const next=levels.find(l=>!l.reached)||null;
 return {
  campaign:{id:campaign.id,name:L(campaign.name),status:now<drop.getTime()?'upcoming':now<end.getTime()?'live':'ended',dropAt:drop.toISOString(),prize:L(g.prize),prizeDetail:L(g.detail),rulesUrl:campaign.rulesUrl},
  requirement:{areaId:campaign.area.id,city:L({ka:campaign.area.ka,en:campaign.area.en}),percent:need,areaKm2},
  me:{percent:round(percent),paintedKm2:round(Number(share?.paintedKm2)||0),eligible:percent+1e-9>=need,remainingPercent:round(Math.max(0,need-percent)),remainingKm2:round(Math.max(0,need-percent)/100*areaKm2),remainingStreetKm:streetKm(need-percent,areaKm2)},
  levels,
  next:next&&{id:next.id,name:next.name,percent:next.percent,remainingStreetKm:streetKm(next.percent-percent,areaKm2)},
 };
}

export async function grandStatus(userId,lang='ka'){
 const share=await cityShare(userId,CAMPAIGN.area.id,{fallbackKm2:CAMPAIGN.area.km2,maxAgeMs:60_000});
 return grandView({share,lang});
}
