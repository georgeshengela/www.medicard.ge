import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Check, ChevronLeft, ChevronRight, Plus, User } from 'lucide-react-native';
import { QuestionContent, bloodLabel, questionCopy, questionReady } from '@/components/assessment/QuestionContent';
import { QuestionPage, QuietAction, StepHeader } from '@/components/onboarding/OnboardingKit';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetInput } from '@/components/velvet/VelvetInput';
import { allergyDisplayLabel } from '@/constants/allergyCatalog';
import { LIST_AFTER_GATE, PROFILE_QUESTIONS, type QuestionKey } from '@/constants/assessmentSteps';
import { resolveConditionLabel } from '@/constants/conditionCatalog';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { useMedications } from '@/hooks/useMedications';
import { api } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { formFromProfile, fullNameFromForm, questionPayload, type AssessmentFormState } from '@/lib/assessmentForm';
import { habitSummary, type HabitAnswers } from '@/lib/healthHabits';
import { leaveProfileComplete } from '@/lib/onboarding';
import { answeredQuestions } from '@/lib/profileCompletion';
import { useAuth } from '@/store/AuthContext';
import { velvetLift, velvetRaised, useVelvet, type VelvetPalette } from '@/theme/velvet';

type Mode =
  | { kind: 'walk'; queue: QuestionKey[]; pos: number }
  | { kind: 'edit'; key: QuestionKey }
  | { kind: 'summary' };

const LIST_QUESTIONS = new Set<QuestionKey>(Object.values(LIST_AFTER_GATE) as QuestionKey[]);
const GATE_OF: Partial<Record<QuestionKey, QuestionKey>> = { 'conditions-list': 'conditions-gate', 'medications-list': 'medications-gate' };

/**
 * „დაასრულე პროფილი“ (owner 2026-10-11 rework). Walks only the questions still unanswered — never the
 * ones already given at registration or earlier — then shows the whole profile on one page, where each
 * answer opens just its own question and comes straight back. Medicines in MEDIPILL count as answered.
 */
