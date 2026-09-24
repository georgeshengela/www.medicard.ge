// Profile allergies include medicines/environmental triggers. Never infer that
// an unrecognised label is a food allergy, or silently consider it food-safe.
const patterns = {
  milk: /milk|dairy|რძ|ლაქტოზ/i,
  eggs: /egg|კვერცხ/i,
  fish: /\bfish\b|თევზ/i,
  shellfish: /shellfish|crustacean|shrimp|prawn|კიბოსნაირ|კრევეტ/i,
  nuts: /\bnuts?\b|walnut|almond|hazelnut|თხილ|ნიგო|ნუშ/i,
  peanuts: /peanut|მიწის თხილ/i,
  soy: /\bsoy\b|soya|სოია/i,
  gluten: /gluten|wheat|გლუტენ|ხორბალ/i,
  sesame: /sesame|სეზამ/i,
  celery: /celery|ნიახურ/i,
  mustard: /mustard|მდოგვ/i,
  sulphites: /sulph?ites|sulfites|სულფიტ/i,
  lupin: /lupin|ლუპინ/i,
  molluscs: /mollus[ck]|mussel|oyster|squid|მოლუსკ|მიდი|ხამანწკ|კალმარ/i,
};
export function profileNutritionAllergies(values) {
  const labels = [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((v) => typeof v === "string" && v.trim())
        .map((v) => v.trim()),
    ),
  ];
  const requiredAllergens = new Set();
  const unclassifiedAllergies = [];
  for (const label of labels) {
    // A peanut is not a tree nut. Keep independently mentioned tree nuts.
    const withoutPeanut = label.replace(/peanuts?|მიწის თხილ\S*/gi, "");
    const matches = Object.entries(patterns)
      .filter(([key, pattern]) =>
        pattern.test(key === "nuts" ? withoutPeanut : label),
      )
      .map(([key]) => key);
    matches.forEach((key) => requiredAllergens.add(key));
    const parts = label
      .replace(/ალერგია|\ballerg(?:y|ies)\b/gi, "")
      .trim()
      .split(/[,;/+&]|\s+(?:და|and)\s+/i)
      .map((v) => v.trim())
      .filter(Boolean);
    // Mixed free text (e.g. "milk, strawberry") must not lose the unknown food
    // just because another word was recognised. Only simple labels auto-resolve.
    const knownOnly =
      parts.length &&
      parts.every((part) =>
        Object.values(patterns).some((pattern) =>
          new RegExp(`^(?:${pattern.source})(?:[ა-ჰ]{0,8})?$`, "i").test(part),
        ),
      );
    if (!knownOnly) unclassifiedAllergies.push(label);
  }
  return {
    requiredAllergens: [...requiredAllergens],
    unclassifiedAllergies,
    unknownAllergies: unclassifiedAllergies.length > 0,
  };
}

export function nutritionMealPlanning(config, facts = {}) {
  const reasons = [];
  const labels = facts.unclassifiedAllergies || [];
  const unresolvedAllergies = labels.filter((label) => {
    const answers = (config.allergyClarifications || []).filter(
      (a) => a.label === label,
    );
    if (answers.length !== 1) return true;
    const answer = answers[0];
    return (
      answer.kind !== "non_food" &&
      !(
        answer.kind === "food" &&
        answer.allergens.length &&
        answer.allergens.every((a) => config.allergens.includes(a))
      )
    );
  });
  if (unresolvedAllergies.length)
    reasons.push(
      `პროფილის ჩანაწერი დასაზუსტებელია: ${unresolvedAllergies.map((v) => `„${v}“`).join(", ")}. კვების არჩევანში მიუთითე, უკავშირდება თუ არა საკვებს და რომელი ალერგენები უნდა გამოირიცხოს.`,
    );
  // Compatibility with older facts/callers: missing detail must never mean safe.
  if (facts.unknownAllergies && !labels.length)
    reasons.push("პროფილის ალერგიები დააზუსტე კვების არჩევანში.");
  if (
    (facts.requiredAllergens || []).some((a) => !config.allergens.includes(a))
  )
    reasons.push(
      "პროფილში მითითებული საკვები ალერგენები განახლდა. გადაამოწმე კვების არჩევანი.",
    );
  if (config.avoidFoods?.trim())
    reasons.push(
      `დამატებითი შეზღუდვა: „${config.avoidFoods.trim()}“. ამ ტექსტს რეცეპტების ინგრედიენტებს საიმედოდ ვერ ვუსადაგებთ; რაციონი სპეციალისტთან შეარჩიე. დღის სამიზნე და დღიური ხელმისაწვდომია.`,
    );
  return { eligible: reasons.length === 0, reasons, unresolvedAllergies };
}
