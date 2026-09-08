import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CalendarHeart, ChevronRight } from 'lucide-react-native';
import { CycleCalendar } from '@/components/cycle/CycleCalendar';
import { CycleAtmosphere, formatCycleDateKa } from '@/components/cycle/CycleUI';
import type { CycleContraceptionMethod, CycleDayMark } from '@/lib/api';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';
import { useThemeColors } from '@/theme/colors';

const METHODS = Object.keys(ka.cycle.contraceptionMethod) as CycleContraceptionMethod[];
const OTHER_METHODS = METHODS.filter((id) => id !== 'NONE');

type Props = {
  visible: boolean;
  saving?: boolean;
  userName?: string | null;
  error?: string | null;
  onSave: (iso: string) => void | Promise<void>;
  onFinishContraception?: (input: {
    method: CycleContraceptionMethod | null;
    startedAt: string | null;
  }) => void | Promise<void>;
};

function firstName(full?: string | null) {
  const part = (full || '').trim().split(/\s+/)[0];
  return part || '';
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function canPickPeriodStart(iso: string, now = new Date()) {
  const [y, m, day] = iso.split('-').map(Number);
  if (!y || !m || !day) return false;
  const t = startOfDay(new Date(y, m - 1, day));
  if (t > startOfDay(now)) return false;
  const min = new Date(now.getFullYear(), now.getMonth() - 18, 1);
  return t >= startOfDay(min);
}

function shiftMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

function monthTooOld(year: number, month: number, now = new Date()) {
  const min = new Date(now.getFullYear(), now.getMonth() - 18, 1);
  return new Date(year, month, 1) < min;
}

function monthTooNew(year: number, month: number, now = new Date()) {
  return new Date(year, month, 1) > new Date(now.getFullYear(), now.getMonth(), 1);
}

/** First-visit gate: pick last period on the same calendar used in the hub. */
export function CycleOnboarding({ visible, saving, userName, error, onSave, onFinishContraception }: Props) {
  const c = useCycleColors();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);
  const [date, setDate] = useState('');
  const [step, setStep] = useState<'date' | 'contraception'>('date');
  const [method, setMethod] = useState<CycleContraceptionMethod | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const name = firstName(userName);
  const greeting = name ? `${ka.cycle.onboardHi}, ${name}` : ka.cycle.onboardHi;
  const title = step === 'date' ? ka.cycle.modePeriod : ka.cycle.contraceptionAsk;
  const lead = step === 'date' ? ka.cycle.onboardLead : ka.cycle.contraceptionLead;

  const marks = useMemo<Record<string, CycleDayMark>>(
    () => (date ? { [date]: { period: true } } : {}),
    [date],
  );

  if (!visible) return null;

  const goPrev = () => {
    const next = shiftMonth(year, month, -1);
    if (monthTooOld(next.year, next.month, now)) return;
    setYear(next.year);
    setMonth(next.month);
  };

  const goNext = () => {
    const next = shiftMonth(year, month, 1);
    if (monthTooNew(next.year, next.month, now)) return;
    setYear(next.year);
    setMonth(next.month);
  };

  const pickDay = (iso: string) => {
    if (!canPickPeriodStart(iso, now)) return;
    Haptics.selectionAsync().catch(() => undefined);
    setDate(iso);
  };

  const header = (
    <Animated.View entering={FadeIn.duration(280)} style={{ alignItems: 'center', paddingTop: 8 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: theme.accent100,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <CalendarHeart size={32} color={c.brand} strokeWidth={2.1} />
      </View>
      <Text
        style={{
          color: c.muted,
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_500Medium',
        }}
      >
        {greeting}
      </Text>
      <Text
        style={{
          color: c.ink,
          fontSize: 26,
          lineHeight: 32,
          marginTop: 6,
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_700Bold',
          letterSpacing: -0.5,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: c.muted,
          fontSize: 14,
          lineHeight: 20,
          marginTop: 10,
          paddingHorizontal: 18,
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_500Medium',
        }}
      >
        {lead}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
        {(['date', 'contraception'] as const).map((s) => (
          <View
            key={s}
            style={{
              width: step === s ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: step === s ? c.cta : c.border,
            }}
          />
        ))}
      </View>
    </Animated.View>
  );

  const footerNote = (
    <Text
      style={{
        color: c.mutedSoft,
        fontSize: 11,
        lineHeight: 16,
        textAlign: 'center',
        paddingTop: 12,
        fontFamily: 'NotoSansGeorgian_500Medium',
      }}
    >
      {ka.cycle.onboardPrivacy}
    </Text>
  );

  return (
    <CycleAtmosphere>
      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 14,
          paddingHorizontal: 16,
        }}
      >
        {header}

        {step === 'date' ? (
          <>
            <Animated.View
              entering={FadeInDown.duration(320)}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <CycleCalendar
                year={year}
                month={month}
                marks={marks}
                selected={date || null}
                onSelect={pickDay}
                onPrev={goPrev}
                onNext={goNext}
                canSelect={(iso) => canPickPeriodStart(iso, now)}
              />

              <View
                style={{
                  alignSelf: 'center',
                  marginTop: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: date ? c.roseSoft : c.card,
                  borderWidth: 1,
                  borderColor: date ? c.period : c.border,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: date ? c.period : c.mutedSoft,
                  }}
                />
                <Text
                  style={{
                    color: date ? c.ink : c.muted,
                    fontSize: 14,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                  }}
                >
                  {date ? formatCycleDateKa(date) : ka.cycle.pickDate}
                </Text>
              </View>
            </Animated.View>

            {error ? (
              <Text
                style={{
                  color: c.danger,
                  marginBottom: 10,
                  textAlign: 'center',
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                {error}
              </Text>
            ) : null}

            <Pressable
              disabled={!date || saving}
              onPress={() => {
                if (!date) return;
                void Promise.resolve(onSave(date)).then(() => setStep('contraception'));
              }}
              style={{
                minHeight: 52,
                borderRadius: 28,
                backgroundColor: c.cta,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                opacity: !date || saving ? 0.45 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text
                    style={{
                      color: '#fff',
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 16,
                    }}
                  >
                    {ka.cycle.onboardCta}
                  </Text>
                  {date ? <ChevronRight size={18} color="#fff" strokeWidth={2.6} /> : null}
                </>
              )}
            </Pressable>
            {footerNote}
          </>
        ) : (
          <ScrollView
            style={{ flex: 1, marginTop: 18 }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(280)}>
              <Pressable
                onPress={() => setMethod('NONE')}
                style={{
                  minHeight: 48,
                  borderRadius: 28,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                  backgroundColor: method === 'NONE' ? c.cta : c.card,
                  borderWidth: 1,
                  borderColor: method === 'NONE' ? c.cta : c.border,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: method === 'NONE' ? '#fff' : c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 14,
                  }}
                >
                  {ka.cycle.contraceptionMethod.NONE}
                </Text>
              </Pressable>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
                {OTHER_METHODS.map((id) => {
                  const on = method === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => setMethod(id)}
                      style={{
                        width: '48.5%',
                        minHeight: 48,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 16,
                        backgroundColor: on ? c.cta : c.card,
                        borderWidth: 1,
                        borderColor: on ? c.cta : c.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        numberOfLines={2}
                        style={{
                          color: on ? '#fff' : c.ink,
                          fontFamily: 'NotoSansGeorgian_600SemiBold',
                          fontSize: 12,
                          lineHeight: 16,
                          textAlign: 'center',
                        }}
                      >
                        {ka.cycle.contraceptionMethod[id]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {error ? (
                <Text
                  style={{
                    color: c.danger,
                    marginTop: 12,
                    textAlign: 'center',
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {error}
                </Text>
              ) : null}

              <Pressable
                disabled={saving}
                onPress={() => void onFinishContraception?.({ method, startedAt: null })}
                style={{
                  marginTop: 16,
                  minHeight: 52,
                  borderRadius: 28,
                  backgroundColor: c.cta,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
                    {ka.cycle.onboardCta}
                  </Text>
                )}
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={() => void onFinishContraception?.({ method: null, startedAt: null })}
                style={{ marginTop: 8, paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
                  {ka.cycle.contraceptionSkip}
                </Text>
              </Pressable>
            </Animated.View>
            <View style={{ marginTop: 'auto' }}>{footerNote}</View>
          </ScrollView>
        )}
      </View>
    </CycleAtmosphere>
  );
}
