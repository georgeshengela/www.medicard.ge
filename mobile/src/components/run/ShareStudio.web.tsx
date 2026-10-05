import type {ShareScene} from '@/lib/run/shareStudio';

/** The web build has no WebView recorder: share clips are an app feature (the buttons hide themselves). */
type Omit3<T>=T extends unknown?Omit<T,'link'|'cta'|'attribution'>:never;
export type ShareSceneInput=Omit3<ShareScene>;
export const canRecordClips=false;
export function ShareStudio(_props:{visible:boolean;scene:ShareSceneInput|null;onClose:()=>void;source:'walk'|'city'|'box'|'wrapped'}){return null;}
