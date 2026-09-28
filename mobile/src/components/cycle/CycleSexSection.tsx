import React from 'react';
import { Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, Heart, Lock } from 'lucide-react-native';
import { CyclePressable } from './CyclePressable';
import { CycleLogSectionHeading } from './CycleVisualChoice';
import { SEX_ACTIVITY_OPTIONS, SEX_DRIVE_OPTIONS } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type SexForm = { sexual: boolean | null; sexTags: string[] };

const ACTIVITY_IDS = new Set(SEX_ACTIVITY_OPTIONS.map((o) => o.id));
const DRIVE_IDS = new Set(SEX_DRIVE_OPTIONS.map((o) => o.id));

/**
 * "Sex and sex drive" (Flo's first logging category), placed right after flow.
 * - "didn't have sex" = explicit no; any activity chip = yes; nothing tapped = not answered (nothing sent).
 * - Sex drive is a separate single answer and is kept whether or not anything happened.
 * Everything here is private: never sent to a partner, Medi or analytics (registry: HIGHLY_SENSITIVE).
 */
export function CycleSexSection({
  form,
  onChange,
  disabled,
}: {
  form: SexForm;
  onChange: (patch: Partial<SexForm>) => void;
  disabled?: boolean;
}) {
  const c = useCycleColors();
  const activity = form.sexTags.filter((id) => ACTIVITY_IDS.has(id));
  const drive = form.sexTags.find((id) => DRIVE_IDS.has(id)) ?? null;
  const driveTags = drive ? [drive] : [];

  const setNone = () => {
    if (form.sexual === false) onChange({ sexual: null });
    else onChange({ sexual: false, sexTags: driveTags });
  };
  const toggleActivity = (id: string) => {
    const next = activity.includes(id) ? activity.filter((x) => x !== id) : [...activity, id];
    onChange({ sexual: next.length ? true : null, sexTags: [...next, ...driveTags] });
  };
  const pickDrive = (id: string) => {
    onChange({ sexTags: [...activity, ...(drive === id ? [] : [id])] });
  };

  return (
    <View>
      <CycleLogSectionHeading icon={Heart}>{ka.cycle.sexSectionTitle}</CycleLogSectionHeading>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Lock size={12} color={c.mutedSoft} strokeWidth={2.2} />
        <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, flex: 1 }}>{ka.cycle.sexPrivateHint}</Text>
      </View>

      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 8, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
        {ka.cycle.sexActivityLabel}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pill label={ka.cycle.sexNone} selected={form.sexual === false} onPress={setNone} disabled={disabled} />
        {SEX_ACTIVITY_OPTIONS.map((opt) => (
          <Pill key={opt.id} label={opt.label} selected={activity.includes(opt.id)} onPress={() => toggleActivity(opt.id)} disabled={disabled} />
        ))}
      </View>

      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 14, marginBottom: 8, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
        {ka.cycle.sexDriveLabel}
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
        {SEX_DRIVE_OPTIONS.map((opt) => (
          <Pill key={opt.id} radio label={opt.label} selected={drive === opt.id} onPress={() => pickDrive(opt.id)} disabled={disabled} grow />
        ))}
      </View>
    </View>
  );
}

function Pill({
  label,
  selected,
  onPress,
  disabled,
  radio,
  grow,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  radio?: boolean;
  grow?: boolean;
}) {
  const c = useCycleColors();
  return (
    <CyclePressable
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={{
        flexGrow: grow ? 1 : 0,
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? c.brand : c.controlBorder,
        backgroundColor: selected ? c.accentSoft : c.card,
      }}
    >
      {selected ? <Check size={13} color={c.brand} strokeWidth={3} /> : null}
      <Text style={{ color: selected ? c.brand : c.ink, fontSize: 13, lineHeight: 18, fontFamily: selected ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium' }}>
        {label}
      </Text>
    </CyclePressable>
  );
}
