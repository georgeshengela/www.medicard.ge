(function(global){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names={PENDING:'შესამოწმებელი',PASS:'გაიარა',FAIL:'ხარვეზი',BLOCKED:'დაბლოკილი',SKIPPED:'გამოტოვებული'};
 const methods={MANUAL:'ხელით შემოწმება',HTTP:'სერვერი / ბაზა',UNIT:'ავტომატური ტესტი',EXPO_WEB:'Expo Web',DEVICE:'რეალური მოწყობილობა'};
 const request=(p,o)=>api('/qa'+p,o);
 const can=cap=>state.admin?.capabilities==null||state.admin.capabilities.includes(cap);
 const btn=(id,label,cls='')=>'<button type="button" class="btn '+cls+'" data-qa="'+id+'">'+label+'</button>';
 const field=(name,label,value='',extra='')=>'<label>'+label+'<input name="'+name+'" value="'+esc(value)+'" '+extra+'></label>';
 const area=(name,label,value='',max=5000)=>'<label>'+label+'<textarea name="'+name+'" maxlength="'+max+'" rows="4">'+esc(value)+'</textarea></label>';
 let runId=null, filter='',offset=0,ticket=0,urls=[];
 function release(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];}
 function stats(s){
  return '<div class="qa-metrics">'+[['total','ეტაპი'],['PASS','გაიარა'],['FAIL','ხარვეზი'],['PENDING','შესამოწმებელი'],['BLOCKED','დაბლოკილი']].map(([k,label])=>'<article><span>'+label+'</span><strong>'+s[k]+'</strong></article>').join('')+'</div>';
 }
 function badge(s){return '<span class="qa-status is-'+s.toLowerCase()+'">'+esc(names[s]||({OPEN:'მიმდინარე',COMPLETE:'დასრულებული',ARCHIVED:'არქივი'})[s]||s)+'</span>';}
 function dialog(title,html,saveLabel,onSave){
  const d=document.createElement('dialog');d.className='qa-dialog';
  d.innerHTML='<form><header><h2>'+esc(title)+'</h2><button type="button" class="btn" aria-label="დახურვა" data-close>×</button></header>'+html+'<p role="alert" class="qa-error"></p><footer><button type="button" class="btn" data-close>გაუქმება</button><button class="btn primary" type="submit">'+esc(saveLabel)+'</button></footer></form>';
  document.body.append(d);d.showModal();d.onclose=()=>d.remove();d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=d.querySelector('[type=submit]');b.disabled=true;
   try{await onSave(Object.fromEntries(new FormData(e.target)));d.close();await render();}
   catch(err){d.querySelector('[role=alert]').textContent=err.message;b.disabled=false;}
  };
 }
 function newRun(){
  dialog('ახალი ტესტირება',field('title','სათაური','ციკლის სრული შემოწმება','required maxlength="160"')+
   '<div class="qa-form-grid">'+field('version','აპის ვერსია','','required maxlength="50"')+
   field('environment','გარემო / სერვერი','ადგილობრივი სატესტო','required maxlength="100"')+
   field('device','მოწყობილობა / ბრაუზერი','','required maxlength="150"')+
   '<label>მოდული<select name="module">'+['cycle','analysis','chat','pets','medirun','quest','other'].map(v=>'<option>'+v+'</option>').join('')+'</select></label></div>'+
   '<label>საწყისი გეგმა<select name="template"><option value="cycle">ციკლი · 33 ეტაპი</option><option value="empty">ცარიელი გეგმა</option></select></label>'+
   area('notes','შენიშვნა / ტესტირების ფარგლები'), 'შექმნა',async data=>{const r=await request('/runs',{method:'POST',body:data});runId=r.id;});
 }
 function addCheck(){
  dialog('ეტაპის დამატება',field('caseKey','უნიკალური კოდი','','required pattern="[a-zA-Z0-9_-]+" maxlength="80"')+
   field('title','ეტაპის სახელი','','required maxlength="180"')+field('stage','ჯგუფი','','required maxlength="100"')+
   area('steps','როგორ ვამოწმებთ')+area('expected','მოსალოდნელი შედეგი'),'დამატება',data=>request('/runs/'+runId+'/checks',{method:'POST',body:data}));
 }
 function updateRun(run,status){
  dialog(status==='OPEN'?'ტესტირების გახსნა':status==='ARCHIVED'?'არქივში გადატანა':'ტესტირების დასრულება',
   '<p>შედეგები და სქრინები ისტორიაში შენარჩუნდება.</p>'+area('notes','შეჯამება / დარჩენილი შეზღუდვები',run.notes),
   'შენახვა',data=>request('/runs/'+run.id,{method:'PATCH',body:{...data,status,revision:run.revision}}));
 }
 function editCheck(check){
  dialog(check.title,'<p>'+esc(check.expected)+'</p><div class="qa-form-grid"><label>შედეგი<select name="status">'+Object.entries(names).map(([v,n])=>'<option value="'+v+'" '+(v===check.status?'selected':'')+'>'+n+'</option>').join('')+
   '</select></label><label>შემოწმების მეთოდი<select name="method">'+Object.entries(methods).map(([v,n])=>'<option value="'+v+'" '+(v===check.method?'selected':'')+'>'+n+'</option>').join('')+
   '</select></label></div>'+area('actual','ფაქტობრივი შედეგი / ხარვეზი / შეზღუდვა',check.actual,10000),'შენახვა',
   data=>request('/checks/'+check.id,{method:'PATCH',body:{...data,revision:check.revision}}));
 }
 function attach(check){
  dialog('სქრინის დამატება',field('caption','რას აჩვენებს სქრინი','','required maxlength="240"')+
   '<label>PNG, JPEG ან WebP · მაქსიმუმ 1 MB<input type="file" name="file" required accept="image/png,image/jpeg,image/webp"></label>'+
   '<p>გამოიყენეთ სინთეზური სატესტო მონაცემები. სქრინები დაცულია ადმინისტრატორის ავტორიზაციით.</p>','ატვირთვა',async data=>{
    const file=data.file;if(!file?.size||file.size>1024*1024)throw new Error('სქრინი უნდა იყოს მაქსიმუმ 1 MB.');
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('ფაილი ვერ წავიკითხეთ.'));r.readAsDataURL(file);});
    await request('/checks/'+check.id+'/evidence',{method:'POST',body:{caption:data.caption,mimeType:file.type,base64}});
   });
 }
 async function loadImage(id,node,revision){
  try{
   const response=await fetch(API+'/api/admin/qa/evidence/'+id,{headers:{Authorization:'Bearer '+state.token}});
   if(!response.ok)throw new Error('სქრინი ვერ ჩაიტვირთა.');
   const blob=await response.blob();if(revision!==ticket||!node.isConnected)return;
   const url=URL.createObjectURL(blob);urls.push(url);node.src=url;
  }catch{if(node.isConnected){node.alt='სქრინი ვერ ჩაიტვირთა — განაახლეთ გვერდი';node.parentElement.classList.add('qa-error');}}
 }
 async function render(){
  const root=document.getElementById('tab-testing');if(!root)return;const revision=++ticket;release();
  global.AdminV3Shell?.mountHeader?.({tab:'testing',kicker:'Quality lab',title:'ტესტირების სივრცე',purpose:'ეტაპები, ხარვეზები და ვიზუალური მტკიცებულება ერთ ისტორიაში.'});
  root.classList.add('v3-workspace-wide');
  root.innerHTML='<div class="qa-workspace"><p role="status">იტვირთება…</p></div>';
  if(!can('QA_VIEW')){root.innerHTML='<p>ტესტირების ნახვის უფლება საჭიროა.</p>';return;}
  try{
   if(!runId){
    const data=await request('/runs?offset='+offset);if(revision!==ticket)return;
    root.innerHTML='<div class="qa-workspace"><header class="qa-hero"><div><span class="qa-eyebrow">MEDICARD · QUALITY LAB</span><h2>ყოველი ეტაპი. სრული სურათი.</h2><p>შეინახეთ რა შემოწმდა, რა დარჩა და როგორ გამოიყურებოდა შედეგი.</p></div>'+ (can('QA_MANAGE')?btn('new','＋ ახალი ტესტირება','primary'):'')+'</header>'+
     '<div class="qa-run-grid">'+data.rows.map(run=>'<button class="qa-run" data-run="'+run.id+'"><div class="qa-row">'+badge(run.status)+'<span>'+esc(run.module)+'</span></div><h3>'+esc(run.title)+'</h3><p>'+esc(run.version)+' · '+esc(run.device)+'</p><small>'+esc(run.environment)+' · '+new Date(run.createdAt).toLocaleDateString('ka-GE')+'</small><div class="qa-mini-progress"><i style="width:'+(run.summary.total?run.summary.PASS/run.summary.total*100:0)+'%"></i></div><div class="qa-row"><span>'+run.summary.PASS+' / '+run.summary.total+' გაიარა</span><span>'+run.summary.FAIL+' ხარვეზი</span></div></button>').join('')+'</div>'+
     (!data.total?'<div class="qa-empty">პირველი ტესტირება ჯერ არ შექმნილა. დაიწყეთ მზა ციკლის გეგმით ან დაამატეთ თქვენი ეტაპები.</div>':'')+
     '<footer class="qa-row"><span>'+data.total+' ტესტირება</span><div>'+(offset?btn('prev','წინა'):'')+(offset+30<data.total?btn('next','შემდეგი'):'')+'</div></footer></div>';
    root.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>{runId=b.dataset.run;filter='';void render();});
    root.querySelector('[data-qa=new]')?.addEventListener('click',newRun);
    root.querySelector('[data-qa=prev]')?.addEventListener('click',()=>{offset=Math.max(0,offset-30);void render();});
    root.querySelector('[data-qa=next]')?.addEventListener('click',()=>{offset+=30;void render();});
    return;
   }
   const run=await request('/runs/'+runId);if(revision!==ticket)return;const editing=run.status==='OPEN'&&can('QA_MANAGE');
   const checks=run.checks.filter(c=>!filter||c.status===filter);
   root.innerHTML='<div class="qa-workspace"><div class="qa-row">'+btn('back','← ყველა ტესტირება')+'<div class="qa-actions">'+btn('refresh','განახლება')+btn('export','ანგარიშის ჩამოტვირთვა')+'</div></div>'+
    '<header class="qa-hero"><div><span class="qa-eyebrow">'+esc(run.module)+' · '+esc(run.version)+'</span><h2>'+esc(run.title)+'</h2><p>'+esc(run.environment)+' · '+esc(run.device)+'</p>'+badge(run.status)+'</div>'+
    (can('QA_MANAGE')?'<div class="qa-actions">'+(editing?btn('add','＋ ეტაპი')+btn('complete','დასრულება','primary'):btn('reopen','ხელახლა გახსნა'))+(run.status!=='ARCHIVED'?btn('archive','არქივი'):'')+'</div>':'')+'</header>'+
    stats(run.summary)+'<p class="qa-note">'+esc(run.notes||'აქ ინახება ტესტირების ფაქტობრივი შედეგები. „გაიარა“ აღნიშნავს მხოლოდ მითითებული მეთოდით შემოწმებულ სცენარს.')+'</p>'+
    '<nav class="qa-filters" aria-label="შედეგით ფილტრი">'+[['','ყველა'],...Object.entries(names)].map(([v,n])=>'<button type="button" data-filter="'+v+'" aria-pressed="'+(filter===v)+'">'+n+'</button>').join('')+'</nav>'+
    '<div class="qa-checks">'+checks.map(c=>'<article class="qa-check"><div class="qa-row"><span class="qa-eyebrow">'+esc(c.stage)+' · '+esc(c.caseKey)+'</span>'+badge(c.status)+'</div><h3>'+esc(c.title)+'</h3><details><summary>ეტაპები და მოსალოდნელი შედეგი</summary><p>'+esc(c.steps)+'</p><strong>მოსალოდნელი</strong><p>'+esc(c.expected)+'</p></details><p class="qa-actual">'+esc(c.actual||'ჯერ არ შემოწმებულა.')+'</p><small>'+esc(methods[c.method])+' · '+new Date(c.updatedAt).toLocaleString('ka-GE')+'</small><div class="qa-evidence">'+c.evidence.map(e=>'<button type="button" data-evidence="'+e.id+'" aria-label="'+esc(e.caption)+'"><img loading="lazy" alt="'+esc(e.caption)+'" data-image="'+e.id+'"><span>'+esc(e.caption)+'</span></button>').join('')+'</div>'+(editing?'<div class="qa-actions"><button class="btn" data-edit="'+c.id+'">შედეგის ჩაწერა</button><button class="btn" data-attach="'+c.id+'">＋ სქრინი</button></div>':'')+'</article>').join('')+'</div>'+(!checks.length?'<div class="qa-empty">ამ ფილტრში ეტაპი არ არის.</div>':'')+'</div>';
   root.querySelector('[data-qa=back]').onclick=()=>{runId=null;void render();};
   root.querySelector('[data-qa=refresh]').onclick=()=>void render();
   root.querySelector('[data-qa=add]')?.addEventListener('click',addCheck);
   for(const [action,status] of [['complete','COMPLETE'],['reopen','OPEN'],['archive','ARCHIVED']])root.querySelector('[data-qa='+action+']')?.addEventListener('click',()=>updateRun(run,status));
   root.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;void render();});
   root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editCheck(run.checks.find(c=>c.id===b.dataset.edit)));
   root.querySelectorAll('[data-attach]').forEach(b=>b.onclick=()=>attach(run.checks.find(c=>c.id===b.dataset.attach)));
   root.querySelectorAll('[data-image]').forEach(img=>void loadImage(img.dataset.image,img,revision));
   root.querySelectorAll('[data-evidence]').forEach(b=>b.onclick=()=>{
    const img=b.querySelector('img');if(!img.src)return;
    const d=document.createElement('dialog');d.className='qa-lightbox';const close=document.createElement('button');close.textContent='დახურვა';close.className='btn';close.onclick=()=>d.close();
    const full=document.createElement('img');full.src=img.src;full.alt=img.alt;const caption=document.createElement('p');caption.textContent=img.alt;
    d.append(close,full,caption);document.body.append(d);d.onclose=()=>d.remove();d.showModal();
   });
   root.querySelector('[data-qa=export]').onclick=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(run,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='medicard-qa-'+run.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   };
  }catch(err){if(revision===ticket){root.innerHTML='<div class="qa-workspace qa-empty"><h3>ტესტირება ვერ ჩაიტვირთა</h3><p role="alert">'+esc(err.message)+'</p>'+btn('retry','ხელახლა ცდა')+'</div>';root.querySelector('[data-qa=retry]').onclick=()=>void render();}}
 }
 global.renderTesting=render;
})(window);
