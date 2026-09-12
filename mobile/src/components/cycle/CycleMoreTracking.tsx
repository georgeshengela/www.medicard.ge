import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ChevronDown, ChevronRight, Lock, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CycleTestResultRow } from '@/components/cycle/CycleTestResultRow';
import { MUCUS_OPTIONS } from '@/constants/cycle';
import { chipsForGroup, ENERGY_LEVELS, type CycleUiGroup } from '@/lib/cycleObservationRegistry';
import { energyLabel, sleepLabel, SLEEP_QUALITIES, STRESS_LEVELS, stressLabel } from '@/lib/cycleObservations';
import { ka } from '@/i18n/ka';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { applySymptomChipToggle } from '@/lib/cycleObservationAssessment';
import { useCycleColors } from '@/theme/cycle';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';

const GROUPS: { id: CycleUiGroup; sensitive?: boolean }[] = [
  { id: 'physical' },
  { id: 'energy' },
  { id: 'mood' },
  { id: 'digestion' },
  { id: 'skin' },
  { id: 'fertility', sensitive: true },
  { id: 'private', sensitive: true },
];

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function groupTitle(id: CycleUiGroup): string {
  return ka.cycle.trackGroup[id];
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `${label}, ${ka.cycle.pregnancySelected}` : label}
      style={{
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 12,
        justifyContent: 'center',
        backgroundColor: selected ? c.cta : c.cardSoft,
        borderWidth: 1,
        borderColor: selected ? c.ink : c.border,
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {selected ? <Check size={14} color={c.white} strokeWidth={3} /> : null}
      <Text
        style={{
          color: selected ? c.white : c.ink,
          fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type Props = {
  form: CycleLogForm;
  onChange: (patch: Partial<CycleLogForm>) => void;
  compact?: boolean;
  mode?: string;
};

export function CycleMoreTracking({ form, onChange, compact, mode }: Props) {
  const c = useCycleColors();
  const caps = cycleModeCapabilities(mode);
  const groups = caps.showFertilityLogging ? GROUPS : GROUPS.filter((item) => item.id !== 'fertility');
  const [open, setOpen] = useState(!compact);
  const [group, setGroup] = useState<CycleUiGroup | null>(null);
  const [query, setQuery] = useState('');

  const chips = useMemo(() => (group ? chipsForGroup(group) : []), [group]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chips;
    return chips.filter((item) => item.label.toLowerCase().includes(q));
  }, [chips, query]);

  return (
    <View>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => undefined);
          setOpen((prev) => !prev);
          if (open) setGroup(null);
        }}
        accessibilityRole="button"
        accessibilityLabel={ka.cycle.moreTracking}
        accessibilityState={{ expanded: open }}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, flex: 1 }}>
          {ka.cycle.moreTracking}
        </Text>
        {open ? <ChevronDown size={18} color={c.ink} /> : <ChevronRight size={18} color={c.ink} />}
      </Pressable>
      {open ? (
        <View>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
            {ka.cycle.moreTrackingHint}
          </Text>
          {groups.map((item) => {
            const active = group === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setGroup(active ? null : item.id);
                  setQuery('');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={groupTitle(item.id)}
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: active ? c.cardSoft : 'transparent',
                  borderWidth: 1,
                  borderColor: item.sensitive ? c.border : c.border,
                }}
              >
                {item.sensitive ? (
                  <View style={{ marginRight: 8 }}>
                    <Lock size={14} color={c.muted} />
                  </View>
                ) : null}
                <Text
                  style={{
                    flex: 1,
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 14,
                  }}
                >
                  {groupTitle(item.id)}
                </Text>
                <ChevronRight size={16} color={c.muted} />
              </Pressable>
            );
          })}

          {pregnancy ? (
            <View style={{ marginTop: 8, marginBottom: 8 }}>
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, marginBottom: 8 }}>
                {ka.cycle.pregnancyTest}
              </Text>
              <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
                {ka.cycle.pregnancyTestNotMode}
              </Text>
              <CycleTestResultRow
                value={form.pregnancyTest}
                onChange={(pregnancyTest) => onChange({ pregnancyTest })}
                accent={c.rose}
              />
            </View>
          ) : null}

          {group ? (
            <View style={{ marginTop: 6 }}>
              {(chips.length > 8 || query) && group !== 'energy' && group !== 'fertility' ? (
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={ka.cycle.moreTrackingSearch}
                  placeholderTextColor={c.mutedSoft}
                  accessibilityLabel={ka.cycle.moreTrackingSearch}
                  style={{
                    minHeight: 44,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.cardSoft,
                    color: c.ink,
                    paddingHorizontal: 12,
                    marginBottom: 10,
                    fontSize: 14,
                  }}
                />
              ) : null}

              {group === 'energy' ? (
                <View>
                  <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, marginBottom: 8 }}>
                    {ka.cycle.energy}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {ENERGY_LEVELS.map((id) => (
                      <Chip
                        key={id}
                        label={energyLabel(id)}
                        selected={form.energy === id}
                        onPress={() => onChange({ energy: form.energy === id ? null : id })}
                      />
                    ))}
                  </View>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 12 }}>
                    {ka.cycle.energyVsFatigueHint}
                  </Text>
                  <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, marginBottom: 8 }}>
                    {ka.cycle.sleep}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {SLEEP_QUALITIES.map((id) => (
                      <Chip
                        key={id}
                        label={sleepLabel(id)}
                        selected={form.sleepQuality === id}
                        onPress={() => onChange({ sleepQuality: form.sleepQuality === id ? null : id })}
                      />
                    ))}
                  </View>
                  <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, marginBottom: 8 }}>
                    {ka.cycle.stress}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {STRESS_LEVELS.map((id) => (
                      <Chip
                        key={id}
                        label={stressLabel(id)}
                        selected={form.stressLevel === id}
                        onPress={() => onChange({ stressLevel: form.stressLevel === id ? null : id })}
                      />
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {filtered.map((opt) => (
                      <Chip
                        key={opt.id}
                        label={opt.label}
                        selected={form.symptoms.includes(opt.id)}
                        onPress={() => onChange(applySymptomChipToggle(form, opt.id))}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {group === 'fertility' ? (
                <View>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
                    {ka.cycle.fertilityGroupHint}
                  </Text>
                  <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, marginBottom: 8 }}>
                    {ka.cycle.ovulationTest}
                  </Text>
                  <CycleTestResultRow
                    value={form.ovulationTest}
                    onChange={(ovulationTest) => onChange({ ovulationTest })}
                    accent={c.fertile}
                  />
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    {ka.cycle.pregnancyTest}
                  </Text>
                  <CycleTestResultRow
                    value={form.pregnancyTest}
                    onChange={(pregnancyTest) => onChange({ pregnancyTest })}
                    accent={c.rose}
                  />
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    {ka.cycle.bbt}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      value={form.bbt}
                      onChangeText={(bbt) => onChange({ bbt })}
                      keyboardType="decimal-pad"
                      placeholder="36.5"
                      placeholderTextColor={c.mutedSoft}
                      accessibilityLabel={ka.cycle.bbt}
                      style={{
                        flex: 1,
                        minHeight: 44,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.border,
                        backgroundColor: c.cardSoft,
                        color: c.ink,
                        paddingHorizontal: 12,
                        fontSize: 16,
                        fontFamily: 'NotoSansGeorgian_700Bold',
                      }}
                    />
                    <Text
                      style={{
                        color: c.ink,
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 16,
                        minWidth: 36,
                      }}
                    >
                      °C
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: c.ink,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      marginTop: 14,
                      marginBottom: 8,
                    }}
                  >
                    {ka.cycle.mucus}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
                    {ka.cycle.mucusHint}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {MUCUS_OPTIONS.map((opt) => (
                      <Chip
                        key={opt.id}
                        label={opt.label}
                        selected={form.mucus === opt.id}
                        onPress={() => onChange({ mucus: form.mucus === opt.id ? null : opt.id })}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {group === 'private' ? (
                <View>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
                    {ka.cycle.privateGroupHint}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {[
                      { val: false, label: ka.cycle.logNo },
                      { val: true, label: ka.cycle.logYes },
                    ].map((opt) => (
                      <Chip
                        key={String(opt.val)}
                        label={opt.label}
                        selected={form.sexual === opt.val}
                        onPress={() => onChange({ sexual: opt.val, sexTags: opt.val ? form.sexTags : [] })}
                      />
                    ))}
                  </View>
                  {form.sexual ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {filtered
                        .filter((opt) => !['vaginal_dryness', 'itching_vulva'].includes(opt.id))
                        .map((opt) => (
                          <Chip
                            key={opt.id}
                            label={opt.label}
                            selected={form.sexTags.includes(opt.id)}
                            onPress={() => onChange({ sexTags: toggle(form.sexTags, opt.id) })}
                          />
                        ))}
                    </View>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {chipsForGroup('private')
                      .filter((opt) => ['vaginal_dryness', 'itching_vulva'].includes(opt.id))
                      .map((opt) => (
                        <Chip
                          key={opt.id}
                          label={opt.label}
                          selected={form.symptoms.includes(opt.id)}
                          onPress={() => onChange(applySymptomChipToggle(form, opt.id))}
                        />
                      ))}
                  </View>
                </View>
              ) : null}

              {group !== 'energy' && group !== 'fertility' && group !== 'private' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {filtered.map((opt) => {
                    const selected =
                      group === 'mood' ? form.moods.includes(opt.id) : form.symptoms.includes(opt.id);
                    return (
                      <Chip
                        key={opt.id}
                        label={opt.label}
                        selected={selected}
                        onPress={() =>
                          group === 'mood'
                            ? onChange({ moods: toggle(form.moods, opt.id) })
                            : onChange(applySymptomChipToggle(form, opt.id))
                        }
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
