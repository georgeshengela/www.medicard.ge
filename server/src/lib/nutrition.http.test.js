import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import {
  nutritionRouter,
  adminNutritionRouter,
} from "../routes/nutrition.routes.js";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";
import { AI_CONSENT_VERSION } from "./aiConsent.js";
import { errorHandler } from "../middleware/error.js";

test("HTTP authentication, consent, validation and upload gates (no outbound AI or DB)", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/nutrition", nutritionRouter);
  app.use("/admin", adminNutritionRouter);
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, options = {}) => fetch(base + path, options);
  assert.equal((await call("/nutrition/meals?from=2026-09-24")).status, 401);
  assert.equal((await call("/admin/overview")).status, 401);
  const admin = jwt.sign({ sub: "synthetic", role: "admin" }, env.JWT_SECRET);
  assert.equal(
    (
      await call("/nutrition/settings", {
        headers: { Authorization: `Bearer ${admin}` },
      })
    ).status,
    403,
  );
  const originalFind = prisma.user.findUnique,
    originalRaw = prisma.$queryRaw, originalExecute = prisma.$executeRaw, originalFetch = globalThis.fetch;
  prisma.user.findUnique = async () => ({ id: "synthetic", status: "ACTIVE" });
  t.after(() => {
    prisma.user.findUnique = originalFind;
    prisma.$queryRaw = originalRaw;
    prisma.$executeRaw = originalExecute;
    globalThis.fetch = originalFetch;
  });
  let accepted = false,
    queried = 0, consentReads = 0, revokeAfterPreflight = false;
  prisma.$queryRaw = async (strings) => {
    queried++;
    const sql = strings.join("");
    if (sql.includes("UserAiConsent")) {
      consentReads++;
      if (revokeAfterPreflight && consentReads > 1) accepted = false;
      return [
        {
          version: AI_CONSENT_VERSION,
          decision: accepted ? "accepted" : "declined",
        },
      ];
    }
    if (sql.includes("NutritionSettings")) return [{ photoEnabled: true }];
    assert.fail("Unexpected database query");
  };

  const headers = {
    Authorization: `Bearer ${jwt.sign({ sub: "synthetic" }, env.JWT_SECRET)}`,
  };
  const denied = await call("/nutrition/estimate", { method: "POST", headers });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "AI_CONSENT_REQUIRED");
  assert.equal(queried, 1);
  assert.equal(
    (await call("/nutrition/meals?from=2026-02-30", { headers })).status,
    400,
  );
  assert.equal(
    (await call("/nutrition/meals?from=2026-01-01&to=2026-09-24", { headers }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("/nutrition/meals/not-uuid", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    400,
  );
  accepted = true;
  assert.equal(
    (await call("/nutrition/estimate", { method: "POST", headers })).status,
    400,
  );
  const body = new FormData();
  body.append(
    "photo",
    new Blob(["not a photo"], { type: "image/jpeg" }),
    "test.jpg",
  );
  assert.equal(
    (await call("/nutrition/estimate", { method: "POST", headers, body }))
      .status,
    400,
  );
  // Real SDK + consented fetch AFTER multipart parsing; external transport stubbed.
  let providerCalls = 0;
  prisma.$executeRaw = async () => 1;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://openrouter.ai/')) {
      providerCalls++;
      return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({foodDetected:true,items:[{name:'ბანანი',grams:120,calories:107,protein:1.3,carbs:27,fat:0.4}],uncertainty:'medium',explanation:'სატესტო შეფასება'})}}]}),{headers:{'Content-Type':'application/json'}});
    }
    return originalFetch(url, init);
  };
  const photo = await sharp({create:{width:16,height:16,channels:3,background:'#fff'}}).jpeg().toBuffer();
  const validBody = new FormData();
  validBody.append('photo',new Blob([photo],{type:'image/jpeg'}),'synthetic.jpg');
  const validResponse = await call('/nutrition/estimate',{method:'POST',headers,body:validBody});
  assert.equal(validResponse.status,200,await validResponse.clone().text());
  assert.equal(providerCalls,1,'Current consent must reach provider through multipart upload');

  consentReads = 0;
  revokeAfterPreflight = true;
  const revokedBody = new FormData();
  revokedBody.append('photo',new Blob([photo],{type:'image/jpeg'}),'synthetic.jpg');
  const revoked = await call('/nutrition/estimate',{method:'POST',headers,body:revokedBody});
  assert.equal(revoked.status,403);
  assert.equal((await revoked.json()).code,'AI_CONSENT_REQUIRED');
  assert.equal(providerCalls,1,'Revoked consent must stop the second transmission');

});
