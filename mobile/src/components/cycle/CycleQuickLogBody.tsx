import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronRight, Lock } from 'lucide-react-native';
import { CycleIconRow, CycleIconTile } from '@/components/cycle/CycleIconTile';
import { CycleMoreTracking } from '@/components/cycle/CycleMoreTracking';
import { CycleSexSection } from '@/components/cycle/CycleSexSection';
import { CycleTestResultRow } from '@/components/cycle/CycleTestResultRow';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { FLOW_OPTIONS, MOOD_OPTIONS, MUCUS_OPTIONS, PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleLog, CyclePainSeverity, CyclePainType } from '@/lib/api';
import { expectationTileHint, expectedIds, type CycleExpectation } from '@/lib/cycleExpectations';
import { ALL_FINE_ID, cycleGlyphFor, flowGlyphStyle } from '@/lib/cycleIconMap';
import { formFromCycleLog } from '@/lib/cycleLogSave';
import { PAIN_MANAGED_SYMPTOM_IDS, PAIN_TYPES, painTypeLabel } from '@/lib/cycleObservations';
import { chipGroup, recentObservationKeys, SENSITIVE_SHORTCUT_IDS } from '@/lib/cycleObservationRegistry';
import { copyFromYesterday, formIsEmpty, hasCopyableContent, nextPainSeverity, painLevel } from '@/lib/cycleQuickLogCopy';
import { addDaysKey } from '@/lib/home/homeCycle';
import { useCycleColors } from '@/theme/cycle';

const DEFAULT_SYMPTOMS = ['bloating', 'fatigue', 'nausea'];
const QUICK_MOODS = ['calm', 'happy', 'energetic', 'sad', 'irritable', 'anxious'];

/**
 * The classic quick log (track period / trying to conceive), row by row — Flo's and Clue's order,
 * our grammar: bleeding (one choice) → sex & sex drive folded behind a lock row → pain (tap again
 * for strength) → mood → symptoms with „ყველაფერი რიგზეა“ first → fertility signs (TTC) → more.
 * Every option is a `CycleIconTile` — „ბოლოს აღნიშნული“ too, led by a dashed „იგივე, რაც გუშინ“ tile; the
 * copy never touches private or fertility fields (`cycleQuickLogCopy`). What the local expectation
 * engine (`cycleExpectations`) expects for this day leads its row as a dashed tile until tapped.
 */
