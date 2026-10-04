// „ლოკაცია“ in the admin box tools: a Google Maps link (or plain coordinates) → the exact point.
// Order matters: the place pin (!3d…!4d…) is the exact spot; @lat,lng is only where the map was centred.
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const valid=(lat,lng)=>lat!=null&&lng!=null&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&!(lat===0&&lng===0);

/** {latitude, longitude, source} or null. Pure — the same rules run in the admin page (medirunBoxes.js). */
export function parseMapLocation(input){
 let text=String(input||'').trim();
 if(!text)return null;
 try{text=decodeURIComponent(text);}catch{/* keep as is */}
 const pick=(re,source)=>{const m=re.exec(text);if(!m)return null;const lat=num(m[1]),lng=num(m[2]);return valid(lat,lng)?{latitude:lat,longitude:lng,source}:null;};
 return pick(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,'pin')
  ||pick(/[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,'query')
  ||pick(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,'center')
  ||pick(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,'coordinates');
}

// Short share links (phones share maps.app.goo.gl/…) are opened here; only Google's own hosts, no other fetch.
const SHORT_HOSTS=new Set(['maps.app.goo.gl','goo.gl','g.co','maps.google.com','www.google.com','google.com']);
export async function resolveMapLocation(input,{fetchImpl=fetch}={}){
 const direct=parseMapLocation(input);
 if(direct)return direct;
 let url;
 try{url=new URL(String(input).trim());}catch{return null;}
 if(url.protocol!=='https:'||!SHORT_HOSTS.has(url.hostname))return null;
 for(let hop=0;hop<5;hop++){
  const res=await fetchImpl(url.toString(),{method:'GET',redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (Medicard admin)'},signal:AbortSignal.timeout(8000)});
  const next=res.headers.get('location');
  if(next){
   const found=parseMapLocation(next);
   if(found)return found;
   url=new URL(next,url);
   if(url.protocol!=='https:'||!/(^|\.)google\.[a-z.]+$|^maps\.app\.goo\.gl$|^goo\.gl$/.test(url.hostname))return null;
   continue;
  }
  const body=await res.text().catch(()=>'');
  return parseMapLocation(url.toString())||parseMapLocation(body.slice(0,200_000));
 }
 return null;
}
