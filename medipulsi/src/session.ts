import type {Journey} from './journey.ts';
import {parkProgress} from './journey.ts';
export type PauseReason='manual'|'background'|'reload'|'gps';
export function pauseJourney(s:Journey,reason:PauseReason='manual',now=Date.now()):Journey{return {...s,speed:0,pauseReason:reason,pausedAt:new Date(now).toISOString(),...(s.source==='gps'?{lastFix:null,lastRaw:null,match:null}:{})};}
export function resetSession(s:Journey):Journey{return {...pauseJourney(s),meters:0,seconds:0,movingSeconds:0,steps:0,speed:0,maxSpeed:0,sessionStartCoverage:parkProgress(s).unique,pauseReason:null,pausedAt:null,startedAt:new Date().toISOString()};}