export function ProfileQuestionnaire() {
  const router = useRouter();
  const { palette: p } = useVelvet();
  const { user, healthProfile, setHealthProfile, setUser } = useAuth();
  const { medications: pills, loaded: pillsLoaded } = useMedications();
  const activePills = useMemo(() => pills.filter((m) => m.active !== false), [pills]);

  const [form, setForm] = useState<AssessmentFormState | null>(null);
  const saved = useRef<AssessmentFormState | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MEDIPILL is read first (≤ 2.5 s) so a person who keeps her medicines there is not asked again.
  const [pillWaitOver, setPillWaitOver] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPillWaitOver(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (mode || !user || (!pillsLoaded && !pillWaitOver)) return;
    const initial = formFromProfile(healthProfile, user);
    const answered = answeredQuestions(healthProfile, user, { pillCount: activePills.length });
    const queue = PROFILE_QUESTIONS.filter((q) => !LIST_QUESTIONS.has(q) && !answered[q]);
    saved.current = initial;
    setForm(initial);
    setMode(queue.length ? { kind: 'walk', queue, pos: 0 } : { kind: 'summary' });
  }, [mode, user, healthProfile, pillsLoaded, pillWaitOver, activePills.length]);

  const patch = useCallback((next: Partial<AssessmentFormState>) => {
    setForm((current) => (current ? { ...current, ...next } : current));
  }, []);
  const patchHabits = useCallback((next: Partial<HabitAnswers>) => {
    setForm((current) => (current ? { ...current, habits: { ...current.habits, ...next } } : current));
  }, []);

  const leave = () => leaveProfileComplete(router);

  if (!form || !mode || !user) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const persist = async (key: QuestionKey, current: AssessmentFormState) => {
    if (key === 'name') {
      const fullName = fullNameFromForm(current);
      if (fullName) {
        const result = await api.auth.updateProfile({ fullName });
        setUser(result.user);
      }
    }
    const result = await api.healthProfile.update(questionPayload(key, current));
    setHealthProfile(result.profile);
    if (result.user) setUser(result.user);
    saved.current = current;
  };

  /** Where to go after `key` was answered (gate „yes“ opens its list next). */
  const advance = (key: QuestionKey, current: AssessmentFormState) => {
    const list = LIST_AFTER_GATE[key];
    const opensList = list && ((key === 'conditions-gate' && current.hasConditions) || (key === 'medications-gate' && current.takesMedications));
    if (mode.kind === 'edit') {
      setMode(opensList ? { kind: 'edit', key: list } : { kind: 'summary' });
      return;
    }
    if (mode.kind !== 'walk') return;
    const queue = opensList ? [...mode.queue.slice(0, mode.pos + 1), list, ...mode.queue.slice(mode.pos + 1)] : mode.queue;
    const pos = mode.pos + 1;
    setMode(pos < queue.length ? { kind: 'walk', queue, pos } : { kind: 'summary' });
  };

  const answer = async (key: QuestionKey, next: Partial<AssessmentFormState> = {}) => {
    if (busy) return;
    Keyboard.dismiss();
    setError(null);
    const current: AssessmentFormState = {
      ...form,
      ...next,
      confirmedSteps: Array.from(new Set([...form.confirmedSteps, key, ...(GATE_OF[key] ? [GATE_OF[key]!] : [])])),
    };
    setForm(current);
    setBusy(true);
    try {
      await persist(key, current);
      advance(key, current);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (mode.kind === 'summary') {
    return (
      <ProfileSummary
        palette={p}
        form={form}
        pills={activePills.map((m) => m.medName)}
        onEdit={(key) => {
          setError(null);
          if (key === 'medications-gate' && activePills.length) {
            router.push('/(tabs)/medications' as never);
            return;
          }
          setMode({ kind: 'edit', key });
        }}
        onDone={leave}
      />
    );
  }

  const key = mode.kind === 'walk' ? mode.queue[mode.pos] : mode.key;
  const editing = mode.kind === 'edit';
  const copy = questionCopy(key, form);
  const ready = key === 'name' ? fullNameFromForm(form) !== null : questionReady(key, form);
  const gate = key === 'conditions-gate' || key === 'medications-gate';
  const lastInWalk = mode.kind === 'walk' && mode.pos === mode.queue.length - 1;

  const back = () => {
    if (busy) return;
    setError(null);
    if (mode.kind === 'edit') {
      // Leaving an edit drops what was not saved.
      if (saved.current) setForm(saved.current);
      setMode({ kind: 'summary' });
      return;
    }
    if (mode.pos === 0) leave();
    else setMode({ ...mode, pos: mode.pos - 1 });
  };

  const skip = () => {
    if (busy || mode.kind !== 'walk') return;
    setError(null);
    if (saved.current) setForm(saved.current);
    const pos = mode.pos + 1;
    setMode(pos < mode.queue.length ? { ...mode, pos } : { kind: 'summary' });
  };

  const quiet =
    key === 'blood-type' ? (
      <QuietAction palette={p} label={tx('არ ვიცი', 'I don’t know')} disabled={busy} onPress={() => void answer(key, { bloodType: 'UNKNOWN' })} />
    ) : key === 'allergies' ? (
      <QuietAction palette={p} label={ka.assessment.noAllergies} disabled={busy} onPress={() => void answer(key, { allergies: [] })} />
    ) : null;

  return (
    <QuestionPage
      palette={p}
      header={
        <StepHeader
          palette={p}
          step={mode.kind === 'walk' ? mode.pos : 0}
          total={mode.kind === 'walk' ? mode.queue.length : 0}
          onBack={back}
          onSkip={mode.kind === 'walk' ? skip : undefined}
        />
      }
      title={copy.title}
      body={copy.body}
      error={error}
      center={key === 'height' || key === 'weight'}
      primary={
        gate
          ? null
          : {
              label: editing ? tx('შენახვა', 'Save') : lastInWalk ? tx('დასრულება', 'Finish') : tx('გაგრძელება', 'Continue'),
              onPress: () => void answer(key),
              disabled: !ready,
              busy,
            }
      }
      footerBelow={quiet}
    >
      {key === 'name' ? (
        <NameFields palette={p} form={form} onChange={patch} onDone={() => (ready ? void answer(key) : undefined)} />
      ) : (
        <QuestionContent palette={p} question={key} form={form} onChange={patch} onHabits={patchHabits} onAnswer={(next) => void answer(key, next)} />
      )}
    </QuestionPage>
  );
}

function NameFields({ palette: p, form, onChange, onDone }: { palette: VelvetPalette; form: AssessmentFormState; onChange: (next: Partial<AssessmentFormState>) => void; onDone: () => void }) {
  const lastRef = useRef<TextInput>(null);
  return (
    <View style={{ gap: 18 }}>
      <VelvetInput
        palette={p}
        label={tx('სახელი', 'First name')}
        placeholder={tx('მაგ. ნინო', 'e.g. Nino')}
        icon={User}
        value={form.firstName}
        onChangeText={(firstName) => onChange({ firstName })}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => lastRef.current?.focus()}
        maxLength={60}
      />
      <VelvetInput
        ref={lastRef}
        palette={p}
        label={tx('გვარი', 'Last name')}
        placeholder={tx('მაგ. ბერიძე', 'e.g. Beridze')}
        icon={User}
        value={form.lastName}
        onChangeText={(lastName) => onChange({ lastName })}
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
        returnKeyType="done"
        onSubmitEditing={onDone}
        maxLength={60}
      />
    </View>
  );
}

