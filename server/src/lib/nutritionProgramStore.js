import { randomUUID } from "node:crypto";
import { prisma } from "./prisma.js";
import {
  assessNutritionProgram,
  shiftCivil,
  summarizeNutritionDays,
  shoppingList,
  buildWeek,
  portionRecipe,
  recipeAllowed,
} from "./nutritionProgram.js";
import { totals } from "./nutrition.js";

export const nutritionError = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export async function nutritionFacts(
  user,
  db = prisma,
  today = new Date().toISOString().slice(0, 10),
) {
  const [profile, measured, cycle] = await Promise.all([
    db.healthProfile.findUnique({ where: { userId: user.id } }),
    db.healthMetricDaily.findMany({
      where: { userId: user.id, weightKg: { not: null }, date: { lte: today } },
      orderBy: { date: "desc" },
      take: 28,
      select: { date: true, weightKg: true },
    }),
    db.cycleProfile.findUnique({
      where: { userId: user.id },
      select: { mode: true },
    }),
  ]);
  const state = profile?.extraAnswers?.appState || {};
  const allergyMap = {
    milk: /milk|dairy|რძ|ლაქტოზ/i,
    eggs: /egg|კვერცხ/i,
    fish: /fish|თევზ/i,
    shellfish: /shellfish|crustacean|shrimp|კიბო|კრევეტ/i,
    nuts: /nuts|walnut|თხილ|ნიგო/i,
    peanuts: /peanut|მიწის თხილ/i,
    soy: /soy|სოია/i,
    gluten: /gluten|wheat|გლუტენ|ხორბალ/i,
    sesame: /sesame|სეზამ/i,
  };
  const allergies = Array.isArray(profile?.allergies)
    ? profile.allergies.filter((v) => typeof v === "string" && v.trim())
    : [];
  const requiredAllergens = [
    ...new Set(
      allergies.flatMap((label) =>
        Object.entries(allergyMap)
          .filter(([, pattern]) => pattern.test(label))
          .map(([key]) => key),
      ),
    ),
  ];
  const unknownAllergies = allergies.some(
    (label) =>
      !Object.values(allergyMap).some((pattern) => pattern.test(label)),
  );
  const logs = Array.isArray(state.weightLogs)
    ? state.weightLogs
        .filter(
          (v) =>
            v.date <= today &&
            Number.isFinite(v.kg) &&
            v.kg >= 20 &&
            v.kg <= 300,
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    : [];
  const current =
    measured[0] && (!logs[0] || measured[0].date >= logs[0].date)
      ? {
          kg: measured[0].weightKg,
          date: measured[0].date,
          source: "measurement",
        }
      : logs[0]
        ? { kg: logs[0].kg, date: logs[0].date, source: "weight_log" }
        : profile?.weightKg
          ? { kg: profile.weightKg, date: null, source: "profile" }
          : null;
  return {
    requiredAllergens,
    unknownAllergies,
    birthDate: user.birthDate
      ? new Date(user.birthDate).toISOString().slice(0, 10)
      : null,
    sex:
      user.gender === "FEMALE"
        ? "female"
        : user.gender === "MALE"
          ? "male"
          : null,
    heightCm: profile?.heightCm || null,
    current,
    weightGoal: state.weightGoal || null,
    // The shared weight log may be newer than the daily-health sync. Keep the
    // chart consistent with current weight and prefer daily measurements on ties.
    weightHistory: [
      ...new Map([
        ...logs
          .slice()
          .reverse()
          .map((v) => [v.date, { date: v.date, weightKg: v.kg }]),
        ...measured.map((v) => [v.date, v]),
      ]).values(),
    ]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-28),
    activity:
      {
        SEDENTARY: "sedentary",
        LIGHT: "light",
        MODERATE: "moderate",
        ACTIVE: "active",
        VERY_ACTIVE: "active",
      }[profile?.activityLevel] || null,
    diet:
      { OMNIVORE: "balanced", VEGETARIAN: "vegetarian", VEGAN: "vegan" }[
        profile?.dietType
      ] || "balanced",
    // No protected reproductive details are exposed through the nutrition payload.
    sensitiveRestriction: ["PREGNANCY", "POSTPARTUM"].includes(cycle?.mode),
    medicalRestriction:
      (Array.isArray(profile?.chronicConditions) &&
        profile.chronicConditions.length > 0) ||
      profile?.extraAnswers?.hasConditions === true,
  };
}
export function publicNutritionFacts(facts) {
  const { sensitiveRestriction, medicalRestriction, ...safe } = facts;
  return {
    ...safe,
    professionalReviewNeeded: !!(sensitiveRestriction || medicalRestriction),
  };
}
export async function readNutritionProgram(userId, db = prisma) {
  return (
    (
      await db.$queryRaw`SELECT * FROM "NutritionProgram" WHERE "userId"=${userId}`
    )[0] || null
  );
}
export function programState(program, facts, today) {
  if (!program)
    return { program: null, needsReview: false, reasons: [], targets: null };
  const review = assessNutritionProgram(program.config, facts, today);
  const reasons = [...review.reasons];
  if (
    program.goalLink &&
    (program.goalLink.id !== facts.weightGoal?.id ||
      program.goalLink.targetKg !== facts.weightGoal?.targetKg)
  )
    reasons.push("წონის მიზანი შეიცვალა. კვების გეგმა ხელახლა გადაამოწმე.");
  if (
    facts.current &&
    Math.abs(facts.current.kg - program.config.weightKg) >= 2
  )
    reasons.push("მიმდინარე წონა შეიცვალა. დღის სამიზნე ხელახლა გადაამოწმე.");
  if (today > shiftCivil(program.startedOn, 28))
    reasons.push(
      "გეგმის განახლების დროა — გადაამოწმე წონა, აქტივობა და ჯანმრთელობის ინფორმაცია.",
    );
  return {
    program,
    needsReview: reasons.length > 0,
    reasons,
    targets: program.active && !reasons.length ? program.targets : null,
  };
}
export async function nutritionDashboard(user, day, db = prisma) {
  const from = shiftCivil(day, -6);
  const [facts, program, meals, history, planned] = await Promise.all([
    nutritionFacts(user, db, day),
    readNutritionProgram(user.id, db),
    db.$queryRaw`SELECT id,date,type,items FROM "NutritionMeal" WHERE "userId"=${user.id} AND date>=${from} AND date<=${day} ORDER BY date,id LIMIT 7000`,
    db.$queryRaw`SELECT date,targets FROM "NutritionTargetHistory" WHERE "userId"=${user.id} AND date<=${day} ORDER BY date DESC LIMIT 35`,
    db.$queryRaw`SELECT p.*, (m.id IS NOT NULL) AS eaten FROM "NutritionPlannedMeal" p LEFT JOIN "NutritionMeal" m ON m.id=p.id AND m."userId"=p."userId" WHERE p."userId"=${user.id} AND p.date=${day} ORDER BY p.type`,
  ]);
  const state = programState(program, facts, day);
  const today = totals(
    meals.filter((m) => m.date === day).flatMap((m) => m.items),
  );
  return {
    ...state,
    facts: publicNutritionFacts(facts),
    date: day,
    today,
    remaining: state.targets ? state.targets.calories - today.calories : null,
    days: summarizeNutritionDays(meals, from, 7, history),
    mealCount: meals.filter((m) => m.date === day).length,
    planned: planned.filter((p) => p.programRevision === program?.revision),
    intakeSource: "nutrition_meals_only",
  };
}

