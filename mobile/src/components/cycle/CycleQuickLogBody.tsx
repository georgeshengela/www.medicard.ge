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
 * Every option is a `CycleIconTile`. „ბოლოს აღნიშნული“ and „იგივე, რაც გუშინ“ sit on top; the
 * copy never touches private or fertility fields (`cycleQuickLogCopy`).
 */
export function CycleQuickLogBody({
  form,
  onChange,
  disabled,
  date,
  logs,
  showFertility,
}: {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  disabled: boolean;
  date: string;
  logs: CycleLog[];
  showFertility: boolean;
}) {
  const c = useCycleColors();
  const [sexOpen, setSexOpen] = useState(form.sexual === true);
  const [allFine, setAllFine] = useState(false);

  const yesterday = useMemo(() => {
    const log = logs.find((l) => l.date === addDaysKey(date, -1));
    return log ? formFromCycleLog(log) : null;
  }, [logs, date]);
  const offerYesterday = Boolean(yesterday && hasCopyableContent(yesterday) && formIsEmpty(form));
  const recents = useMemo(() => recentObservationKeys(logs, { limit: 6, minDays: 2 }), [logs]);

  const symptomPool = useMemo(() => {
    const ids = new Set<string>();
    for (const id of recents) if (chipGroup(id) && chipGroup(id) !== 'mood' && !PAIN_MANAGED_SYMPTOM_IDS.has(id)) ids.add(id);
    for (const id of DEFAULT_SYMPTOMS) ids.add(id);
    for (const id of form.symptoms) if (!PAIN_MANAGED_SYMPTOM_IDS.has(id)) ids.add(id);
    const lead = [...ids].slice(0, 5);
    const rest = PHYSICAL_SYMPTOMS.filter((o) => !lead.includes(o.id) && !PAIN_MANAGED_SYMPTOM_IDS.has(o.id) && !SENSITIVE_SHORTCUT_IDS.has(o.id)).map((o) => o.id);
    return [...lead, ...rest].map((id) => ({ id, label: PHYSICAL_SYMPTOMS.find((o) => o.id === id)?.label ?? id }));
  }, [recents, form.symptoms]);

  const moods = useMemo(() => {
    const lead = QUICK_MOODS.concat(form.moods.filter((id) => !QUICK_MOODS.includes(id)));
    return [...lead, ...MOOD_OPTIONS.map((o) => o.id).filter((id) => !lead.includes(id))].map((id) => ({ id, label: MOOD_OPTIONS.find((o) => o.id === id)?.label ?? id }));
  }, [form.moods]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const painOf = (type: CyclePainType) => form.painEntries.find((e) => e.type === type)?.severity ?? null;
  const tapPain = (type: CyclePainType) => {
    const next = nextPainSeverity(painOf(type) as CyclePainSeverity | null);
    const rest = form.painEntries.filter((e) => e.type !== type);
    onChange({ painEntries: next ? [...rest, { type, severity: next }] : rest });
  };

  return (
    <View style={s.body}>
      {recents.length || offerYesterday ? (
        <Group title={tx('ბოლოს აღნიშნული', 'Logged recently')}>
          <View style={s.chips}>
            {offerYesterday && yesterday ? (
              <Chip
                dashed
                label={tx('იგივე, რაც გუშინ', 'Same as yesterday')}
                onPress={() => onChange(copyFromYesterday(yesterday))}
              />
            ) : null}
            {recents.map((id) => {
              const mood = chipGroup(id) === 'mood';
              const label = (mood ? MOOD_OPTIONS : PHYSICAL_SYMPTOMS).find((o) => o.id === id)?.label ?? id;
              const on = mood ? form.moods.includes(id) : form.symptoms.includes(id);
              return <Chip key={id} label={label} selected={on} onPress={() => onChange(mood ? { moods: toggle(form.moods, id) } : { symptoms: toggle(form.symptoms, id) })} />;
            })}
          </View>
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
          items={PAIN_TYPES.map((id) => ({ id }))}
          visible={4}
          renderTile={({ id }) => (
            <CycleIconTile
              glyph={cycleGlyphFor('pain', id)}
              label={painTypeLabel(id)}
              selected={painOf(id as CyclePainType) != null}
              level={painLevel(painOf(id as CyclePainType))}
              disabled={disabled}
              onPress={() => tapPain(id as CyclePainType)}
              accessibilityHint={tx('ხელახალი შეხება ინტენსივობას ცვლის', 'Tap again to change the strength')}
            />
          )}
        />
      </Group>

      <Group title={ka.cycle.moods}>
        <CycleIconRow
          items={moods}
          visible={4}
          renderTile={({ id, label }) => (
            <CycleIconTile glyph={cycleGlyphFor('mood', id)} label={label} selected={form.moods.includes(id)} disabled={disabled} onPress={() => onChange({ moods: toggle(form.moods, id) })} />
          )}
        />
      </Group>

      <Group title={ka.cycle.symptoms}>
        <CycleIconRow
          items={[{ id: ALL_FINE_ID, label: tx('ყველაფერი რიგზეა', 'Everything is fine') }, ...symptomPool]}
          visible={4}
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
                disabled={disabled}
                onPress={() => {
                  setAllFine(false);
                  onChange({ symptoms: toggle(form.symptoms, id) });
                }}
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

function Chip({ label, selected = false, dashed = false, onPress }: { label: string; selected?: boolean; dashed?: boolean; onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={[
        s.chip,
        { borderColor: selected ? c.ink : dashed ? c.controlBorder : c.border, backgroundColor: selected ? c.ink : c.card, borderStyle: dashed ? 'dashed' : 'solid' },
      ]}
    >
      <Text style={[s.chipText, { color: selected ? c.card : c.ink }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: { gap: 18 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  groupTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  groupHint: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  chipText: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  lockIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  lockHint: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 15 },
  sub: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 16, fontFamily: 'NotoSansGeorgian_700Bold' },
});
