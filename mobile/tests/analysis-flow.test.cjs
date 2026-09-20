const {test}=require('node:test');
const assert=require('node:assert/strict');
const loader=require('./helpers/loadTs.cjs');
const flow=loader()('src/lib/analysisFlow.ts');

test('stalled native transfer times out and cancels its native task',async()=>{
  const {uploadWithDeadline,UploadTimeoutError}=loader()('src/lib/uploadDeadline.ts');let cancelled=0;
  await assert.rejects(()=>uploadWithDeadline({uploadAsync:()=>new Promise(()=>{}),cancelAsync:async()=>{cancelled++;}},10),UploadTimeoutError);
  assert.equal(cancelled,1);
  const result=await uploadWithDeadline({uploadAsync:async()=>({status:201}),cancelAsync:async()=>{cancelled++;}},100);
  assert.equal(result.status,201);assert.equal(cancelled,1);
  await assert.rejects(()=>uploadWithDeadline({uploadAsync:async()=>undefined,cancelAsync:async()=>{}},100));
  await assert.rejects(()=>uploadWithDeadline({uploadAsync:async()=>null,cancelAsync:async()=>{}},100));
});

test('one tap owns an operation; late completion cannot unlock a newer request',()=>{
  const gate=flow.createRequestGate(),a=gate.begin();assert.ok(a);assert.equal(gate.begin(),null);
  gate.reset();const b=gate.begin();gate.finish(a);assert.equal(gate.isCurrent(a),false);assert.equal(gate.isCurrent(b),true);assert.equal(gate.begin(),null);
  gate.finish(b);assert.ok(gate.begin());
});
test('empty or malformed answers never render as successful medical results',()=>{
  for(const value of [null,undefined,'','  \n ',{},[]])assert.throws(()=>flow.requireAnalysisText(value));
  assert.equal(flow.requireAnalysisText('  ## პასუხი\nტექსტი  '),'## პასუხი\nტექსტი');
});
test('keyboard overlap uses measured frame, including nested headers and floating keyboards',()=>{
  for(const [top,height,keyboard,expected] of [[100,700,500,300],[150,600,500,250],[100,300,500,0],[0,800,null,0],[100,600,0,600],[100,0,400,0],[140,460,390,210]]){
    assert.equal(flow.keyboardFrameOverlap(top,height,keyboard),expected);
  }
});
test('focused fields scroll into the visible area above actions without negative offsets',()=>{
  assert.equal(flow.focusedFieldOffset(120,100,240,290,90),172);
  assert.equal(flow.focusedFieldOffset(20,100,240,140,88),20);
  assert.equal(flow.focusedFieldOffset(0,100,240,10,88),0);
  assert.equal(flow.focusedFieldOffset(120,100,180,200,300),196);
});
test('skincare output preserves cautions before headings and CRLF content',()=>{
  const mod=loader({'@/lib/localAccount':{}})('src/lib/skincareStorage.ts');
  const sections=mod.splitSkincareSections('შენიშვნა\r\n\r\n## დილა\r\nპირველი\r\n\r\n## საღამო\r\nმეორე');
  assert.equal(sections.length,3);assert.equal(sections[0].body,'შენიშვნა');assert.equal(sections[1].body,'პირველი');assert.equal(sections[2].body,'მეორე');
  assert.equal(mod.splitSkincareSections('აბზაცი სათაურის გარეშე').length,0);
});
test('skincare pending cache read cannot write a routine into a different account',async()=>{
  let owner='A',finish,writes=0;
  const mod=loader({'@/lib/localAccount':{localAccountId:()=>owner,getScopedPreference:()=>new Promise(r=>finish=r),setScopedPreference:async()=>writes++}})('src/lib/skincareStorage.ts');
  const pending=mod.saveSkincareRoutine({recordId:'A-record',createdAt:'2026-09-20',skinType:'მშრალი',concerns:['საცდელი'],analysis:'A'});
  owner='B';finish('[]');await pending;assert.equal(writes,0);
});
test('lab merge cannot save private panels to a newly signed-in account',async()=>{
  let owner='A',finish,writes=0;
  const mod=loader({'@/lib/localAccount':{localAccountId:()=>owner,getScopedPreference:()=>new Promise(r=>finish=r),setScopedPreferenceStrict:async()=>writes++},'@/lib/labNames':{titledLabPanel:p=>p},'@/lib/labMerge':{}})('src/lib/labStore.ts');
  const pending=mod.upsertLabPanel({id:'A',date:'2026-09-20',createdAt:'2026-09-20',recordIds:['private'],parameters:[],analysis:'private'});
  owner='B';finish('[]');await pending;assert.equal(writes,0);
});
test('failed HEIC conversion is rejected rather than mislabelled as a JPEG',async()=>{
  const mod=loader({'expo-file-system/legacy':{cacheDirectory:null},'expo-image-picker':{UIImagePickerPreferredAssetRepresentationMode:{Compatible:'compatible'}},'expo-image-manipulator':{SaveFormat:{JPEG:'jpeg'},manipulateAsync:async()=>{throw Error('conversion failed');}}})('src/lib/imageUpload.ts');
  await assert.rejects(()=>mod.toUploadableImage({uri:'file:///photo.heic',name:'photo.heic',mimeType:'image/heic'}));
  assert.equal(mod.normalizeUploadMime('image/heic','mislabelled.jpg'),'image/heic');
  assert.equal(mod.needsJpegTranscode('image/avif','photo.avif'),true);
  const png=await mod.prepareLabImage({uri:'file:///photo.png',name:'photo.png',mimeType:'image/png',size:1024});
  assert.equal(png.mimeType,'image/png');assert.equal(png.name,'photo.png');assert.equal(png.size,1024);
});

test('converted camera files report their actual size for the 12 MB upload check',async()=>{
  const mod=loader({'expo-file-system/legacy':{getInfoAsync:async()=>({exists:true,size:13*1024*1024})},'expo-image-picker':{UIImagePickerPreferredAssetRepresentationMode:{Compatible:'compatible'}},'expo-image-manipulator':{SaveFormat:{JPEG:'jpeg'},manipulateAsync:async()=>({uri:'file:///converted.jpg'})}})('src/lib/imageUpload.ts');
  const file=await mod.toUploadableImage({uri:'file:///photo.heic',name:'photo.heic',mimeType:'image/heic'});
  assert.equal(file.size,13*1024*1024);assert.equal(file.mimeType,'image/jpeg');
});
