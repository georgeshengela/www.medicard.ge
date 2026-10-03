import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarHeart, Check, ChevronLeft, Repeat, ShieldCheck, SlidersHorizontal } from 'lucide-react-native';
import { CycleCalendar } from './CycleCalendar';
import { CycleAtmosphere, CyclePrimaryButton, formatCycleDateKa } from './CycleUI';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { cycleDatePickable } from '@/lib/cycleExperience';
import type { CycleContraceptionMethod } from '@/lib/api';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { useCycleColors } from '@/theme/cycle';

/** Cycle-length tiles 21–35 (ACOG's typical adult range); period-length tiles 2–7. */
export const CYCLE_LENGTH_CHOICES = Array.from({ length: 15 }, (_, i) => 21 + i);
export const PERIOD_LENGTH_CHOICES = [2, 3, 4, 5, 6, 7];

export type CycleRhythmAnswer = {
  /** null = „არ ვიცი“ (the server keeps its 28-day default and learns from her logs). */
  avgCycleLength: number | null;
  /** null = not answered (the server keeps its 5-day default). */
  avgPeriodLength: number | null;
  /** „ჩემი ციკლები ცვალებადია“ → windows instead of dates everywhere. */
  isIrregular: boolean;
};

type Step = 'date' | 'rhythm' | 'contraception';

type Props = {
  visible: boolean;
  saving?: boolean;
  userName?: string | null;
  error?: string | null;
  /** The assessment's goal step already saved the last period: skip the date step (brief §9 item 19). */
  hasLastPeriod?: boolean;
  onSave: (iso: string) => Promise<boolean>;
  onSaveRhythm?: (answer: CycleRhythmAnswer) => Promise<boolean>;
  onBack?: () => void;
  onChooseMode?: () => void;
  onFinishContraception?: (input: { method: CycleContraceptionMethod | null; startedAt: string | null }) => void | Promise<void>;
};

/**
 * Cycle set-up: (date →) rhythm → contraception. Three screens when the cycle screen is the first
 * place the person tells us about her period; two when onboarding already saved the date. The rhythm
 * screen asks with tiles, never a wheel or a text field (brief §8.3): cycle length 21–35 · „არ ვიცი“,
 * „ჩემი ციკლები ცვალებადია“ (→ `isIrregular`), period length 2–7. The footer is the sign-in pattern
 * (`KeyboardFormShell`): the primary action stays pinned, the content scrolls.
 */
