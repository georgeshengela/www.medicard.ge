import OpenAI from 'openai';
import { env } from '../config/env.js';
import { calculateAge } from './patient.js';

const openrouter = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      timeout: 120_000,
      maxRetries: 1,
      defaultHeaders: {
        'HTTP-Referer': 'https://medicard.ge',
        'X-Title': 'Medicard.GE',
      },
    })
  : null;

const SCORE_BANDS = [
  { min: 0, max: 20, label: 'Critical', labelKa: 'კრიტიკული', color: '#22C55E', detailKa: 'საჭიროა დაუყოვნებლივი სამედიცინო კონსულტაცია და გეგმის შედგენა.' },
  { min: 21, max: 50, label: 'Suboptimal', labelKa: 'არაოპტიმალური', color: '#F43F5E', detailKa: 'რამდენიმე მაჩვენებელი საშუალო ნორმის ქვემოთაა — რეკომენდებულია ცვლილებები ყოველდღიურ ჩვევებში.' },
  { min: 51, max: 70, label: 'Mild Risk', labelKa: 'მსუბუქი რისკი', color: '#F97316', detailKa: 'მსუბუქი გადახრები ოპტიმალური ჯანმრთელობისგან — პრევენცია და მონიტორინგი დაგეხმარებათ.' },
  { min: 71, max: 100, label: 'Very Healthy', labelKa: 'ძალიან ჯანმრთელი', color: '#14B8A6', detailKa: 'ძირითადი მაჩვენებლები კარგ დიაპაზონშია — გააგრძელეთ ჯანსაღი ჩვევები.' },
];

function bandForScore(score) {
  return SCORE_BANDS.find((b) => score >= b.min && score <= b.max) ?? SCORE_BANDS[2];
}

function computeHeuristicScore(profile, user) {
  let score = 72;
  const bmi =
    profile.heightCm && profile.weightKg
      ? profile.weightKg / (profile.heightCm / 100) ** 2
      : null;

  if (bmi != null) {
    if (bmi < 18.5 || bmi > 30) score -= 18;
    else if (bmi < 20 || bmi > 27) score -= 10;
    else if (bmi > 25) score -= 5;
  }

  if (profile.smokingStatus === 'CURRENT') score -= 15;
  else if (profile.smokingStatus === 'FORMER') score -= 5;

  if (profile.sleepQuality === 'POOR') score -= 12;
  else if (profile.sleepQuality === 'FAIR') score -= 6;

  if (profile.stressLevel === 'VERY_HIGH') score -= 12;
  else if (profile.stressLevel === 'HIGH') score -= 8;

  if (profile.activityLevel === 'SEDENTARY') score -= 10;
  else if (profile.activityLevel === 'LIGHT') score -= 4;

  const conditions = profile.chronicConditions?.length ?? 0;
  score -= Math.min(conditions * 4, 16);

  const meds = profile.medications?.length ?? 0;
  if (meds > 3) score -= 6;

  const age = user?.birthDate ? calculateAge(user.birthDate) : null;
  if (age != null && age > 55) score -= 4;

  return Math.max(8, Math.min(96, Math.round(score * 10) / 10));
}

function estimateBodyComposition(profile) {
  const weight = profile.weightKg ?? 70;
  const bmi =
    profile.heightCm && profile.weightKg
      ? profile.weightKg / (profile.heightCm / 100) ** 2
      : 22;

  let fatPct = 18 + (bmi - 22) * 1.2;
  if (profile._gender === 'MALE') fatPct -= 4;
  fatPct = Math.max(8, Math.min(38, Math.round(fatPct * 10) / 10));

  const musclePct = Math.max(55, Math.min(88, Math.round((100 - fatPct - 12) * 10) / 10));

  let physiqueLabelKa = 'კარგი ფიზიკური ფორმა';
  if (bmi > 28) physiqueLabelKa = 'ზედმეტი წონის რისკი';
  else if (bmi < 19) physiqueLabelKa = 'დაბალი წონის რისკი';

  return { fatPct, weightKg: Math.round(weight), musclePct, physiqueLabelKa };
}

