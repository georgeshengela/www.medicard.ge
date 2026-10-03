import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { ChatFormScroll } from '@/components/chat/ChatScreenShell';
import React, { useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ChevronDown, ChevronRight, Droplets, Heart, Lock, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { CYCLE_TEST_OPTIONS } from '@/constants/cycle';
import { CycleIconRow, CycleIconTile } from '@/components/cycle/CycleIconTile';
import { CycleJournalField, CycleLifestyleFields, CycleTagPicker } from '@/components/cycle/CycleObservationFields';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { CycleSexSection } from '@/components/cycle/CycleSexSection';
import { CycleObservationAssessment } from '@/components/cycle/CycleObservationAssessment';
import type { CycleCustomTag, CyclePainEntry, CyclePainSeverity, CyclePainType } from '@/lib/api';
import { PAIN_TYPES, painTypeLabel } from '@/lib/cycleObservations';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import {
  applySymptomChipToggle,
  PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS,
  PREGNANCY_DAILY_ASSESSMENT_KEYS,
} from '@/lib/cycleObservationAssessment';
import {
  FULL_LOG_TABS,
  FULL_LOG_VISIBLE,
  activeTabForOffset,
  flowTiles,
  hasPrivateContent,
  moodTiles,
  mucusTiles,
  symptomTiles,
  tabHasContent,
  type FullLogTab,
  type SymptomGroupId,
} from '@/lib/cycleFullLog';
import { cycleGlyphFor, flowGlyphStyle } from '@/lib/cycleIconMap';
import { nextPainSeverity, painLevel } from '@/lib/cycleQuickLogCopy';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { useCycleColors } from '@/theme/cycle';

type TabId = FullLogTab;

export type CycleLogForm = {
  flow: string | null;
  symptoms: string[];
  moods: string[];
  sexTags: string[];
  sexual: boolean | null;
  libido: number | null;
  bbt: string;
  mucus: string | null;
  ovulationTest: string | null;
  pregnancyTest: string | null;
  notes: string;
  painEntries: CyclePainEntry[];
  sleepQuality: string | null;
  stressLevel: string | null;
  exerciseLevel: string | null;
  caffeine: string | null;
  alcohol: string | null;
  customTagIds: string[];
  energy: string | null;
  observationAssessments: Record<string, 'ABSENT'>;
};

type Props = {
  date: string;
  mode: string;
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  bottomInset: number;
  initialTab?: TabId;
  customTags?: CycleCustomTag[];
  onCreateTag?: (name: string) => Promise<void>;
  creatingTag?: boolean;
};

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'flow', label: ka.cycle.logStepFlow, icon: Droplets },
  { id: 'feel', label: ka.cycle.logStepFeel, icon: Heart },
  { id: 'more', label: ka.cycle.logStepMore, icon: Sparkles },
];

