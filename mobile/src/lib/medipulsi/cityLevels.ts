import {tx} from '../../i18n/locale.js';

/**
 * Light levels of one city (owner 2026-10-05, „ჩემი ქალაქები“): the share of a city a walker lights stays small for
 * a long time, so the meter shows the way to the next level, not the share of the whole city. The first four match
 * the Tbilisi campaign levels.
 */
export type CityLevel={percent:number;name:string;gold:boolean};
export const CITY_LEVELS:ReadonlyArray<{percent:number;ka:string;en:string}>=[
 {percent:0.1,ka:'ნაპერწკალი',en:'Spark'},
 {percent:0.25,ka:'ფარანი',en:'Lantern'},
 {percent:0.5,ka:'ჩირაღდანი',en:'Torch'},
 {percent:1,ka:'შუქურა',en:'Lighthouse'},
 {percent:2.5,ka:'ვარსკვლავი',en:'Star'},
 {percent:5,ka:'თანავარსკვლავედი',en:'Constellation'},
 {percent:10,ka:'მზე',en:'Sun'},
];
const level=(l:typeof CITY_LEVELS[number]):CityLevel=>({percent:l.percent,name:tx(l.ka,l.en),gold:l.percent>=0.25});

/** The reached level, the next one and how far along the way to it (0–1). Past the last level progress is 1. */
export function cityLevel(percent:number){
 const p=Number.isFinite(percent)&&percent>0?percent:0;
 let i=-1;for(let k=0;k<CITY_LEVELS.length;k++)if(p+1e-9>=CITY_LEVELS[k].percent)i=k;
 const current=i>=0?level(CITY_LEVELS[i]):null,next=i+1<CITY_LEVELS.length?level(CITY_LEVELS[i+1]):null;
 const from=current?.percent??0,to=next?.percent??from;
 return {current,next,progress:next?Math.max(0,Math.min(1,(p-from)/(to-from))):1};
}
/**
 * The honest meter (owner 2026-10-05: „0,03% ნამეტანი დიდად ჩანს“): a fixed linear scale up to Lighthouse (1%), then
 * to 10% and 100% — never stretched to the next small level, so a tiny share looks tiny. `ticks` mark the levels on
 * the scale (0–1 positions).
 */
export function cityScale(percent:number){
 const p=Number.isFinite(percent)&&percent>0?percent:0;
 const max=p<1?1:p<10?10:100;
 const ticks=CITY_LEVELS.filter(l=>l.percent<max&&l.percent>=max/20).map(l=>({at:l.percent/max,name:tx(l.ka,l.en),reached:p+1e-9>=l.percent}));
 const top=CITY_LEVELS.find(l=>l.percent===max);
 return {max,fill:Math.min(1,p/max),ticks,goal:top?tx(top.ka,top.en):null};
}
/** Lit segments of an LED meter with `count` segments; a started segment counts as half (0.5). */
export function meterSegments(progress:number,count:number){
 const v=Math.max(0,Math.min(1,progress))*count,full=Math.floor(v);
 // a real but tiny share still shows a spark in the first segment
 return Array.from({length:count},(_,i)=>i<full?1:i===full&&v-full>0.001?0.5:0);
}