/** A row lock protects the shared canonical weight goal, including app-state writers. */
export async function saveNutritionProgram(
  user,
  input,
  day,
  expectedRevision,
  db = prisma,
) {
  return db.$transaction(
    async (tx) => {
      await tx.healthProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      await tx.$queryRaw`SELECT "userId" FROM "HealthProfile" WHERE "userId"=${user.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT "userId" FROM "NutritionProgram" WHERE "userId"=${user.id} FOR UPDATE`;
      const current = await readNutritionProgram(user.id, tx);
      if ((current?.revision || null) !== expectedRevision)
        throw nutritionError(
          "გეგმა სხვა ეკრანზე შეიცვალა. განაახლე გვერდი და გადაამოწმე.",
          409,
        );
      const facts = await nutritionFacts(user, tx, day);
      const assessment = assessNutritionProgram(input, facts, day);
      if (!assessment.eligible)
        throw nutritionError(assessment.reasons.join(" "), 422);
      input = assessment.input;
      const revision = randomUUID();
      const oldGoal = facts.weightGoal;
      const sameGoal = oldGoal?.targetKg === input.targetKg;
      const difference = Math.abs(input.targetKg - input.weightKg);
      await tx.healthMetricDaily.upsert({
        where: { userId_date: { userId: user.id, date: day } },
        create: { userId: user.id, date: day, weightKg: input.weightKg },
        update: { weightKg: input.weightKg },
      });
      const pace =
        input.mode === "gain" ? 0.2 : input.pace === "gentle" ? 0.25 : 0.4;
      const weeks = difference / pace;
      // This date is only an approximate review horizon, not a promised weight-loss deadline.
      const goal = {
        ...(oldGoal || {}),
        id: oldGoal?.id || randomUUID(),
        startKg: sameGoal ? oldGoal.startKg : input.weightKg,
        targetKg: input.targetKg,
        startedYmd: sameGoal ? oldGoal.startedYmd : day,
        deadlineYmd: shiftCivil(day, Math.max(28, Math.ceil(weeks * 7))),
        paceKgPerWeek: pace,
        pace: pace <= 0.25 ? "slow" : "moderate",
        reminderEnabled: oldGoal?.reminderEnabled || false,
        reminderDays: oldGoal?.reminderDays || [],
        reminderHour: oldGoal?.reminderHour ?? 9,
        reminderMinute: oldGoal?.reminderMinute ?? 0,
        completedSeen: sameGoal ? oldGoal.completedSeen : false,
        updatedAt: new Date().toISOString(),
      };
      const goalLink = { id: goal.id, targetKg: goal.targetKg };
      const storedState =
        (await tx.healthProfile.findUnique({ where: { userId: user.id } }))
          ?.extraAnswers?.appState || {};
      const weightLog = {
        id: `wlog-nutrition-${day}`,
        date: day,
        at: goal.updatedAt,
        kg: input.weightKg,
      };
      const updated = JSON.stringify({
        ...storedState,
        weightGoal: goal,
        weightLogs: [
          weightLog,
          ...(storedState.weightLogs || []).filter((v) => v.date !== day),
        ].slice(0, 1000),
        updatedAt: goal.updatedAt,
      });
      await tx.$executeRaw`UPDATE "HealthProfile" SET "weightKg"=${input.weightKg},"heightCm"=${input.heightCm},"extraAnswers"=jsonb_set(COALESCE("extraAnswers",'{}'::jsonb),'{appState}',${updated}::jsonb,true) WHERE "userId"=${user.id}`;
      await tx.$executeRaw`INSERT INTO "NutritionProgram" ("userId",revision,config,targets,"goalLink","startedOn") VALUES (${user.id},${revision},${JSON.stringify(input)}::jsonb,${JSON.stringify(assessment.targets)}::jsonb,${JSON.stringify(goalLink)}::jsonb,${day}) ON CONFLICT ("userId") DO UPDATE SET revision=EXCLUDED.revision,config=EXCLUDED.config,targets=EXCLUDED.targets,"goalLink"=EXCLUDED."goalLink","startedOn"=EXCLUDED."startedOn",active=TRUE,"updatedAt"=NOW()`;
      await tx.$executeRaw`INSERT INTO "NutritionTargetHistory" ("userId",date,targets) VALUES (${user.id},${day},${JSON.stringify(assessment.targets)}::jsonb) ON CONFLICT ("userId",date) DO UPDATE SET targets=EXCLUDED.targets`;
      return {
        program: await readNutritionProgram(user.id, tx),
        goal,
        weightLog,
      };
    },
    { timeout: 15000 },
  );
}

