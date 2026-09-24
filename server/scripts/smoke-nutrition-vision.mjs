// Standalone provider-contract check. Sends ONLY generated, non-personal test images.
// No account, personal photo, health context or database is read by this script.
import OpenAI from "openai";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { env } from "../src/config/env.js";
import { consentedAiFetch } from "../src/lib/consentedAiFetch.js";
import { parseEstimate, NUTRITION_PROMPT } from "../src/lib/nutrition.js";
import assert from "node:assert/strict";
if (process.env.NUTRITION_SYNTHETIC_SMOKE !== "1")
  throw new Error("Explicit synthetic smoke opt-in required.");
const foodFixture = process.argv.includes("--food");
const bytes = foodFixture ? await sharp(fileURLToPath(new URL("../../mobile/assets/pregnancy-size/banana.webp", import.meta.url))).flatten({background:"#f5f5f5"}).jpeg().toBuffer() : await sharp({
  create: { width: 128, height: 128, channels: 3, background: "#777777" },
})
  .jpeg()
  .toBuffer();
const syntheticFetch = consentedAiFetch("openrouter", {
  account: () => "synthetic-generated-image",
  check: async (id) => {
    assert.equal(id, "synthetic-generated-image");
  },
});
const client = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
  fetch: syntheticFetch,
  maxRetries: 0,
  timeout: 45000,
});
const result = await client.chat.completions.create({
  model: "google/gemini-3.8-flash",
  temperature: 0.1,
  max_tokens: 2200,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: NUTRITION_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Estimate the contents of this image." },
        {
          type: "image_url",
          image_url: {
            url: "data:image/jpeg;base64," + bytes.toString("base64"),
          },
        },
      ],
    },
  ],
});
console.log(JSON.stringify({finish:result.choices[0]?.finish_reason, characters:result.choices[0]?.message?.content?.length, tokens:result.usage?.completion_tokens}));
const estimate = parseEstimate(result.choices[0]?.message?.content || "");
assert.equal(estimate.foodDetected, foodFixture);
assert.equal(estimate.items.length > 0, foodFixture);
console.log(
  `Live provider contract passed (${foodFixture ? "generated banana illustration" : "non-food image"}). JSON validated. No personal data or database writes.`,
);
