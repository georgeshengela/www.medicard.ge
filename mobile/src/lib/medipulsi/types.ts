import type {Journey,Fix} from './core/journey';
import type {Mission,MissionBook} from './core/missions';
export type {Journey,Mission,MissionBook};
export type PulseFix=Fix&{mocked?:boolean};
export type Claim={id:string;giftId:string;status:'PENDING'|'APPROVED'|'FULFILLED'|'REJECTED';code:string;reward:{title:string;description:string;kind:string};createdAt:string};
export type PulseSettings={mapMode?:'auto'|'day'|'night';sound?:boolean;haptic?:boolean;volume?:number;followBearing?:boolean;threeD?:boolean};
export type Snapshot={userId:string;state:{journey:Journey;book:MissionBook};settings:PulseSettings;handle:string;leaderboardOptIn:boolean;session:null|{id:string;seq:number;phase:string};history:Array<{id:string;startedAt:string;meters:number;seconds:number;steps:number;newMeters:number}>;claims:Claim[];missions:Mission[];config:{enabled:boolean;giftsEnabled:boolean;leaderboardEnabled:boolean;message:string};mapboxToken?:string};
export type GiftSignal={signal:boolean;revealed:boolean;quality:boolean;period:number;distance:number;gift:null|{id:string;title:string;description:string;rewardKind:string;position:[number,number]}};
export const EMPTY_SIGNAL:GiftSignal={signal:false,revealed:false,quality:false,period:2200,distance:0,gift:null};
