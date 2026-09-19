import SunCalc from 'suncalc';
/** Solar altitude also handles polar day/night without invalid sunrise dates. */
export function nightAt(latitude:number,longitude:number,date=new Date()){return SunCalc.getPosition(date,latitude,longitude).altitude<-.0145;}