export function CycleQuickLogBody({
  form,
  onChange,
  disabled,
  date,
  logs,
  showFertility,
  expected = [],
}: {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  disabled: boolean;
  date: string;
  logs: CycleLog[];
  showFertility: boolean;
  /** Expected for `date` (brief §9 item 11): shown first in their rows, dashed until confirmed. */
  expected?: CycleExpectation[];
}) {
  const c = useCycleColors();
  const [sexOpen, setSexOpen] = useState(form.sexual === true);
  const [allFine, setAllFine] = useState(false);
  const expectedPain = useMemo(() => expectedIds(expected, 'pain'), [expected]);
  const expectedMoods = useMemo(() => expectedIds(expected, 'mood'), [expected]);
  const expectedSymptoms = useMemo(() => expectedIds(expected, 'symptom'), [expected]);
  const hintFor = (kind: CycleExpectation['kind'], id: string) => {
    const item = expected.find((e) => e.kind === kind && e.id === id);
    return item ? expectationTileHint(item) : undefined;
  };

  const yesterday = useMemo(() => {
    const log = logs.find((l) => l.date === addDaysKey(date, -1));
    return log ? formFromCycleLog(log) : null;
  }, [logs, date]);
  const offerYesterday = Boolean(yesterday && hasCopyableContent(yesterday) && formIsEmpty(form));
  const recents = useMemo(() => recentObservationKeys(logs, { limit: 6, minDays: 2 }), [logs]);

  const symptomPool = useMemo(() => {
    const ids = new Set<string>(expectedSymptoms);
    for (const id of recents) if (chipGroup(id) && chipGroup(id) !== 'mood' && !PAIN_MANAGED_SYMPTOM_IDS.has(id)) ids.add(id);
    for (const id of DEFAULT_SYMPTOMS) ids.add(id);
    for (const id of form.symptoms) if (!PAIN_MANAGED_SYMPTOM_IDS.has(id)) ids.add(id);
    const lead = [...ids].slice(0, Math.max(5, expectedSymptoms.length));
    const rest = PHYSICAL_SYMPTOMS.filter((o) => !lead.includes(o.id) && !PAIN_MANAGED_SYMPTOM_IDS.has(o.id) && !SENSITIVE_SHORTCUT_IDS.has(o.id)).map((o) => o.id);
    return [...lead, ...rest].map((id) => ({ id, label: PHYSICAL_SYMPTOMS.find((o) => o.id === id)?.label ?? id }));
  }, [recents, form.symptoms, expectedSymptoms]);

  const moods = useMemo(() => {
    const lead = [...new Set([...expectedMoods, ...QUICK_MOODS, ...form.moods])];
    return [...lead, ...MOOD_OPTIONS.map((o) => o.id).filter((id) => !lead.includes(id))].map((id) => ({ id, label: MOOD_OPTIONS.find((o) => o.id === id)?.label ?? id }));
  }, [form.moods, expectedMoods]);

  const painTypes = useMemo(() => [...new Set([...expectedPain, ...PAIN_TYPES])] as CyclePainType[], [expectedPain]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  /** „ბოლოს აღნიშნული“: what she logged on ≥ 2 recent days (never private ids — `recentObservationKeys` filters them). */
  const recentTiles = useMemo(() => {
    const out: { id: string; label: string; kind: 'yesterday' | 'mood' | 'symptom' }[] = [];
    if (offerYesterday) out.push({ id: '__yesterday', label: tx('იგივე, რაც გუშინ', 'Same as yesterday'), kind: 'yesterday' });
    for (const id of recents.slice(0, 6)) {
      const mood = chipGroup(id) === 'mood';
      out.push({ id, kind: mood ? 'mood' : 'symptom', label: (mood ? MOOD_OPTIONS : PHYSICAL_SYMPTOMS).find((o) => o.id === id)?.label ?? id });
    }
    return out;
  }, [offerYesterday, recents]);
  const isRecentOn = (id: string) => (chipGroup(id) === 'mood' ? form.moods.includes(id) : form.symptoms.includes(id));
  const toggleRecent = (id: string) => {
    if (chipGroup(id) === 'mood') onChange({ moods: toggle(form.moods, id) });
    else {
      setAllFine(false);
      onChange({ symptoms: toggle(form.symptoms, id) });
    }
  };
  const painOf = (type: CyclePainType) => form.painEntries.find((e) => e.type === type)?.severity ?? null;
  const tapPain = (type: CyclePainType) => {
    const next = nextPainSeverity(painOf(type) as CyclePainSeverity | null);
    const rest = form.painEntries.filter((e) => e.type !== type);
    onChange({ painEntries: next ? [...rest, { type, severity: next }] : rest });
  };

  return (
    <View style={s.body}>
      {recentTiles.length ? (
        <Group title={tx('ბოლოს აღნიშნული', 'Logged recently')}>
          {/* Same tiles as every row below; „იგივე, რაც გუშინ“ leads as one dashed action tile. */}
          <CycleIconRow
            items={recentTiles}
            visible={4}
            isSelected={(item) => item.kind !== 'yesterday' && isRecentOn(item.id)}
            renderTile={(item) =>
              item.kind === 'yesterday' && yesterday ? (
                <CycleIconTile
                  role="button"
                  glyph="calendar"
                  label={item.label}
                  selected={false}
                  dashed
                  disabled={disabled}
                  onPress={() => onChange(copyFromYesterday(yesterday))}
                  accessibilityHint={tx('გუშინდელი სიმპტომები, განწყობა, ტკივილი და სისხლდენა დღევანდელ დღეზე', 'Copies yesterday’s symptoms, mood, pain and bleeding to today')}
                />
              ) : (
                <CycleIconTile
                  glyph={cycleGlyphFor(item.kind === 'mood' ? 'mood' : 'symptom', item.id)}
                  label={item.label}
                  selected={isRecentOn(item.id)}
                  disabled={disabled}
                  onPress={() => toggleRecent(item.id)}
                />
              )
            }
          />
        </Group>
      ) : null}

      <Group title={tx('სისხლდენა', 'Bleeding')} hint={tx('ერთი არჩევანი', 'one choice')}>
        <View style={s.row}>
          {FLOW_OPTIONS.map((opt) => {
            const style = flowGlyphStyle(opt.id);
            return (
              <CycleIconTile
                key={opt.id}
                role="radio"
                group="bleeding"
                glyph={cycleGlyphFor('flow', opt.id)}
                label={opt.label}
                selected={form.flow === opt.id}
                disabled={disabled}
                glyphScale={style.scale}
                glyphOpacity={style.opacity}
                hollow={style.hollow}
                onPress={() => onChange({ flow: form.flow === opt.id ? null : opt.id })}
              />
            );
          })}
        </View>
      </Group>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: sexOpen }}
        accessibilityLabel={`${ka.cycle.sexSectionTitle}. ${ka.cycle.sexPrivateHint}`}
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          setSexOpen((v) => !v);
        }}
        style={[s.lockRow, { backgroundColor: c.cardSoft }]}
      >
        <View style={[s.lockIcon, { backgroundColor: c.periodSoft }]}>
          <Lock size={16} color={c.period} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.lockTitle, { color: c.ink }]}>
            {ka.cycle.sexSectionTitle}
            {form.sexual === true ? <Text style={{ color: c.period }}>{` · ${tx('აღრიცხულია', 'logged')}`}</Text> : null}
          </Text>
          <Text numberOfLines={1} style={[s.lockHint, { color: c.mutedSoft }]}>
            {ka.cycle.sexPrivateHint}
          </Text>
        </View>
        {sexOpen ? <ChevronDown size={18} color={c.muted} /> : <ChevronRight size={18} color={c.muted} />}
      </Pressable>
      {sexOpen ? (
        <View style={{ marginTop: -6 }}>
          <CycleSexSection form={form} onChange={onChange} disabled={disabled} hideHeading />
        </View>
      ) : null}

      <Group title={ka.cycle.pain} hint={tx('ხელახალი შეხება — ინტენსივობა', 'tap again for strength')}>
        <CycleIconRow
          items={painTypes.map((id) => ({ id }))}
          visible={4}
          isSelected={({ id }) => painOf(id) != null}
          renderTile={({ id }) => (
            <CycleIconTile
              glyph={cycleGlyphFor('pain', id)}
              label={painTypeLabel(id)}
              selected={painOf(id) != null}
              level={painLevel(painOf(id))}
              dashed={expectedPain.includes(id)}
              disabled={disabled}
              onPress={() => tapPain(id)}
              accessibilityHint={hintFor('pain', id) ?? tx('ხელახალი შეხება ინტენსივობას ცვლის', 'Tap again to change the strength')}
            />
          )}
        />
      </Group>

      <Group title={ka.cycle.moods}>
        <CycleIconRow
          items={moods}
          visible={4}
          isSelected={({ id }) => form.moods.includes(id)}
          renderTile={({ id, label }) => (
            <CycleIconTile
              glyph={cycleGlyphFor('mood', id)}
              label={label}
              selected={form.moods.includes(id)}
              dashed={expectedMoods.includes(id)}
              disabled={disabled}
              onPress={() => onChange({ moods: toggle(form.moods, id) })}
              accessibilityHint={hintFor('mood', id)}
            />
          )}
        />
      </Group>

      <Group title={ka.cycle.symptoms}>
        <CycleIconRow
          items={[{ id: ALL_FINE_ID, label: tx('ყველაფერი რიგზეა', 'Everything is fine') }, ...symptomPool]}
          visible={4}
          isSelected={({ id }) => form.symptoms.includes(id)}
          renderTile={({ id, label }) =>
            id === ALL_FINE_ID ? (
              <CycleIconTile
                glyph="yes"
                group="fertility"
                label={label}
                selected={allFine && form.symptoms.length === 0}
                disabled={disabled}
                onPress={() => {
                  setAllFine((v) => !v);
                  onChange({ symptoms: [] });
                }}
              />
            ) : (
              <CycleIconTile
                glyph={cycleGlyphFor('symptom', id)}
                label={label}
                selected={form.symptoms.includes(id)}
                dashed={expectedSymptoms.includes(id)}
                disabled={disabled}
                onPress={() => {
                  setAllFine(false);
                  onChange({ symptoms: toggle(form.symptoms, id) });
                }}
                accessibilityHint={hintFor('symptom', id)}
              />
            )
          }
        />
      </Group>

      {showFertility ? (
        <Group title={ka.cycle.ttcQuickLogTitle} hint={tx('დაკვირვებაა, არა დიაგნოზი', 'observations, not a diagnosis')}>
          <Text style={[s.sub, { color: c.ink }]}>{ka.cycle.ovulationTest}</Text>
          <CycleTestResultRow value={form.ovulationTest} onChange={(ovulationTest) => onChange({ ovulationTest })} />
          <Text style={[s.sub, { color: c.ink, marginTop: 12 }]}>{ka.cycle.bbt}</Text>
          <TextInput
            value={form.bbt}
            onChangeText={(bbt) => onChange({ bbt })}
            keyboardType="decimal-pad"
            placeholder="36.6"
            placeholderTextColor={c.mutedSoft}
            accessibilityLabel={ka.cycle.bbt}
            style={[s.input, { borderColor: c.controlBorder, backgroundColor: c.cardSoft, color: c.ink }]}
          />
          <Text style={[s.sub, { color: c.ink, marginTop: 12 }]}>{ka.cycle.mucus}</Text>
          <View style={s.row}>
            {MUCUS_OPTIONS.map((opt, i) => (
              <CycleIconTile
                key={opt.id}
                role="radio"
                group="fertility"
                glyph={cycleGlyphFor('mucus', opt.id)}
                label={opt.label}
                selected={form.mucus === opt.id}
                glyphScale={0.7 + i * 0.08}
                glyphOpacity={0.6 + i * 0.1}
                disabled={disabled}
                onPress={() => onChange({ mucus: form.mucus === opt.id ? null : opt.id })}
              />
            ))}
          </View>
          <Text style={[s.sub, { color: c.ink, marginTop: 12 }]}>{ka.cycle.pregnancyTest}</Text>
          <CycleTestResultRow value={form.pregnancyTest} onChange={(pregnancyTest) => onChange({ pregnancyTest })} />
        </Group>
      ) : null}

      <View style={{ marginTop: 4 }}>
        <CycleMoreTracking form={form} onChange={onChange} compact />
      </View>
    </View>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
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
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  body: { gap: 18 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  groupTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  groupHint: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: 12 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  lockIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  lockHint: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 15 },
  sub: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 16, fontFamily: 'NotoSansGeorgian_700Bold' },
});
