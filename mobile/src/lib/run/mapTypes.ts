import type {LatLng} from './geo';
export type RunMapMessage =
 | {type:'init';origin:LatLng;pin:LatLng|null;route:[number,number][]|null;radiusM?:number;fit?:boolean}
 | {type:'fix';lat:number;lng:number;heading:number|null}
 | {type:'trail';coords:[number,number][]}
 | {type:'paint';lines:[number,number][][]}
 | {type:'mission';center:[number,number]|null;radius?:number}
 | {type:'gift';position:[number,number]|null}
 | {type:'options';rotate:boolean;threeD:boolean}
 | {type:'fit';bottom?:number}|{type:'follow'}|{type:'reached'}|{type:'theme';dark:boolean};
export type RunMapHandle={send:(message:RunMapMessage)=>void};
export type RunMapProps={center:LatLng;onReady?:()=>void;onFollowChange?:(following:boolean)=>void;onError?:(message:string)=>void;style?:object;mapDark?:boolean};
