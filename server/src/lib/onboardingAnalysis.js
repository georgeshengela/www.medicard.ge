import { consentedAiFetch } from './consentedAiFetch.js';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { withOpenRouterModelFallback } from './aiEngine.js';
import { calculateAge } from './patient.js';
import { cycleModeForPatientAiContext } from './cycleModes.js';

const openrouter = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      fetch: consentedAiFetch('openrouter'),
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
  { min: 51, max: 70, label: 'Mild Risk', labelKa: 'მსუბუქი რისკი', color: '#F97316', detailKa: 'მსუბუქი გადახრები ოპტიმალური ჯანმრთელობისგან — პრევენცია და მონიტორინგი დაგეხმარება.' },
  { min: 71, max: 100, label: 'Normal', labelKa: 'ნორმალური', color: '#14B8A6', detailKa: 'ძირითადი მაჩვენებლები ნორმალურ დიაპაზონშია — გააგრძელე ჯანსაღი ჩვევები.' },
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

  const avgHydrationMl = averageMetric(metrics, 'hydrationMl');
  const waterL = avgHydrationMl != null ? avgHydrationMl / 1000 : profile.waterIntakeL;
  if (waterL != null) {
    if (waterL >= 2) score += 3;
    else if (waterL < 1.2) score -= 4;
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

/**
 * Body fat from BMI, age and sex: Deurenberg, Weststrate & Seidell 1991, Br J Nutr 65:105-114
 * (PubMed 2043597): BF% = 1.2 x BMI + 0.23 x age - 10.8 x sex (1 = male) - 5.4.
 * "musclePct" is the rest, i.e. fat-free mass, not measured muscle. The weight label uses the
 * WHO adult BMI cut-offs (18.5 / 25). Estimates only; the app says so next to the numbers.
 */
export function estimateBodyComposition(profile, age = null) {
  const weight = profile.weightKg ?? 70;
  const bmi =
    profile.heightCm && profile.weightKg
      ? profile.weightKg / (profile.heightCm / 100) ** 2
      : 22;
  const years = Number.isFinite(age) && age >= 18 ? age : 35;
  const male = profile._gender === 'MALE' ? 1 : 0;

  let fatPct = 1.2 * bmi + 0.23 * years - 10.8 * male - 5.4;
  fatPct = Math.max(3, Math.min(60, Math.round(fatPct * 10) / 10));

  const musclePct = Math.round((100 - fatPct) * 10) / 10;

  let physiqueLabelKa = 'ჯანსაღი წონის დიაპაზონი';
  if (bmi >= 25) physiqueLabelKa = 'ჭარბი წონის დიაპაზონი';
  else if (bmi < 18.5) physiqueLabelKa = 'დაბალი წონის დიაპაზონი';

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
            hydrationMl: row.hydrationMl,
            weightKg: row.weightKg,
            sleepHours: row.sleepHours,
            heartRate: row.heartRate,
            nutritionKcal: row.nutritionKcal,
            activeMinutes: row.activeMinutes,
            distanceKm: row.distanceKm,
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
  "summaryTitleKa": string,
  "summaryBodyKa": string,
  "scoreRanges": [{ "min": number, "max": number, "labelKa": string, "detailKa": string }]
}`;


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
  model,
}) {
  const extra = extras && typeof extras === 'object' ? extras : {};
  const heuristicScore = computeHeuristicScore(profile, user, extra, metrics);
  const bodyComposition = estimateBodyComposition(
    { ...profile, _gender: user?.gender },
    user?.birthDate ? calculateAge(user.birthDate) : null,
  );
  const band = bandForScore(heuristicScore);
  const extrasContext = { metrics, scheduledMeds, cycleMode: cycleModeForPatientAiContext(cycleMode) };

  const fallback = {
    score: heuristicScore,
    label: band.label,
    labelKa: band.labelKa,
    // No invented confidence and no guessed conditions: the score is a wellness summary of
    // the answers, not a diagnosis (App Review 1.4.1).
    confidence: null,
    summaryTitleKa: `${band.labelKa} — პრევენციული ზომები რეკომენდებულია`,
    summaryBodyKa:
      'ანალიზი ეყრდნობა შენს პროფილს, ჩვევებს და შენახულ მაჩვენებლებს. რეკომენდებულია ცხოვრების წესის კორექცია და რეგულარული კონტროლი.',
    scoreRanges: SCORE_BANDS.map((b) => ({
      min: b.min,
      max: b.max,
      label: b.label,
      labelKa: b.labelKa,
      color: b.color,
      detailKa: b.detailKa,
    })),
    bodyComposition,
    engine: 'heuristic',
    model: null,
    previousScore,
    scoreDelta: previousScore != null ? Math.round((heuristicScore - previousScore) * 10) / 10 : null,
    analyzedAt: new Date().toISOString(),
  };

  if (!openrouter) return fallback;

  try {
    return await withOpenRouterModelFallback(model || env.OPENROUTER_MODEL, async (candidate) => {
      const completion = await openrouter.chat.completions.create({
        model: candidate,
        temperature: 0.35,
        max_tokens: 3200,
        messages: [
          {
            role: 'system',
            content: `Wellness summary writer for Medicard.GE. Output ONLY valid JSON:\n${ANALYSIS_SCHEMA}\nAll user strings in Georgian. This is a lifestyle summary of the answers, not a diagnosis: never name or guess a disease, deficiency, lab value or medication, and never invent doctors, clinics, pharmacies, products or prices.`,
          },
          {
            role: 'user',
            content: `Use ALL of this patient data. Score must move with the data, stay near baseline ${heuristicScore} (±12).\nPrevious score: ${previousScore ?? 'none'}\nProfile:\n${buildPatientContext(profile, user, extra, extrasContext)}`,
          },
        ],
      });

      const raw = completion.choices?.[0]?.message?.content?.trim();
      if (!raw) throw new Error('empty onboarding analysis');

      const jsonText = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(jsonText);
      const score = clampToHeuristic(parsed.score, heuristicScore);
      const resolvedBand = bandForScore(score);

      return {
        score,
        label: resolvedBand.label,
        labelKa: resolvedBand.labelKa,
        confidence: null,
        summaryTitleKa: parsed.summaryTitleKa ?? fallback.summaryTitleKa,
        summaryBodyKa: parsed.summaryBodyKa ?? fallback.summaryBodyKa,
        scoreRanges: SCORE_BANDS.map((b, i) => ({
          min: b.min,
          max: b.max,
          label: b.label,
          labelKa: b.labelKa,
          color: b.color,
          detailKa: parsed.scoreRanges?.[i]?.detailKa ?? b.detailKa,
        })),
        // Cited formula only; the model may not invent body-composition numbers.
        bodyComposition,
        engine: 'openrouter',
        model: completion.model ?? candidate,
        previousScore,
        scoreDelta: previousScore != null ? Math.round((score - previousScore) * 10) / 10 : null,
        analyzedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('[medicard] onboarding analysis failed:', error?.message ?? error);
    return fallback;
  }
}

export { SCORE_BANDS, bandForScore };