type Row = { key: QuestionKey; label: string; value: string; sub?: string };

function cleanList(list: string[]): string[] {
  return list.filter((item) => item && item !== 'none');
}

/** The whole profile on one page; every row edits only itself. */
function ProfileSummary({
  palette: p,
  form,
  pills,
  onEdit,
  onDone,
}: {
  palette: VelvetPalette;
  form: AssessmentFormState;
  pills: string[];
  onEdit: (key: QuestionKey) => void;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const confirmed = new Set(form.confirmedSteps);
  const h = habitSummary(form.habits);
  const allergies = cleanList(form.allergies);
  const conditions = cleanList(form.chronicConditions);
  const meds = Array.from(new Set([...pills, ...form.medications]));

  const basics: Row[] = [
    { key: 'name', label: tx('სახელი და გვარი', 'Name'), value: fullNameFromForm(form) ?? '' },
    { key: 'blood-type', label: tx('სისხლის ჯგუფი', 'Blood type'), value: form.bloodType ? (form.bloodType === 'UNKNOWN' ? tx('არ ვიცი', 'I don’t know') : bloodLabel(form.bloodType)) : '' },
    {
      key: 'allergies',
      label: tx('ალერგიები', 'Allergies'),
      value: allergies.length ? allergies.map((a) => allergyDisplayLabel(a)).join(', ') : confirmed.has('allergies') ? tx('არ მაქვს', 'None') : '',
    },
    {
      key: 'conditions-gate',
      label: tx('ქრონიკული დაავადებები', 'Chronic conditions'),
      value: conditions.length ? conditions.map((c) => resolveConditionLabel(c)).join(', ') : form.hasConditions === false ? tx('არ მაქვს', 'None') : '',
    },
    {
      key: 'medications-gate',
      label: tx('მედიკამენტები', 'Medications'),
      value: meds.length ? meds.join(', ') : form.takesMedications === false ? tx('არ ვიღებ', 'None') : '',
      sub: pills.length ? tx('MEDIPILL-დან', 'From MEDIPILL') : undefined,
    },
  ];
  const life: Row[] = [
    { key: 'activity', label: tx('მოძრაობა კვირაში', 'Active days a week'), value: h.activity },
    { key: 'sleep', label: tx('ძილი', 'Sleep'), value: h.sleep },
    { key: 'smoking', label: tx('მოწევა', 'Smoking'), value: h.smoking },
    { key: 'alcohol', label: tx('ალკოჰოლი', 'Alcohol'), value: h.alcohol },
    { key: 'diet', label: tx('კვება', 'Eating pattern'), value: h.diet },
    { key: 'eating', label: tx('კვების ჩვევები', 'Eating habits'), value: h.eating },
  ];
  const all = [...basics, ...life];
  const done = all.filter((r) => r.value).length;

  return (
    <View style={{ flex: 1, backgroundColor: p.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('უკან', 'Back')}
          onPress={onDone}
          hitSlop={10}
          style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, boxShadow: velvetLift(p) }}
        >
          <ChevronLeft size={22} color={p.ink} strokeWidth={2.2} />
        </Pressable>

        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <CompletionDisc palette={p} done={done} total={all.length} />
        </View>
        <Text accessibilityRole="header" style={{ marginTop: 22, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 35, color: p.text, textAlign: 'center' }}>
          {tx('შენი ჯანმრთელობის პროფილი', 'Your health profile')}
        </Text>
        <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 23, color: p.ink2, textAlign: 'center', paddingHorizontal: 8 }}>
          {done === all.length
            ? tx('ყველაფერი შევსებულია. Medi ამას ითვალისწინებს — შეეხე პასუხს, რომ შეცვალო.', 'All filled in. Medi takes it into account — tap an answer to change it.')
            : tx('შეეხე, რომ დაამატო ან შეცვალო. Medi ამას ითვალისწინებს.', 'Tap a line to add or change it. Medi takes it into account.')}
        </Text>

        <SummaryGroup palette={p} title={tx('ძირითადი', 'Basics')} rows={basics} onEdit={onEdit} />
        <SummaryGroup palette={p} title={tx('ცხოვრების წესი', 'Way of life')} rows={life} onEdit={onEdit} />
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) }}>
        <VelvetButton palette={p} label={tx('მზადაა', 'Done')} onPress={onDone} />
      </View>
    </View>
  );
}

