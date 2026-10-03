import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { ChatFormScroll, ChatScreenShell } from '@/components/chat/ChatScreenShell';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft, ChevronRight, Info, Lock, X } from 'lucide-react-native';
import { APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { CycleHeavyBleedingCard } from '@/components/cycle/CycleHeavyBleedingCard';
import { CycleIconTile } from '@/components/cycle/CycleIconTile';
import { CycleLearnMoreSheet } from '@/components/cycle/CycleLearnMoreSheet';
import { CycleQuickLogFields, quickLogModeHint } from '@/components/cycle/CycleQuickLogSheet';
import { CyclePrimaryButton, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { useCycleQuickLog } from '@/components/cycle/useCycleQuickLog';
import { learnMoreFor, type LearnMoreEntry, type LearnMoreKind } from '@/i18n/cycle/learnMore';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleBundle, CycleDayMark, CyclePostpartumPayload } from '@/lib/api';
import { cycleToday, phaseFromBundle } from '@/lib/cycleCanonical';
import { showFertilityUi, showPhaseAsBiological } from '@/lib/cycleContraception';
import { dayFactSections, privateFactCount, privateFactsLine } from '@/lib/cycleDayFacts';
import { heavyBleedingSignalForDay } from '@/lib/cycleHeavyBleeding';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { explicitAbsentKeys } from '@/lib/cycleObservationAssessment';
import type { CycleView } from '@/lib/cycleOffline';
import { classifyCycleDay } from '@/lib/cyclePresentation.js';
import { addDaysKey } from '@/lib/home/homeCycle';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  date: string;
  bundle: CycleBundle;
  marks: Record<string, CycleDayMark>;
  onClose: () => void;
  /** ◀ ▶ move the sheet to another day without closing it. */
  onDateChange: (date: string) => void;
  onSaved: (view?: CycleView | null) => void;
  onFullLog: (date: string) => void;
  showPredicted?: boolean;
  postpartum?: CyclePostpartumPayload | null;
  onClassifyEpisode?: (date: string, classified: boolean) => void;
};

type Pending = { kind: 'move'; date: string } | { kind: 'close' } | { kind: 'full' } | null;

/**
 * One sheet for a calendar day (brief §8.4, §9 item 9): ◀ date ▶, the phase in words (always
 * „სავარაუდო“ when estimated, nothing biological under hormonal contraception), the day's facts as
 * read-only tiles (private things as one line without detail), then the same quick log that
 * `CycleQuickLogSheet` uses, inline for that date, and a save footer with the „სრული აღრიცხვა“ link.
 * Replaces the details sheet → quick log → full log hops. Viewing never creates data.
 */