export function CycleOnboarding({ visible, saving, userName, error, hasLastPeriod, onSave, onSaveRhythm, onBack, onChooseMode, onFinishContraception }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const now = new Date();
  // Fixed at mount: saving the date flips `hasLastPeriod`, and the step list must not shift under her.
  const [steps] = useState<Step[]>(() => (hasLastPeriod ? ['rhythm', 'contraception'] : ['date', 'rhythm', 'contraception']));
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const [date, setDate] = useState('');
  const [cycleLength, setCycleLength] = useState<number | 'unknown' | null>(null);
  const [periodLength, setPeriodLength] = useState<number | null>(null);
  const [irregular, setIrregular] = useState(false);
  const [method, setMethod] = useState<CycleContraceptionMethod | null>(null);
  const [cursor, setCursor] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const [localError, setLocalError] = useState<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  if (!visible) return null;

  const next = () => {
    if (alive.current) setIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const advanceDate = async () => {
    if (busy.current || saving || !date) return;
    busy.current = true;
    setLocalError(null);
    try {
      if (await onSave(date)) next();
    } catch {
      if (alive.current) setLocalError(ka.common.error);
    } finally {
      busy.current = false;
    }
  };
  const advanceRhythm = async () => {
    if (busy.current || saving || cycleLength === null) return;
    busy.current = true;
    setLocalError(null);
    try {
      const answer: CycleRhythmAnswer = {
        avgCycleLength: typeof cycleLength === 'number' ? cycleLength : null,
        avgPeriodLength: periodLength,
        isIrregular: irregular,
      };
      if (!onSaveRhythm || (await onSaveRhythm(answer))) next();
    } catch {
      if (alive.current) setLocalError(ka.common.error);
    } finally {
      busy.current = false;
    }
  };
  const finish = async (skip = false) => {
    if (busy.current || saving) return;
    busy.current = true;
    setLocalError(null);
    try {
      await onFinishContraception?.({ method: skip ? null : method, startedAt: null });
    } catch {
      if (alive.current) setLocalError(ka.common.error);
    } finally {
      busy.current = false;
    }
  };
  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    const min = new Date(now.getFullYear(), now.getMonth() - 18, 1);
    const max = new Date(now.getFullYear(), now.getMonth(), 1);
    if (d >= min && d <= max) setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const name = (userName || '').trim().split(/\s+/)[0];
  const pad2 = (n: number) => String(n).padStart(2, '0');

  const title =
    step === 'date'
      ? tx('შენი რიტმი.\nშენი უკეთ გაგება.', 'Your rhythm.\nKnowing yourself better.')
      : step === 'rhythm'
        ? tx('როგორია შენი ციკლი ჩვეულებრივ?', 'What is your cycle usually like?')
        : ka.cycle.contraceptionAsk;
  const lead =
    step === 'date'
      ? tx(
          'მონიშნე ბოლო მენსტრუაციის პირველი დღე. ყოველდღიური ჩანაწერები დაგეხმარება შენი ციკლისა და შეგრძნებების უკეთ დანახვაში.',
          'Mark the first day of your last period. Daily entries help you see your cycle and how you feel more clearly.',
        )
      : step === 'rhythm'
        ? tx(
            'ზუსტი რიცხვი არ არის აუცილებელი — სავარაუდო თარიღებს შენი ჩანაწერებით დავაზუსტებთ.',
            'An exact number is not required — your entries will refine the estimated dates over time.',
          )
        : ka.cycle.contraceptionLead;
  const continueLabel = step === 'contraception' ? tx('ჩემი სივრცის გახსნა', 'Open my space') : tx('გაგრძელება', 'Continue');
  const continueDisabled = (step === 'date' && !date) || (step === 'rhythm' && cycleLength === null);
  const onContinue = () => void (step === 'date' ? advanceDate() : step === 'rhythm' ? advanceRhythm() : finish());

  const header = (
    <View style={{ paddingTop: insets.top + 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.back}
          disabled={saving}
          onPress={() => (index > 0 ? setIndex(index - 1) : onBack?.())}
          style={{ width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }}
        >
          <ChevronLeft size={22} color={c.ink} />
        </Pressable>
        <Text style={{ flex: 1, color: c.muted, fontSize: 12, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('შენი ციკლის სივრცე', 'Your cycle space')}</Text>
        <Text style={{ color: c.brand, fontSize: 12, fontFamily: 'NotoSansGeorgian_700Bold' }}>
          {pad2(index + 1)} / {pad2(steps.length)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 16, marginBottom: 6 }}>
        {steps.map((id, i) => (
          <View key={id} style={{ flex: 1, height: 3, borderRadius: 3, backgroundColor: i <= index ? c.brand : c.gaugeTrack }} />
        ))}
      </View>
    </View>
  );

  const footer = (
    <View style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: 12, marginHorizontal: -20, paddingHorizontal: 20, backgroundColor: c.card }}>
      {error || localError ? (
        <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>
          {error || localError}
        </Text>
      ) : null}
      <CyclePrimaryButton label={continueLabel} onPress={onContinue} loading={saving} disabled={continueDisabled} />
      {step === 'contraception' ? (
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void finish(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{ka.cycle.contraceptionSkip}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <CycleAtmosphere>
      <KeyboardFormShell header={header} footer={footer} background="transparent" contentStyle={{ padding: 20, paddingBottom: 8 }}>
        <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          {step === 'rhythm' ? <Repeat size={26} color={c.brand} /> : <CalendarHeart size={27} color={c.brand} />}
        </View>
        <Text style={{ color: c.muted, fontSize: 13, fontFamily: 'NotoSansGeorgian_500Medium' }}>
          {name ? name + tx(', ეს შენი სივრცეა', ', this is your space') : tx('ეს შენი სივრცეა', 'This is your space')}
        </Text>
        <Text accessibilityRole="header" style={{ color: c.ink, fontSize: step === 'date' ? 28 : 24, lineHeight: step === 'date' ? 38 : 32, fontFamily: 'NotoSansGeorgian_600SemiBold', marginTop: 6 }}>
          {title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular', marginTop: 10, marginBottom: 20 }}>{lead}</Text>

        {step === 'date' ? (
          <>
            <CycleCalendar
              year={cursor.y}
              month={cursor.m}
              marks={date ? { [date]: { period: true } } : {}}
              selected={date || null}
              onSelect={(iso) => {
                if (cycleDatePickable(iso)) setDate(iso);
              }}
              onPrev={() => move(-1)}
              onNext={() => move(1)}
              canSelect={cycleDatePickable}
            />
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: date ? c.period : c.border, marginTop: 16 }}>
              <Text style={{ color: c.muted, fontSize: 11, fontFamily: 'NotoSansGeorgian_500Medium' }}>{tx('ბოლო მენსტრუაციის პირველი დღე', 'First day of your last period')}</Text>
              <Text style={{ color: c.ink, fontSize: 15, lineHeight: 22, fontFamily: 'NotoSansGeorgian_700Bold', marginTop: 4 }}>
                {date ? formatCycleDateKa(date) : tx('აირჩიე კალენდარში', 'Pick it in the calendar')}
              </Text>
            </View>
            <Pressable
              onPress={onChooseMode}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={tx('სხვა რეჟიმის არჩევა', 'Choose another mode')}
              style={{ flexDirection: 'row', gap: 12, paddingVertical: 18, alignItems: 'center' }}
            >
              <SlidersHorizontal size={20} color={c.lavender} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('სხვა ეტაპზე ხარ?', 'At a different stage?')}</Text>
                <Text style={{ color: c.muted, fontSize: 12, lineHeight: 19, marginTop: 3 }}>
                  {tx('ორსულობა, მშობიარობის შემდგომი პერიოდი ან სხვა რეჟიმი', 'Pregnancy, after giving birth, or another mode')}
                </Text>
              </View>
            </Pressable>
          </>
        ) : step === 'rhythm' ? (
          <View style={{ gap: 22 }}>
            <View style={{ gap: 10 }}>
              <SectionLabel text={tx('ციკლის სიგრძე · დღე', 'Cycle length · days')} hint={tx('მენსტრუაციის პირველი დღიდან მომდევნოს პირველ დღემდე', 'From the first day of one period to the first day of the next')} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CYCLE_LENGTH_CHOICES.map((n) => (
                  <NumberTile key={n} value={n} selected={cycleLength === n} onPress={() => setCycleLength(n)} />
                ))}
              </View>
              <ChoiceRow
                label={tx('არ ვიცი', "I don't know")}
                body={tx('არაუშავს — აღრიცხვით თავად დავითვლით', 'That is fine — we will work it out from your entries')}
                selected={cycleLength === 'unknown'}
                radio
                onPress={() => setCycleLength('unknown')}
              />
              <ChoiceRow
                label={tx('ჩემი ციკლები ცვალებადია', 'My cycles vary')}
                body={tx('თარიღების ნაცვლად სავარაუდო დღეების დიაპაზონს გაჩვენებთ', 'You will see an estimated range of days instead of one date')}
                selected={irregular}
                onPress={() => setIrregular((v) => !v)}
              />
            </View>
            <View style={{ gap: 10 }}>
              <SectionLabel text={tx('მენსტრუაციის სიგრძე · დღე', 'Period length · days')} hint={tx('რამდენ დღეს გრძელდება ჩვეულებრივ', 'How many days it usually lasts')} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PERIOD_LENGTH_CHOICES.map((n) => (
                  <NumberTile key={n} value={n} selected={periodLength === n} grow onPress={() => setPeriodLength((v) => (v === n ? null : n))} />
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {(Object.keys(ka.cycle.contraceptionMethod) as CycleContraceptionMethod[]).map((id) => (
              <Pressable
                key={id}
                onPress={() => setMethod(id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: method === id }}
                style={{
                  minHeight: 52,
                  borderRadius: 16,
                  padding: 14,
                  backgroundColor: method === id ? c.accentSoft : c.card,
                  borderWidth: 1,
                  borderColor: method === id ? c.period : c.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Radio on={method === id} />
                <Text style={{ flex: 1, color: c.ink, fontSize: 13, lineHeight: 20, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{ka.cycle.contraceptionMethod[id]}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'flex-start' }}>
          <ShieldCheck size={16} color={c.todayRing} />
          <Text style={{ flex: 1, color: c.muted, fontSize: 11, lineHeight: 18 }}>{ka.cycle.onboardPrivacy}</Text>
        </View>
      </KeyboardFormShell>
    </CycleAtmosphere>
  );
}

function SectionLabel({ text, hint }: { text: string; hint: string }) {
  const c = useCycleColors();
  return (
    <View>
      <Text style={{ color: c.ink, fontSize: 14, lineHeight: 20, fontFamily: 'NotoSansGeorgian_700Bold' }}>{text}</Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }}>{hint}</Text>
    </View>
  );
}

/** One number as a flat tile; selected = rose outline on the soft tint (the quick log's grammar). */
function NumberTile({ value, selected, grow, onPress }: { value: number; selected: boolean; grow?: boolean; onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${value} ${ka.cycle.day}`}
      style={{
        width: grow ? undefined : 58,
        flex: grow ? 1 : undefined,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? c.accentSoft : c.card,
        borderWidth: 1,
        borderColor: selected ? c.period : c.border,
      }}
    >
      <Text style={{ color: selected ? c.period : c.ink, fontSize: 16, lineHeight: 22, fontFamily: 'NotoSansGeorgian_700Bold', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </Pressable>
  );
}

/** Full-width choice: a radio („არ ვიცი“, exclusive with the numbers) or a check („ცვალებადია“, a toggle). */
function ChoiceRow({ label, body, selected, radio, onPress }: { label: string; body: string; selected: boolean; radio?: boolean; onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={{ checked: selected }}
      style={{
        minHeight: 56,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: selected ? c.accentSoft : c.card,
        borderWidth: 1,
        borderColor: selected ? c.period : c.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {radio ? (
        <Radio on={selected} />
      ) : (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: selected ? c.period : c.border,
            backgroundColor: selected ? c.period : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? <Check size={14} color={c.onPeriod} strokeWidth={3} /> : null}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 1 }}>{body}</Text>
      </View>
    </Pressable>
  );
}

function Radio({ on }: { on: boolean }) {
  const c = useCycleColors();
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? c.period : c.border, alignItems: 'center', justifyContent: 'center' }}>
      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.period }} /> : null}
    </View>
  );
}
