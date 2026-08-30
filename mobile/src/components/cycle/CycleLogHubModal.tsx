import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import {
  HubBook,
  HubCloseX,
  HubDrug,
  HubEcg,
  HubLeaf,
  HubPad,
  HubRunning,
  HubSleep,
  HubStethoscope,
  HubVirus,
} from '@/components/cycle/CycleLogHubIcons';
import { CycleFlowPicker } from '@/components/cycle/CycleFlowPicker';
import { CycleTestResultRow } from '@/components/cycle/CycleTestResultRow';
import {
  MOOD_OPTIONS,
  MUCUS_OPTIONS,
  PHYSICAL_SYMPTOMS,
  SEXUAL_OPTIONS,
} from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import type { CycleLog } from '@/lib/api';
import { CyclePregnancyTransitionSheet } from '@/components/cycle/CyclePregnancyTransitionSheet';
import { persistCycleLog } from '@/lib/cycleLogSave';
import { loadCycleView, queueApplyPeriod } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

type Pane =
  | 'grid'
  | 'flow'
  | 'symptoms'
  | 'moods'
  | 'bbt'
  | 'mucus'
  | 'sex'
  | 'libido'
  | 'start'
  | 'notes'
  | 'opk'
  | 'preg';

type Item = {
  key: Exclude<Pane, 'grid'>;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
};

const ITEMS: Item[] = [
  { key: 'bbt', label: ka.cycle.logHubBbt, Icon: HubEcg },
  { key: 'libido', label: ka.cycle.logHubLibido, Icon: HubRunning },
  { key: 'moods', label: ka.cycle.logHubMood, Icon: HubSleep },
  { key: 'mucus', label: ka.cycle.logHubMucus, Icon: HubLeaf },
  { key: 'flow', label: ka.cycle.logHubFlow, Icon: HubPad },
  { key: 'symptoms', label: ka.cycle.logHubSymptoms, Icon: HubStethoscope },
  { key: 'start', label: ka.cycle.logHubStart, Icon: HubDrug },
  { key: 'sex', label: ka.cycle.logHubSex, Icon: HubVirus },
  { key: 'notes', label: ka.cycle.logHubNotes, Icon: HubBook },
  { key: 'opk', label: ka.cycle.logHubOpk, Icon: HubLeaf },
  { key: 'preg', label: ka.cycle.logHubPreg, Icon: HubBook },
];

const ROWS = [ITEMS.slice(0, 3), ITEMS.slice(3, 6), ITEMS.slice(6, 9), ITEMS.slice(9, 12)];
const SEX_IDS = new Set(SEXUAL_OPTIONS.map((o) => o.id));
const FEATURED_SYMPTOMS = ['cramps', 'headache', 'bloating', 'acne', 'fatigue', 'back_pain', 'breast_tenderness', 'nausea', 'ovulation_pain'];
const FEATURED_MOODS = ['energetic', 'calm', 'happy', 'sensitive', 'anxious', 'irritable', 'sad', 'tired_mood', 'stressed'];
const HUB_COL = 88;
const HUB_GAP = 24;
const HUB_GRID_W = HUB_COL * 3 + HUB_GAP * 2;

const SHADOW = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
} as const;

type Draft = {
  flow: string | null;
  symptoms: string[];
  sexTags: string[];
  moods: string[];
  sexualActivity: boolean | null;
  libido: number | null;
  bbt: string;
  cervicalMucus: string | null;
  ovulationTest: string | null;
  pregnancyTest: string | null;
  notes: string;
};

const EMPTY: Draft = {
  flow: null,
  symptoms: [],
  sexTags: [],
  moods: [],
  sexualActivity: null,
  libido: null,
  bbt: '',
  cervicalMucus: null,
  ovulationTest: null,
  pregnancyTest: null,
  notes: '',
};

