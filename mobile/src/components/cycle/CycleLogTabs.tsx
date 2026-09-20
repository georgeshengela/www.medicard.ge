import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { ChatFormScroll } from '@/components/chat/ChatScreenShell';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  View} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { Check, ChevronRight, Droplets, Heart, Lock, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import {
  FLOW_OPTIONS,
  MOOD_OPTIONS,
  MUCUS_OPTIONS,
  PHYSICAL_SYMPTOMS,
  SEXUAL_OPTIONS,
} from '@/constants/cycle';
import { CycleTestResultRow } from '@/components/cycle/CycleTestResultRow';
import { CycleFlowPicker } from '@/components/cycle/CycleFlowPicker';
import {
  CycleJournalField,
  CycleLifestyleFields,
  CyclePainEditor,
  CycleTagPicker,
} from '@/components/cycle/CycleObservationFields';
import { CycleCard, CycleScalePicker, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { CycleObservationAssessment } from '@/components/cycle/CycleObservationAssessment';
import type { CycleCustomTag, CyclePainEntry } from '@/lib/api';
import { PAIN_MANAGED_SYMPTOM_IDS } from '@/lib/cycleObservations';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import {
  applySymptomChipToggle,
  PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS,
  PREGNANCY_DAILY_ASSESSMENT_KEYS,
} from '@/lib/cycleObservationAssessment';
import { ka } from '@/i18n/ka';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

type TabId = 'flow' | 'feel' | 'more';
type FeelPane = 'symptoms' | 'moods' | 'pain';

export type CycleLogForm = {
  flow: string | null;
  symptoms: string[];
  moods: string[];
  sexTags: string[];
  sexual: boolean;
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

/** Intensity 0–4 for flow dots visual */
const FLOW_LEVEL: Record<string, number> = {
  none: 0,
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
};

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function withAlpha(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
  const [tab, setTab] = useState<TabId>(initialTab ?? 'flow');
  const [feelPane, setFeelPane] = useState<FeelPane>('symptoms');
  const [symQuery, setSymQuery] = useState('');

  const caps = cycleModeCapabilities(mode);
  const showFertility = caps.showFertilityShortcuts;
  const showPregnancyTest = caps.showPregnancyTestLog;
  const assessmentKeys = caps.showPregnancyObservations
    ? PREGNANCY_DAILY_ASSESSMENT_KEYS
    : caps.showPerimenopauseTracking
      ? PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS
      : [];

  const tabDone: Record<TabId, boolean> = {
    flow: Boolean(form.flow),
    feel:
      form.symptoms.length > 0 ||
      form.moods.length > 0 ||
      form.painEntries.length > 0 ||
      Object.keys(form.observationAssessments || {}).length > 0,
    more:
      form.sexual ||
      form.libido != null ||
      form.notes.trim().length > 0 ||
      Boolean(form.bbt.trim()) ||
      Boolean(form.mucus) ||
      Boolean(form.ovulationTest) ||
      Boolean(form.pregnancyTest) ||
      Boolean(form.sleepQuality) ||
      Boolean(form.stressLevel) ||
      Boolean(form.exerciseLevel) ||
      Boolean(form.caffeine) ||
      Boolean(form.alcohol) ||
      Boolean(form.energy) ||
      form.customTagIds.length > 0,
  };

  const filteredSymptoms = useMemo(() => {
    const q = symQuery.trim().toLowerCase();
    const catalog = PHYSICAL_SYMPTOMS.filter((o) => !PAIN_MANAGED_SYMPTOM_IDS.has(o.id));
    if (!q) return catalog;
    return catalog.filter((o) => o.label.toLowerCase().includes(q));
  }, [symQuery]);

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const goNext = () => {
    if (tabIndex < TABS.length - 1) {
      Haptics.selectionAsync().catch(() => undefined);
      setTab(TABS[tabIndex + 1].id);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text
          style={{
            color: c.muted,
            fontSize: 12,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
          }}
        >
          {ka.cycle.logHeroEyebrow}
        </Text>
        <Text
          style={{
            color: c.ink,
            fontSize: 22,
            fontFamily: 'NotoSansGeorgian_700Bold',
            marginTop: 4,
            letterSpacing: -0.3,
          }}
        >
          {formatCycleDateKa(date)}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            marginTop: 16,
            backgroundColor: c.cardSoft,
            borderRadius: 16,
            padding: 4,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setTab(t.id);
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: active ? c.card : 'transparent',
                }}
              >
                <Icon size={16} color={active ? c.brand : c.muted} strokeWidth={2.2} />
                <Text
                  style={{
                    color: active ? c.ink : c.muted,
                    fontFamily: active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
                    fontSize: 11,
                    marginTop: 4,
                  }}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
                {tabDone[t.id] ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: c.cta,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <ChatFormScroll
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === 'flow' ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)}>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 17,
                marginBottom: 6,
              }}
            >
              {ka.cycle.flow}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
              {ka.cycle.logFlowHint}
            </Text>
            <CycleFlowPicker
              value={form.flow}
              onChange={(id) => onChange({ flow: id === form.flow ? null : id })}
            />
          </Animated.View>
        ) : null}

        {tab === 'feel' ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)}>
            {assessmentKeys.length ? (
              <CycleObservationAssessment keys={assessmentKeys} form={form} onChange={onChange} ready />
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                marginBottom: 16,
                backgroundColor: c.cardSoft,
                borderRadius: 24,
                padding: 4,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              {(
                [
                  { id: 'symptoms' as FeelPane, label: ka.cycle.symptoms, count: form.symptoms.length },
                  { id: 'moods' as FeelPane, label: ka.cycle.moods, count: form.moods.length },
                  { id: 'pain' as FeelPane, label: ka.cycle.pain, count: form.painEntries.length },
                ] as const
              ).map((pane) => {
                const active = feelPane === pane.id;
                return (
                  <Pressable
                    key={pane.id}
                    accessibilityRole="tab"
                    accessibilityLabel={pane.label}
                    accessibilityState={{ selected: active }}
                    onPress={() => setFeelPane(pane.id)}
                    style={{
                      flex: 1,
                      paddingVertical: 11,
                      borderRadius: 20,
                      alignItems: 'center',
                      backgroundColor: active ? c.card : 'transparent',
                    }}
                  >
                    <Text style={{ color: active ? c.ink : c.muted, fontWeight: '800', fontSize: 13 }}>
                      {pane.label}
                      {pane.count > 0 ? ` · ${pane.count}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {feelPane === 'pain' ? (
              <CyclePainEditor
                entries={form.painEntries}
                onChange={(painEntries) => onChange({ painEntries })}
              />
            ) : feelPane === 'symptoms' ? (
              <>
                <TextInput
                  value={symQuery}
                  accessibilityLabel="სიმპტომების ძებნა"
                  onChangeText={setSymQuery}
                  placeholder="ძებნა…"
                  placeholderTextColor={c.mutedSoft}
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    color: c.ink,
                    fontSize: 15,
                    borderWidth: 1.5,
                    borderColor: c.controlBorder,
                    marginBottom: 12,
                  }}
                />
                <ToggleList
                  options={filteredSymptoms}
                  selected={form.symptoms}
                  onToggle={(id) => onChange(applySymptomChipToggle(form, id))}
                  accent={c.brand}
                />
              </>
            ) : (
              <ToggleList
                options={MOOD_OPTIONS}
                selected={form.moods}
                onToggle={(id) => onChange({ moods: toggle(form.moods, id) })}
                accent={c.lavender}
              />
            )}
          </Animated.View>
        ) : null}

        {tab === 'more' ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(160)}>
            <Block title={ka.cycle.lifestyle}>
              <CycleLifestyleFields
                sleepQuality={form.sleepQuality}
                stressLevel={form.stressLevel}
                exerciseLevel={form.exerciseLevel}
                caffeine={form.caffeine}
                alcohol={form.alcohol}
                energy={form.energy}
                onChange={onChange}
              />
            </Block>

            <Block title={ka.cycle.customTags}>
              <CycleTagPicker
                tags={customTags}
                selectedIds={form.customTagIds}
                onChange={(customTagIds) => onChange({ customTagIds })}
                onCreate={onCreateTag}
                creating={creatingTag}
              />
            </Block>

            <Block title={ka.cycle.journalTitle} hint={ka.cycle.logNotesHint}>
              <CycleJournalField value={form.notes} onChange={(notes) => onChange({ notes })} />
            </Block>

            {/* §7.4 — private grouping: sensitive fields never sit among
                generic shortcuts. Presentation only; storage is unchanged. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
                marginBottom: 4,
              }}
            >
              <Lock size={15} color={c.muted} strokeWidth={2.2} />
              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 15,
                  marginLeft: 8,
                }}
              >
                {ka.cycle.privateSection}
              </Text>
            </View>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 14 }}>
              {ka.cycle.privateSectionHint}
            </Text>

            <Block title={ka.cycle.sexual} hint={ka.cycle.logSexHint}>
              <View style={{ flexDirection: 'row', marginHorizontal: -5, marginBottom: form.sexual ? 12 : 0 }}>
                {[
                  { val: false, label: ka.cycle.logNo },
                  { val: true, label: ka.cycle.logYes },
                ].map((opt) => {
                  const active = form.sexual === opt.val;
                  return (
                    <View key={String(opt.val)} style={{ flex: 1, marginHorizontal: 5 }}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityLabel={opt.label}
                        accessibilityState={{ checked: active }}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => undefined);
                          onChange({ sexual: opt.val, sexTags: opt.val ? form.sexTags : [] });
                        }}
                        style={{
                          minHeight: 52,
                          borderRadius: 24,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: active ? c.cta : c.cardSoft,
                          borderWidth: active ? 0 : 1.5,
                          borderColor: c.border,
                        }}
                      >
                        <Text style={{ color: active ? c.onPrimary : c.ink, fontWeight: '800' }}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              {form.sexual ? (
                <ToggleList
                  options={SEXUAL_OPTIONS}
                  selected={form.sexTags}
                  onToggle={(id) => onChange({ sexTags: toggle(form.sexTags, id) })}
                  accent={c.blushDeep}
                />
              ) : null}
            </Block>

            <Block title={ka.cycle.libido} hint={ka.cycle.logLibidoHint}>
              <CycleScalePicker
                value={form.libido}
                onChange={(n) => onChange({ libido: n })}
                accent={c.rose}
              />
            </Block>

            {showFertility ? (
              <>
                <Block title={ka.cycle.fertilityTests} hint={ka.cycle.fertilityTestsHint}>
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      marginBottom: 6,
                    }}
                  >
                    {ka.cycle.ovulationTest}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginBottom: 10 }}>
                    {ka.cycle.ovulationTestHint}
                  </Text>
                  <CycleTestResultRow
                    value={form.ovulationTest}
                    onChange={(ovulationTest) => onChange({ ovulationTest })}
                    accent={c.fertile}
                  />
                  <View style={{ height: 16 }} />
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      marginBottom: 6,
                    }}
                  >
                    {ka.cycle.pregnancyTest}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginBottom: 10 }}>
                    {ka.cycle.pregnancyTestHint}
                  </Text>
                  <CycleTestResultRow
                    value={form.pregnancyTest}
                    onChange={(pregnancyTest) => onChange({ pregnancyTest })}
                    accent={c.rose}
                  />
                </Block>
                <Block title={ka.cycle.bbt} hint="°C">
                  <TextInput
                    value={form.bbt}
                    accessibilityLabel={ka.cycle.bbt}
                    onChangeText={(bbt) => onChange({ bbt })}
                    keyboardType="decimal-pad"
                    placeholder="36.5"
                    placeholderTextColor={c.mutedSoft}
                    style={{
                      backgroundColor: c.cardSoft,
                      borderRadius: 24,
                      paddingVertical: 16,
                      paddingHorizontal: 18,
                      color: c.ink,
                      fontSize: 20,
                      fontWeight: '800',
                      borderWidth: 1.5,
                      borderColor: c.controlBorder,
                    }}
                  />
                </Block>
                <Block title={ka.cycle.mucus} hint={ka.cycle.mucusHint}>
                  <MucusRow
                    value={form.mucus}
                    onChange={(mucus) => onChange({ mucus })}
                    accent={c.fertile}
                  />
                </Block>
              </>
            ) : showPregnancyTest ? (
              <Block title={ka.cycle.pregnancyTest} hint={ka.cycle.pregnancyTestNotMode}>
                <CycleTestResultRow
                  value={form.pregnancyTest}
                  onChange={(pregnancyTest) => onChange({ pregnancyTest })}
                  accent={c.rose}
                />
              </Block>
            ) : null}
          </Animated.View>
        ) : null}
      </ChatFormScroll>

      {tabIndex < TABS.length - 1 ? (
        <View style={{ position: 'absolute', right: 20, bottom: bottomInset + 76 }}>
          <Pressable
            onPress={goNext}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.logNext}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.card,
              borderRadius: 999,
              minHeight: 44,
              paddingVertical: 12,
              paddingHorizontal: 18,
              borderWidth: 1.5,
              borderColor: c.border,
              ...cycleShadow.card,
            }}
          >
            <Text
              style={{
                color: c.brand,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 14,
                marginRight: 4,
              }}
            >
              {ka.cycle.logNext}
            </Text>
            <ChevronRight size={16} color={c.brand} strokeWidth={2.6} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const c = useCycleColors();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 16,
          marginBottom: hint ? 4 : 10,
        }}
      >
        {title}
      </Text>
      {hint ? (
        <Text style={{ color: c.muted, fontSize: 12, marginBottom: 10, lineHeight: 16 }}>{hint}</Text>
      ) : null}
      <CycleCard padded={false} style={{ padding: 12 }}>
        {children}
      </CycleCard>
    </View>
  );
}

/** 5-column flow intensity — equal width, dots show level. */
function FlowMeter({
  value,
  onChange,
  accent,
}: {
  value: string | null;
  onChange: (id: string) => void;
  accent: string;
}) {
  const c = useCycleColors();
  return (
    <CycleCard padded={false} style={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
        {FLOW_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          const level = FLOW_LEVEL[opt.id] ?? 0;
          return (
            <View key={opt.id} style={{ flex: 1, marginHorizontal: 4, alignItems: 'center' }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  onChange(opt.id);
                }}
                style={{
                  width: '100%',
                  borderRadius: 20,
                  paddingVertical: 14,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  backgroundColor: selected ? accent : c.cardSoft,
                  borderWidth: selected ? 0 : 1.5,
                  borderColor: c.border,
                  minHeight: 88,
                  justifyContent: 'center',
                  ...(selected ? cycleShadow.soft : {}),
                }}
              >
                <View style={{ height: 40, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {level === 0 ? (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        borderWidth: 2,
                        borderColor: selected ? c.onPrimary : c.mutedSoft,
                      }}
                    />
                  ) : (
                    Array.from({ length: level }).map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: selected ? c.onPrimary : accent,
                          opacity: selected ? 1 : 0.35 + i * 0.15,
                          marginBottom: 3,
                        }}
                      />
                    ))
                  )}
                </View>
              </Pressable>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 9,
                  fontWeight: selected ? '800' : '600',
                  color: selected ? accent : c.muted,
                  textAlign: 'center',
                  lineHeight: 12,
                }}
                numberOfLines={2}
              >
                {opt.label}
              </Text>
            </View>
          );
        })}
      </View>
    </CycleCard>
  );
}

/** iOS-style toggle rows — label left, check circle right. */
function ToggleList({
  options,
  selected,
  onToggle,
  accent,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  accent: string;
}) {
  const c = useCycleColors();
  if (!options.length) {
    return (
      <Text style={{ color: c.muted, textAlign: 'center', paddingVertical: 20, fontWeight: '600' }}>
        {ka.cycle.logNoResults}
      </Text>
    );
  }
  return (
    <View
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: c.border,
        backgroundColor: c.card,
      }}
    >
      {options.map((opt, idx) => {
        const on = selected.includes(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onToggle(opt.id);
            }}
            accessibilityRole="checkbox"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: on }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              minHeight: 48,
              backgroundColor: on ? withAlpha(accent, 0.1) : c.card,
              borderBottomWidth: idx < options.length - 1 ? 1 : 0,
              borderBottomColor: c.border,
            }}
          >
            <Text
              style={{
                flex: 1,
                color: c.ink,
                fontWeight: on ? '600' : '500',
                fontSize: 13,
                paddingRight: 12,
              }}
            >
              {opt.label}
            </Text>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? c.cta : 'transparent',
                borderWidth: on ? 0 : 2,
                borderColor: c.mutedSoft,
              }}
            >
              {on ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal scroll chips for mucus — single select. */
function MucusRow({
  value,
  onChange,
  accent,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  accent: string;
}) {
  const c = useCycleColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
        {MUCUS_OPTIONS.map((opt, i) => {
          const on = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityState={{ checked: on }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                onChange(on ? null : opt.id);
              }}
              style={{
                marginRight: i < MUCUS_OPTIONS.length - 1 ? 8 : 0,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 24,
                minHeight: 44,
                backgroundColor: on ? c.accentSoft : c.cardSoft,
                borderWidth: 1,
                borderColor: on ? accent : c.controlBorder,
              }}
            >
              <Text style={{ color: c.ink, fontWeight: on ? '600' : '500', fontSize: 13 }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
