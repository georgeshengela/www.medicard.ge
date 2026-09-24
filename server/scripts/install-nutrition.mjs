// Additive only; uses the existing configured main database. Never resets data.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
const db = new PrismaClient();
try {
  const sql = readFileSync(
    new URL("../prisma/20260924-nutrition.sql", import.meta.url),
    "utf8",
  );
  const statements = sql
    .split(/;\s*(?=\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "BEGIN" && s !== "COMMIT");
  await db.$transaction(
    async (tx) => {
      for (const s of statements) await tx.$executeRawUnsafe(s);
    },
    { timeout: 60000 },
  );
  console.log("Nutrition schema ready. Existing records preserved.");
} finally {
  await db.$disconnect();
}
