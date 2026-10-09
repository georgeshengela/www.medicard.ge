import type {LatLng} from './geo';
import type {RunWeatherFx} from './runWeather';
export type RunMapMessage =
 | {type:'init';origin:LatLng;pin:LatLng|null;route:[number,number][]|null;radiusM?:number;fit?:boolean;hero?:'m'|'f';runner?:boolean}
 | {type:'fix';lat:number;lng:number;heading:number|null;speed?:number}
 | {type:'trail';coords:[number,number][]}
 | {type:'paint';lines:[number,number][][]}
 | {type:'mission';center:[number,number]|null;radius?:number}
 | {type:'gift';position:[number,number]|null}
 | {type:'options';rotate:boolean;threeD:boolean}
 | {type:'fit';bottom?:number;top?:number;paintOnly?:boolean}|{type:'follow'}|{type:'reached'}|{type:'theme';dark:boolean}
 /** Glow map: what the runner is doing ('auto' = from GPS speed) and how much of the screen the native chrome covers. */
 | {type:'activity';value:'auto'|'idle'|'dance'}
 | {type:'layout';top:number;bottom:number}
 /** Live weather where the runner is: rain, snow, fog or lightning over the city (null = clear). */
 | {type:'weather';fx:RunWeatherFx|null}
 /** Box hunt: the zone where a district's boxes lie, the way there; `tour` flies over it once and comes back. */
 | {type:'hunt';center:[number,number]|null;radius?:number;route?:[number,number][]|null;label?:string;tour?:boolean}
 /** How much of the way to the zone is walked (0–1): the map trims that part off. */
 | {type:'huntProgress';done:number};
export type RunMapHandle={send:(message:RunMapMessage)=>void};
export type RunMapProps={center:LatLng;onReady?:()=>void;onFollowChange?:(following:boolean)=>void;onError?:(message:string)=>void;onLit?:(count:number)=>void;style?:object;mapDark?:boolean};
