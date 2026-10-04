import type {Journey,Fix} from './core/journey';
import type {Mission,MissionBook} from './core/missions';
export type {Journey,Mission,MissionBook};
export type PulseFix=Fix&{mocked?:boolean};
/** `reward.coins` = what THIS opening paid, `rank` = its place in the box's first-finder ladder (economy 2). */
export type Claim={id:string;giftId:string;status:'PENDING'|'APPROVED'|'FULFILLED'|'REJECTED';code:string;reward:{title:string;description:string;kind:string;coins?:number;rank?:number;base?:number};createdAt:string};
export type PulseSettings={mapMode?:'auto'|'day'|'night';sound?:boolean;haptic?:boolean;volume?:number;followBearing?:boolean;threeD?:boolean};
export type Snapshot={userId:string;state:{journey:Journey;book:MissionBook};settings:PulseSettings;handle:string;leaderboardOptIn:boolean;session:null|{id:string;seq:number;phase:string};history:Array<{id:string;startedAt:string;meters:number;seconds:number;steps:number;newMeters:number}>;totals?:{walks:number;meters:number;newMeters:number};claims:Claim[];missions:Mission[];config:{enabled:boolean;giftsEnabled:boolean;leaderboardEnabled:boolean;message:string};mapboxToken?:string};
/** Economy 2 fields: `coins` = what opening it now pays, `rank` = the opener's place, `base` = the first finder's coins, `opened`/`stock` = openings used / total. */
export type GiftSignal={signal:boolean;revealed:boolean;quality:boolean;period:number;distance:number;gift:null|{id:string;title:string;description:string;rewardKind:string;position:[number,number];coins?:number;rank?:number;base?:number;opened?:number;stock?:number;decay?:number[]}};
export type LeaderboardRow={handle:string;meters?:number;newMeters?:number;walks?:number;boxes?:number;coins?:number;firsts?:number};
/** `GET /leaderboard?period=&board=` — servers before economy 2 send only `rows`. */
export type Leaderboard={rows:LeaderboardRow[];board?:'boxes'|'meters';period?:'week'|'season';me?:null|{rank:number|null;listed:boolean;boxes:number;coins:number;firsts:number;meters:number;newMeters:number;walks:number};prizes?:null|{coins:number[];endsAt:string};lastWeek?:{board:string;rank:number;handle:string;coins:number}[]};
export const EMPTY_SIGNAL:GiftSignal={signal:false,revealed:false,quality:false,period:2200,distance:0,gift:null};
