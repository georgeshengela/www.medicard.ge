const test=require('node:test');
const assert=require('node:assert/strict');
const load=()=>import('../src/lib/nutrition.ts');
test('portion changes scale all nutrients, not only energy',async()=>{
 const {scaleFood}=await load();const item={name:'Rice',grams:100,calories:130,protein:3,carbs:28,fat:0.3};
 assert.deepEqual(scaleFood(item,200),{name:'Rice',grams:200,calories:260,protein:6,carbs:56,fat:0.6});
 assert.deepEqual(scaleFood(scaleFood(item,200),100),item);
});
test('daily totals keep fractional nutrients',async()=>{const {foodTotals}=await load();assert.deepEqual(foodTotals([{name:'Rice',grams:100,calories:130,protein:3,carbs:28,fat:0.3}]),{calories:130,protein:3,carbs:28,fat:0.3});});
test('history navigation crosses month and year boundaries',async()=>{const {shiftDay}=await load();assert.equal(shiftDay('2026-01-01',-1),'2025-12-31');assert.equal(shiftDay('2024-03-01',-1),'2024-02-29');});
