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

function asList(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function latestMetric(metrics, key) {
  if (!Array.isArray(metrics)) return null;
  const row = metrics.find((item) => item?.[key] != null);
  return row ? row[key] : null;
}

function averageMetric(metrics, key) {
  if (!Array.isArray(metrics)) return null;
  const values = metrics.map((item) => Number(item?.[key])).filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export function computeHeuristicScore(profile, user, extras = {}, metrics = []) {
  let score = 68;
  const extra = extras && typeof extras === 'object' ? extras : {};
  const weightKg = profile.weightKg ?? latestMetric(metrics, 'weightKg');
  const heightCm = profile.heightCm;
  const bmi = heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;

  if (bmi != null) {
    if (bmi >= 18.5 && bmi < 25) score += 8;
    else if (bmi >= 25 && bmi < 27) score += 1;
    else if (bmi >= 27 && bmi < 30) score -= 8;
    else score -= 16;
  }

  if (profile.smokingStatus === 'NEVER') score += 4;
  else if (profile.smokingStatus === 'FORMER') score -= 4;
  else if (profile.smokingStatus === 'CURRENT') score -= 16;

  if (profile.sleepQuality === 'EXCELLENT') score += 6;
  else if (profile.sleepQuality === 'GOOD') score += 3;
  else if (profile.sleepQuality === 'FAIR') score -= 6;
  else if (profile.sleepQuality === 'POOR') score -= 12;

  const sleepHours = profile.sleepHours ?? averageMetric(metrics, 'sleepHours');
  if (sleepHours != null) {
    if (sleepHours >= 7 && sleepHours <= 9) score += 4;
    else if (sleepHours < 6) score -= 10;
    else if (sleepHours > 10) score -= 4;
  }

  if (profile.stressLevel === 'LOW') score += 4;
  else if (profile.stressLevel === 'HIGH') score -= 8;
  else if (profile.stressLevel === 'VERY_HIGH') score -= 12;

  if (profile.activityLevel === 'VERY_ACTIVE' || profile.activityLevel === 'ACTIVE') score += 8;
  else if (profile.activityLevel === 'MODERATE') score += 3;
  else if (profile.activityLevel === 'LIGHT') score -= 4;
  else if (profile.activityLevel === 'SEDENTARY') score -= 10;

  if (profile.exerciseFrequency === 'DAILY') score += 5;
  else if (profile.exerciseFrequency === 'WEEKLY') score += 2;
  else if (profile.exerciseFrequency === 'RARE') score -= 2;
  else if (profile.exerciseFrequency === 'NEVER') score -= 5;

  if (profile.alcoholUse === 'NEVER') score += 3;
  else if (profile.alcoholUse === 'REGULAR') score -= 8;

  if (profile.waterIntakeL != null) {
    if (profile.waterIntakeL >= 2) score += 3;
    else if (profile.waterIntakeL < 1.2) score -= 4;
  }

  const hr = profile.restingHeartRate ?? latestMetric(metrics, 'heartRate');
  if (hr != null) {
    if (hr >= 55 && hr <= 75) score += 3;
    else if (hr > 90) score -= 8;
    else if (hr < 48) score -= 3;
  }

  const sys = profile.bloodPressureSystolic ?? latestMetric(metrics, 'bloodPressureSystolic');
  const dia = profile.bloodPressureDiastolic ?? latestMetric(metrics, 'bloodPressureDiastolic');
  if (sys != null) {
    if (sys < 120 && (dia == null || dia < 80)) score += 4;
    else if (sys < 130) score -= 2;
    else if (sys < 140) score -= 8;
    else score -= 14;
  }

  score -= Math.min(asList(profile.chronicConditions).length * 5, 20);
  score -= Math.min(asList(profile.allergies).length, 4);
  score -= Math.min(asList(profile.familyHistory).length * 2, 8);
  if (asList(profile.medications).length > 4) score -= 6;
  if (asList(profile.healthGoals).length > 0) score += 2;

  const mood = typeof extra.mood === 'string' ? extra.mood : null;
  if (mood === 'GREAT' || mood === 'HAPPY') score += 3;
  else if (mood === 'SAD' || mood === 'AWFUL') score -= 5;

  const fitness = typeof extra.fitnessLevel === 'number' ? extra.fitnessLevel : null;
  if (fitness != null) {
    if (fitness >= 4) score += 4;
    else if (fitness <= 2) score -= 4;
  }

  const sleepLevel = typeof extra.sleepLevel === 'number' ? extra.sleepLevel : null;
  if (sleepLevel != null) {
    if (sleepLevel >= 4) score += 3;
    else if (sleepLevel <= 2) score -= 4;
  }

  const avgSteps = averageMetric(metrics, 'steps');
  if (avgSteps != null) {
    if (avgSteps >= 8000) score += 6;
    else if (avgSteps >= 5000) score += 2;
    else if (avgSteps < 3000) score -= 6;
  }

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

function extraForContext(extra) {
  if (!extra || typeof extra !== 'object') return {};
  const { onboardingAnalysis: _omit, ...rest } = extra;
  return rest;
}

function buildPatientContext(profile, user, extras = {}, extrasContext = {}) {
  const age = user?.birthDate ? calculateAge(user.birthDate) : null;
  const extra = extraForContext(extras);
  const metrics = extrasContext.metrics ?? [];
  const scheduledMeds = extrasContext.scheduledMeds ?? [];
  const lines = [
    `gender: ${user?.gender ?? 'unknown'}`,
    age != null ? `age: ${age}` : null,
    profile.heightCm ? `heightCm: ${profile.heightCm}` : null,
    profile.weightKg ? `weightKg: ${profile.weightKg}` : null,
    profile.bloodType ? `bloodType: ${profile.bloodType}` : null,
    profile.activityLevel ? `activity: ${profile.activityLevel}` : null,
    profile.exerciseFrequency ? `exercise: ${profile.exerciseFrequency}` : null,
    profile.sleepQuality ? `sleepQuality: ${profile.sleepQuality}` : null,
    profile.sleepHours != null ? `sleepHours: ${profile.sleepHours}` : null,
    profile.stressLevel ? `stress: ${profile.stressLevel}` : null,
    profile.smokingStatus ? `smoking: ${profile.smokingStatus}` : null,
    profile.alcoholUse ? `alcohol: ${profile.alcoholUse}` : null,
    profile.dietType ? `diet: ${profile.dietType}` : null,
    profile.waterIntakeL != null ? `waterL: ${profile.waterIntakeL}` : null,
    profile.restingHeartRate != null ? `restingHr: ${profile.restingHeartRate}` : null,
    profile.bloodPressureSystolic
      ? `bp: ${profile.bloodPressureSystolic}/${profile.bloodPressureDiastolic ?? '?'}`
      : null,
    asList(profile.chronicConditions).length ? `conditions: ${asList(profile.chronicConditions).join(', ')}` : null,
    asList(profile.allergies).length ? `allergies: ${asList(profile.allergies).join(', ')}` : null,
    asList(profile.medications).length ? `medications: ${asList(profile.medications).join(', ')}` : null,
    asList(profile.familyHistory).length ? `familyHistory: ${asList(profile.familyHistory).join(', ')}` : null,
    asList(profile.healthGoals).length ? `goals: ${asList(profile.healthGoals).join(', ')}` : null,
    extra.bodyType ? `bodyType: ${extra.bodyType}` : null,
    extra.mood ? `mood: ${extra.mood}` : null,
    extra.fitnessLevel != null ? `fitnessLevel: ${extra.fitnessLevel}` : null,
    extra.sleepLevel != null ? `sleepLevel: ${extra.sleepLevel}` : null,
    extra.checkupFrequency ? `checkupFrequency: ${extra.checkupFrequency}` : null,
    extra.legalName ? `legalName: ${extra.legalName}` : null,
    extra.healthNote ? `healthNote: ${String(extra.healthNote).slice(0, 400)}` : null,
    extra.takesMedications != null ? `takesMedications: ${extra.takesMedications}` : null,
    extra.hasConditions != null ? `hasConditions: ${extra.hasConditions}` : null,
    scheduledMeds.length ? `scheduledMeds: ${scheduledMeds.join(', ')}` : null,
    extrasContext.cycleMode ? `cycleMode: ${extrasContext.cycleMode}` : null,
    metrics.length
      ? `recentDailyMetrics: ${JSON.stringify(
          metrics.slice(0, 14).map((row) => ({
            date: row.date,
            steps: row.steps,
            weightKg: row.weightKg,
            sleepHours: row.sleepHours,
            heartRate: row.heartRate,
            bp: row.bloodPressureSystolic
              ? `${row.bloodPressureSystolic}/${row.bloodPressureDiastolic ?? '?'}`
              : null,
          })),
        )}`
      : null,
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
      nameKa: 'დრ. მარიამ ჩიხლაძე',
      specialtyKa: 'ნევროლოგი',
      distanceKm: 1.8,
      rating: 4.5,
      reviewCount: 221,
      remote: false,
    },
  ];

  const medications = asList(profile.medications).slice(0, 2).map((med) => ({
    nameKa: med,
    typeKa: 'ტაბლეტი',
    scheduleKa: '1 ტაბლეტი დღეში — ექიმის დანიშნულების მიხედვით',
    tagsKa: ['ყოველდღე'],
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
          ? `ძილი ${profile.sleepHours} საათია — რეკომენდებულია მინიმუმ 7 საათი.`
          : 'ძილის რეჟიმის დაცვა აძლიერებს იმუნიტეტს.',
      currentHours,
      optimalHours: [7.5, 7.5, 8, 7.5, 8, 7.5, 8],
    },
    pharmacies: [
      {
        nameKa: 'PSP აფთიაქი',
        addressKa: 'თბილისი, ვაკე',
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
      { titleKa: 'როგორ გავაუმჯობესოთ ჯანმრთელობა ყოველდღიური ჩვევებით', readMinutes: 3 },
      { titleKa: 'კეტო დიეტა — რა უნდა იცოდეთ', readMinutes: 5 },
      { titleKa: 'ენერგეტიკული სასმელები და გული', readMinutes: 3 },
    ],
  };
}

function clampToHeuristic(aiScore, heuristicScore) {
  if (typeof aiScore !== 'number' || Number.isNaN(aiScore)) return heuristicScore;
  const lo = Math.max(8, heuristicScore - 12);
  const hi = Math.min(96, heuristicScore + 12);
  return Math.max(lo, Math.min(hi, Math.round(aiScore * 10) / 10));
}

export async function generateOnboardingAnalysis({
  profile,
  user,
  extras = {},
  metrics = [],
  scheduledMeds = [],
  cycleMode = null,
  previousScore = null,
}) {
  const extra = extras && typeof extras === 'object' ? extras : {};
  const heuristicScore = computeHeuristicScore(profile, user, extra, metrics);
  const bodyComposition = estimateBodyComposition({ ...profile, _gender: user?.gender });
  const band = bandForScore(heuristicScore);
  const extrasContext = { metrics, scheduledMeds, cycleMode };

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
      'ანალიზი ეყრდნობა თქვენს პროფილს, ჩვევებს და შენახულ მაჩვენებლებს. რეკომენდებულია ცხოვრების წესის კორექცია და რეგულარული კონტროლი.',
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
    previousScore,
    scoreDelta: previousScore != null ? Math.round((heuristicScore - previousScore) * 10) / 10 : null,
    analyzedAt: new Date().toISOString(),
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
          content: `Use ALL of this patient data. Score must move with the data, stay near baseline ${heuristicScore} (±12).\nPrevious score: ${previousScore ?? 'none'}\nProfile:\n${buildPatientContext(profile, user, extra, extrasContext)}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) return { ...fallback, model: env.OPENROUTER_MODEL };

    const jsonText = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonText);
    const score = clampToHeuristic(parsed.score, heuristicScore);
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
      previousScore,
      scoreDelta: previousScore != null ? Math.round((score - previousScore) * 10) / 10 : null,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[medicard] onboarding analysis failed:', error?.message ?? error);
    return { ...fallback, model: env.OPENROUTER_MODEL };
  }
}

export { SCORE_BANDS, bandForScore };
