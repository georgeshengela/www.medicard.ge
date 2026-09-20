import type {PulseFix} from './types';

/** CLLocation uses fractional milliseconds and negative values for unknown accuracy/speed. */
export function normalizePulseFix(value:unknown):PulseFix|null{
 if(!value||typeof value!=='object')return null;
 const fix=value as PulseFix;
 if(!Array.isArray(fix.position)||fix.position.length!==2||!fix.position.every(Number.isFinite)||Math.abs(fix.position[0])>180||Math.abs(fix.position[1])>90)return null;
 if(!Number.isFinite(fix.timestamp)||fix.timestamp<1||fix.timestamp>Number.MAX_SAFE_INTEGER)return null;
 return {position:[fix.position[0],fix.position[1]],timestamp:Math.trunc(fix.timestamp),
  accuracy:Number.isFinite(fix.accuracy)&&fix.accuracy>=0&&fix.accuracy<=100000?fix.accuracy:999,
  speed:typeof fix.speed==='number'&&Number.isFinite(fix.speed)&&fix.speed>=0&&fix.speed<=1000?fix.speed:null,
  ...(typeof fix.mocked==='boolean'?{mocked:fix.mocked}:{})};
}

/** Only called after HTTP 400: an accepted/uncertain batch must retain its exact digest. */
export function repairRejectedBatch(body:unknown):unknown|null{
 if(!body||typeof body!=='object')return null;
 const batch=body as {id:string;seq:number;fixes:PulseFix[]};
 if(typeof batch.id!=='string'||!Number.isSafeInteger(batch.seq)||batch.seq<1||!Array.isArray(batch.fixes)||!batch.fixes.length||batch.fixes.length>120)return null;
 const fixes=batch.fixes.map(normalizePulseFix);
 if(fixes.some(f=>f===null))return null;
 if(!fixes.some((f,i)=>f!.timestamp!==batch.fixes[i].timestamp||f!.accuracy!==batch.fixes[i].accuracy||f!.speed!==batch.fixes[i].speed))return null;
 return {...batch,fixes};
}