export async function getNutritionWeek(userId, from, db = prisma) {
  const to = shiftCivil(from, 6);
  const meals =
    await db.$queryRaw`SELECT p.*, (m.id IS NOT NULL) AS eaten FROM "NutritionPlannedMeal" p LEFT JOIN "NutritionMeal" m ON m.id=p.id AND m."userId"=p."userId" WHERE p."userId"=${userId} AND p.date>=${from} AND p.date<=${to} ORDER BY p.date,p.type`;
  return { from, to, meals, shopping: shoppingList(meals) };
}
export async function generateNutritionWeek(
  user,
  from,
  today,
  variant,
  expectedRevision,
  db = prisma,
) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "userId" FROM "NutritionProgram" WHERE "userId"=${user.id} FOR UPDATE`;
      const program = await readNutritionProgram(user.id, tx);
      const state = programState(
        program,
        await nutritionFacts(user, tx, today),
        today,
      );
      if (!state.targets || program.revision !== expectedRevision)
        throw nutritionError("ჯერ მოქმედი კვების გეგმა გადაამოწმე.", 409);
      const recipes =
        await tx.$queryRaw`SELECT * FROM "NutritionRecipe" WHERE active=TRUE ORDER BY id`;
      const week = buildWeek(
        program.config,
        state.targets,
        recipes,
        from,
        variant,
      );
      const rows = week.map(({ date, type, recipeId, ...data }) => ({
        id: randomUUID(),
        date,
        type,
        recipeId,
        data,
      }));
      await tx.$executeRaw`INSERT INTO "NutritionPlannedMeal" (id,"userId",date,type,"recipeId","programRevision",data)
        SELECT entry.id,${user.id},entry.date,entry.type,entry."recipeId",${program.revision},entry.data
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS entry(id text,date text,type text,"recipeId" text,data jsonb)
        ON CONFLICT ("userId",date,type) DO UPDATE SET "recipeId"=EXCLUDED."recipeId","programRevision"=EXCLUDED."programRevision",data=EXCLUDED.data,"updatedAt"=NOW()
        WHERE NOT EXISTS (SELECT 1 FROM "NutritionMeal" m WHERE m.id="NutritionPlannedMeal".id AND m."userId"=${user.id})`;
      return getNutritionWeek(user.id, from, tx);
    },
    { timeout: 20000 },
  );
}
export async function eatPlannedMeal(userId, id, today, db = prisma) {
  return db.$transaction(async (tx) => {
    const [meal] =
      await tx.$queryRaw`SELECT * FROM "NutritionPlannedMeal" WHERE id=${id} AND "userId"=${userId} FOR UPDATE`;
    if (!meal) throw nutritionError("კვება ვერ მოიძებნა.", 404);
    if (meal.date > today)
      throw nutritionError("მომავალი კვება მიღებულად ჯერ ვერ ჩაითვლება.");
    // Snapshot planned food once; retries never replace later manual portion corrections.
    await tx.$executeRaw`INSERT INTO "NutritionMeal" (id,"userId",date,type,items,note,source) VALUES (${meal.id},${userId},${meal.date},${meal.type},${JSON.stringify(meal.data.items)}::jsonb,'რაციონიდან დამატებული','plan') ON CONFLICT (id) DO NOTHING`;
    return { ok: true };
  });
}
export async function swapPlannedMeal(user, id, recipeId, today, db = prisma) {
  return db.$transaction(async (tx) => {
    const [meal] =
      await tx.$queryRaw`SELECT * FROM "NutritionPlannedMeal" WHERE id=${id} AND "userId"=${user.id} FOR UPDATE`;
    if (!meal) throw nutritionError("კვება ვერ მოიძებნა.", 404);
    if (
      (
        await tx.$queryRaw`SELECT id FROM "NutritionMeal" WHERE id=${id} AND "userId"=${user.id}`
      ).length
    )
      throw nutritionError("მიღებული კვება დღიურში შეასწორე.", 409);
    const program = await readNutritionProgram(user.id, tx),
      state = programState(
        program,
        await nutritionFacts(user, tx, today),
        today,
      );
    if (!state.targets || meal.programRevision !== program.revision)
      throw nutritionError("ჯერ მოქმედი გეგმა გადაამოწმე.", 409);
    const [recipe] =
      await tx.$queryRaw`SELECT * FROM "NutritionRecipe" WHERE id=${recipeId}`;
    if (
      !recipe ||
      !recipeAllowed(recipe, program.config) ||
      recipe.data.type !== meal.type
    )
      throw nutritionError(
        "ეს კერძი არჩეულ კვებასა და შეზღუდვებს არ შეესაბამება.",
      );
    const data = portionRecipe(recipe, totals(meal.data.items).calories);
    await tx.$executeRaw`UPDATE "NutritionPlannedMeal" SET "recipeId"=${recipeId},data=${JSON.stringify(data)}::jsonb,"updatedAt"=NOW() WHERE id=${id} AND "userId"=${user.id}`;
    return { ok: true };
  });
}
