/** Civil dates: do not silently normalize e.g. 31 February into March. */
export function cycleDatePickable(iso: string, now = new Date()) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return false;
 const [y,m,d]=iso.split('-').map(Number),date=new Date(y,m-1,d);
 if(date.getFullYear()!==y||date.getMonth()!==m-1||date.getDate()!==d)return false;
 return date>=new Date(now.getFullYear(),now.getMonth()-18,1)&&date<=new Date(now.getFullYear(),now.getMonth(),now.getDate());
}
export function needsCycleOnboarding(mode:string|undefined,lastPeriod:unknown,holding=false){
 if(mode==='PREGNANCY'||mode==='POSTPARTUM'||mode==='PERIMENOPAUSE')return false;
 return !lastPeriod||holding;
}
/**
 * Onboarding dedup (brief §9 item 19): the assessment's goal step already saved „ბოლო მენსტრუაცია“
 * (`api.cycle.setLastPeriod`), so the cycle screen must not ask for the date again — only for the
 * rhythm (cycle / period length, „ცვალებადია“) and contraception. That tail is due once, while nothing
 * else is known yet: a simple mode, a last period, averages still the 28 / 5 defaults with fewer than
 * two completed cycles (`averages.source === 'default'`), no contraception answer. The caller keeps a
 * per-account „done“ flag (`cycleSetupTailKey`) so the person is never asked twice.
 */
export function needsCycleSetupTail(bundle:{profile:{mode?:string;lastPeriodStart?:string|null;contraceptionMethod?:string|null};averages?:{source?:string;cycleCount?:number}|null}|null|undefined,done:boolean){
 if(!bundle||done)return false;
 const {profile,averages}=bundle,mode=profile.mode;
 if(mode==='PREGNANCY'||mode==='POSTPARTUM'||mode==='PERIMENOPAUSE')return false;
 if(!profile.lastPeriodStart||profile.contraceptionMethod)return false;
 return averages?.source==='default'&&(averages.cycleCount??0)<2;
}
/** Preference key of the once-per-account „cycle setup tail answered“ flag. */
export function cycleSetupTailKey(userId:string){return `cycle.setupTail.done:${userId}`;}
