import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { CycleCard, CyclePrimaryButton, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { FLOW_OPTIONS } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import type { CycleBundle, CyclePeriodRange } from '@/lib/api';
import { saveCycleObservation, queueApplyPeriod } from '@/lib/cycleOffline';
import { addDaysToKey } from '@/lib/cyclePhase';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
  onChanged: () => void;
};

const BLEED_FLOWS = FLOW_OPTIONS.filter((o) => o.id === 'light' || o.id === 'medium' || o.id === 'heavy');

function daysInRange(range: CyclePeriodRange) {
  const out: string[] = [];
  let key = range.start;
  for (let i = 0; i < 20 && key <= range.end; i += 1) {
    out.push(key);
    key = addDaysToKey(key, 1);
  }
  return out;
}

export function CyclePeriodHistory({ bundle, onChanged }: Props) {
  const { user } = useAuth();
  const c = useCycleColors();
  const router = useRouter();
  const ranges = [
    ...(bundle.periodRanges?.length
      ? bundle.periodRanges
      : (bundle.inferred?.periodStarts ?? []).map((start) => ({
          start,
          end: start,
          lengthDays: 1,
          source: 'logged' as const,
        }))),
  ].reverse();
  const logsByDate = new Map((bundle.logs ?? []).map((log) => [log.date, log]));
  const [openStart, setOpenStart] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState('');
  const [days, setDays] = useState(5);
  const [fillFlow, setFillFlow] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [addDayFor, setAddDayFor] = useState<string | null>(null);
  const [extraDay, setExtraDay] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const addMissed = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    Alert.alert(ka.cycle.missedPeriodFillTitle, ka.cycle.missedPeriodFillConfirm, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.cycle.missedPeriodSave,
        onPress: () => {
          void commitMissed();
        },
      },
    ]);
  };

  const commitMissed = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    setBusy(true);
    setMsg(null);
    try {
      const length = Math.min(10, Math.max(1, days));
      const end = addDaysToKey(start, length - 1);
      if (!user?.id) return;
      const result = await queueApplyPeriod(user.id, { action: 'fill', start, end, flow: fillFlow });
      setAdding(false);
      setStart('');
      setMsg(
        result.synced
          ? ka.cycle.missedPeriodSaved
          : result.persistedLocally
            ? ka.cycle.savedOnDevice
            : result.sessionOnly
              ? ka.cycle.savedSessionOnly
              : ka.cycle.saveNotPersisted,
      );
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const setDayFlow = async (date: string, flow: 'light' | 'medium' | 'heavy') => {
    setBusy(true);
    setMsg(null);
    try {
      if (!user?.id) return;
      const result = await saveCycleObservation(user.id, date, { flow });
      setMsg(
        result.synced
          ? null
          : result.persistedLocally
            ? ka.cycle.savedOnDevice
            : result.sessionOnly
              ? ka.cycle.savedSessionOnly
              : ka.cycle.saveNotPersisted,
      );
      onChanged();
    } catch {
      setMsg(ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const removeDay = (date: string) => {
    Alert.alert(ka.cycle.deleteLog, ka.cycle.periodDeleteDay, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.common.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              if (!user?.id) return;
              const result = await saveCycleObservation(user.id, date, { flow: 'none' });
              setMsg(
                result.synced
                  ? ka.cycle.deleteLogDone
                  : result.persistedLocally
                    ? ka.cycle.savedOnDevice
                    : result.sessionOnly
                      ? ka.cycle.savedSessionOnly
                      : ka.cycle.saveNotPersisted,
              );
              onChanged();
            } catch {
              setMsg(ka.common.error);
            }
          })();
        },
      },
    ]);
  };

  const addExtraDay = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(extraDay)) return;
    setBusy(true);
    setMsg(null);
    try {
      if (!user?.id) return;
      const result = await queueApplyPeriod(user.id, { action: 'start', date: extraDay, flow: 'medium' });
      setAddDayFor(null);
      setExtraDay('');
      setMsg(
        result.synced
          ? ka.cycle.missedPeriodSaved
          : result.persistedLocally
            ? ka.cycle.savedOnDevice
            : result.sessionOnly
              ? ka.cycle.savedSessionOnly
              : ka.cycle.saveNotPersisted,
      );
      onChanged();
    } catch {
      setMsg(ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <CycleCard>
        {ranges.length === 0 ? (
          <View>
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.periodHistoryEmpty}</Text>
            <Text style={{ color: c.muted, marginTop: 6, lineHeight: 18 }}>{ka.cycle.periodHistoryEmptyHint}</Text>
          </View>
        ) : (
          ranges.map((range, i) => {
            const open = openStart === range.start;
            const dayKeys = daysInRange(range);
            return (
              <View
                key={`${range.start}-${range.end}`}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: i === ranges.length - 1 ? 0 : 1,
                  borderBottomColor: c.border,
                }}
              >
                <Pressable
                  onPress={() => setOpenStart(open ? null : range.start)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>
                      {formatCycleDateKa(range.start)}
                      {range.end !== range.start ? ` – ${formatCycleDateKa(range.end)}` : ''}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>
                      {ka.cycle.periodLoggedDays(range.lengthDays)}
                    </Text>
                  </View>
                  <ChevronDown size={18} color={c.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
                </Pressable>

                {open ? (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {dayKeys.map((date) => {
                      const log = logsByDate.get(date);
                      const flow = log?.flow && log.flow !== 'none' && log.flow !== 'spotting' ? log.flow : 'medium';
                      return (
                        <View
                          key={date}
                          style={{
                            borderRadius: 14,
                            backgroundColor: c.cardSoft,
                            padding: 10,
                            gap: 8,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: c.ink, fontWeight: '700', flex: 1 }}>
                              {formatCycleDateKa(date)}
                            </Text>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={ka.common.edit}
                              onPress={() => router.push({ pathname: '/cycle/log', params: { date } })}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: c.card,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Pencil size={16} color={c.brand} strokeWidth={2.2} />
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={ka.cycle.deleteLog}
                              onPress={() => removeDay(date)}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: `${c.danger}14`,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={16} color={c.danger} strokeWidth={2.2} />
                            </Pressable>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {BLEED_FLOWS.map((opt) => {
                              const on = flow === opt.id;
                              return (
                                <Pressable
                                  key={opt.id}
                                  onPress={() => void setDayFlow(date, opt.id as 'light' | 'medium' | 'heavy')}
                                  style={{
                                    flex: 1,
                                    height: 36,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: on ? c.cta : c.card,
                                  }}
                                >
                                  <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '700', fontSize: 12 }}>
                                    {opt.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}

                    {addDayFor === range.start ? (
                      <View style={{ gap: 10 }}>
                        <CycleDateField label={ka.cycle.periodAddDay} value={extraDay} onChange={setExtraDay} range="past" />
                        <CyclePrimaryButton
                          label={busy ? ka.common.loading : ka.cycle.missedPeriodSave}
                          onPress={() => void addExtraDay()}
                          loading={busy}
                          disabled={busy || !extraDay}
                          icon={Plus}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => {
                          setAddDayFor(range.start);
                          setExtraDay(addDaysToKey(range.end, 1));
                        }}
                        style={{
                          minHeight: 44,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: c.cardSoft,
                        }}
                      >
                        <Text style={{ color: c.ink, fontWeight: '700' }}>{ka.cycle.periodAddDay}</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </CycleCard>

      {adding ? (
        <CycleCard>
          <CycleDateField label={ka.cycle.lastPeriod} value={start} onChange={setStart} range="past" />
          <Text style={{ color: c.muted, marginTop: 12, marginBottom: 8 }}>{ka.cycle.missedPeriodFlowLabel}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {BLEED_FLOWS.map((opt) => {
              const on = fillFlow === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setFillFlow(opt.id as 'light' | 'medium' | 'heavy')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={opt.label}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? c.cta : c.cardSoft,
                    borderWidth: 1,
                    borderColor: on ? c.ink : c.border,
                  }}
                >
                  <Text style={{ color: on ? c.white : c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: c.muted, marginTop: 4, marginBottom: 8 }}>{ka.cycle.missedPeriodLength}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[3, 4, 5, 6, 7].map((n) => (
              <Pressable
                key={n}
                onPress={() => setDays(n)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: days === n ? c.cta : c.cardSoft,
                }}
              >
                <Text style={{ color: days === n ? '#fff' : c.ink, fontWeight: '700' }}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <CyclePrimaryButton
            label={busy ? ka.common.loading : ka.cycle.missedPeriodSave}
            onPress={() => void addMissed()}
            loading={busy}
            disabled={busy || !start}
            icon={Plus}
          />
          <Pressable
            onPress={() => {
              setAdding(false);
              setStart('');
            }}
            style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 4 }}
          >
            <Text style={{ color: c.muted, fontWeight: '700' }}>{ka.common.cancel}</Text>
          </Pressable>
        </CycleCard>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
            paddingVertical: 14,
            borderRadius: 18,
            backgroundColor: c.cardSoft,
            borderWidth: 1,
            borderColor: c.border,
            gap: 8,
          }}
        >
          <Plus size={18} color={c.brand} />
          <Text style={{ color: c.ink, fontWeight: '700' }}>{ka.cycle.addMissedPeriod}</Text>
        </Pressable>
      )}

      {msg ? (
        <Text
          style={{
            color: msg === ka.common.error ? c.danger : c.success,
            fontWeight: '600',
            textAlign: 'center',
            paddingVertical: 4,
          }}
        >
          {msg}
        </Text>
      ) : null}
      {busy ? <ActivityIndicator color={c.brand} /> : null}
    </View>
  );
}