function fromLog(log: CycleLog | undefined): Draft {
  if (!log) return { ...EMPTY };
  const all = log.symptoms || [];
  return {
    flow: log.flow,
    symptoms: all.filter((id) => !SEX_IDS.has(id)),
    sexTags: all.filter((id) => SEX_IDS.has(id)),
    moods: log.moods || [],
    sexualActivity: log.sexualActivity,
    libido: log.libido,
    bbt: log.bbt != null ? String(log.bbt) : '',
    cervicalMucus: log.cervicalMucus,
    ovulationTest: log.ovulationTest ?? null,
    pregnancyTest: log.pregnancyTest ?? null,
    notes: log.notes || '',
  };
}

function parseBbt(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function isLogged(key: Item['key'], d: Draft, started: boolean): boolean {
  switch (key) {
    case 'bbt':
      return parseBbt(d.bbt) != null;
    case 'libido':
      return d.libido != null;
    case 'moods':
      return d.moods.length > 0;
    case 'mucus':
      return Boolean(d.cervicalMucus);
    case 'flow':
      return Boolean(d.flow);
    case 'symptoms':
      return d.symptoms.length > 0;
    case 'start':
      return started;
    case 'sex':
      return d.sexualActivity != null;
    case 'notes':
      return Boolean(d.notes.trim());
    case 'opk':
      return Boolean(d.ovulationTest);
    case 'preg':
      return Boolean(d.pregnancyTest);
  }
}

type Props = {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: () => void;
};

export function CycleLogHubModal({ visible, date, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const [pane, setPane] = useState<Pane>('grid');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<Item['key'] | null>(null);
  const [showAllSymptoms, setShowAllSymptoms] = useState(false);
  const [showAllMoods, setShowAllMoods] = useState(false);
  const [lastPeriod, setLastPeriod] = useState(date);
  const [offerPregnancy, setOfferPregnancy] = useState(false);
  const [mode, setMode] = useState('TRACK_PERIOD');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaved = useCallback((key: Item['key']) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setToast(ka.cycle.logHubSaved);
    setFlashKey(key);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
    flashTimer.current = setTimeout(() => setFlashKey(null), 1400);
  }, []);

  useEffect(() => {
    if (!visible) {
      setPane('grid');
      setShowAllSymptoms(false);
      setShowAllMoods(false);
      setToast(null);
      setFlashKey(null);
      return;
    }
    let alive = true;
    if (!user?.id) return;
    void loadCycleView(user.id).then((view) => {
      if (!alive) return;
      const bundle = view.display;
      setDraft(fromLog(bundle.logs.find((l) => l.date === date)));
      setStarted(bundle.profile.lastPeriodStart === date || bundle.inferred.lastPeriodStart === date);
      setLastPeriod(bundle.profile.lastPeriodStart || bundle.inferred.lastPeriodStart || date);
      setMode(bundle.profile.mode);
    });
    return () => {
      alive = false;
    };
  }, [visible, date, user?.id]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const persist = async (patch: Partial<Draft>, markStart?: boolean) => {
    const next = { ...draft, ...patch };
    const savedKey = pane === 'grid' ? null : pane;
    setDraft(next);
    setSaving(true);
    try {
      if (!user?.id) return;
      const result = await persistCycleLog(
        user.id,
        date,
        {
          flow: next.flow,
          symptoms: next.symptoms,
          moods: next.moods,
          sexTags: next.sexTags,
          sexual: Boolean(next.sexualActivity),
          libido: next.libido,
          bbt: next.bbt,
          mucus: next.cervicalMucus,
          ovulationTest: next.ovulationTest,
          pregnancyTest: next.pregnancyTest,
          notes: next.notes,
        },
        { markStart },
      );
      if (markStart) setStarted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onSaved();
      if (savedKey) showSaved(savedKey);
      else if (result.persistedLocally) setToast(ka.cycle.savedOnDevice);
      else if (result.sessionOnly) setToast(ka.cycle.savedSessionOnly);
      else if (!result.synced) setToast(ka.cycle.saveNotPersisted);
      setPane('grid');
      if (next.pregnancyTest === 'positive' && mode !== 'PREGNANCY') {
        Alert.alert(ka.cycle.positivePregTitle, ka.cycle.positivePregBody, [
          { text: ka.cycle.positivePregLater, style: 'cancel' },
          { text: ka.cycle.positivePregConfirm, onPress: () => setOfferPregnancy(true) },
        ]);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setToast(ka.common.error);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2200);
    } finally {
      setSaving(false);
    }
  };

  const active = ITEMS.find((item) => item.key === pane);
  const symptomChips = useMemo(
    () => (showAllSymptoms ? PHYSICAL_SYMPTOMS : PHYSICAL_SYMPTOMS.filter((o) => FEATURED_SYMPTOMS.includes(o.id))),
    [showAllSymptoms],
  );
  const moodChips = useMemo(
    () => (showAllMoods ? MOOD_OPTIONS : MOOD_OPTIONS.filter((o) => FEATURED_MOODS.includes(o.id))),
    [showAllMoods],
  );

  const nudgeBbt = (delta: number) => {
    const current = parseBbt(draft.bbt) ?? 36.5;
    setDraft((d) => ({ ...d, bbt: (Math.round((current + delta) * 10) / 10).toFixed(1) }));
  };

  return (
    <>
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: APP_MODAL_OVERLAY }]} onPress={onClose} />

        <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            {pane === 'grid' ? (
              <View style={styles.grid}>
                {ROWS.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.row}>
                    {row.map((item) => {
                      const logged = isLogged(item.key, draft, started);
                      const flash = flashKey === item.key;
                      return (
                        <View key={item.key} style={styles.cell}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={item.label}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                              setPane(item.key);
                            }}
                            style={({ pressed }) => [styles.cellHit, { opacity: pressed ? 0.7 : 1 }]}
                          >
                            <View style={styles.iconWrap}>
                              <View
                                style={[
                                  styles.iconCircle,
                                  {
                                    backgroundColor: flash ? c.rose : logged ? c.roseSoft : c.cardSoft,
                                    borderColor: flash || logged ? c.rose : c.border,
                                  },
                                ]}
                              >
                                <item.Icon size={24} color={flash ? '#FFFFFF' : logged ? c.rose : c.muted} />
                              </View>
                              {logged ? (
                                <View style={[styles.checkBadge, { backgroundColor: c.rose }]}>
                                  <Check size={10} color="#FFFFFF" strokeWidth={3} />
                                </View>
                              ) : null}
                            </View>
                          <Text numberOfLines={1} style={[styles.cellLabel, { color: c.ink }]}>
                            {item.label}
                          </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <View style={{ gap: 12 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setPane('grid')}
                    hitSlop={8}
                    style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
                  >
                    <Text style={[styles.back, { color: c.brand }]}>{ka.common.back}</Text>
                  </Pressable>
                  <View style={{ alignItems: 'center', gap: 10 }}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: c.cardSoft, borderColor: c.border },
                      ]}
                    >
                      {active ? <active.Icon size={24} color={c.muted} /> : null}
                    </View>
                    <Text style={[styles.detailTitle, { color: c.ink, textAlign: 'center' }]}>
                      {active?.label}
                    </Text>
                  </View>
                </View>

                <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {pane === 'flow' ? (
                    <CycleFlowPicker
                      value={draft.flow}
                      disabled={saving}
                      onChange={(id) => void persist({ flow: id })}
                    />
                  ) : null}

                  {pane === 'mucus' ? (
                    <View style={styles.stack}>
                      {MUCUS_OPTIONS.map((opt) => (
                        <ChoiceRow
                          key={opt.id}
                          label={opt.label}
                          selected={draft.cervicalMucus === opt.id}
                          disabled={saving}
                          onPress={() => void persist({ cervicalMucus: opt.id })}
                        />
                      ))}
                    </View>
                  ) : null}

                  {pane === 'opk' ? (
                    <View style={{ gap: 10 }}>
                      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>
                        {ka.cycle.ovulationTestHint}
                      </Text>
                      <CycleTestResultRow
                        value={draft.ovulationTest}
                        onChange={(ovulationTest) => void persist({ ovulationTest })}
                        accent={c.fertile}
                      />
                    </View>
                  ) : null}

                  {pane === 'preg' ? (
                    <View style={{ gap: 10 }}>
                      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17 }}>
                        {ka.cycle.pregnancyTestHint}
                      </Text>
                      <CycleTestResultRow
                        value={draft.pregnancyTest}
                        onChange={(pregnancyTest) => void persist({ pregnancyTest })}
                        accent={c.rose}
                      />
                    </View>
                  ) : null}

                  {pane === 'libido' ? (
                    <View style={styles.libidoRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <View key={n} style={styles.libidoSlot}>
                          <Pressable
                            disabled={saving}
                            onPress={() => void persist({ libido: n })}
                            style={[
                              styles.libidoDot,
                              {
                                backgroundColor: draft.libido === n ? c.card : c.cardSoft,
                                borderColor: draft.libido === n ? c.brand : c.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.libidoNum,
                                { color: draft.libido === n ? c.brand : c.ink },
                              ]}
                            >
                              {n}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {pane === 'symptoms' ? (
                    <View style={{ gap: 12 }}>
                      <MiniGrid
                        items={symptomChips}
                        selected={draft.symptoms}
                        onToggle={(id) =>
                          setDraft((d) => ({
                            ...d,
                            symptoms: d.symptoms.includes(id) ? d.symptoms.filter((x) => x !== id) : [...d.symptoms, id],
                          }))
                        }
                      />
                      <Pressable
                        onPress={() => setShowAllSymptoms((v) => !v)}
                        style={{ minHeight: 40, justifyContent: 'center' }}
                      >
                        <Text style={[styles.more, { color: c.brand }]}>
                          {showAllSymptoms ? ka.common.close : ka.cycle.logHubMore}
                        </Text>
                      </Pressable>
                      <ApplyRow saving={saving} onPress={() => void persist({})} />
                    </View>
                  ) : null}

                  {pane === 'moods' ? (
                    <View style={{ gap: 12 }}>
                      <MiniGrid
                        items={moodChips}
                        selected={draft.moods}
                        onToggle={(id) =>
                          setDraft((d) => ({
                            ...d,
                            moods: d.moods.includes(id) ? d.moods.filter((x) => x !== id) : [...d.moods, id],
                          }))
                        }
                      />
                      <Pressable
                        onPress={() => setShowAllMoods((v) => !v)}
                        style={{ minHeight: 40, justifyContent: 'center' }}
                      >
                        <Text style={[styles.more, { color: c.brand }]}>
                          {showAllMoods ? ka.common.close : ka.cycle.logHubMore}
                        </Text>
                      </Pressable>
                      <ApplyRow saving={saving} onPress={() => void persist({})} />
                    </View>
                  ) : null}

                  {pane === 'sex' ? (
                    <View style={{ gap: 12 }}>
                      <View style={styles.twoCol}>
                        <View style={styles.grow}>
                          <ChoiceRow
                            label={ka.cycle.logNo}
                            selected={draft.sexualActivity === false}
                            disabled={saving}
                            onPress={() => void persist({ sexualActivity: false, sexTags: [] })}
                          />
                        </View>
                        <View style={styles.grow}>
                          <ChoiceRow
                            label={ka.cycle.logYes}
                            selected={draft.sexualActivity === true}
                            disabled={saving}
                            onPress={() => setDraft((d) => ({ ...d, sexualActivity: true }))}
                          />
                        </View>
                      </View>
                      {draft.sexualActivity ? (
                        <>
                          <View style={styles.stack}>
                            {SEXUAL_OPTIONS.map((opt) => (
                              <ChoiceRow
                                key={opt.id}
                                label={opt.label}
                                selected={draft.sexTags.includes(opt.id)}
                                disabled={saving}
                                onPress={() =>
                                  setDraft((d) => ({
                                    ...d,
                                    sexTags: d.sexTags.includes(opt.id)
                                      ? d.sexTags.filter((id) => id !== opt.id)
                                      : [...d.sexTags, opt.id],
                                  }))
                                }
                              />
                            ))}
                          </View>
                          <ApplyRow saving={saving} onPress={() => void persist({ sexualActivity: true })} />
                        </>
                      ) : null}
                    </View>
                  ) : null}

                  {pane === 'bbt' ? (
                    <View style={{ gap: 16, alignItems: 'center' }}>
                      <View style={styles.stepper}>
                        <Pressable
                          onPress={() => nudgeBbt(-0.1)}
                          style={[styles.stepBtn, { backgroundColor: c.cardSoft, borderColor: c.border }]}
                        >
                          <Text style={[styles.stepGlyph, { color: c.muted }]}>−</Text>
                        </Pressable>
                        <Text style={[styles.stepValue, { color: c.ink }]}>{draft.bbt || '36.5'}</Text>
                        <Pressable
                          onPress={() => nudgeBbt(0.1)}
                          style={[styles.stepBtn, { backgroundColor: c.cardSoft, borderColor: c.border }]}
                        >
                          <Text style={[styles.stepGlyph, { color: c.muted }]}>+</Text>
                        </Pressable>
                      </View>
                      <ApplyRow saving={saving} onPress={() => void persist({ bbt: draft.bbt || '36.5' })} />
                    </View>
                  ) : null}

                  {pane === 'notes' ? (
                    <View style={{ gap: 12 }}>
                      <TextInput
                        value={draft.notes}
                        onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
                        placeholder={ka.cycle.logNotesPlaceholder}
                        placeholderTextColor={c.mutedSoft}
                        multiline
                        style={[
                          styles.notes,
                          { color: c.ink, borderColor: c.border, backgroundColor: c.cardSoft },
                        ]}
                      />
                      <ApplyRow saving={saving} onPress={() => void persist({})} />
                    </View>
                  ) : null}

                  {pane === 'start' ? (
                    <View style={{ gap: 10 }}>
                      <CycleFlowPicker
                        value={draft.flow}
                        disabled={saving}
                        onChange={(id) => setDraft((d) => ({ ...d, flow: id }))}
                      />
                      <Pressable
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel={ka.cycle.quickLogStart}
                        onPress={() =>
                          void persist({ flow: draft.flow && draft.flow !== 'none' ? draft.flow : 'medium' }, true)
                        }
                        style={[styles.primary, { backgroundColor: c.cta }]}
                      >
                        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{ka.cycle.quickLogStart}</Text>}
                      </Pressable>
                      <Pressable
                        disabled={saving}
                        onPress={() =>
                          void (async () => {
                            setSaving(true);
                            try {
                              if (!user?.id) return;
                              const result = await queueApplyPeriod(user.id, { action: 'end', date });
                              setStarted(false);
                              onSaved();
                              setPane('grid');
                              if (result.synced) setToast(ka.cycle.logHubSaved);
                              else if (result.persistedLocally) setToast(ka.cycle.savedOnDevice);
                              else if (result.sessionOnly) setToast(ka.cycle.savedSessionOnly);
                              else setToast(ka.cycle.saveNotPersisted);
                            } catch {
                              setToast(ka.common.error);
                            } finally {
                              setSaving(false);
                            }
                          })()
                        }
                        style={[styles.primary, { backgroundColor: c.cardSoft }]}
                      >
                        {saving ? (
                          <ActivityIndicator color={c.ink} />
                        ) : (
                          <Text style={[styles.primaryText, { color: c.ink }]}>{ka.cycle.periodEndCta}</Text>
                        )}
                      </Pressable>
                      <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center', lineHeight: 17 }}>
                        {ka.cycle.periodEndHint}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            {toast ? (
              <View style={[styles.toast, { backgroundColor: c.cardSoft, borderColor: c.brand }]}>
                <Check size={16} color={c.brand} strokeWidth={2.8} />
                <Text style={[styles.toastText, { color: c.brand }]}>{toast}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ alignItems: 'center', paddingTop: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              onPress={onClose}
              style={styles.close}
            >
              <HubCloseX size={32} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    <CyclePregnancyTransitionSheet
      visible={offerPregnancy}
      lastPeriod={lastPeriod}
      onClose={() => setOfferPregnancy(false)}
      onComplete={() => setOfferPregnancy(false)}
    />
    </>
  );
}

function MiniGrid({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const c = useCycleColors();
  const rows: { id: string; label: string }[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return (
    <View style={styles.miniGrid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.miniRow}>
          {row.map((opt) => {
            const on = selected.includes(opt.id);
            return (
              <View key={opt.id} style={styles.miniSlot}>
                <Pressable
                  onPress={() => onToggle(opt.id)}
                  style={[
                    styles.miniCell,
                    { backgroundColor: on ? c.roseSoft : c.cardSoft, borderColor: on ? c.rose : c.border },
                  ]}
                >
                  <Text numberOfLines={2} style={[styles.miniLabel, { color: on ? c.rose : c.ink }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
          {row.length < 3
            ? Array.from({ length: 3 - row.length }).map((_, j) => <View key={`pad-${j}`} style={styles.miniSlot} />)
            : null}
        </View>
      ))}
    </View>
  );
}

function ChoiceRow({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        { backgroundColor: selected ? c.roseSoft : c.cardSoft, borderColor: selected ? c.rose : c.border },
      ]}
    >
      <Text style={[styles.choiceText, { color: selected ? c.rose : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

function ApplyRow({ saving, onPress }: { saving: boolean; onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable disabled={saving} onPress={onPress} style={[styles.primary, { backgroundColor: c.cta }]}>
      {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{ka.cycle.saveLog}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  grid: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: HUB_GRID_W,
    gap: HUB_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: HUB_GAP,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  cellHit: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  iconCircleOn: {
    backgroundColor: '#F0FDFA',
    borderColor: '#14B8A6',
  },
  iconCircleFlash: {
    backgroundColor: '#14B8A6',
    borderColor: '#14B8A6',
  },
  checkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: {
    marginTop: 8,
    height: 20,
    width: '100%',
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
    textAlign: 'center',
  },
  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backHit: {
    minWidth: 48,
  },
  back: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 14,
    color: '#14B8A6',
  },
  detailTitle: {
    flex: 1,
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
  },
  stack: { gap: 8 },
  twoCol: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  choice: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  choiceOn: {
    backgroundColor: '#F0FDFA',
    borderColor: '#14B8A6',
  },
  choiceText: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 15,
    color: '#1F2937',
    textAlign: 'center',
  },
  choiceTextOn: { color: '#0F766E' },
  miniGrid: { gap: 8 },
  miniRow: { flexDirection: 'row', gap: 8 },
  miniSlot: { flex: 1 },
  miniCell: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  miniCellOn: {
    backgroundColor: '#F0FDFA',
    borderColor: '#14B8A6',
  },
  miniLabel: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: '#1F2937',
    textAlign: 'center',
  },
  miniLabelOn: { color: '#0F766E' },
  libidoRow: {
    flexDirection: 'row',
  },
  libidoSlot: {
    flex: 1,
    alignItems: 'center',
  },
  libidoDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
  libidoDotOn: {
    backgroundColor: '#F0FDFA',
    borderColor: '#14B8A6',
  },
  libidoNum: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 16,
    color: '#1F2937',
  },
  libidoNumOn: { color: '#0F766E' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    paddingVertical: 8,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: {
    fontSize: 24,
    lineHeight: 28,
    color: '#4B5563',
    fontFamily: 'NotoSansGeorgian_400Regular',
  },
  stepValue: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.5,
    color: '#1F2937',
  },
  notes: {
    minHeight: 112,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 16,
    color: '#1F2937',
    textAlignVertical: 'top',
  },
  more: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 14,
    color: '#14B8A6',
    textAlign: 'center',
  },
  primary: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#14B8A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  toast: {
    marginTop: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  toastText: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 14,
    color: '#0F766E',
  },
  close: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW,
  },
});
