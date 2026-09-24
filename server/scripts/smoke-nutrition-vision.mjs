// Standalone provider-contract check. Sends ONLY an in-memory synthetic flat image.
// No account, personal photo, health context or database is read by this script.
import OpenAI from "openai";
import sharp from "sharp";
import { env } from "../src/config/env.js";
import { consentedAiFetch } from "../src/lib/consentedAiFetch.js";
import { parseEstimate, NUTRITION_PROMPT } from "../src/lib/nutrition.js";
import assert from "node:assert/strict";
if (process.env.NUTRITION_SYNTHETIC_SMOKE !== "1")
  throw new Error("Explicit synthetic smoke opt-in required.");
const bytes = await sharp({
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
  max_tokens: 800,
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
const estimate = parseEstimate(result.choices[0]?.message?.content || "");
assert.equal(estimate.foodDetected, false);
assert.equal(estimate.items.length, 0);
console.log(
  "Live provider contract passed: a synthetic non-food image is rejected, JSON validated. No personal data or database writes.",
);
