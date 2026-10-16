import React from 'react';
import { Dimensions, Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { AllergyPicker } from '@/components/assessment/AllergyPicker';
import { ConditionPicker } from '@/components/assessment/ConditionPicker';
import { DateWheelPicker } from '@/components/assessment/DateWheelPicker';
import { MedicationPicker } from '@/components/assessment/MedicationPicker';
import { WeightRulerPicker } from '@/components/assessment/WeightRulerPicker';
import { ChipGroup, ChoiceList, GroupLabel, TileGrid } from '@/components/onboarding/OnboardingKit';
import { VelvetInput } from '@/components/velvet/VelvetInput';
import { AssessmentTokensContext, velvetAssessmentTokens } from '@/constants/assessmentLayout';
import { AVATAR_SOURCES } from '@/constants/avatarAssets';
import type { QuestionKey } from '@/constants/assessmentSteps';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { Gender } from '@/lib/api';
import { ageFromForm, type AssessmentFormState } from '@/lib/assessmentForm';
import { MIN_USER_AGE, MIN_USER_AGE_MESSAGE } from '@/lib/birthdate';
import {
  activeDaysOptions,
  alcoholOptions,
  dietPatternOptions,
  eatingHabitOptions,
  exerciseOptions,
  produceOptions,
  sleepBandOptions,
  sleepFeelOptions,
  smokingOptions,
  smokingProductOptions,
  toggleDietPattern,
  toggleExclusive,
  type HabitAnswers,
} from '@/lib/healthHabits';
import { velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

const SCREEN_W = Dimensions.get('window').width;
const WEIGHT_KG = Array.from({ length: 166 }, (_, i) => 35 + i);
const HEIGHT_RULER_CM = Array.from({ length: 101 }, (_, i) => 120 + i);

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const GEO_GROUP: Record<string, string> = { O: 'I', A: 'II', B: 'III', AB: 'IV' };

/** „A-“ → „A−“ for display (a real minus sign). */
export function bloodLabel(value: string): string {
  return value.replace('-', '−');
}

/** The title and the one line under it for every question. Kept here so the copy sits next to the answers. */
export function questionCopy(key: QuestionKey, form: AssessmentFormState): { title: string; body?: string } {
  const s = ka.assessment.steps;
  switch (key) {
    case 'name':
      return { title: tx('როგორ მოგმართოთ?', 'What should we call you?'), body: tx('სახელი და გვარი — Medi სახელით მოგმართავს.', 'First and last name — Medi will call you by your first name.') };
    case 'gender':
      return { title: s.genderTitle, body: s.genderBody };
    case 'birthdate':
      return { title: s.birthdateTitle, body: s.birthdateBody };
    case 'height':
      return { title: s.heightTitle, body: tx('საჭიროა BMI-სთვის და დღის კალორიების დასათვლელად.', 'For your BMI and daily calorie target.') };
    case 'weight':
      return { title: s.weightTitle, body: tx('საჭიროა წონის დინამიკისთვის და დღის კალორიების დასათვლელად. მერეც მარტივად შეცვლი.', 'For your weight trend and daily calorie target. Easy to change later.') };
    case 'blood-type':
      return { title: s.bloodTypeTitle, body: s.bloodTypeBody };
    case 'allergies':
      return { title: s.allergiesTitle, body: s.allergiesBody };
    case 'conditions-gate':
      return { title: s.conditionsGateTitle, body: s.conditionsGateBody };
    case 'conditions-list':
      return { title: s.conditionsListTitle, body: tx('შეგიძლია რამდენიმე დაამატო.', 'You can add several.') };
    case 'medications-gate':
      return { title: s.medsGateTitle, body: s.medsGateBody };
    case 'medications-list':
      return { title: s.medsListTitle, body: tx('რასაც ამჟამად იღებ — ერთი ან რამდენიმე.', 'What you take now — one or several.') };
    case 'activity':
      return {
        title: tx('კვირაში რამდენ დღეს მოძრაობ აქტიურად?', 'On how many days a week are you active?'),
        body: tx(
          'ჯამში 30 წუთი მაინც, ისე რომ სუნთქვა აგიჩქარდეს. ყველაფერი ითვლება: სწრაფი სიარული, ფეხით გადაადგილება, ფიზიკური სამუშაო, ველოსიპედი, სპორტი.',
          'At least 30 minutes in total, enough to breathe faster. Everything counts: brisk walking, walking to get places, physical work, cycling, sport.',
        ),
      };
    case 'sleep':
      return { title: tx('საშუალოდ რამდენ საათს გძინავს?', 'How many hours do you usually sleep?'), body: tx('დღე-ღამეში, დღის ძილის ჩათვლით.', 'In 24 hours, naps included.') };
    case 'smoking':
      return {
        title: tx('ეწევი?', 'Do you smoke?'),
        body: tx('სიგარეტი, IQOS, ელექტრონული სიგარეტი თუ ჩილიმი — ყველა ითვლება.', 'Cigarettes, IQOS, e-cigarettes or hookah — they all count.'),
      };
    case 'alcohol':
      return { title: tx('რამდენად ხშირად სვამ ალკოჰოლს?', 'How often do you drink alcohol?'), body: tx('ღვინო, ლუდი, ჭაჭა, არაყი — სახლისაც ითვლება.', 'Wine, beer, chacha, vodka — homemade counts too.') };
    case 'diet':
      return {
        title: tx('როგორ იკვებები?', 'How do you eat?'),
        body: tx('მონიშნე ყველაფერი, რაც შენ გეხება. Medi და MEDIFOOD ამას გაითვალისწინებენ.', 'Pick all that apply. Medi and MEDIFOOD take it into account.'),
      };
    case 'eating':
      return { title: tx('ხილი და ბოსტნეული', 'Fruit and vegetables'), body: tx('დღეში რამდენ პორციას ჭამ? 1 პორცია ≈ ერთი მუჭა.', 'How many portions a day? 1 portion ≈ a handful.') };
    default:
      return { title: '' };
  }
}

/** Whether „გაგრძელება“ can be pressed. Second parts of a page (exercise, sleep quality…) are optional. */
export function questionReady(key: QuestionKey, form: AssessmentFormState): boolean {
  const h = form.habits;
  switch (key) {
    case 'gender':
      return form.gender !== null && (form.gender !== 'OTHER' || form.genderOther.trim().length > 0);
    case 'birthdate':
      return ageFromForm(form) >= MIN_USER_AGE;
    case 'height':
      return form.heightCm >= 100;
    case 'weight':
      return form.weightKg >= 30;
    case 'blood-type':
      return form.bloodType !== null;
    case 'allergies':
      return form.allergies.length > 0;
    case 'conditions-list':
      return form.chronicConditions.length > 0;
    case 'medications-list':
      return form.medications.length > 0;
    case 'activity':
      return h.activeDays !== null;
    case 'sleep':
      return h.sleepBand !== null;
    case 'smoking':
      return h.smoking !== null;
    case 'alcohol':
      return h.alcoholFreq !== null;
    case 'diet':
      return h.dietPatterns.length > 0;
    case 'eating':
      return h.produce !== null;
    default:
      return true;
  }
}

/** One measurement per page: a big number, then a full-width ruler under it. */
function BigRuler({ palette: p, label, value, unit, values, labelOrigin, onSelect }: { palette: VelvetPalette; label: string; value: number; unit: string; values: number[]; labelOrigin: number; onSelect: (n: number) => void }) {
  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <View
        accessibilityLabel={`${label}: ${value} ${unit}`}
        style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 76, lineHeight: 92, letterSpacing: -2, color: p.ink }}>{value}</Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 24, lineHeight: 30, color: p.ink2 }}>{unit}</Text>
      </View>
      <View style={{ width: SCREEN_W, marginHorizontal: -20, marginTop: 18 }}>
        <WeightRulerPicker values={values} selected={value} labelEvery={10} labelOrigin={labelOrigin} onSelect={onSelect} />
      </View>
      <Text style={{ marginTop: 14, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: p.inkOff }}>
        {tx('გადაასრიალე სახაზავი', 'Slide the ruler')}
      </Text>
    </View>
  );
}

