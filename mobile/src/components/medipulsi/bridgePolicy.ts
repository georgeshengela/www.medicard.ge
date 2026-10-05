export type BridgeMessage={channel:'medipulsi';id:string;action:string;payload?:Record<string,unknown>};
export function parseBridgeMessage(raw:string):BridgeMessage|null{
 if(raw.length>100000)return null;
 try{const m=JSON.parse(raw);if(m?.channel!=='medipulsi'||typeof m.id!=='string'||m.id.length>80||typeof m.action!=='string')return null;return m;}catch{return null;}
}
export function allowedApi(path:unknown,method:unknown):path is string{
 if(typeof path!=='string'||typeof method!=='string')return false;
 // GET: the hub/panel reads — the wallet and both leaderboard boards (period + board) included.
 if(method==='GET')return /^\/(bootstrap|nearby|territory|grand|drops|wallet|crew|city|cities|wrapped|leaderboard(?:\?period=(week|season)(?:&board=(boxes|meters))?)?)$/.test(path);
 if(method==='PATCH')return path==='/settings'||path==='/crew';
 if(method==='PUT')return path==='/mission';
 return method==='POST'&&/^\/(sessions(?:\/[a-zA-Z0-9_-]+\/(batches|pause|resume|finish))?|gifts\/[a-zA-Z0-9_-]+\/claim|crew|crew\/(join|leave)|crew\/members\/[a-zA-Z0-9_-]+\/remove)$/.test(path);
}
export function trustedGameUrl(url:string,base:string){try{const u=new URL(url),b=new URL(base);return u.origin===b.origin&&u.pathname==='/medipulsi/';}catch{return false;}}
