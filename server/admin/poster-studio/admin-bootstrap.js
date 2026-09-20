(async function(){
  const key='medicard.admin.token',token=localStorage.getItem(key);
  function block(message){document.body.className='auth-pending';document.body.replaceChildren();const p=document.createElement('p');p.className='auth-message';p.textContent=message;const a=document.createElement('a');a.href='/admin/';a.textContent='ადმინში შესვლა';p.append(document.createElement('br'),a);document.body.append(p);}
  window.addEventListener('storage',e=>{if(e.key===key&&e.newValue!==token)location.reload();});
  if(!token){block('რედაქტორისთვის საჭიროა ადმინისტრატორის ავტორიზაცია.');return;}
  try{const response=await fetch('/api/admin/me',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!response.ok)throw new Error('auth');const data=await response.json();if(!data.admin?.id||localStorage.getItem(key)!==token)throw new Error('auth');window.STUDIO_ACCOUNT=data.admin.id;const script=document.createElement('script');script.src='studio.js';script.onload=()=>document.body.classList.remove('auth-pending');script.onerror=()=>block('რედაქტორი ვერ ჩაიტვირთა. განაახლე გვერდი.');document.body.append(script);}catch{block('სესია ვერ დადასტურდა. ხელახლა შედი ადმინში.');}
})();