import {useEffect,useState} from 'react';
import {Activity,ArrowRight,LoaderCircle,ShieldCheck} from 'lucide-react';
import ExplorerApp from './ExplorerApp';
import {init,setToken} from './cloud';
import {native,embedded,bridge} from './bridge';
export default function AccountGate(){
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[login,setLogin]=useState(false);
 async function load(){setBusy(true);setError('');try{await init();setReady(true);}catch(e){setError((e as Error).message);setLogin(!native&&!embedded&&(e as {status?:number}).status===401);}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');const data=new FormData(event.currentTarget);try{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.get('email'),password:data.get('password')})});const result=await response.json();if(!response.ok)throw new Error(result.error||'შესვლა ვერ მოხერხდა.');setToken(result.token);await load();}catch(e){setError((e as Error).message);setBusy(false);}}
 if(ready)return <ExplorerApp/>;
 return <main className="account-gate"><div className="account-card"><span className="account-symbol"><Activity size={34}/></span><span className="eyebrow mint">MEDICARD AI</span><h1>MEDIPULSI</h1><p>შენი ნაბიჯები.<br/>შენი ქალაქის ახალი ისტორია.</p>{login?<form onSubmit={submit}><label>MEDICARD ელფოსტა<input name="email" type="email" autoComplete="username" required/></label><label>პაროლი<input name="password" type="password" autoComplete="current-password" required/></label><button className="primary full" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<ArrowRight/>} შესვლა</button><small>გამოიყენე შენი არსებული MEDICARD ანგარიში.</small></form>:busy?<p className="inline-note"><LoaderCircle className="spin"/> ანგარიშის დაკავშირება…</p>:<button className="primary full" onClick={load}>თავიდან ცდა</button>}{error&&<p role="alert" className="inline-note">{error}</p>}<p className="fine-print"><ShieldCheck size={14}/> პროგრესი შენს ანგარიშში ინახება.</p>{(native||embedded)&&<button className="text-button" onClick={()=>void bridge('close')}>აპში დაბრუნება</button>}</div></main>;
}
