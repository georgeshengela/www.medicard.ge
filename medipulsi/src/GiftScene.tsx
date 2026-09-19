import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {createGift,lightGift,disposeGift} from './giftModel';
export default function GiftScene({opened=false,camera=false}:{opened?:boolean;camera?:boolean}){
 const el=useRef<HTMLDivElement>(null),opening=useRef(opened);opening.current=opened;
 useEffect(()=>{
  if(!el.current)return;const host=el.current;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{host.textContent='საჩუქარი მზადაა გასახსნელად';return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setSize(host.clientWidth,host.clientHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(39,host.clientWidth/host.clientHeight,.1,100);cam.position.set(3.2,2.4,4.6);cam.lookAt(0,.36,0);lightGift(scene);
  const {group,lid}=createGift();scene.add(group);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.18,.013,8,80),new THREE.MeshBasicMaterial({color:'#5eead4',transparent:true,opacity:.45}));ring.rotation.x=Math.PI/2;ring.position.y=-.88;scene.add(ring);
  const glow=new THREE.PointLight('#5eead4',0,5);glow.position.y=.4;scene.add(glow);
  const particles=new THREE.Group();scene.add(particles);for(let i=0;i<30;i++){particles.add(new THREE.Mesh(new THREE.OctahedronGeometry(.018+(i%4)*.01),new THREE.MeshBasicMaterial({color:i%3?'#5eead4':'#fff8dd',transparent:true,opacity:0})));}
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;let raf=0,t=0,previous=performance.now(),open=opening.current?1:0;
  function render(now:number){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(document.hidden){raf=requestAnimationFrame(render);return;}t+=dt;open=THREE.MathUtils.lerp(open,opening.current?1:0,1-Math.exp(-dt*5));
   group.rotation.y=reduce?.18:Math.sin(t*.5)*.12+.18;group.position.y=reduce?0:Math.sin(t*1.4)*.045;lid.position.y=.46+open*1.1;lid.rotation.z=open*.16;glow.intensity=open*12;
   particles.children.forEach((child,i)=>{const p=child as THREE.Mesh;const angle=i*2.399;const rise=(t*.3+i/30)%1;p.position.set(Math.sin(angle)*(.6+rise),-.2+rise*2,Math.cos(angle)*(.6+rise));(p.material as THREE.MeshBasicMaterial).opacity=open*(1-rise)*.85;});
   renderer.render(scene,cam);raf=requestAnimationFrame(render);
  }raf=requestAnimationFrame(render);
  const observer=new ResizeObserver(()=>{if(!host.clientHeight)return;renderer.setSize(host.clientWidth,host.clientHeight);cam.aspect=host.clientWidth/host.clientHeight;cam.updateProjectionMatrix();});observer.observe(host);
  return()=>{cancelAnimationFrame(raf);observer.disconnect();disposeGift(scene);renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div ref={el} className={`gift-scene ${camera?'on-camera':''}`} aria-label={opened?'გახსნილი სამგანზომილებიანი საჩუქრის ყუთი':'სამგანზომილებიანი საჩუქრის ყუთი'}/>;
}