/** The two portraits are the app's own 3D profile avatars (the same art the profile offers later). */
const PORTRAITS: { key: Gender; label: string; image: number }[] = [
  { key: 'FEMALE', label: ka.auth.genderFemale, image: AVATAR_SOURCES['avatar-1'] },
  { key: 'MALE', label: ka.auth.genderMale, image: AVATAR_SOURCES['avatar-2'] },
];
const PORTRAIT = 128;

function tick() {
  void Haptics.selectionAsync().catch(() => undefined);
}

/**
 * Sex (owner 2026-10-11: the three small symbol tiles looked poor): two tall cards with a portrait in a
 * pressed well — the page's one bold element — and „სხვა“ as a quiet row under them. The card not chosen
 * steps back a little once the other one is picked.
 */
function GenderTiles({ palette: p, value, onPick }: { palette: VelvetPalette; value: Gender | null; onPick: (g: Gender) => void }) {
  const otherOn = value === 'OTHER';
  // Two cards share the page (20 pt gutters, 14 pt gap); the well keeps 8 pt of card on each side, so a
  // 320 pt iPhone SE (133 pt cards) gets a smaller portrait instead of one wider than its card.
  const { width } = useWindowDimensions();
  const well = Math.min(PORTRAIT + 12, Math.floor((width - 40 - 14) / 2 - 16));
  const portrait = well - 12;
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        {PORTRAITS.map((g) => {
          const on = value === g.key;
          const faded = value !== null && !on;
          return (
            <Pressable
              key={g.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={g.label}
              onPress={() => {
                tick();
                onPick(g.key);
              }}
              style={{
                flex: 1,
                paddingTop: 20,
                paddingBottom: 18,
                borderRadius: 28,
                alignItems: 'center',
                gap: 14,
                backgroundColor: on ? p.field : p.surface,
                boxShadow: on ? `${velvetField(p)}, 0px 0px 0px 2px ${p.pulse}` : velvetLift(p),
              }}
            >
              <View
                style={{
                  width: well,
                  height: well,
                  borderRadius: well / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: p.surface,
                  boxShadow: velvetField(p),
                }}
              >
                <Image
                  source={g.image}
                  accessibilityIgnoresInvertColors
                  style={{ width: portrait, height: portrait, borderRadius: portrait / 2, opacity: faded ? 0.45 : 1 }}
                />
                {on ? (
                  <View
                    style={{
                      position: 'absolute',
                      right: 2,
                      bottom: 2,
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: p.pulse,
                      borderWidth: 3,
                      borderColor: p.field,
                    }}
                  >
                    <Check size={15} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <Text style={{ fontFamily: on ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold', fontSize: 18, lineHeight: 24, color: on ? p.ink : faded ? p.inkOff : p.text }}>
                {g.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: otherOn }}
        accessibilityLabel={ka.auth.genderOther}
        onPress={() => {
          tick();
          onPick('OTHER');
        }}
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          borderRadius: 20,
          backgroundColor: otherOn ? p.field : p.surface,
          boxShadow: otherOn ? `${velvetField(p)}, 0px 0px 0px 1.5px ${p.pulse}` : velvetLift(p),
        }}
      >
        <Text style={{ fontFamily: otherOn ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 22, color: otherOn ? p.ink : p.text }}>
          {ka.auth.genderOther}
        </Text>
        {otherOn ? (
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.pulse, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={15} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : (
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.field, boxShadow: velvetField(p) }} />
        )}
      </Pressable>
    </View>
  );
}

/**
 * The blood-group guide under the choices, as the old page had it (owner 2026-10-11): Georgian I–IV next
 * to the international O / A / B / AB, the Rh sign, examples and the „მეორე დადებითი = A+“ takeaway.
 */
function BloodGuide({ palette: p }: { palette: VelvetPalette }) {
  const help = ka.assessment.bloodTypeHelp;
  const small = { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: p.ink2 } as const;
  return (
    <View style={{ marginTop: 22, borderRadius: 22, padding: 16, gap: 14, backgroundColor: p.surface, boxShadow: velvetLift(p) }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: p.text }}>{help.title}</Text>
      <Text style={small}>{help.intro}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {help.maps.map((row) => (
          <View key={row.geo} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: p.field, boxShadow: velvetField(p) }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: p.ink }}>{row.geo}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, color: p.inkOff }}>=</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: p.text }}>{row.abo}</Text>
          </View>
        ))}
      </View>
      <Text style={small}>{help.rh}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {help.examples.map((ex) => (
          <View key={ex.abo} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: p.field, boxShadow: velvetField(p) }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: p.ink2 }}>{ex.geo}</Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: p.pulse }}>=</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 17, color: p.ink }}>{ex.abo}</Text>
          </View>
        ))}
      </View>
      <View style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: p.field, boxShadow: `${velvetField(p)}, 0px 0px 0px 1.5px ${p.pulse}` }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 20, color: p.ink }}>{help.takeaway}</Text>
      </View>
    </View>
  );
}

