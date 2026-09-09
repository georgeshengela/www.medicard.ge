import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { cycleLogFactBits, cycleLogHasFacts } from '@/lib/cycleLogFacts';
import { classifyCycleDay } from '@/lib/cyclePresentation.js';
import { cycleToday, phaseFromBundle } from '@/lib/cycleCanonical';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { showFertilityUi } from '@/lib/cycleContraception';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { ka } from '@/i18n/ka';
import type { CycleBundle, CycleDayMark } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  date: string;
  bundle: CycleBundle;
  mark?: CycleDayMark;
  onClose: () => void;
  /** Edit/log this day — reuses the Quick Log sheet, prefilled (§8, §65). */
  onLog: (date: string) => void;
  /** Open the full detailed log for this day. */
  onFullLog: (date: string) => void;
  showPredicted?: boolean;
};

/**
 * Day Details sheet over the Calendar pane (docs/CYCLE_DESIGN.md §8).
 * Splits ● აღრიცხული (logged facts) from ◌ სავარაუდო (estimates) using
 * the same glyph system as the calendar. Viewing/selecting never creates data.
 */
export function CycleDayDetailsSheet({
  visible,
  date,
  bundle,
  mark,
  onClose,
  onLog,
  onFullLog,
  showPredicted = true,
}: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const today = cycleToday(bundle, todayKey());
  const showFertility = showFertilityUi(bundle);

  const log = useMemo(
    () => bundle.logs.find((l) => l.date === date) ?? null,
    [bundle.logs, date],
  );
  const phase = useMemo(() => phaseFromBundle(bundle, date), [bundle, date]);
  const layers = classifyCycleDay(mark, { showFertility, showPredicted });

  const loggedBits = cycleLogFactBits(log);
  if (log?.notes?.trim()) {
    const idx = loggedBits.lastIndexOf(ka.cycle.journalTitle);
    const noteLine = `${ka.cycle.journalTitle}: ${log.notes.trim()}`;
    if (idx >= 0) loggedBits[idx] = noteLine;
    else loggedBits.push(noteLine);
  }

  const estimatedBits: string[] = [];
  if (layers.predictedPeriod) estimatedBits.push(ka.cycle.legendPeriodPredicted);
  if (layers.fertile) estimatedBits.push(ka.cycle.legendFertile);
  if (layers.ovulation) estimatedBits.push(ka.cycle.legendOvulation);
  const phaseCoveredByMark =
    layers.ovulation || layers.fertile || layers.predictedPeriod || layers.loggedPeriod;
  if (
    !phaseCoveredByMark &&
    phase.day != null &&
    phase.phase !== 'unknown' &&
    bundle.contraception?.presentation?.showPhaseAsBiological !== false
  ) {
    const phaseLabel = displayPhaseLabel(phase.phase, phase.phaseKa, {
      loggedPeriod: isBleedFlow(log?.flow),
    });
    if (!estimatedBits.includes(phaseLabel)) estimatedBits.push(phaseLabel);
  }

  const isFuture = date > today;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]}
        />

        <View
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            borderTopWidth: 1,
            borderColor: c.border,
            maxHeight: '72%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.creamDeep,
              alignSelf: 'center',
              marginBottom: 12,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  color: c.ink,
                  fontSize: 19,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  letterSpacing: -0.3,
                }}
              >
                {formatCycleDateKa(date)}
              </Text>
              {phase.day != null ? (
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 12,
                    marginTop: 3,
                    fontFamily: 'NotoSansGeorgian_500Medium',
                  }}
                >
                  {ka.cycle.cycleDay} {phase.day}
                  {date === today ? ` · ${ka.cycle.jumpToday}` : ''}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: c.cardSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={c.ink} strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView
            style={{ marginTop: 12 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            {/* ● Logged facts — solid glyphs, factual wording. */}
            {cycleLogHasFacts(log) || loggedBits.length ? (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: c.period,
                      marginRight: 8,
                    }}
                  />
                  <Text
                    style={{
                      color: c.mutedSoft,
                      fontSize: 11,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      letterSpacing: 0.4,
                    }}
                  >
                    {ka.cycle.logged}
                  </Text>
                </View>
                {(loggedBits.length ? loggedBits : [ka.cycle.loggedEntryEmpty]).map((bit, i) => (
                  <Text
                    key={i}
                    style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginBottom: 3 }}
                  >
                    {bit}
                  </Text>
                ))}
              </View>
            ) : !isFuture ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
                {ka.cycle.dayNothingLogged}
              </Text>
            ) : null}

            {/* ◌ Estimates — hollow glyph, always labeled predicted. */}
            {estimatedBits.length ? (
              <View style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: c.period,
                      borderStyle: 'dashed',
                      backgroundColor: 'transparent',
                      marginRight: 8,
                    }}
                  />
                  <Text
                    style={{
                      color: c.mutedSoft,
                      fontSize: 11,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      letterSpacing: 0.4,
                    }}
                  >
                    {ka.cycle.estimatedSection}
                  </Text>
                </View>
                {estimatedBits.map((bit, i) => (
                  <Text
                    key={i}
                    style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginBottom: 3 }}
                  >
                    {bit}
                  </Text>
                ))}
                <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginTop: 6 }}>
                  {ka.cycle.estimatedDisclaimer}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => onLog(date)}
              accessibilityRole="button"
              accessibilityLabel={log ? ka.common.edit : ka.cycle.logFab}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: c.cta,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: c.white, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
                {log ? ka.common.edit : ka.cycle.logFab}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onFullLog(date)}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.fullLog}
              style={{
                flex: 1,
                minHeight: 48,
                borderRadius: 14,
                backgroundColor: c.cardSoft,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
                {ka.cycle.fullLog}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
});
