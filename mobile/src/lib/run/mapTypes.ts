import type {LatLng} from './geo';
export type RunMapMessage =
 | {type:'init';origin:LatLng;pin:LatLng|null;route:[number,number][]|null;radiusM?:number;fit?:boolean;hero?:'m'|'f';runner?:boolean}
 | {type:'fix';lat:number;lng:number;heading:number|null}
 | {type:'trail';coords:[number,number][]}
 | {type:'paint';lines:[number,number][][]}
 | {type:'mission';center:[number,number]|null;radius?:number}
 | {type:'gift';position:[number,number]|null}
 | {type:'options';rotate:boolean;threeD:boolean}
 | {type:'fit';bottom?:number;top?:number;paintOnly?:boolean}|{type:'follow'}|{type:'reached'}|{type:'theme';dark:boolean}
 /** Glow map: what the runner is doing ('auto' = from GPS speed) and how much of the screen the native chrome covers. */
 | {type:'activity';value:'auto'|'idle'|'dance'}
 | {type:'layout';top:number;bottom:number};
export type RunMapHandle={send:(message:RunMapMessage)=>void};
export type RunMapProps={center:LatLng;onReady?:()=>void;onFollowChange?:(following:boolean)=>void;onError?:(message:string)=>void;onLit?:(count:number)=>void;style?:object;mapDark?:boolean};