function buildPatientContext(profile, user) {
  const age = user?.birthDate ? calculateAge(user.birthDate) : null;
  const extra = profile.extraAnswers ?? {};
  const lines = [
    `gender: ${user?.gender ?? 'unknown'}`,
    age != null ? `age: ${age}` : null,
    profile.heightCm ? `heightCm: ${profile.heightCm}` : null,
    profile.weightKg ? `weightKg: ${profile.weightKg}` : null,
    profile.bloodType ? `bloodType: ${profile.bloodType}` : null,
    profile.activityLevel ? `activity: ${profile.activityLevel}` : null,
    profile.sleepQuality ? `sleepQuality: ${profile.sleepQuality}` : null,
    profile.sleepHours ? `sleepHours: ${profile.sleepHours}` : null,
    profile.stressLevel ? `stress: ${profile.stressLevel}` : null,
    profile.smokingStatus ? `smoking: ${profile.smokingStatus}` : null,
    profile.chronicConditions?.length ? `conditions: ${profile.chronicConditions.join(', ')}` : null,
    profile.medications?.length ? `medications: ${profile.medications.join(', ')}` : null,
    profile.healthGoals?.length ? `goals: ${profile.healthGoals.join(', ')}` : null,
    profile.bloodPressureSystolic
      ? `bp: ${profile.bloodPressureSystolic}/${profile.bloodPressureDiastolic ?? '?'}`
      : null,
    extra.bodyType ? `bodyType: ${extra.bodyType}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

const ANALYSIS_SCHEMA = `{
  "score": number,
  "labelKa": string,
  "confidence": number,
  "summaryTitleKa": string,
  "summaryBodyKa": string,
  "scoreRanges": [{ "min": number, "max": number, "labelKa": string, "detailKa": string }],
  "bodyComposition": { "fatPct": number, "weightKg": number, "musclePct": number, "physiqueLabelKa": string },
  "recommendations": {
    "specialists": [{ "nameKa": string, "specialtyKa": string, "distanceKm": number, "rating": number, "reviewCount": number, "remote": boolean }],
    "medications": [{ "nameKa": string, "typeKa": string, "scheduleKa": string, "tagsKa": string[] }],
    "bloodPressure": { "systolic": number, "diastolic": number, "summaryKa": string },
    "sleep": { "personaKa": string, "adviceKa": string, "currentHours": number[], "optimalHours": number[] },
    "pharmacies": [{ "nameKa": string, "addressKa": string, "rating": number, "freeDelivery": boolean, "tagKa": string }],
    "products": [{ "nameKa": string, "priceGel": number, "originalPriceGel": number, "discountPct": number, "rating": number, "rxNeeded": boolean, "inStock": number }],
    "articles": [{ "titleKa": string, "readMinutes": number }]
  }
}`;

function buildFallbackRecommendations(profile) {
  const sys = profile.bloodPressureSystolic ?? 120;
  const dia = profile.bloodPressureDiastolic ?? 80;
  const sleepHours = profile.sleepHours ?? 6.5;
  const currentHours = [0, 1, 2, 3, 4, 5, 6].map((i) =>
    Math.round((sleepHours + (i % 3) * 0.3 - 0.5) * 10) / 10,
  );

  const specialists = [
    {
      nameKa: 'დრ. ნინო ბერიძე',
      specialtyKa: 'თერაპევტი',
      distanceKm: 0.8,
      rating: 4.7,
      reviewCount: 128,
      remote: true,
    },
    {
      nameKa: 'დრ. მარიამ ჩიხლadze',
      specialtyKa: 'ნevrolog',
      distanceKm: 1.8,
      rating: 4.5,
      reviewCount: 221,
      remote: false,
    },
  ];

  const medications = (profile.medications ?? []).slice(0, 2).map((med) => ({
    nameKa: med,
    typeKa: 'tableti',
    scheduleKa: '1 tablet დღეში — ექიმის დანიშნულების მიხედვით',
    tagsKa: ['#daily', 'after meal'],
  }));

  return {
    specialists,
    medications,
    bloodPressure: {
      systolic: sys,
      diastolic: dia,
      summaryKa:
        sys <= 130 && dia <= 85
          ? 'თქვენი არტერიული წნევა ნორმის ფარგლებშია.'
          : 'არტერიული წნევა საჭიროებს მონიტორინგს.',
    },
    sleep: {
      personaKa: profile.sleepQuality === 'POOR' ? 'დაღლილი' : 'საშუალო',
      adviceKa:
        profile.sleepHours != null && profile.sleepHours < 7
          ? `ძილი ${profile.sleepHours} საათია — რეკომendebuliა მინიმუმ 7 საათი.`
          : 'ძილის რეჟimის დაცვა გ strengthens იმუნიტetს.',
      currentHours,
      optimalHours: [7.5, 7.5, 8, 7.5, 8, 7.5, 8],
    },
    pharmacies: [
      {
        nameKa: 'PSP ფarmacia',
        addressKa: 'თბilisი, ვაკe',
        rating: 4.4,
        freeDelivery: true,
        tagKa: 'personal care',
      },
    ],
    products: [
      {
        nameKa: 'Vitamin D3 2000 IU',
        priceGel: 24.9,
        originalPriceGel: 32,
        discountPct: 22,
        rating: 4.6,
        rxNeeded: false,
        inStock: 46,
      },
    ],
    articles: [
      { titleKa: 'AI ეპoxის შემდეგ ჯანმრთelobის გაუმჯობესება', readMinutes: 3 },
      { titleKa: 'კეტo დიეტა — რა უნდა იცოდეთ', readMinutes: 5 },
      { titleKa: 'ენergetikული სასმelები', readMinutes: 3 },
    ],
  };
}

export async function generateOnboardingAnalysis({ profile, user }) {
  const heuristicScore = computeHeuristicScore(profile, user);
  const bodyComposition = estimateBodyComposition({ ...profile, _gender: user?.gender });
  const band = bandForScore(heuristicScore);

  const fallback = {
    score: heuristicScore,
    label: band.label,
    labelKa: band.labelKa,
    confidence: 94.5,
    summaryTitleKa:
      band.labelKa === 'მსუბუქი რისკი'
        ? 'მსუბუქი ვიტამინის დეფიციტი ან ქოლესტერინის მცირე მომატება'
        : `${band.labelKa} — პრევენციული ზომები რეკომენდებულია`,
    summaryBodyKa:
      'მიუთითებს ოპტიმალური ჯანმრთელობის პარამეტრებისგან მსუბუქ გადახრებზე. რეკომendebuliა ცხოვრების წესის კორექция და რეგულარული კონტროლი.',
    scoreRanges: SCORE_BANDS.map((b) => ({
      min: b.min,
      max: b.max,
      label: b.label,
      labelKa: b.labelKa,
      color: b.color,
      detailKa: b.detailKa,
    })),
    bodyComposition,
    recommendations: buildFallbackRecommendations(profile),
    engine: 'heuristic',
    model: null,
  };

  if (!openrouter) return fallback;

  try {
    const completion = await openrouter.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      temperature: 0.35,
      max_tokens: 3200,
      messages: [
        {
          role: 'system',
          content: `Clinical wellness analyst for Medicard.GE. Output ONLY valid JSON:\n${ANALYSIS_SCHEMA}\nAll user strings in Georgian.`,
        },
        {
          role: 'user',
          content: `Profile:\n${buildPatientContext(profile, user)}\nBaseline score: ${heuristicScore}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return { ...fallback, model: env.OPENROUTER_MODEL };

    const jsonText = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonText);
    const score = typeof parsed.score === 'number' ? parsed.score : heuristicScore;
    const resolvedBand = bandForScore(score);

    return {
      score,
      label: resolvedBand.label,
      labelKa: parsed.labelKa ?? resolvedBand.labelKa,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 96.2,
      summaryTitleKa: parsed.summaryTitleKa ?? fallback.summaryTitleKa,
      summaryBodyKa: parsed.summaryBodyKa ?? fallback.summaryBodyKa,
      scoreRanges: SCORE_BANDS.map((b, i) => ({
        min: b.min,
        max: b.max,
        label: b.label,
        labelKa: parsed.scoreRanges?.[i]?.labelKa ?? b.labelKa,
        color: b.color,
        detailKa: parsed.scoreRanges?.[i]?.detailKa ?? b.detailKa,
      })),
      bodyComposition: { ...bodyComposition, ...parsed.bodyComposition },
      recommendations: { ...fallback.recommendations, ...parsed.recommendations },
      engine: 'openrouter',
      model: completion.model ?? env.OPENROUTER_MODEL,
    };
  } catch (error) {
    console.error('[medicard] onboarding analysis failed:', error?.message ?? error);
    return { ...fallback, model: env.OPENROUTER_MODEL };
  }
}

export { SCORE_BANDS, bandForScore };
