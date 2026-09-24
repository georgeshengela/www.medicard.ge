import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { nutritionRouter, adminNutritionRouter } from '../routes/nutrition.routes.js';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { AI_CONSENT_VERSION } from './aiConsent.js';
import { errorHandler } from '../middleware/error.js';

test('HTTP authentication, consent, validation and upload gates (no outbound AI or DB)', async t=>{
 const app=express();app.use(express.json());app.use('/nutrition',nutritionRouter);app.use('/admin',adminNutritionRouter);app.use(errorHandler);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=(path,options={})=>fetch(base+path,options);
 assert.equal((await call('/nutrition/meals?from=2026-09-24')).status,401);
 assert.equal((await call('/admin/overview')).status,401);
 const admin=jwt.sign({sub:'synthetic',role:'admin'},env.JWT_SECRET);
 assert.equal((await call('/nutrition/settings',{headers:{Authorization:`Bearer ${admin}`}})).status,403);
 const originalFind=prisma.user.findUnique,originalRaw=prisma.$queryRaw;
 prisma.user.findUnique=async()=>({id:'synthetic',status:'ACTIVE'});
 t.after(()=>{prisma.user.findUnique=originalFind;prisma.$queryRaw=originalRaw;});
 let accepted=false, queried=0;
 prisma.$queryRaw=async strings=>{
   queried++;
   const sql=strings.join('');
   if(sql.includes('UserAiConsent')) return [{version:AI_CONSENT_VERSION,decision:accepted?'accepted':'declined'}];
   if(sql.includes('NutritionSettings'))return [{photoEnabled:true}];
   assert.fail('Unexpected database query');
 };

 const headers={Authorization:`Bearer ${jwt.sign({sub:'synthetic'},env.JWT_SECRET)}`};
 const denied=await call('/nutrition/estimate',{method:'POST',headers});
 assert.equal(denied.status,403);assert.equal((await denied.json()).code,'AI_CONSENT_REQUIRED');assert.equal(queried,1);
 assert.equal((await call('/nutrition/meals?from=2026-02-30',{headers})).status,400);
 assert.equal((await call('/nutrition/meals?from=2026-01-01&to=2026-09-24',{headers})).status,400);
 assert.equal((await call('/nutrition/meals/not-uuid',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,400);
 accepted=true;
 assert.equal((await call('/nutrition/estimate',{method:'POST',headers})).status,400);
 const body=new FormData();body.append('photo',new Blob(['not a photo'],{type:'image/jpeg'}),'test.jpg');
 assert.equal((await call('/nutrition/estimate',{method:'POST',headers,body})).status,400);
});
