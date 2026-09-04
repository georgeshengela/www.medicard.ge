import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Copy } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useAssessment } from '@/constants/assessmentLayout';
import {
  MAX_ALLERGIES,
  allergyLabel,
  commonAllergies,
  hasAllergy,
  searchAllergies,
  type AllergyEntry,
} from '@/constants/allergyCatalog';
import { ka } from '@/i18n/ka';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

function CloseChipIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 32 32" fill="none">
      <Path
        d="M24.6262 5.95956C25.0168 5.56904 25.6498 5.56904 26.0403 5.95956C26.4307 6.35009 26.4308 6.98312 26.0403 7.37362L17.414 15.9999L26.0403 24.6262C26.4307 25.0168 26.4308 25.6498 26.0403 26.0403C25.6498 26.4308 25.0168 26.4307 24.6262 26.0403L15.9999 17.414L7.37362 26.0403C6.98312 26.4308 6.35009 26.4307 5.95956 26.0403C5.56904 25.6498 5.56904 25.0168 5.95956 24.6262L14.5859 15.9999L5.95956 7.37362C5.56904 6.9831 5.56904 6.35008 5.95956 5.95956C6.35008 5.56904 6.9831 5.56904 7.37362 5.95956L15.9999 14.5859L24.6262 5.95956Z"
        fill="#9CA3AF"
      />
    </Svg>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const ASSESSMENT = useAssessment();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: selected ? '#14B8A6' : ASSESSMENT.border,
        backgroundColor: selected ? ASSESSMENT.selectedSoft : ASSESSMENT.surface,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 13,
          lineHeight: 18,
          color: selected ? ASSESSMENT.textPrimary : ASSESSMENT.textSecondary,
        }}
      >
        {label}
      </Text>
      {selected ? (
        <View style={{ width: 12, height: 12 }}>
          <CloseChipIcon />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Figma 9217:164840 — tag composer,  n / 10 counter, common allergen chips. */
export function AllergyPicker({ value, onChange }: Props) {
  const ASSESSMENT = useAssessment();
  const [draft, setDraft] = useState('');
  const atCap = value.length >= MAX_ALLERGIES;
  const trimmed = draft.trim();
  const matches = useMemo(() => (trimmed ? searchAllergies(trimmed, 6) : []), [trimmed]);
  const common = useMemo(() => commonAllergies(), []);
  const canAddCustom = trimmed.length >= 2 && !hasAllergy(value, trimmed) && !atCap;
  const exactInCatalog = matches.some(
    (entry) => allergyLabel(entry).toLowerCase() === trimmed.toLowerCase(),
  );

  const add = (name: string) => {
    const label = name.trim();
    if (!label || hasAllergy(value, label) || value.length >= MAX_ALLERGIES) return;
    pickerSelectionTick();
    onChange([...value, label]);
    setDraft('');
    Keyboard.dismiss();
  };

  const addEntry = (entry: AllergyEntry) => add(allergyLabel(entry));

  const remove = (name: string) => {
    pickerSelectionTick();
    onChange(value.filter((item) => item !== name));
  };

  return (
    <View style={{ width: '100%', gap: 20 }}>
      <View
        style={{
          minHeight: 132,
          borderWidth: 1.5,
          borderColor: '#14B8A6',
          borderRadius: 16,
          backgroundColor: ASSESSMENT.surface,
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 10,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {value.map((name) => (
            <Chip key={name} label={name} selected onPress={() => remove(name)} />
          ))}
          {!atCap ? (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => {
                if (matches[0]) addEntry(matches[0]);
                else if (canAddCustom) add(trimmed);
              }}
              placeholder={value.length === 0 ? ka.assessment.allergyPlaceholder : undefined}
              placeholderTextColor={ASSESSMENT.muted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              style={{
                minWidth: 96,
                flexGrow: 1,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 16,
                lineHeight: 22,
                color: ASSESSMENT.textPrimary,
                paddingVertical: 6,
              }}
            />
          ) : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            marginTop: 12,
          }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 13,
              lineHeight: 18,
              color: ASSESSMENT.muted,
            }}
          >
            {ka.assessment.allergyCount(value.length, MAX_ALLERGIES)}
          </Text>
          <Copy size={14} color={ASSESSMENT.muted} strokeWidth={2} />
        </View>
      </View>

      {trimmed.length >= 1 ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: ASSESSMENT.border,
            borderRadius: 16,
            backgroundColor: ASSESSMENT.surface,
            overflow: 'hidden',
          }}
        >
          {canAddCustom && !exactInCatalog ? (
            <Pressable
              onPress={() => add(trimmed)}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: ASSESSMENT.rowLine }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 15,
                  lineHeight: 22,
                  color: '#14B8A6',
                }}
              >
                {ka.assessment.addAllergy(trimmed)}
              </Text>
            </Pressable>
          ) : null}
          {matches.map((entry) => {
            const label = allergyLabel(entry);
            const selected = hasAllergy(value, label);
            return (
              <Pressable
                key={entry.id}
                disabled={selected || atCap}
                onPress={() => addEntry(entry)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  opacity: selected || atCap ? 0.45 : 1,
                  borderBottomWidth: 1,
                  borderBottomColor: ASSESSMENT.rowLine,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_500Medium',
                    fontSize: 15,
                    lineHeight: 22,
                    color: ASSESSMENT.textPrimary,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
          {matches.length === 0 && !canAddCustom ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: ASSESSMENT.textSecondary,
                  textAlign: 'center',
                }}
              >
                {ka.assessment.allergySearchEmpty}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              lineHeight: 20,
              color: ASSESSMENT.textSecondary,
            }}
          >
            {ka.assessment.mostCommonAllergies}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {common.map((entry) => {
              const label = allergyLabel(entry);
              const selected = hasAllergy(value, label);
              return (
                <Chip
                  key={entry.id}
                  label={label}
                  selected={selected}
                  onPress={() => (selected ? remove(label) : addEntry(entry))}
                />
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
