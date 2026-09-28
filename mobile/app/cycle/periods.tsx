import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { CycleAtmosphere, CycleLoading, CyclePrimaryButton, cycleNavHeader } from '@/components/cycle/CycleUI';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { MONTHS_KA, WEEKDAYS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { cycleToday } from '@/lib/cycleCanonical';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { cacheCycleBundle, loadCycleView } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

const MONTHS_BACK = 6;

function key(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Month grid (Monday first) for one month; null = leading/trailing blank. */
function monthCells(y: number, m: number) {
  const pad = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const out: (string | null)[] = Array.from({ length: pad }, () => null);
  for (let d = 1; d <= days; d += 1) out.push(key(y, m, d));
  while (out.length % 7) out.push(null);
  return out;
}

/**
 * Flo's "Edit period dates": the last months as calendars with a round checkbox per day. Tick or untick
 * past days, then save once. Future days are locked (the server refuses them too). Needs a connection.
 */
export default function CyclePeriodDatesScreen() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [logged, setLogged] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.periodDatesTitle));
  }, [navigation, c]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadCycleView(user.id)
      .then((view) => {
        const b = view.display;
        setBundle(b);
        const bleed = new Set(b.logs.filter((l) => isBleedFlow(l.flow)).map((l) => l.date));
        setLogged(bleed);
        setPicked(new Set(bleed));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const today = cycleToday(bundle, todayKey());
  const months = useMemo(() => {
    const [ty, tm] = today.split('-').map(Number);
    return Array.from({ length: MONTHS_BACK + 1 }, (_, i) => {
      const d = new Date(ty, tm - 1 - (MONTHS_BACK - i), 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }, [today]);

  const add = [...picked].filter((d) => !logged.has(d));
  const remove = [...logged].filter((d) => !picked.has(d));
  const changes = add.length + remove.length;

  const toggle = (date: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const save = async () => {
    if (!user?.id || !changes || saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await api.cycle.editPeriodDays({ add, remove });
      await cacheCycleBundle(user.id, next).catch(() => undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : ka.cycle.periodDatesNeedsInternet);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CycleLoading />;

  const predicted = bundle?.predictions?.calendar ?? {};

  return (
    <CycleAtmosphere>
      <ScrollView
        ref={scrollRef}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>{ka.cycle.periodDatesHint}</Text>
        {months.map(({ y, m }) => (
          <View key={`${y}-${m}`} style={{ backgroundColor: c.card, borderRadius: 22, padding: 14, marginBottom: 14 }}>
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, marginBottom: 10, marginLeft: 4 }}>
              {MONTHS_KA[m]} {y}
            </Text>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS_KA.map((w) => (
                <Text key={w} style={{ width: '14.2857%', textAlign: 'center', color: c.mutedSoft, fontSize: 11, marginBottom: 6 }}>
                  {w}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthCells(y, m).map((date, i) => {
                if (!date) return <View key={`b${i}`} style={{ width: '14.2857%', height: 52 }} />;
                const future = date > today;
                const on = picked.has(date);
                const expected = !on && Boolean(predicted[date]?.period && predicted[date]?.predicted);
                const isToday = date === today;
                const day = Number(date.slice(8));
                return (
                  <Pressable
                    key={date}
                    disabled={future}
                    onPress={() => toggle(date)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: future }}
                    accessibilityLabel={`${day} ${MONTHS_KA[m]}${on ? `, ${ka.cycle.legendPeriod}` : ''}${expected ? `, ${ka.cycle.legendPeriodPredicted}` : ''}`}
                    style={{ width: '14.2857%', height: 52, alignItems: 'center', justifyContent: 'center', opacity: future ? 0.3 : 1 }}
                  >
                    <Text style={{ color: isToday ? c.ink : c.muted, fontSize: 11, lineHeight: 14, fontFamily: isToday ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium' }}>
                      {day}
                    </Text>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        marginTop: 3,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: on ? c.period : 'transparent',
                        borderWidth: on ? 0 : 1.5,
                        borderColor: expected ? c.period : cycleHexAlpha(c.ink, 0.22),
                        borderStyle: expected ? 'dashed' : 'solid',
                      }}
                    >
                      {on ? <Check size={15} color={c.onPeriod} strokeWidth={3} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) + 4, backgroundColor: c.cream, gap: 8 }}>
        {error ? <Text style={{ color: c.danger, fontSize: 13, lineHeight: 18, textAlign: 'center' }}>{error}</Text> : null}
        <CyclePrimaryButton
          label={changes ? ka.cycle.periodDatesSave(changes) : ka.cycle.periodDatesNoChanges}
          onPress={() => void save()}
          loading={saving}
          disabled={!changes || saving}
          icon={Check}
        />
      </View>
    </CycleAtmosphere>
  );
}
