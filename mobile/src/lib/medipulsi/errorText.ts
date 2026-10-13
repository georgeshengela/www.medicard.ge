import {tx} from '../../i18n/locale.js';

/**
 * MEDIRUN errors as people read them (audit 2026-10-13): the phone's raw transport errors — „Network request failed“,
 * „Aborted“ (our 15 s timeout), a JSON parse error from a proxy error page — showed in English inside the Georgian
 * screens. They become the hub's own connection line; the server's own (already translated) messages pass through.
 */
const TRANSPORT=/network request failed|failed to fetch|load failed|network ?error|internet connection|\babort|timed? ?out|timeout|json parse|unexpected (token|character|end of)/i;

export function isTransportError(error:unknown):boolean{
 const name=(error as {name?:unknown}|null)?.name,message=error instanceof Error?error.message:typeof error==='string'?error:'';
 return name==='AbortError'||name==='TimeoutError'||(error instanceof TypeError&&!message)||TRANSPORT.test(message);
}

export function pulseErrorText(error:unknown):string{
 const message=error instanceof Error?error.message:typeof error==='string'?error:'';
 if(!message.trim()||isTransportError(error))return tx('MEDIRUN-თან კავშირი ვერ დამყარდა. შეამოწმე ინტერნეტი და სცადე ხელახლა.','Couldn’t reach MEDIRUN. Check your connection and try again.');
 return message;
}
