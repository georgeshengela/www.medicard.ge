import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { h } from '@/lib/hunt/copy';
import { useThemeColors } from '@/theme/colors';

const threeAsset = require('../../../assets/run/three.min.bin');
const glbAsset = require('../../../assets/hunt/virus_1.glb');

function encounterHtml(modelB64: string, threeJs: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<style>html,body,#c{margin:0;padding:0;width:100%;height:100%;background:transparent;overflow:hidden}</style>
</head><body><canvas id="c"></canvas>
<script>${threeJs}</script>
<script>
var b64=${JSON.stringify(modelB64)};
var canvas=document.getElementById('c');
var renderer=new THREE.WebGLRenderer({canvas:canvas,alpha:true,antialias:true});
renderer.setClearColor(0x000000,0);
var scene=new THREE.Scene();
var camera=new THREE.PerspectiveCamera(32,1,0.1,100);
camera.position.set(0,0.15,3.2);
scene.add(new THREE.AmbientLight(0xffffff,0.9));
var dir=new THREE.DirectionalLight(0x99f6e4,1.1); dir.position.set(2,3,2); scene.add(dir);
var root=new THREE.Group(); scene.add(root);
var t=0, hit=0, dead=0;
function resize(){ var w=window.innerWidth,h=window.innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
function boot(){
  var g=new THREE.IcosahedronGeometry(0.7,2);
  var placeholder=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x34d399,roughness:0.35,metalness:0.2}));
  root.add(placeholder);
  if(!b64 || !THREE.GLTFLoader) return;
  var bin=atob(b64); var arr=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  var loader=new THREE.GLTFLoader();
  loader.parse(arr.buffer, '', function(gltf){
    var model=gltf.scene; model.scale.setScalar(1.15);
    root.remove(placeholder);
    root.add(model);
  }, function(){});
}
if(typeof THREE!=='undefined' && THREE.WebGLRenderer) boot();
function tick(){
  requestAnimationFrame(tick);
  t+=0.016;
  root.position.y=Math.sin(t*2.2)*0.06;
  root.rotation.y=Math.sin(t*0.8)*0.35;
  var pulse=1+Math.sin(t*5)*0.03+(hit>0?0.08:0);
  root.scale.setScalar(Math.max(0.01,(1-dead)*pulse));
  if(hit>0) hit-=0.04;
  if(dead>0) dead=Math.min(1,dead+0.02);
  renderer.render(scene,camera);
}
tick();
window.__huntFx=function(kind){ if(kind==='hit') hit=1; if(kind==='die') dead=0.02; };
</script></body></html>`;
}

export function HuntEncounterView({
  locale = 'ka',
  preview,
  onNeutralize,
  onCancel,
}: {
  locale?: string;
  preview?: boolean;
  onNeutralize: () => void;
  onCancel: () => void;
}) {
  const copy = h(locale);
  const colors = useThemeColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [html, setHtml] = useState('');
  const [camOk, setCamOk] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [threeA, loaderA, modelA] = await Promise.all([
          Asset.fromModule(threeAsset).downloadAsync(),
          Asset.fromModule(require('../../../assets/run/GLTFLoader.bin')).downloadAsync(),
          Asset.fromModule(glbAsset).downloadAsync(),
        ]);
        const threeJs =
          (await FileSystem.readAsStringAsync(threeA.localUri || threeA.uri)) +
          '\n' +
          (await FileSystem.readAsStringAsync(loaderA.localUri || loaderA.uri));
        const modelB64 = await FileSystem.readAsStringAsync(modelA.localUri || modelA.uri, { encoding: FileSystem.EncodingType.Base64 });
        if (alive) setHtml(encounterHtml(modelB64, threeJs));
      } catch {
        if (alive) setHtml(encounterHtml('', 'var THREE={};'));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!preview && permission && !permission.granted) void requestPermission();
  }, [permission, preview, requestPermission]);

  const showCam = !preview && permission?.granted && Platform.OS !== 'web';

  useEffect(() => {
    if (showCam) setCamOk(true);
  }, [showCam]);

  const overlay = useMemo(() => html, [html]);

  return (
    <View style={{ flex: 1, backgroundColor: '#030712' }}>
      {showCam ? (
        <CameraView style={{ ...StyleSheetAbs }} facing="back" onMountError={() => setCamOk(false)} />
      ) : (
        <View style={{ ...StyleSheetAbs, backgroundColor: '#042F2E' }} />
      )}
      {overlay ? (
        <WebView
          originWhitelist={['*']}
          source={{ html: overlay }}
          style={{ ...StyleSheetAbs, backgroundColor: 'transparent' }}
          androidLayerType="hardware"
          javaScriptEnabled
          mixedContentMode="always"
          scrollEnabled={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
        />
      ) : null}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 28, gap: 10 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: '#D1D5DB', textAlign: 'center' }}>
          {copy.encounterHint}
        </Text>
        {preview || !camOk ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, color: '#99F6E4', textAlign: 'center' }}>
            {copy.preview} · {copy.simBadge}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onNeutralize}
          style={{ height: 54, borderRadius: 16, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#fff' }}>{copy.neutralize}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.text300 }}>{copy.end}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const StyleSheetAbs = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };
