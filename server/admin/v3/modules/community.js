(function(global){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const request=(p,o)=>api('/community'+p,o);
 let section='PENDING',offset=0,generation=0,urls=[];
 const labels={PENDING:'შესამოწმებელი',PUBLISHED:'გამოქვეყნებული',HIDDEN:'დამალული',reports:'საჩივრები',members:'წევრები',audit:'ქმედებების ისტორია'};
 function feedback(error){alert(error.message||'მოქმედება ვერ შესრულდა.');}
 async function moderate(kind,id,action,revision){
  if(['approve','hide','delete'].includes(action)&&revision===undefined){feedback(new Error('გახსენით შესაბამისი ჩანაწერი გამოქვეყნებულ ან შესამოწმებელ სიაში და იქ მიიღეთ გადაწყვეტილება.'));return;}
  const d=document.createElement('dialog');d.className='qa-dialog';
  d.innerHTML='<form style="display:grid;gap:16px"><h3>მოდერაციის გადაწყვეტილება</h3><p>მოქმედება: '+esc(action)+'. გადაწყვეტილება ჩაიწერება ისტორიაში.</p><label>მიზეზი<textarea name="reason" required minlength="3" maxlength="500" rows="4" placeholder="მოკლედ აღწერეთ გადაწყვეტილება"></textarea></label><p role="alert"></p><div style="display:flex;gap:10px"><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary">დადასტურება</button></div></form>';
  document.body.append(d);d.querySelector('[data-cancel]').onclick=()=>d.close();d.onclose=()=>d.remove();
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=d.querySelector('[type=submit]');submit.disabled=true;try{await request(`/${kind}/${id}/moderate`,{method:'POST',body:{action,revision,reason:d.querySelector('textarea').value}});d.close();await render();}catch(err){d.querySelector('[role=alert]').textContent=err.message;submit.disabled=false;}};d.showModal();
 }
 async function render(){
  const root=document.getElementById('tab-community');if(!root)return;
  const gen=++generation;urls.forEach(URL.revokeObjectURL);urls=[];
  root.innerHTML='<p role="status">იტვირთება…</p>';
  try{
   const [summary,rows]=await Promise.all([request('/overview'),request(section==='members'?'/members?offset='+offset:section==='reports'?'/reports':section==='audit'?'/audit':'/content?status='+section+'&offset='+offset)]);
   if(gen!==generation)return;
   const can=state.admin?.capabilities==null||state.admin.capabilities.includes('COMMUNITY_MANAGE');
   root.innerHTML='<div class="v3-tab-shell" style="display:flex;flex-direction:column;gap:18px;width:100%"><div style="display:flex;gap:14px;flex-wrap:wrap">'+[[summary.members,'წევრი'],[summary.pending,'პოსტი ელოდება'],[summary.reports,'ღია საჩივარი'],[summary.failedPushes,'პუშის შეცდომა']].map(([n,l])=>'<article class="card" style="flex:1;min-width:150px;padding:20px"><strong style="font-size:28px">'+n+'</strong><p>'+l+'</p></article>').join('')+'</div><p>ანონიმურ პოსტებზე ვინაობა დაფარულია. შეამოწმეთ ტექსტი და ფოტო გამოქვეყნებამდე. ჯანმრთელობის პირადი მონაცემები არ გადაიტანოთ მიმოწერაში. საჩივრებს უპასუხეთ დროულად.</p><div class="tabs" style="display:flex;gap:8px;flex-wrap:wrap">'+Object.entries(labels).map(([k,l])=>'<button class="btn '+(k===section?'primary':'')+'" data-section="'+k+'">'+l+'</button>').join('')+'<button class="btn" data-refresh>განახლება</button></div><div class="pane" style="display:grid;gap:16px;width:100%">'+(!rows.length?'<div class="card" style="padding:36px;text-align:center">ამ სიაში ჩანაწერი არ არის.</div>':rows.map(row=>section==='members'?'<article class="card" style="padding:20px"><strong>'+esc(row.alias)+'</strong><p>'+(row.banned?'წვდომა შეჩერებულია':'აქტიური წევრი')+'</p>'+(can?'<button class="btn" data-action="'+(row.banned?'unban':'ban')+'" data-kind="members" data-id="'+row.id+'">'+(row.banned?'წვდომის აღდგენა':'წვდომის შეჩერება')+'</button>':'')+'</article>':section==='audit'?'<article class="card" style="padding:18px"><strong>'+esc(row.action)+'</strong><p>'+esc(row.reason)+'</p><small>'+esc(row.createdAt)+' · '+esc(row.adminId)+'</small></article>':section==='reports'?'<article class="card" style="padding:20px"><strong>'+esc(row.reason)+'</strong><p style="white-space:pre-wrap">'+esc(row.body)+'</p>'+(can?'<button class="btn" data-resolve="'+esc(row.id)+'">განხილულია</button><button class="btn" data-action="hide" data-revision="'+row.revision+'" data-kind="'+(row.postId?'posts':'comments')+'" data-id="'+esc(row.postId||row.commentId)+'">ჩანაწერის დამალვა</button>':'')+'</article>':'<article class="card" style="padding:22px;display:grid;gap:14px"><div><strong>'+esc(row.author)+'</strong> · '+(row.kind==='posts'?'პოსტი':'კომენტარი')+' · '+esc(new Date(row.createdAt).toLocaleString('ka-GE'))+(row.banned?' · წევრი შეჩერებულია':'')+'</div><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(row.body)+'</p>'+(row.hasImage?'<img data-image="'+esc(row.id)+'" alt="პოსტის ფოტო" style="max-height:340px;max-width:100%;border-radius:16px;object-fit:contain">':'')+(can?'<div style="display:flex;gap:8px;flex-wrap:wrap">'+[['approve','გამოქვეყნება'],['hide','დამალვა'],['delete','სამუდამოდ წაშლა'],[row.banned?'unban':'ban',row.banned?'წვდომის აღდგენა':'წევრის შეჩერება']].map(([a,l])=>'<button class="btn" data-action="'+a+'" data-kind="'+row.kind+'" data-revision="'+row.revision+'" data-id="'+row.id+'">'+l+'</button>').join('')+'</div>':'')+'</article>').join(''))+'</div></div>';
   root.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{section=b.dataset.section;offset=0;void render();});
   root.querySelector('[data-refresh]').onclick=()=>void render();
   if(!['audit','reports'].includes(section)){
    const nav=document.createElement('div');nav.style.cssText='display:flex;gap:12px;margin-top:16px';
    for(const [label,delta,disabled] of [['წინა გვერდი',-100,offset===0],['შემდეგი გვერდი',100,rows.length<100]]){const b=document.createElement('button');b.className='btn';b.textContent=label;b.disabled=disabled;b.onclick=()=>{offset+=delta;void render();};nav.append(b);}root.append(nav);
   }
   root.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>void moderate(b.dataset.kind,b.dataset.id,b.dataset.action,b.dataset.revision===undefined?undefined:Number(b.dataset.revision)));
   root.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await request('/reports/'+b.dataset.resolve+'/resolve',{method:'POST'});await render();}catch(e){b.disabled=false;feedback(e);}});
   root.querySelectorAll('[data-image]').forEach(async img=>{try{const response=await fetch('/api/admin/community/posts/'+img.dataset.image+'/image',{headers:{Authorization:'Bearer '+state.token},cache:'no-store'});if(!response.ok)throw new Error('ფოტო ვერ ჩაიტვირთა');const blob=await response.blob();if(gen!==generation)return;const url=URL.createObjectURL(blob);urls.push(url);img.src=url;}catch{img.alt='ფოტო ვერ ჩაიტვირთა — არ გამოაქვეყნოთ შემოწმებამდე.';}});
  }catch(e){if(gen!==generation)return;root.innerHTML='<p role="alert">'+esc(e.message)+'</p><button class="btn">ხელახლა ცდა</button>';root.querySelector('button').onclick=()=>void render();}
 }
 global.renderCommunity=render;
})(window);
