import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { CycleCard, CyclePrimaryButton, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import { FLOW_OPTIONS } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleBundle, CyclePeriodRange } from '@/lib/api';
import { saveCycleObservation, queueApplyPeriod } from '@/lib/cycleOffline';
import { cycleHistoryPresentation } from '@/lib/cycleHistoryCopy';
import { addDaysToKey } from '@/lib/cyclePhase';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  bundle: CycleBundle;
  onChanged: () => void;
};

type BleedFlow = 'light' | 'medium' | 'heavy';

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

/**
 * „მენსტრუაციის ისტორია“ — logged bleeding runs, each unfolding into its days. A day opens one
 * sheet (`CycleExplainSheet`) with the bleeding intensity, the full log and a delete that confirms
 * inside the same sheet; adding a missed period confirms there too. No native alerts (brief §6
 * weakness 6).
 */
export function CyclePeriodHistory({ bundle, onChanged }: Props) {
  const { user } = useAuth();
  const c = useCycleColors();
  const router = useRouter();
  const [openStart, setOpenStart] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState('');
  const [days, setDays] = useState(5);
  const [fillFlow, setFillFlow] = useState<BleedFlow>('medium');
  const [fillConfirm, setFillConfirm] = useState(false);
  const [addDayFor, setAddDayFor] = useState<string | null>(null);
  const [extraDay, setExtraDay] = useState('');
  /** The day whose sheet is open, and whether its delete step is showing. */
  const [daySheet, setDaySheet] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const history = cycleHistoryPresentation(bundle.profile?.mode);
  if (!history.showPeriodHistory) return null;

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
  const loggedFlowOf = (date: string): BleedFlow | null => {
    const flow = logsByDate.get(date)?.flow;
    return flow === 'light' || flow === 'medium' || flow === 'heavy' ? flow : null;
  };
  const flowLabel = (flow: BleedFlow | null) =>
    flow ? FLOW_OPTIONS.find((o) => o.id === flow)?.label ?? flow : tx('არ არის აღრიცხული', 'Not logged');

  const persistMessage = (result: { synced: boolean; persistedLocally?: boolean; sessionOnly?: boolean }, synced: string | null) =>
    result.synced
      ? synced
      : result.persistedLocally
        ? ka.cycle.savedOnDevice
        : result.sessionOnly
          ? ka.cycle.savedSessionOnly
          : ka.cycle.saveNotPersisted;

  const commitMissed = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
    setBusy(true);
    setMsg(null);
    try {
      const length = Math.min(10, Math.max(1, days));
      const end = addDaysToKey(start, length - 1);
      if (!user?.id) return;
      const result = await queueApplyPeriod(user.id, { action: 'fill', start, end, flow: fillFlow });
      setFillConfirm(false);
      setAdding(false);
      setStart('');
      setMsg(persistMessage(result, ka.cycle.missedPeriodSaved));
      onChanged();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const setDayFlow = async (date: string, flow: BleedFlow) => {
    setBusy(true);
    setMsg(null);
    try {
      if (!user?.id) return;
      const result = await saveCycleObservation(user.id, date, { flow });
      setMsg(persistMessage(result, null));
      onChanged();
    } catch {
      setMsg(ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const removeDay = async (date: string) => {
    setBusy(true);
    setMsg(null);
    try {
      if (!user?.id) return;
      const result = await saveCycleObservation(user.id, date, { flow: 'none' });
      setMsg(persistMessage(result, ka.cycle.deleteLogDone));
      setConfirmRemove(false);
      setDaySheet(null);
      onChanged();
    } catch {
      setMsg(ka.common.error);
    } finally {
      setBusy(false);
    }
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
      setMsg(persistMessage(result, ka.cycle.missedPeriodSaved));
      onChanged();
    } catch {
      setMsg(ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  const openDay = (date: string) => {
    setConfirmRemove(false);
    setDaySheet(date);
  };
  const closeDay = () => {
    setConfirmRemove(false);
    setDaySheet(null);
  };
  const sheetFlow = daySheet ? loggedFlowOf(daySheet) : null;

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
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
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
                  <View style={{ marginTop: 10, gap: 6 }}>
                    {dayKeys.map((date) => {
                      const flow = loggedFlowOf(date);
                      return (
                        <Pressable
                          key={date}
                          onPress={() => openDay(date)}
                          accessibilityRole="button"
                          accessibilityLabel={`${formatCycleDateKa(date)}, ${flowLabel(flow)}`}
                          accessibilityHint={ka.common.edit}
                          style={{
                            minHeight: 48,
                            borderRadius: 14,
                            backgroundColor: c.cardSoft,
                            paddingHorizontal: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: flow ? c.period : 'transparent',
                              borderWidth: flow ? 0 : 1.5,
                              borderColor: c.period,
                              opacity: flow === 'light' ? 0.55 : 1,
                            }}
                          />
                          <Text style={{ color: c.ink, fontWeight: '700', flex: 1 }}>{formatCycleDateKa(date)}</Text>
                          <Text style={{ color: c.muted, fontSize: 12 }}>{flowLabel(flow)}</Text>
                          <ChevronRight size={16} color={c.mutedSoft} />
                        </Pressable>
                      );
                    })}

                    {addDayFor === range.start ? (
                      <View style={{ gap: 10, marginTop: 4 }}>
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
                        accessibilityRole="button"
                        style={{
                          minHeight: 44,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'row',
                          gap: 6,
                          marginTop: 2,
                        }}
                      >
                        <Plus size={16} color={c.brand} />
                        <Text style={{ color: c.brand, fontWeight: '700' }}>{ka.cycle.periodAddDay}</Text>
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
                  onPress={() => setFillFlow(opt.id as BleedFlow)}
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
                  }}
                >
                  <Text style={{ color: on ? c.onPrimary : c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12 }}>
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
                accessibilityRole="button"
                accessibilityState={{ selected: days === n }}
                accessibilityLabel={ka.cycle.periodRangeDays(n)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: days === n ? c.cta : c.cardSoft,
                }}
              >
                <Text style={{ color: days === n ? c.onPrimary : c.ink, fontWeight: '700' }}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <CyclePrimaryButton
            label={busy ? ka.common.loading : ka.cycle.missedPeriodSave}
            onPress={() => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(start)) setFillConfirm(true);
            }}
            loading={busy}
            disabled={busy || !start}
            icon={Plus}
          />
          <Pressable
            onPress={() => {
              setAdding(false);
              setStart('');
            }}
            accessibilityRole="button"
            style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center', marginTop: 4 }}
          >
            <Text style={{ color: c.muted, fontWeight: '700' }}>{ka.common.cancel}</Text>
          </Pressable>
        </CycleCard>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
            paddingVertical: 14,
            borderRadius: 18,
            backgroundColor: c.cardSoft,
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

      {/* Missed period: the fill confirmation (what gets recorded, as your log — not a prediction). */}
      <CycleExplainSheet
        visible={fillConfirm}
        title={ka.cycle.missedPeriodFillTitle}
        body={ka.cycle.missedPeriodFillConfirm}
        accent={c.period}
        actions={[{ label: ka.cycle.missedPeriodSave, onPress: () => void commitMissed(), loading: busy, icon: Plus }]}
        onClose={() => setFillConfirm(false)}
      />

      {/* One day of a logged period: intensity, full log, delete (confirmed in the same sheet). */}
      {daySheet && !confirmRemove ? (
        <CycleExplainSheet
          visible
          title={formatCycleDateKa(daySheet)}
          body={ka.cycle.periodDaySheetHint}
          accent={c.period}
          closeLabel={ka.common.close}
          actions={[
            {
              label: ka.cycle.fullLog,
              tone: 'secondary',
              icon: Pencil,
              onPress: () => {
                const date = daySheet;
                closeDay();
                router.push({ pathname: '/cycle/log', params: { date } });
              },
            },
            { label: ka.cycle.deleteLog, tone: 'destructive', icon: Trash2, onPress: () => setConfirmRemove(true), disabled: busy },
          ]}
          onClose={closeDay}
        >
          <Text style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, marginBottom: 8 }}>
            {ka.cycle.logStepFlow}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {BLEED_FLOWS.map((opt) => {
              const on = sheetFlow === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => void setDayFlow(daySheet, opt.id as BleedFlow)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: busy }}
                  accessibilityLabel={opt.label}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    backgroundColor: on ? c.cta : c.cardSoft,
                  }}
                >
                  {on ? <Check size={14} color={c.onPrimary} strokeWidth={3} /> : null}
                  <Text style={{ color: on ? c.onPrimary : c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12 }}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </CycleExplainSheet>
      ) : null}
      {daySheet && confirmRemove ? (
        <CycleExplainSheet
          visible
          title={ka.cycle.deleteLog}
          body={[formatCycleDateKa(daySheet), ka.cycle.periodDeleteDay]}
          accent={c.danger}
          closeLabel={ka.common.back}
          actions={[{ label: ka.common.delete, tone: 'destructive', icon: Trash2, onPress: () => void removeDay(daySheet), loading: busy }]}
          onClose={() => setConfirmRemove(false)}
        />
      ) : null}
    </View>
  );
}