export function CycleDaySheet({
  visible,
  date,
  bundle,
  marks,
  onClose,
  onDateChange,
  onSaved,
  onFullLog,
  showPredicted = true,
  postpartum = null,
  onClassifyEpisode,
}: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { user } = useAuth();
  const q = useCycleQuickLog({ active: visible, date, userId: user?.id, onSaved });
  const [pending, setPending] = useState<Pending>(null);
  /** „გაიგე მეტი“ for a fact tile — drawn inside this sheet's Modal, never a second native Modal. */
  const [learn, setLearn] = useState<{ title: string; entry: LearnMoreEntry } | null>(null);
  useEffect(() => {
    setLearn(null);
  }, [visible, date]);

  const today = cycleToday(bundle, todayKey());
  const isFuture = date > today;
  const caps = cycleModeCapabilities(bundle.profile?.mode);
  const showFertility = caps.showFertileEstimates && showFertilityUi(bundle);
  const fertilityFacts = Boolean(caps.showFertilityShortcuts) && showFertilityUi(bundle);
  const biological = showPhaseAsBiological(bundle);
  const mark = marks[date];
  const layers = classifyCycleDay(mark, { showFertility, showPredicted: Boolean(showPredicted) && caps.showFertileEstimates });

  const log = useMemo(() => bundle.logs.find((l) => l.date === date) ?? null, [bundle.logs, date]);
  const phase = useMemo(() => phaseFromBundle(bundle, date), [bundle, date]);
  const sections = useMemo(() => dayFactSections(log, { showFertility: fertilityFacts }), [log, fertilityFacts]);
  const privateCount = privateFactCount(log, { showFertility: fertilityFacts });
  const assessed = explicitAbsentKeys(log).map((key) => ka.cycle.assessmentAbsentBit(cycleChipLabel(key)));
  // Classic overview only (track / TTC): pregnancy, postpartum and perimenopause never get this card.
  const heavyRun = useMemo(
    () => caps.showClassicCycleOverview && heavyBleedingSignalForDay(bundle.logs, date, today).show,
    [caps.showClassicCycleOverview, bundle.logs, date, today],
  );

  // Phase in words: logged bleeding is a fact; everything else is an estimate and says so.
  let phaseLine: string | null = null;
  if (caps.showClassicCycleOverview && biological) {
    if (layers.loggedPeriod || isBleedFlow(log?.flow)) phaseLine = ka.cycle.period;
    else if (layers.ovulation) phaseLine = ka.cycle.legendOvulation;
    else if (layers.fertile) phaseLine = ka.cycle.legendFertile;
    else if (layers.predictedPeriod) phaseLine = ka.cycle.legendPeriodPredicted;
    else if (phase.phase !== 'unknown') phaseLine = displayPhaseLabel(phase.phase, phase.phaseKa, { loggedPeriod: false });
  }
  const estimated = phaseLine != null && phaseLine !== ka.cycle.period;
  const cycleDayLine = caps.showClassicCycleOverview && phase.day != null ? `${ka.cycle.cycleDay} ${phase.day}` : null;

  const classifiedDates = postpartum?.classifiedDates || bundle.classifiedDates || [];
  const bleedEpisode = (postpartum?.bleedEpisodes || []).find((row) => date >= row.start && date <= row.end);
  const historicalPostpartumBleed = log?.trackingContext === 'POSTPARTUM' && isBleedFlow(log?.flow);
  const classifiedBleed = Boolean(bleedEpisode?.classified || classifiedDates.includes(date) || mark?.ownerClassifiedPeriod);
  const canClassifyBleed = Boolean(onClassifyEpisode && historicalPostpartumBleed && !isFuture);

  const run = (next: Exclude<Pending, null>) => {
    setPending(null);
    setLearn(null);
    if (next.kind === 'move') onDateChange(next.date);
    else if (next.kind === 'full') onFullLog(date);
    else onClose();
  };
  const guard = (next: Exclude<Pending, null>) => {
    if (q.dirty && !q.saving) {
      Haptics.selectionAsync().catch(() => undefined);
      setPending(next);
      return;
    }
    run(next);
  };
  const move = (delta: number) => guard({ kind: 'move', date: addDaysKey(date, delta) });
  const close = () => guard({ kind: 'close' });

  const save = async () => {
    const ok = await q.save();
    if (!ok) return;
    if (pending) run(pending);
    else onClose();
  };
  const discard = () => {
    q.reset();
    if (pending) run(pending);
  };

  const title = formatCycleDateKa(date);
  const subtitle = [date === today ? ka.cycle.jumpToday : null, cycleDayLine].filter(Boolean).join(' · ');
  // Public fact tiles only; private things stay one line and are never explained here.
  const explainable = sections.some((section) => section.tiles.some((tile) => learnMoreFor(tile.kind as LearnMoreKind, tile.id)));

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={learn ? () => setLearn(null) : close}>
      <ChatScreenShell header={null} style={{ backgroundColor: c.overlay }}>
        <View style={s.root}>
          <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={close} style={StyleSheet.absoluteFill} />
          <View
            role="dialog"
            aria-modal={true}
            accessibilityViewIsModal
            accessibilityLabel={title}
            style={[s.sheet, { backgroundColor: c.card, maxHeight: fontScale >= 1.5 ? '94%' : fontScale >= 1.3 ? '90%' : '92%' }]}
          >
            <View style={[s.grabber, { backgroundColor: c.creamDeep }]} />

            {/* ◀ date ▶ ✕ */}
            <View style={s.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('წინა დღე', 'Previous day')}
                onPress={() => move(-1)}
                hitSlop={6}
                style={[s.navBtn, { backgroundColor: c.cardSoft }]}
              >
                <ChevronLeft size={20} color={c.ink} strokeWidth={2.4} />
              </Pressable>
              <View style={s.headerText}>
                <Text numberOfLines={1} style={[s.title, { color: c.ink }]}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text numberOfLines={1} style={[s.subtitle, { color: c.muted }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('შემდეგი დღე', 'Next day')}
                onPress={() => move(1)}
                hitSlop={6}
                style={[s.navBtn, { backgroundColor: c.cardSoft }]}
              >
                <ChevronRight size={20} color={c.ink} strokeWidth={2.4} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ka.common.close}
                onPress={close}
                hitSlop={6}
                style={[s.navBtn, { backgroundColor: c.cardSoft, marginLeft: 4 }]}
              >
                <X size={18} color={c.ink} strokeWidth={2.4} />
              </Pressable>
            </View>

            <ChatFormScroll
              style={{ flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
            >
              {/* Phase in words */}
              {phaseLine || cycleDayLine ? (
                <View style={[s.phaseRow, { backgroundColor: estimated ? c.cardSoft : c.periodSoft }]}>
                  <View
                    style={[
                      s.phaseDot,
                      estimated
                        ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: layers.fertile || layers.ovulation ? c.fertile : c.period }
                        : { backgroundColor: c.period },
                    ]}
                  />
                  <Text style={[s.phaseText, { color: c.ink }]}>
                    <Text style={{ color: c.muted }}>{`${tx('ფაზა', 'Phase')} · `}</Text>
                    {phaseLine ?? cycleDayLine}
                  </Text>
                </View>
              ) : null}
              {estimated ? (
                <Text style={[s.fine, { color: c.mutedSoft }]}>{ka.cycle.estimatedDisclaimer}</Text>
              ) : null}

              {/* Facts as tiles */}
              {sections.length || privateCount || assessed.length ? (
                <View style={s.facts}>
                  <View style={s.factsHead}>
                    <Text accessibilityRole="header" style={[s.sectionTitle, { color: c.mutedSoft }]}>
                      {ka.cycle.logged}
                    </Text>
                    {explainable ? (
                      <View style={s.learnHint} accessible={false}>
                        <Info size={13} color={c.mutedSoft} strokeWidth={2.2} />
                        <Text style={[s.learnHintText, { color: c.mutedSoft }]}>
                          {tx('შეეხე — გაიგე მეტი', 'Tap to learn more')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {sections.map((section) => (
                    <View key={section.id} style={s.factGroup}>
                      <Text style={[s.factTitle, { color: c.muted }]}>{section.title}</Text>
                      <View style={s.tiles}>
                        {section.tiles.map((tile) => {
                          const entry = learnMoreFor(tile.kind as LearnMoreKind, tile.id);
                          return (
                            <CycleIconTile
                              key={tile.key}
                              readOnly
                              selected
                              onPress={() => undefined}
                              onExplain={entry ? () => setLearn({ title: tile.label, entry }) : undefined}
                              glyph={tile.glyph}
                              label={tile.label}
                              group={tile.group}
                              level={tile.level}
                              levelMax={tile.levelMax}
                              levelName={tile.levelName}
                              glyphScale={tile.glyphScale}
                              glyphOpacity={tile.glyphOpacity}
                              hollow={tile.hollow}
                            />
                          );
                        })}
                      </View>
                    </View>
                  ))}
                  {privateCount ? (
                    <View style={[s.privateRow, { backgroundColor: c.cardSoft }]}>
                      <Lock size={14} color={c.muted} strokeWidth={2} />
                      <Text style={[s.privateText, { color: c.muted }]}>{privateFactsLine()}</Text>
                    </View>
                  ) : null}
                  {assessed.length ? (
                    <Text style={[s.fine, { color: c.muted }]}>{`${ka.cycle.assessmentToday}: ${assessed.join(' · ')}`}</Text>
                  ) : null}
                </View>
              ) : isFuture ? (
                <Text style={[s.fine, { color: c.muted, marginTop: 8 }]}>
                  {tx('მომავალი დღე — აღრიცხვა თარიღის დადგომისას.', 'A future day — log it when it comes.')}
                </Text>
              ) : null}

              {/* Brief §9 item 15: the calm card also on any day of a run that qualifies (not in postpartum / perimenopause). */}
              {heavyRun ? (
                <View style={{ marginTop: 14 }}>
                  <CycleHeavyBleedingCard variant="inset" />
                </View>
              ) : null}

              {canClassifyBleed ? (
                <View style={{ marginTop: 14 }}>
                  {classifiedBleed ? (
                    <Text accessibilityLabel={ka.cycle.postpartumClassifiedA11y} style={[s.factTitle, { color: c.brand, marginBottom: 8 }]}>
                      {ka.cycle.postpartumClassifiedBadge}
                    </Text>
                  ) : null}
                  <Pressable
                    onPress={() => onClassifyEpisode?.(date, classifiedBleed)}
                    accessibilityRole="button"
                    accessibilityLabel={classifiedBleed ? ka.cycle.postpartumUnclassify : ka.cycle.postpartumClassifyPeriod}
                    style={[s.tonal, { backgroundColor: c.cardSoft }]}
                  >
                    <Text style={[s.tonalText, { color: c.ink }]}>
                      {classifiedBleed ? ka.cycle.postpartumUnclassify : ka.cycle.postpartumClassifyPeriod}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Inline quick log for this date */}
              {!isFuture ? (
                <View style={s.logBlock}>
                  <View style={s.logHead}>
                    <Text accessibilityRole="header" style={[s.sectionTitle, { color: c.mutedSoft }]}>
                      {log ? tx('შეცვალე ან დაამატე', 'Change or add') : ka.cycle.logTodayCta}
                    </Text>
                    {q.caps ? (
                      <Text style={[s.logHint, { color: c.mutedSoft }]}>
                        {quickLogModeHint(q.caps)}
                      </Text>
                    ) : null}
                  </View>
                  {!q.hydrated || !q.caps ? (
                    <View style={s.loading}>
                      {!q.saveError ? <ActivityIndicator color={c.brand} /> : null}
                      <Text accessibilityLabel={ka.common.loading} style={{ color: c.muted, fontSize: 13, marginTop: 10 }}>
                        {q.saveError || ka.common.loading}
                      </Text>
                      {q.saveError ? <CyclePrimaryButton label={tx('ხელახლა ცდა', 'Try again')} onPress={q.retry} /> : null}
                    </View>
                  ) : (
                    <>
                      <CycleQuickLogFields q={q} date={date} />
                      {q.saveError ? <Text style={[s.error, { color: c.danger }]}>{q.saveError}</Text> : null}
                    </>
                  )}
                </View>
              ) : null}
            </ChatFormScroll>

            {/* Unsaved changes: an inline question, never a system alert. */}
            {pending ? (
              <View style={[s.pendingBar, { backgroundColor: c.cardSoft, borderColor: c.border }]}>
                <Text style={[s.pendingText, { color: c.ink }]}>{tx('ცვლილებები შეუნახავია — შევინახო?', 'Unsaved changes — save them?')}</Text>
                <View style={s.pendingActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={tx('უარყოფა', 'Discard')} onPress={discard} style={[s.pendingBtn, { backgroundColor: c.card }]}>
                    <Text style={[s.pendingBtnText, { color: c.ink }]}>{tx('უარყოფა', 'Discard')}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={ka.cycle.saveLog} onPress={() => void save()} disabled={q.saving} style={[s.pendingBtn, { backgroundColor: c.cta }]}>
                    <Text style={[s.pendingBtnText, { color: c.onPrimary }]}>{ka.cycle.saveLog}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {!isFuture && q.hydrated && q.caps ? (
              <View style={[s.footer, { borderColor: c.border, backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, 8) }]}>
                <CyclePrimaryButton label={ka.cycle.saveLog} loading={q.saving} onPress={() => void save()} icon={Check} />
                <Pressable
                  onPress={() => guard({ kind: 'full' })}
                  disabled={q.saving}
                  accessibilityRole="button"
                  accessibilityLabel={ka.cycle.fullLog}
                  style={s.fullLink}
                >
                  <Text style={[s.fullLinkText, { color: c.brand }]}>{ka.cycle.fullLog}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          <CycleLearnMoreSheet
            embedded
            visible={visible && learn != null}
            title={learn?.title ?? ''}
            items={learn ? [{ entry: learn.entry }] : []}
            onClose={() => setLearn(null)}
          />
        </View>
      </ChatScreenShell>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 10 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  headerText: { flex: 1, minWidth: 0, alignItems: 'center' },
  title: { fontSize: 17, lineHeight: 22, fontFamily: 'NotoSansGeorgian_700Bold', letterSpacing: -0.2, textAlign: 'center' },
  subtitle: { fontSize: 12, lineHeight: 16, marginTop: 2, fontFamily: 'NotoSansGeorgian_500Medium', textAlign: 'center' },
  navBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  phaseText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'NotoSansGeorgian_600SemiBold' },
  fine: { fontSize: 11.5, lineHeight: 16, marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular' },
  facts: { marginTop: 16, gap: 12 },
  factsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  learnHint: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  learnHintText: { fontSize: 11.5, lineHeight: 16, fontFamily: 'NotoSansGeorgian_500Medium' },
  sectionTitle: { fontSize: 11, lineHeight: 16, letterSpacing: 0.4, fontFamily: 'NotoSansGeorgian_700Bold', textTransform: 'uppercase' },
  factGroup: { gap: 6 },
  factTitle: { fontSize: 12.5, lineHeight: 18, fontFamily: 'NotoSansGeorgian_600SemiBold' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: 12 },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  privateText: { flex: 1, fontSize: 13, lineHeight: 18, fontFamily: 'NotoSansGeorgian_500Medium' },
  tonal: { minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  tonalText: { fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' },
  logBlock: { marginTop: 22, gap: 14 },
  logHead: { gap: 4 },
  logHint: { fontSize: 12, lineHeight: 16, fontFamily: 'NotoSansGeorgian_400Regular' },
  loading: { minHeight: 120, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  error: { fontSize: 13, marginTop: 12, fontFamily: 'NotoSansGeorgian_600SemiBold' },
  pendingBar: { marginHorizontal: 16, marginBottom: 8, borderRadius: 16, borderWidth: 1, padding: 12, gap: 10 },
  pendingText: { fontSize: 13.5, lineHeight: 19, fontFamily: 'NotoSansGeorgian_600SemiBold' },
  pendingActions: { flexDirection: 'row', gap: 8 },
  pendingBtn: { flex: 1, minHeight: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  pendingBtnText: { fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  fullLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fullLinkText: { fontSize: 13, lineHeight: 20, fontFamily: 'NotoSansGeorgian_600SemiBold' },
});
