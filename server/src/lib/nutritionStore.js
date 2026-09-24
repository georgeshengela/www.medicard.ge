// Every read and mutation is scoped to the authenticated account, never body.userId.
export async function saveMeal(db, userId, input) {
  const rows =
    await db.$queryRaw`INSERT INTO "NutritionMeal" (id,"userId",date,type,items,note,source) VALUES (${input.id},${userId},${input.date},${input.type},${JSON.stringify(input.items)}::jsonb,${input.note},${input.source})
 ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date,type=EXCLUDED.type,items=EXCLUDED.items,note=EXCLUDED.note,source=EXCLUDED.source,"updatedAt"=NOW() WHERE "NutritionMeal"."userId"=${userId} RETURNING *`;
  return rows[0] || null;
}
export function listMeals(db, userId, from, to) {
  return db.$queryRaw`SELECT * FROM "NutritionMeal" WHERE "userId"=${userId} AND date>=${from} AND date<=${to} ORDER BY date DESC,"createdAt" DESC LIMIT 1001`;
}
export function deleteMeal(db, userId, id) {
  return db.$executeRaw`DELETE FROM "NutritionMeal" WHERE id=${id} AND "userId"=${userId}`;
}
