/** Metadata only: never select message bodies, health values, images or identities. */
export async function collectModuleUsage(db, userId, from, to) {
  const definitions = [
    ['nutrition', 'nutritionMeal', 'createdAt', { userId }],
    ['assistant', 'assistantOperation', 'createdAt', { userId, status: 'DONE' }],
    ['consilium', 'aiInteraction', 'createdAt', { userId, mode: 'CONSILIUM', status: 'OK' }],
    ['lab', 'medicalRecord', 'createdAt', { userId, type: 'LAB' }],
    ['imaging', 'medicalRecord', 'createdAt', { userId, type: { in: ['XRAY', 'CT_MRI', 'IMAGING'] } }],
    ['skin', 'medicalRecord', 'createdAt', { userId, type: 'SKIN' }],
    ['skincare', 'medicalRecord', 'createdAt', { userId, type: 'SKINCARE' }],
    ['symptom_review', 'aiInteraction', 'createdAt', { userId, mode: 'SYMPTOM_CHECKER', status: 'OK' }],
    ['records', 'medicalRecord', 'createdAt', { userId }],
    ['medirun', 'medipulsiSession', 'startedAt', { userId }],
    ['quest', 'questCompletion', 'completedAt', { userId }],
    ['pets', 'pet', 'createdAt', { userId }],
    ['medi_vet', 'petChatSession', 'createdAt', { userId }],
    ['community', 'communityMember', 'createdAt', { userId }],
    ['pregnancy', 'pregnancyLog', 'createdAt', { userId }],
  ];
  const entries = await Promise.all(definitions.map(async ([key, model, field, where]) => {
    try {
      const [all, periodCount] = await Promise.all([
        db[model].aggregate({ where, _count: { _all: true }, _min: { [field]: true }, _max: { [field]: true } }),
        db[model].count({ where: { ...where, [field]: { gte: from, lt: to } } }),
      ]);
      return [key, { available: true, used: all._count._all > 0,
        firstUsed: all._min[field]?.toISOString() || null,
        lastUsed: all._max[field]?.toISOString() || null, periodCount }];
    } catch (error) {
      console.warn('[admin usage]', key, error?.code || 'query_failed');
      return [key, { available: false, used: false, firstUsed: null, lastUsed: null, periodCount: null }];
    }
  }));
  return Object.fromEntries(entries);
}
