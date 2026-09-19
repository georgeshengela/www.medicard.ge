import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
export function createGift(){
 const group=new THREE.Group(),lid=new THREE.Group();
 const pearl=new THREE.MeshPhysicalMaterial({color:'#edf9f5',metalness:.12,roughness:.24,clearcoat:.65});
 const teal=new THREE.MeshPhysicalMaterial({color:'#0d9488',metalness:.55,roughness:.23,clearcoat:.8});
 const edge=new THREE.MeshStandardMaterial({color:'#5eead4',metalness:.7,roughness:.18});
 const mesh=(w:number,h:number,d:number,material:THREE.Material,x=0,y=0,z=0,round=.035)=>{const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,round),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;};
 // Four walls and a floor keep the discovery box visibly hollow when its lid rises.
 group.add(mesh(1.5,.10,1.5,pearl,0,-.71));
 [-1,1].forEach(side=>{
  group.add(mesh(1.5,1.14,.075,pearl,0,-.19,side*.7125));
  group.add(mesh(.075,1.14,1.35,pearl,side*.7125,-.19));
  group.add(mesh(.23,1.14,.022,teal,0,-.19,side*.756,.01));
  group.add(mesh(.022,1.14,.23,teal,side*.756,-.19,0,.01));
 });
 group.add(mesh(1.34,.03,1.34,edge,0,-.64));group.add(mesh(1.42,.08,1.42,edge,0,-.74));
 lid.position.y=.46;lid.add(mesh(1.65,.27,1.65,pearl));lid.add(mesh(.25,.29,1.68,teal));lid.add(mesh(1.68,.29,.25,teal));
 [-1,1].forEach(sign=>{
  const points=[new THREE.Vector3(0,.17,0),new THREE.Vector3(sign*.40,.7,.02),new THREE.Vector3(sign*.68,.43,-.02),new THREE.Vector3(sign*.32,.18,0),new THREE.Vector3(0,.17,0)];
  const curve=new THREE.CatmullRomCurve3(points);const shape=new THREE.Shape();shape.moveTo(-.065,-.014);shape.lineTo(.065,-.014);shape.lineTo(.065,.014);shape.lineTo(-.065,.014);shape.closePath();
  const ribbon=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{steps:50,bevelEnabled:false,extrudePath:curve}),teal);ribbon.castShadow=true;lid.add(ribbon);
 });
 lid.add(mesh(.23,.18,.24,edge,0,.24,0,.07));group.add(lid);
 const seal=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.025,32),edge);seal.rotation.x=Math.PI/2;seal.position.set(.43,-.1,.766);group.add(seal);
 return {group,lid};
}
export function lightGift(scene:THREE.Scene){
 scene.add(new THREE.HemisphereLight('#f0fffc','#20344b',2.8));
 const main=new THREE.DirectionalLight('#fff9e9',4);main.position.set(3,5,4);scene.add(main);
 const rim=new THREE.DirectionalLight('#5eead4',3);rim.position.set(-3,2,-2);scene.add(rim);
 const fill=new THREE.DirectionalLight('#abc9ff',1.4);fill.position.set(1,0,-3);scene.add(fill);
}
export function disposeGift(scene:THREE.Scene){const materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});materials.forEach(m=>m.dispose());}
let sprite:string|undefined;
export function giftSprite(){
 if(sprite)return sprite;
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(240,260);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const scene=new THREE.Scene();lightGift(scene);scene.add(createGift().group);
 const cam=new THREE.PerspectiveCamera(35,240/260,.1,100);cam.position.set(3.1,2.4,4.2);cam.lookAt(0,.12,0);renderer.render(scene,cam);sprite=renderer.domElement.toDataURL('image/png');disposeGift(scene);renderer.dispose();renderer.forceContextLoss();return sprite;
}
