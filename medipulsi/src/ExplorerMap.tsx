import {currentSignal,currentSnapshot} from './cloud';
import {useEffect,useRef,useState} from 'react';
import mapboxgl from 'mapbox-gl';
import {NODES,PLAYABLE,PARK,coverageFeatures,proximity,GIFTS,parkProgress,interpolate} from './journey';
import type {Journey,DemoConfig} from './journey';
import type {Coordinate} from './engine';
import {distance} from './engine';
import {easeAngle} from './motion';
import type {Lighting} from './mapTypes';
import {currentHeading} from './compass';
import type {CompassReading} from './compass';
import {missionCircle} from './missions';
import {trailFeatures} from './trail';
import type {Mission} from './missions';
type Props={motion:{current:Journey};snapshot:Journey;config:DemoConfig;lighting:Lighting;threeD:boolean;showNetwork:boolean;followBearing:boolean;headingRef:{current:CompassReading|null};mission:Mission|null;missionComplete:boolean;missionFocus:number;visible:boolean;recenter:number;overview:number;selecting:boolean;onPick:(p:Coordinate)=>void;onGift:()=>void;onReady:()=>void};
export default function ExplorerMap(props:Props){
 const host=useRef<HTMLDivElement>(null),map=useRef<mapboxgl.Map|null>(null),current=useRef(props);current.current=props;
 const following=useRef(true),lock=useRef(0),ready=useRef(false),visual=useRef<Coordinate>(props.snapshot.position),angle=useRef(props.snapshot.heading);
 const gift=useRef<mapboxgl.Marker|null>(null),player=useRef<mapboxgl.Marker|null>(null);const [error,setError]=useState('');
 const dark=props.lighting==='night'||props.lighting==='dusk',lastDark=useRef(dark);
 const padding=()=>({top:88,bottom:145,left:24,right:24});
 function follow(){const m=map.current;if(!m)return;const p=current.current;following.current=true;lock.current=performance.now()+650;m.easeTo({center:p.motion.current.position,zoom:17.35,pitch:p.threeD?48:0,bearing:p.followBearing?currentHeading(p.headingRef.current,p.motion.current.heading):0,padding:padding(),duration:650});}
 useEffect(()=>{
  if(!host.current)return;let m:mapboxgl.Map;
  try{m=new mapboxgl.Map({container:host.current,accessToken:currentSnapshot.mapboxToken||import.meta.env.VITE_MAPBOX_TOKEN,style:dark?'mapbox://styles/mapbox/dark-v11':'mapbox://styles/mapbox/light-v11',center:visual.current,zoom:17.35,pitch:current.current.threeD?48:0,bearing:current.current.followBearing?angle.current:0,antialias:true,attributionControl:false,localFontFamily:'Noto Sans Georgian',maxZoom:20,minZoom:11});}catch{setError('რუკა ვერ ჩაიტვირთა. გადაამოწმე ინტერნეტი და ბრაუზერის 3D მხარდაჭერა.');return;}
  map.current=m;m.setPadding(padding());m.addControl(new mapboxgl.AttributionControl({compact:true,customAttribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank">OSM ბილიკები</a>'}));
  const el=document.createElement('div');el.className='explorer-puck';el.setAttribute('aria-label','შენი მდებარეობა');el.innerHTML='<span class="puck-halo"></span><span class="puck-direction"></span><span class="puck-disc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-5 4 10 2-5h4"/></svg></span>';
  player.current=new mapboxgl.Marker({element:el,rotationAlignment:'map',pitchAlignment:'viewport',occludedOpacity:1}).setLngLat(visual.current).setRotation(angle.current).addTo(m);
  const giftEl=document.createElement('button');giftEl.className='gift-beacon';giftEl.setAttribute('aria-label','აღმოჩენილი საჩუქრის გახსნა');giftEl.innerHTML='<span class="gift-beacon-ground"></span><span class="gift-beacon-column"></span><span class="gift-beacon-orbit"></span><span class="gift-beacon-art"></span>';
  gift.current=new mapboxgl.Marker({element:giftEl,anchor:'bottom',offset:[0,5],occludedOpacity:1});giftEl.setAttribute('role','button');giftEl.type='button';giftEl.onclick=()=>current.current.onGift();let spriteLoaded=false,alive=true,giftShown=false;
  const ensureGift=()=>{if(spriteLoaded)return;spriteLoaded=true;void import('./giftModel').then(({giftSprite})=>{if(!alive)return;const img=document.createElement('img');img.alt='აღმოჩენილი საჩუქარი';img.src=giftSprite();giftEl.querySelector('.gift-beacon-art')?.appendChild(img);}).catch(()=>{giftEl.querySelector('.gift-beacon-art')!.textContent='საჩუქარი';});};
  m.on('style.load',()=>{if(!alive)return;const d=current.current.lighting==='night'||current.current.lighting==='dusk';
   for(const l of m.getStyle().layers||[]){if(l.type==='background')m.setPaintProperty(l.id,'background-color',d?'#0a1424':'#e7eeed');if(l.type==='fill'&&/landuse|landcover/.test(l.id))m.setPaintProperty(l.id,'fill-color',d?'#152238':'#d7e6dc');if(l.type==='line'&&/road/.test(l.id)&&!l.id.includes('label'))m.setPaintProperty(l.id,'line-color',d?(l.id.includes('case')?'#152336':'#34475a'):(l.id.includes('case')?'#ccd9d5':'#f8fcfa'));if(l.type==='symbol'&&l.id.includes('label')){m.setLayoutProperty(l.id,'text-field',['coalesce',['get','name_ka'],['get','name']]);m.setPaintProperty(l.id,'text-color',d?'#98aabd':'#536963');}}
   if(m.getLayer('water'))m.setPaintProperty('water','fill-color',d?'#0d253e':'#b7d9de');
   if(m.getSource('composite'))m.addLayer({id:'explorer-buildings',type:'fill-extrusion',source:'composite','source-layer':'building',minzoom:15,filter:['==','extrude','true'],paint:{'fill-extrusion-color':d?'#293e53':'#bed0cb','fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','min_height'],'fill-extrusion-opacity':.75}});
   m.addSource('explorer-zone',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[PARK]}}});
   m.addLayer({id:'explorer-zone-fill',type:'fill',source:'explorer-zone',paint:{'fill-color':'#14b8a6','fill-opacity':parkProgress(current.current.motion.current).complete?.18:0}});
   m.addLayer({id:'explorer-zone-line',type:'line',source:'explorer-zone',layout:{visibility:current.current.showNetwork?'visible':'none'},paint:{'line-color':'#14b8a6','line-opacity':.6,'line-width':1.5,'line-dasharray':[3,4]}});
   m.addSource('mission-zone',{type:'geojson',data:current.current.mission?missionCircle(current.current.mission):{type:'FeatureCollection',features:[]}});
   m.addLayer({id:'mission-zone-fill',type:'fill',source:'mission-zone',paint:{'fill-color':'#14b8a6','fill-opacity':current.current.missionComplete?.17:.07}});
   m.addLayer({id:'mission-zone-line',type:'line',source:'mission-zone',paint:{'line-color':'#2dd4bf','line-width':2,'line-opacity':.8,'line-dasharray':[2,2]}});
   m.addSource('explorer-network',{type:'geojson',data:{type:'FeatureCollection',features:PLAYABLE.map(e=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[NODES[e.a],NODES[e.b]]}}))}});
   m.addLayer({id:'explorer-paths',type:'line',source:'explorer-network',layout:{visibility:current.current.showNetwork?'visible':'none'},paint:{'line-color':d?'#b5ccc9':'#517970','line-width':2,'line-opacity':.55,'line-dasharray':[2,3]}});
   m.addSource('explorer-trail',{type:'geojson',data:trailFeatures(current.current.motion.current.trail)});
   [{id:'glow',width:16,blur:5,opacity:.3,color:'#14b8a6'},{id:'line',width:5,blur:0,opacity:.9,color:'#14b8a6'},{id:'center',width:1.2,blur:0,opacity:.85,color:'#ccfbf1'}].forEach(l=>m.addLayer({id:'explorer-trail-'+l.id,type:'line',source:'explorer-trail',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':l.color,'line-width':['interpolate',['linear'],['zoom'],14,l.width*.4,17.35,l.width,19,l.width*1.4],'line-blur':l.blur,'line-opacity':l.opacity}}));
   m.addSource('explorer-covered',{type:'geojson',data:coverageFeatures(current.current.motion.current)});
   [{id:'aura',color:'#14b8a6',width:38,blur:13,opacity:.18},{id:'area',color:'#14b8a6',width:22,blur:1,opacity:.22},{id:'edge',color:'#0f766e',width:10,blur:0,opacity:1},{id:'body',color:'#2dd4bf',width:7,blur:0,opacity:1},{id:'core',color:'#ccfbf1',width:1.3,blur:0,opacity:.8}].forEach(l=>m.addLayer({id:'explorer-'+l.id,type:'line',source:'explorer-covered',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':l.color,'line-width':['interpolate',['linear'],['zoom'],14,l.width*.35,17.35,l.width,19,l.width*1.4],'line-blur':l.blur,'line-opacity':l.opacity}}));
   ready.current=true;setError('');current.current.onReady();
  });
  m.on('error',e=>{if(/401|403/.test(e.error?.message||''))setError('რუკის წვდომა მიუწვდომელია.');});
  m.on('dragstart',()=>{following.current=false;});m.on('zoomstart',e=>{if((e as {originalEvent?:Event}).originalEvent)following.current=false;});m.on('rotatestart',e=>{if(e.originalEvent)following.current=false;});
  m.on('click',e=>{if(current.current.selecting)current.current.onPick([e.lngLat.lng,e.lngLat.lat]);});
  let frame=0,previous=performance.now(),lastPaint=0,lastMeters=-1,lastSource='',lastCovered=-1;
  function render(now:number){const dt=Math.min(.06,(now-previous)/1000);previous=now;const p=current.current,s=p.motion.current;
   if(p.visible&&!document.hidden){
    const targetHeading=currentHeading(p.headingRef.current,s.heading),d=distance(visual.current,s.position);visual.current=d>300?[...s.position]:interpolate(visual.current,s.position,1-Math.exp(-dt*15));angle.current=easeAngle(angle.current,targetHeading,1-Math.exp(-dt*10));player.current?.setLngLat(visual.current).setRotation(angle.current);
    const cameraBearing=p.followBearing?easeAngle(m.getBearing(),targetHeading,1-Math.exp(-dt*3)):0;
    if(following.current&&now>lock.current&&(d>.015||Math.abs(cameraBearing-m.getBearing())>.01||lastSource!==s.source))m.jumpTo({center:visual.current,bearing:cameraBearing});
    if(ready.current&&now-lastPaint>300&&(s.meters!==lastMeters||s.source!==lastSource||Object.keys(s.covered).length!==lastCovered)){
     (m.getSource('explorer-trail') as mapboxgl.GeoJSONSource)?.setData(trailFeatures(s.trail));
     (m.getSource('explorer-covered') as mapboxgl.GeoJSONSource)?.setData(coverageFeatures(s));m.setPaintProperty('explorer-zone-fill','fill-opacity',parkProgress(s).complete?.18:0);lastPaint=now;lastMeters=s.meters;lastSource=s.source;lastCovered=Object.keys(s.covered).length;
    }
    const reveal=s.source==='gps'?currentSignal.revealed:proximity(s,p.config).revealed;if(reveal)gift.current?.setLngLat(s.source==='gps'&&currentSignal.gift?currentSignal.gift.position:NODES[GIFTS[p.config.giftIndex]]);if(reveal!==giftShown){giftShown=reveal;if(reveal){ensureGift();gift.current?.addTo(m);}else gift.current?.remove();}
   }frame=requestAnimationFrame(render);
  }frame=requestAnimationFrame(render);
  const observer=new ResizeObserver(()=>{if(host.current?.clientWidth&&host.current?.clientHeight)m.resize();});observer.observe(host.current);
  return()=>{alive=false;cancelAnimationFrame(frame);observer.disconnect();gift.current?.remove();m.remove();map.current=null;ready.current=false;};
 },[]);
 useEffect(()=>{if(map.current&&lastDark.current!==dark){lastDark.current=dark;ready.current=false;map.current.setStyle(dark?'mapbox://styles/mapbox/dark-v11':'mapbox://styles/mapbox/light-v11',{diff:false,localFontFamily:'Noto Sans Georgian',localIdeographFontFamily:'sans-serif'});}},[dark]);
 useEffect(()=>{if(!map.current||!ready.current)return;['explorer-paths','explorer-zone-line'].forEach(id=>map.current!.setLayoutProperty(id,'visibility',props.showNetwork?'visible':'none'));},[props.showNetwork]);
 useEffect(()=>{lock.current=performance.now()+500;map.current?.easeTo({pitch:props.threeD?48:0,duration:500});},[props.threeD]);
 useEffect(()=>{if(props.recenter)follow();},[props.recenter]);
 useEffect(()=>{if(props.visible)map.current?.resize();},[props.visible]);
 useEffect(()=>{const m=map.current;if(!m||!ready.current)return;(m.getSource('mission-zone') as mapboxgl.GeoJSONSource)?.setData(props.mission?missionCircle(props.mission):{type:'FeatureCollection',features:[]});m.setPaintProperty('mission-zone-fill','fill-opacity',props.missionComplete?.17:.07);},[props.mission,props.missionComplete]);
 useEffect(()=>{const m=map.current;if(!m||!props.mission||!props.missionFocus)return;following.current=false;m.resize();const bounds=new mapboxgl.LngLatBounds();missionCircle(props.mission).geometry.coordinates[0].forEach(p=>bounds.extend(p));m.fitBounds(bounds,{padding:{top:160,bottom:180,left:32,right:32},pitch:0,bearing:0,duration:850});},[props.missionFocus]);
 useEffect(()=>{if(!props.overview||!map.current)return;following.current=false;const bounds=new mapboxgl.LngLatBounds();PLAYABLE.forEach(e=>bounds.extend(NODES[e.a]));map.current.fitBounds(bounds,{padding:{top:110,bottom:170,left:35,right:35},pitch:0,bearing:0,duration:800});},[props.overview]);
 return <div className={'explorer-map '+(props.selecting?'is-selecting':'')}><div ref={host} className="map-canvas-host" aria-label="თავისუფალი გასეირნების რუკა"/>{error&&<div className="map-error" role="alert">{error}<button onClick={()=>location.reload()}>ხელახლა ცდა</button></div>}</div>;
}
