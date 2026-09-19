// Disposable local visual QA only; never referenced by application code or native exports.
import route from './pulse-route.json';
import {haversineM,bearingDeg} from '../../src/lib/run/geo';
if(process.env.EXPO_PUBLIC_API_URL!=='http://localhost:4318')throw new Error('QA location requires the disposable localhost backend.');
let edge=0,along=0;
const point=(i:number)=>({lng:route[i][0],lat:route[i][1]});
function position(){const a=point(edge),b=point(Math.min(edge+1,route.length-1)),t=along/Math.max(1,haversineM(a,b));return {longitude:a.lng+(b.lng-a.lng)*t,latitude:a.lat+(b.lat-a.lat)*t,accuracy:5,heading:bearingDeg(a,b),speed:1.4};}
const sample=()=>({coords:position(),timestamp:Date.now(),mocked:false});
export const Accuracy={High:4,BestForNavigation:6};
export const getForegroundPermissionsAsync=async()=>({granted:true});
export const getCurrentPositionAsync=async()=>sample();
export const getLastKnownPositionAsync=async()=>sample();
export const watchPositionAsync=async(_options:unknown,receive:(p:ReturnType<typeof sample>)=>void)=>{receive(sample());const timer=setInterval(()=>{along+=5.6;while(edge<route.length-2&&along>haversineM(point(edge),point(edge+1))){along-=haversineM(point(edge),point(edge+1));edge++;}receive(sample());},4000);return {remove:()=>clearInterval(timer)};};
export const watchHeadingAsync=async(receive:(h:{trueHeading:number;magHeading:number})=>void)=>{receive({trueHeading:position().heading,magHeading:position().heading});const timer=setInterval(()=>receive({trueHeading:position().heading,magHeading:position().heading}),1000);return {remove:()=>clearInterval(timer)};};
