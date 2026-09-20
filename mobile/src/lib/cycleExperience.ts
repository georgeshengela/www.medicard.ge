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
