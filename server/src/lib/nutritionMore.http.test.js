import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import { nutritionRouter } from "../routes/nutrition.routes.js";
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";
import { errorHandler } from "../middleware/error.js";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("fasting, recipe and copy gates (no database writes on refusal)", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/nutrition", nutritionRouter);
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const saved = {
    find: prisma.user.findUnique,
    raw: prisma.$queryRaw,
    execute: prisma.$executeRaw,
    profile: prisma.healthProfile.findUnique,
    metrics: prisma.healthMetricDaily.findMany,
    cycle: prisma.cycleProfile.findUnique,
  };
  t.after(() => {
    prisma.user.findUnique = saved.find;
    prisma.$queryRaw = saved.raw;
    prisma.$executeRaw = saved.execute;
    prisma.healthProfile.findUnique = saved.profile;
    prisma.healthMetricDaily.findMany = saved.metrics;
    prisma.cycleProfile.findUnique = saved.cycle;
  });
  assert.equal((await fetch(base + "/nutrition/fasting")).status, 401);

  prisma.user.findUnique = async () => ({ id: "synthetic", status: "ACTIVE", birthDate: new Date("1990-01-01"), gender: "FEMALE" });
  prisma.healthProfile.findUnique = async () => null;
  prisma.healthMetricDaily.findMany = async () => [];
  prisma.cycleProfile.findUnique = async () => null;
  let preference = null;
  const writes = [];
  prisma.$queryRaw = async (strings) => {
    const sql = strings.join("");
    if (sql.includes("NutritionPreference")) return preference ? [{ data: preference }] : [];
    if (sql.includes("INSERT") || sql.includes("UPDATE")) writes.push(sql);
    return [];
  };
  prisma.$executeRaw = async (strings) => {
    writes.push(strings.join(""));
    return 1;
  };
  const token = jwt.sign({ sub: "synthetic" }, env.JWT_SECRET);
  const call = (path, method = "GET", body) =>
    fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Client-Timezone": "Asia/Tbilisi" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const start = { id: id(1), protocol: "16:8", targetMinutes: 960 };
  const first = await call("/nutrition/fasting/start", "POST", start);
  assert.equal(first.status, 403, "no timer before the safety answers");
  preference = { fasting: { screening: { eatingDisorder: true, pregnancy: false, diabetesMedication: false, doctorApproved: true, answeredAt: "2026-09-27T08:00:00.000Z" }, protocol: "16:8", targetMinutes: 960, notify: true } };
  const refused = await call("/nutrition/fasting/start", "POST", start);
  assert.equal(refused.status, 403, "eating-disorder history is never overridden");
  const state = await (await call("/nutrition/fasting")).json();
  assert.equal(state.eligibility.blocked, true);
  assert.equal((await call("/nutrition/fasting/start", "POST", { ...start, targetMinutes: 36 * 60, protocol: "custom" })).status, 400, "no extended fasts");
  assert.equal(writes.filter((w) => w.includes("NutritionFast")).length, 0);

  // General preference saves never replace the fasting answers.
  await call("/nutrition/preferences", "PUT", { rollover: true });
  const prefWrite = writes.find((w) => w.includes("NutritionPreference"));
  assert.ok(prefWrite, "preference saved");
  const prefs = await (await call("/nutrition/preferences")).json();
  assert.equal(prefs.preferences.fasting, undefined, "fasting answers are not echoed by the general endpoint");
  assert.equal((await call("/nutrition/preferences", "PUT", { unknownKey: true })).status, 400);
  assert.equal((await call("/nutrition/preferences", "PUT", { macros: { mode: "custom", protein: 20, carbs: 10, fat: 70 } })).status, 400);

  assert.equal((await call("/nutrition/meals/copy", "POST", { date: "2099-01-01", copies: [{ fromId: id(2), id: id(3) }] })).status, 400, "no future copies");
  assert.equal((await call("/nutrition/meals/copy", "POST", { date: "2026-09-01", copies: [{ fromId: id(2), id: id(3) }] })).status, 404, "only the person's own meals are copied");
  assert.equal((await call(`/nutrition/recipes/${id(4)}`, "PUT", { id: id(5), name: "x", servings: 2, items: [{ name: "a", grams: 100, calories: 100, protein: 1, carbs: 1, fat: 1 }] })).status, 400, "path and body ids must match");
  assert.equal((await call(`/nutrition/recipes/${id(4)}`, "PUT", { id: id(4), name: "x", servings: 0, items: [] })).status, 400);
});