function SummaryGroup({ palette: p, title, rows, onEdit }: { palette: VelvetPalette; title: string; rows: Row[]; onEdit: (key: QuestionKey) => void }) {
  return (
    <View style={{ marginTop: 30 }}>
      <Text style={{ marginBottom: 12, marginLeft: 4, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: p.text }}>{title}</Text>
      <View style={{ borderRadius: 24, backgroundColor: p.surface, boxShadow: velvetLift(p), paddingHorizontal: 16 }}>
        {rows.map((row, i) => (
          <Pressable
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}: ${row.value || tx('დამატება', 'Add')}`}
            onPress={() => onEdit(row.key)}
            style={{
              minHeight: 64,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 12,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: `${p.shade}80`,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: p.inkOff }}>
                {row.label}
                {row.sub && row.value ? ` · ${row.sub}` : ''}
              </Text>
              {row.value ? (
                <Text style={{ marginTop: 2, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 22, color: p.text }}>{row.value}</Text>
              ) : (
                <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Plus size={15} color={p.pulse} strokeWidth={2.6} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 22, color: p.ink }}>{tx('დამატება', 'Add')}</Text>
                </View>
              )}
            </View>
            <ChevronRight size={18} color={p.inkOff} strokeWidth={2.2} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const DISC = 112;
const RING = 92;
const STROKE = 6;

/** The page's one bold element: a raised disc with how much of the profile is filled. */
function CompletionDisc({ palette: p, done, total }: { palette: VelvetPalette; done: number; total: number }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const fraction = total ? done / total : 0;
  const complete = done === total;
  return (
    <View
      accessibilityLabel={tx(`შევსებულია ${done} / ${total}`, `${done} of ${total} filled in`)}
      style={{ width: DISC, height: DISC, borderRadius: DISC / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, boxShadow: velvetRaised(p) }}
    >
      <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={p.shade} strokeOpacity={0.55} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={r}
          stroke={p.pulse}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - fraction)}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      {complete ? (
        <Check size={36} color={p.pulse} strokeWidth={2.6} />
      ) : (
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 28, color: p.ink }}>
          {done}
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: p.inkOff }}>/{total}</Text>
        </Text>
      )}
    </View>
  );
}