type Props = {
  palette: VelvetPalette;
  question: QuestionKey;
  form: AssessmentFormState;
  onChange: (patch: Partial<AssessmentFormState>) => void;
  onHabits: (patch: Partial<HabitAnswers>) => void;
  /** Yes/no questions answer and move on in one tap. */
  onAnswer: (patch: Partial<AssessmentFormState>) => void;
};

/** The answer area of one question (the title, button and header live in the page). */
export function QuestionContent({ palette: p, question, form, onChange, onHabits, onAnswer }: Props) {
  const h = form.habits;
  const tokens = React.useMemo(() => velvetAssessmentTokens(p), [p]);

  switch (question) {
    case 'gender':
      return (
        <View style={{ gap: 18 }}>
          <GenderTiles palette={p} value={form.gender} onPick={(gender) => onChange({ gender })} />
          {form.gender === 'OTHER' ? (
            <VelvetInput
              palette={p}
              value={form.genderOther}
              onChangeText={(genderOther) => onChange({ genderOther })}
              placeholder={ka.assessment.genderOtherPlaceholder}
              autoCapitalize="sentences"
              maxLength={60}
            />
          ) : null}
        </View>
      );

    case 'birthdate': {
      const age = ageFromForm(form);
      return (
        <View style={{ alignItems: 'center' }}>
          <DateWheelPicker
            palette={p}
            month={form.birthMonth}
            day={form.birthDay}
            year={form.birthYear}
            maxYear={new Date().getFullYear() - MIN_USER_AGE}
            onChange={(patch) =>
              onChange({
                ...(patch.month !== undefined ? { birthMonth: patch.month } : {}),
                ...(patch.day !== undefined ? { birthDay: patch.day } : {}),
                ...(patch.year !== undefined ? { birthYear: patch.year } : {}),
              })
            }
          />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 22, color: p.ink2 }}>{ka.assessment.ageBadge(age)}</Text>
          {age < MIN_USER_AGE ? (
            <Text accessibilityRole="alert" style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: p.danger, textAlign: 'center', paddingHorizontal: 12 }}>
              {MIN_USER_AGE_MESSAGE}
            </Text>
          ) : null}
        </View>
      );
    }

    case 'height':
      return (
        <AssessmentTokensContext.Provider value={tokens}>
          <BigRuler palette={p} label={ka.assessment.bodyHeight} value={Math.round(form.heightCm)} unit={ka.assessment.cm} values={HEIGHT_RULER_CM} labelOrigin={120} onSelect={(heightCm) => onChange({ heightCm })} />
        </AssessmentTokensContext.Provider>
      );

    case 'weight':
      return (
        <AssessmentTokensContext.Provider value={tokens}>
          <BigRuler palette={p} label={ka.assessment.bodyWeight} value={Math.round(form.weightKg)} unit={ka.assessment.kg} values={WEIGHT_KG} labelOrigin={35} onSelect={(weightKg) => onChange({ weightKg })} />
        </AssessmentTokensContext.Provider>
      );

    case 'blood-type':
      return (
        <View>
          <TileGrid
            palette={p}
            columns={4}
            items={BLOOD_TYPES.map((t) => {
              const group = t.replace(/[+-]/, '');
              return { key: t, label: bloodLabel(t), sub: `${GEO_GROUP[group]}${t.endsWith('+') ? '+' : '−'}` };
            })}
            selected={form.bloodType && form.bloodType !== 'UNKNOWN' ? form.bloodType : null}
            onPress={(bloodType) => onChange({ bloodType })}
          />
          <BloodGuide palette={p} />
        </View>
      );

    case 'allergies':
      return (
        <AssessmentTokensContext.Provider value={tokens}>
          <AllergyPicker value={form.allergies} onChange={(allergies) => onChange({ allergies })} />
        </AssessmentTokensContext.Provider>
      );

    case 'conditions-gate':
      return (
        <ChoiceList
          palette={p}
          items={[
            { key: 'yes', label: ka.assessment.conditionsYes },
            { key: 'no', label: ka.assessment.conditionsNo },
          ]}
          selected={form.hasConditions === null ? [] : [form.hasConditions ? 'yes' : 'no']}
          onPress={(key) => onAnswer(key === 'yes' ? { hasConditions: true } : { hasConditions: false, chronicConditions: [] })}
        />
      );

    case 'conditions-list':
      return (
        <AssessmentTokensContext.Provider value={tokens}>
          <ConditionPicker value={form.chronicConditions} onChange={(chronicConditions) => onChange({ chronicConditions })} />
        </AssessmentTokensContext.Provider>
      );

    case 'medications-gate':
      return (
        <ChoiceList
          palette={p}
          items={[
            { key: 'yes', label: ka.assessment.medsYes },
            { key: 'no', label: ka.assessment.medsNo },
          ]}
          selected={form.takesMedications === null ? [] : [form.takesMedications ? 'yes' : 'no']}
          onPress={(key) => onAnswer(key === 'yes' ? { takesMedications: true } : { takesMedications: false, medications: [] })}
        />
      );

    case 'medications-list':
      return (
        <AssessmentTokensContext.Provider value={tokens}>
          <MedicationPicker value={form.medications} onChange={(medications) => onChange({ medications })} />
        </AssessmentTokensContext.Provider>
      );

    case 'activity':
      return (
        <View>
          <ChoiceList palette={p} items={activeDaysOptions()} selected={h.activeDays ? [h.activeDays] : []} onPress={(key) => onHabits({ activeDays: key as HabitAnswers['activeDays'] })} />
          <GroupLabel palette={p} text={tx('რამდენად ხშირად ვარჯიშობ?', 'How often do you exercise?')} hint={tx('დარბაზი, სირბილი, ცურვა, ფეხბურთი, იოგა…', 'Gym, running, swimming, football, yoga…')} />
          <ChipGroup palette={p} multi={false} items={exerciseOptions()} selected={h.exerciseFreq ? [h.exerciseFreq] : []} onPress={(key) => onHabits({ exerciseFreq: key as HabitAnswers['exerciseFreq'] })} />
        </View>
      );

    case 'sleep':
      return (
        <View>
          <TileGrid palette={p} columns={3} unit={tx('საათი', 'hours')} items={sleepBandOptions()} selected={h.sleepBand} onPress={(key) => onHabits({ sleepBand: key as HabitAnswers['sleepBand'] })} />
          <GroupLabel palette={p} text={tx('როგორ გძინავს ჩვეულებრივ?', 'How well do you usually sleep?')} />
          <ChipGroup palette={p} multi={false} items={sleepFeelOptions()} selected={h.sleepFeel ? [h.sleepFeel] : []} onPress={(key) => onHabits({ sleepFeel: key as HabitAnswers['sleepFeel'] })} />
        </View>
      );

    case 'smoking':
      return (
        <View>
          <ChoiceList palette={p} items={smokingOptions()} selected={h.smoking ? [h.smoking] : []} onPress={(key) => onHabits({ smoking: key as HabitAnswers['smoking'] })} />
          {h.smoking && h.smoking !== 'NEVER' ? (
            <>
              <GroupLabel
                palette={p}
                text={h.smoking === 'FORMER' ? tx('რას ეწეოდი?', 'What did you smoke?') : tx('რას ეწევი?', 'What do you smoke?')}
                hint={tx('შეგიძლია რამდენიმე მონიშნო.', 'You can pick several.')}
              />
              <ChipGroup
                palette={p}
                items={smokingProductOptions()}
                selected={h.smokingProducts}
                onPress={(key) => {
                  const k = key as HabitAnswers['smokingProducts'][number];
                  onHabits({ smokingProducts: h.smokingProducts.includes(k) ? h.smokingProducts.filter((x) => x !== k) : [...h.smokingProducts, k] });
                }}
              />
            </>
          ) : null}
        </View>
      );

    case 'alcohol':
      return <ChoiceList palette={p} items={alcoholOptions()} selected={h.alcoholFreq ? [h.alcoholFreq] : []} onPress={(key) => onHabits({ alcoholFreq: key as HabitAnswers['alcoholFreq'] })} />;

    case 'diet':
      return (
        <ChipGroup
          palette={p}
          items={dietPatternOptions()}
          selected={h.dietPatterns}
          onPress={(key) => onHabits({ dietPatterns: toggleDietPattern(h.dietPatterns, key as HabitAnswers['dietPatterns'][number]) })}
        />
      );

    case 'eating':
      return (
        <View>
          <TileGrid palette={p} columns={4} unit={tx('პორცია', 'a day')} items={produceOptions()} selected={h.produce} onPress={(key) => onHabits({ produce: key as HabitAnswers['produce'] })} />
          <GroupLabel palette={p} text={tx('მონიშნე, რაც შენ გეხება', 'Tick what applies to you')} />
          <ChoiceList
            palette={p}
            multi
            items={eatingHabitOptions()}
            selected={h.eatingHabits}
            onPress={(key) => onHabits({ eatingHabits: toggleExclusive(h.eatingHabits, key as HabitAnswers['eatingHabits'][number], 'none') })}
          />
        </View>
      );

    default:
      return null;
  }
}
