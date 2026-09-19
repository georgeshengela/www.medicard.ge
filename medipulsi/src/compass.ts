export type CompassReading={heading:number;at:number};
export type OrientationSample={alpha:number|null;absolute?:boolean;webkitCompassHeading?:number;webkitCompassAccuracy?:number};
export const normalizeHeading=(angle:number)=>((angle%360)+360)%360;
export function orientationHeading(event:OrientationSample,screenAngle=0):number|null{
 if(Number.isFinite(event.webkitCompassHeading)){const accuracy=event.webkitCompassAccuracy;if(accuracy!==undefined&&(!Number.isFinite(accuracy)||accuracy<0||accuracy>40))return null;return normalizeHeading(event.webkitCompassHeading!+screenAngle);}
 if(event.absolute&&event.alpha!==null&&Number.isFinite(event.alpha))return normalizeHeading(360-event.alpha+screenAngle);
 return null;
}
export function currentHeading(reading:CompassReading|null,fallback:number,now=Date.now()){return reading&&now-reading.at>=0&&now-reading.at<5000?reading.heading:normalizeHeading(fallback);}