/** The ✓-less result tiles: one test glyph, the result told by the glyph's variant and label. */
function testTileLook(id: string): { glyph: 'rdt' | 'rdtPositive'; opacity: number } {
  if (id === 'positive') return { glyph: 'rdtPositive', opacity: 1 };
  if (id === 'unclear') return { glyph: 'rdt', opacity: 0.45 };
  return { glyph: 'rdt', opacity: 0.8 };
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * The full log, one scrolling list of group cards (Clue's structure, the quick log's tiles): bleeding →
 * pain → mood → body → digestion → skin → energy → fertility signs (when the mode logs them) → private
 * (a lock row that unfolds, never pre-filled) → lifestyle → tags → journal. The three tabs on top are
 * jump anchors into that list and light up as the person scrolls; a tab with content carries a dot.
 */
export function CycleLogTabs({
  date,
  mode,
  form,
  onChange,
  bottomInset,
  initialTab,
  customTags = [],
  onCreateTag,
  creatingTag,
}: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<Partial<Record<TabId, number>>>({});
  const pending = useRef<TabId | null>(initialTab && initialTab !== 'flow' ? initialTab : null);
  const [tab, setTab] = useState<TabId>(initialTab ?? 'flow');
  const [privateOpen, setPrivateOpen] = useState(false);

  const caps = cycleModeCapabilities(mode);
  const showFertility = Boolean(caps.showFertilityLogging);
  const showPregnancyTestOnly = !showFertility && Boolean(caps.showPregnancyTestLog);
  const assessmentKeys = caps.showPregnancyObservations
    ? PREGNANCY_DAILY_ASSESSMENT_KEYS
    : caps.showPerimenopauseTracking
      ? PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS
      : [];

  const jumpTo = (id: TabId) => {
    Haptics.selectionAsync().catch(() => undefined);
    setTab(id);
    const y = anchors.current[id];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: !reduceMotion });
  };
  const onAnchor = (id: TabId) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    anchors.current[id] = y;
    if (pending.current === id) {
      // Deep link (`?tab=feel`): land on the section once it has a position.
      pending.current = null;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: false }));
    }
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const endReached = contentOffset.y + layoutMeasurement.height >= contentSize.height - 24;
    const next = activeTabForOffset(anchors.current, contentOffset.y, { endReached });
    setTab((prev) => (prev === next ? prev : next));
  };

  const painOf = (type: CyclePainType) => form.painEntries.find((e) => e.type === type)?.severity ?? null;
  const tapPain = (type: CyclePainType) => {
    const next = nextPainSeverity(painOf(type) as CyclePainSeverity | null);
    const rest = form.painEntries.filter((e) => e.type !== type);
    onChange({ painEntries: next ? [...rest, { type, severity: next }] : rest });
  };

  const symptomGroup = (group: SymptomGroupId, title: string, hint?: string) => (
    <Group key={group} title={title} hint={hint}>
      <CycleIconRow
        items={symptomTiles(group)}
        visible={FULL_LOG_VISIBLE}
        gap={0}
        isSelected={({ id }) => form.symptoms.includes(id)}
        renderTile={({ id, label }) => (
          <CycleIconTile
            glyph={cycleGlyphFor('symptom', id)}
            label={label}
            selected={form.symptoms.includes(id)}
            onPress={() => onChange(applySymptomChipToggle(form, id))}
          />
        )}
      />
    </Group>
  );

  const testTiles = (value: string | null, onPick: (next: string | null) => void, group: 'fertility' | 'bleeding') => (
    <View style={s.tiles}>
      {CYCLE_TEST_OPTIONS.map((opt) => {
        const look = testTileLook(opt.id);
        return (
          <CycleIconTile
            key={opt.id}
            role="radio"
            group={group}
            glyph={look.glyph}
            glyphOpacity={look.opacity}
            label={opt.label}
            selected={value === opt.id}
            onPress={() => onPick(value === opt.id ? null : opt.id)}
          />
        );
      })}
    </View>
  );

  const privateLogged = hasPrivateContent(form);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.header}>
        <Text style={[s.eyebrow, { color: c.muted }]}>{ka.cycle.logHeroEyebrow}</Text>
        <Text style={[s.date, { color: c.ink }]}>{formatCycleDateKa(date)}</Text>

        <View style={[s.tabBar, { backgroundColor: c.cardSoft }]} accessibilityRole="tablist">
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
                onPress={() => jumpTo(t.id)}
                style={[s.tab, { backgroundColor: active ? c.card : 'transparent' }]}
              >
                <Icon size={16} color={active ? c.brand : c.muted} strokeWidth={2.2} />
                <Text
                  numberOfLines={1}
                  style={[
                    s.tabLabel,
                    { color: active ? c.ink : c.muted, fontFamily: active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium' },
                  ]}
                >
                  {t.label}
                </Text>
                {tabHasContent(t.id, form) ? <View style={[s.tabDot, { backgroundColor: c.cta }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ChatFormScroll
        ref={scrollRef}
        onScroll={onScroll}
        contentContainerStyle={[s.list, { paddingBottom: bottomInset + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View onLayout={onAnchor('flow')} style={s.anchor}>
          <Group title={tx('სისხლდენა', 'Bleeding')} hint={ka.cycle.logFlowHint}>
            <View style={s.tiles}>
              {flowTiles().map((opt) => {
                const look = flowGlyphStyle(opt.id);
                return (
                  <CycleIconTile
                    key={opt.id}
                    role="radio"
                    group="bleeding"
                    glyph={cycleGlyphFor('flow', opt.id)}
                    label={opt.label}
                    selected={form.flow === opt.id}
                    glyphScale={look.scale}
                    glyphOpacity={look.opacity}
                    hollow={look.hollow}
                    onPress={() => onChange({ flow: form.flow === opt.id ? null : opt.id })}
                  />
                );
              })}
            </View>
          </Group>
        </View>

        <View onLayout={onAnchor('feel')} style={s.anchor}>
          {assessmentKeys.length ? (
            <View style={[s.card, s.cardText, { backgroundColor: c.card }]}>
              <CycleObservationAssessment keys={assessmentKeys} form={form} onChange={onChange} ready />
            </View>
          ) : null}

          <Group title={ka.cycle.pain} hint={tx('ხელახალი შეხება — ინტენსივობა', 'tap again for strength')}>
            <CycleIconRow
              items={PAIN_TYPES.map((id) => ({ id }))}
              visible={FULL_LOG_VISIBLE}
              gap={0}
              isSelected={({ id }) => painOf(id) != null}
              renderTile={({ id }) => (
                <CycleIconTile
                  glyph={cycleGlyphFor('pain', id)}
                  label={painTypeLabel(id)}
                  selected={painOf(id) != null}
                  level={painLevel(painOf(id))}
                  onPress={() => tapPain(id)}
                  accessibilityHint={tx('ხელახალი შეხება ინტენსივობას ცვლის', 'Tap again to change the strength')}
                />
              )}
            />
          </Group>

          <Group title={ka.cycle.trackGroup.mood} hint={ka.cycle.logMoodHint}>
            <CycleIconRow
              items={moodTiles()}
              visible={FULL_LOG_VISIBLE}
              gap={0}
              isSelected={({ id }) => form.moods.includes(id)}
              renderTile={({ id, label }) => (
                <CycleIconTile
                  glyph={cycleGlyphFor('mood', id)}
                  label={label}
                  selected={form.moods.includes(id)}
                  onPress={() => onChange({ moods: toggle(form.moods, id) })}
                />
              )}
            />
          </Group>

          {symptomGroup('physical', ka.cycle.trackGroup.physical, ka.cycle.logSymHint)}
          {symptomGroup('digestion', ka.cycle.trackGroup.digestion)}
          {symptomGroup('skin', ka.cycle.trackGroup.skin)}
          {symptomGroup('energy', ka.cycle.trackGroup.energy, tx('დონე — ცხოვრების წესში', 'the level sits under lifestyle'))}
        </View>

        <View onLayout={onAnchor('more')} style={s.anchor}>
          {showFertility ? (
            <Group title={ka.cycle.trackGroup.fertility} note={ka.cycle.fertilityGroupHint}>
              <Text style={[s.sub, { color: c.ink }]}>{ka.cycle.ovulationTest}</Text>
              {testTiles(form.ovulationTest, (ovulationTest) => onChange({ ovulationTest }), 'fertility')}

              <Text style={[s.sub, s.subGap, { color: c.ink }]}>{ka.cycle.bbt}</Text>
              <View style={s.bbtRow}>
                <TextInput
                  value={form.bbt}
                  accessibilityLabel={ka.cycle.bbt}
                  onChangeText={(bbt) => onChange({ bbt })}
                  keyboardType="decimal-pad"
                  placeholder="36.6"
                  placeholderTextColor={c.mutedSoft}
                  style={[s.bbtInput, { backgroundColor: c.cardSoft, color: c.ink }]}
                />
                <Text style={[s.bbtUnit, { color: c.muted }]}>°C</Text>
              </View>

              <Text style={[s.sub, s.subGap, { color: c.ink }]}>{ka.cycle.mucus}</Text>
              <View style={s.tiles}>
                {mucusTiles().map((opt, i) => (
                  <CycleIconTile
                    key={opt.id}
                    role="radio"
                    group="fertility"
                    glyph={cycleGlyphFor('mucus', opt.id)}
                    label={opt.label}
                    selected={form.mucus === opt.id}
                    glyphScale={0.7 + i * 0.08}
                    glyphOpacity={0.6 + i * 0.1}
                    onPress={() => onChange({ mucus: form.mucus === opt.id ? null : opt.id })}
                  />
                ))}
              </View>

              {caps.showPregnancyTestLog ? (
                <>
                  <Text style={[s.sub, s.subGap, { color: c.ink }]}>{ka.cycle.pregnancyTest}</Text>
                  {testTiles(form.pregnancyTest, (pregnancyTest) => onChange({ pregnancyTest }), 'bleeding')}
                </>
              ) : null}
            </Group>
          ) : showPregnancyTestOnly ? (
            <Group title={ka.cycle.pregnancyTest} note={ka.cycle.pregnancyTestNotMode}>
              {testTiles(form.pregnancyTest, (pregnancyTest) => onChange({ pregnancyTest }), 'bleeding')}
            </Group>
          ) : null}

          {/* Private: sex, sex drive and the two intimate symptoms sit behind a lock row. It never
              unfolds by itself — a logged day only says „აღრიცხულია“ until the person opens it. */}
          <View style={s.group}>
            <View style={s.groupHead}>
              <Text accessibilityRole="header" style={[s.groupTitle, { color: c.ink }]}>
                {ka.cycle.trackGroup.private}
              </Text>
            </View>
            <View style={[s.card, { backgroundColor: c.card }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: privateOpen }}
                accessibilityLabel={`${ka.cycle.sexSectionTitle}. ${ka.cycle.privateGroupHint}`}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setPrivateOpen((v) => !v);
                }}
                style={s.lockRow}
              >
                <View style={[s.lockIcon, { backgroundColor: c.periodSoft }]}>
                  <Lock size={16} color={c.period} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.lockTitle, { color: c.ink }]}>
                    {tx('სექსი, ლიბიდო და ინტიმური ნიშნები', 'Sex, sex drive and intimate symptoms')}
                    {privateLogged ? <Text style={{ color: c.period }}>{` · ${tx('აღრიცხულია', 'logged')}`}</Text> : null}
                  </Text>
                  <Text numberOfLines={2} style={[s.lockHint, { color: c.mutedSoft }]}>
                    {ka.cycle.privateGroupHint}
                  </Text>
                </View>
                {privateOpen ? <ChevronDown size={18} color={c.muted} /> : <ChevronRight size={18} color={c.muted} />}
              </Pressable>
              {privateOpen ? (
                <View style={s.lockBody}>
                  <View style={s.tiles}>
                    {symptomTiles('private').map(({ id, label }) => (
                      <CycleIconTile
                        key={id}
                        glyph={cycleGlyphFor('symptom', id)}
                        label={label}
                        selected={form.symptoms.includes(id)}
                        onPress={() => onChange(applySymptomChipToggle(form, id))}
                      />
                    ))}
                  </View>
                  <View style={s.lockSex}>
                    <CycleSexSection form={form} onChange={onChange} hideHeading hidePrivacyHint />
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          <Group title={ka.cycle.lifestyle} text>
            <CycleLifestyleFields
              sleepQuality={form.sleepQuality}
              stressLevel={form.stressLevel}
              exerciseLevel={form.exerciseLevel}
              caffeine={form.caffeine}
              alcohol={form.alcohol}
              energy={form.energy}
              onChange={onChange}
            />
          </Group>

          <Group title={ka.cycle.customTags} text>
            <CycleTagPicker
              tags={customTags}
              selectedIds={form.customTagIds}
              onChange={(customTagIds) => onChange({ customTagIds })}
              onCreate={onCreateTag}
              creating={creatingTag}
            />
          </Group>

          <Group title={ka.cycle.journalTitle} note={ka.cycle.logNotesHint} text>
            <CycleJournalField value={form.notes} onChange={(notes) => onChange({ notes })} />
          </Group>
        </View>
      </ChatFormScroll>
    </View>
  );
}

/** Title outside, flat card inside (hub grammar). `text` cards pad for prose; tile cards hug five tiles. */
function Group({
  title,
  hint,
  note,
  text = false,
  children,
}: {
  title: string;
  hint?: string;
  note?: string;
  text?: boolean;
  children: React.ReactNode;
}) {
  const c = useCycleColors();
  return (
    <View style={s.group}>
      <View style={s.groupHead}>
        <Text accessibilityRole="header" style={[s.groupTitle, { color: c.ink }]}>
          {title}
        </Text>
        {hint ? (
          <Text numberOfLines={1} style={[s.groupHint, { color: c.mutedSoft }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      {note ? <Text style={[s.groupNote, { color: c.muted }]}>{note}</Text> : null}
      <View style={[s.card, text ? s.cardText : s.cardTiles, { backgroundColor: c.card }]}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  eyebrow: { fontSize: 12, fontFamily: 'NotoSansGeorgian_600SemiBold' },
  date: { fontSize: 22, fontFamily: 'NotoSansGeorgian_700Bold', marginTop: 4, letterSpacing: -0.3 },
  tabBar: { flexDirection: 'row', marginTop: 14, borderRadius: 16, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12 },
  tabLabel: { fontSize: 11, marginTop: 4 },
  tabDot: { position: 'absolute', top: 6, right: 8, width: 7, height: 7, borderRadius: 4 },
  list: { paddingHorizontal: 16, paddingTop: 2 },
  anchor: { gap: 22, paddingBottom: 22 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, paddingHorizontal: 4 },
  groupTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 21 },
  groupHint: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, flexShrink: 1 },
  groupNote: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, paddingHorizontal: 4, marginTop: -4 },
  card: { borderRadius: 22 },
  cardTiles: { paddingVertical: 14, paddingHorizontal: 4 },
  cardText: { padding: 14 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 0, rowGap: 12 },
  sub: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 8, paddingHorizontal: 10 },
  subGap: { marginTop: 16 },
  bbtRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  bbtInput: { flex: 1, minHeight: 46, borderRadius: 14, paddingHorizontal: 14, fontSize: 17, fontFamily: 'NotoSansGeorgian_700Bold' },
  bbtUnit: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, minWidth: 28 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, minHeight: 60 },
  lockIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  lockHint: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 15 },
  lockBody: { paddingTop: 4, paddingBottom: 14, paddingHorizontal: 4 },
  lockSex: { paddingHorizontal: 10, marginTop: -4 },
});
