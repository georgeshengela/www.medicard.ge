import test from "node:test";
import assert from "node:assert/strict";
import { nutritionTextEn, nutritionPayloadEn } from "./nutritionMessages.js";

test("nutrition English copy covers errors, recipes, catalog foods and labels", () => {
  assert.equal(nutritionTextEn("ჩანაწერი ვერ მოიძებნა."), "Entry not found.");
  assert.equal(nutritionTextEn("შვრია ბანანითა და თესლით"), "Oats with banana and seeds");
  assert.equal(nutritionTextEn("თეთრი პური"), "White bread");
  assert.equal(nutritionTextEn("my own food"), null);
  const out = nutritionPayloadEn({ items: [{ name: "ომლეტი", serving: { grams: 60, label: "პორცია" } }], note: "ჩემი" });
  assert.deepEqual(out, { items: [{ name: "Omelette", serving: { grams: 60, label: "serving" } }], note: "ჩემი" });
});
