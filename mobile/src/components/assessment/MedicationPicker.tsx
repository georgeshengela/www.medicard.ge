import React, { useMemo, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { ASSESSMENT } from '@/constants/assessmentLayout';
import {
  commonMedications,
  hasMedication,
  medicationLabel,
  searchMedications,
  type MedicationEntry,
} from '@/constants/medicationCatalog';
import { ka } from '@/i18n/ka';

const ICON = 24;
const CHEVRON = 20;
const FIELD_H = 56;

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

function PillBottleIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 2.75C9 2.33579 9.33579 2 9.75 2H14.25C14.6642 2 15 2.33579 15 2.75V4.5H16.5C17.7426 4.5 18.75 5.50736 18.75 6.75V19.5C18.75 20.7426 17.7426 21.75 16.5 21.75H7.5C6.25736 21.75 5.25 20.7426 5.25 19.5V6.75C5.25 5.50736 6.25736 4.5 7.5 4.5H9V2.75ZM10.5 4.5H13.5V3.5H10.5V4.5ZM7.5 6C7.08579 6 6.75 6.33579 6.75 6.75V19.5C6.75 19.9142 7.08579 20.25 7.5 20.25H16.5C16.9142 20.25 17.25 19.9142 17.25 19.5V6.75C17.25 6.33579 16.9142 6 16.5 6H7.5Z"
        fill="#9CA3AF"
      />
      <Path
        d="M8.75 10.5C8.75 10.0858 9.08579 9.75 9.5 9.75H14.5C14.9142 9.75 15.25 10.0858 15.25 10.5C15.25 10.9142 14.9142 11.25 14.5 11.25H9.5C9.08579 11.25 8.75 10.9142 8.75 10.5Z"
        fill="#9CA3AF"
      />
    </Svg>
  );
}

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
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: selected ? '#14B8A6' : ASSESSMENT.border,
        backgroundColor: selected ? '#F0FDFA' : '#FFFFFF',
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

/** Figma 9217:164803 — combobox, catalog search, custom add, most-common chips. */
export function MedicationPicker({ value, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => searchMedications(draft, 8), [draft]);
  const common = useMemo(() => commonMedications(), []);
  const trimmed = draft.trim();
  const canAddCustom = trimmed.length >= 2 && !hasMedication(value, trimmed);
  const exactInCatalog = matches.some(
    (entry) => medicationLabel(entry).toLowerCase() === trimmed.toLowerCase() || entry.inn.toLowerCase() === trimmed.toLowerCase(),
  );

  const add = (name: string) => {
    const label = name.trim();
    if (!label || hasMedication(value, label)) return;
    pickerSelectionTick();
    onChange([...value, label]);
    setDraft('');
    setOpen(false);
    Keyboard.dismiss();
  };

  const addEntry = (entry: MedicationEntry) => add(medicationLabel(entry));

  const remove = (name: string) => {
    pickerSelectionTick();
    onChange(value.filter((item) => item !== name));
  };

  return (
    <View style={{ width: '100%', gap: 20 }}>
      <View style={{ zIndex: 4 }}>
        <View
          style={{
            height: FIELD_H,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: open ? '#14B8A6' : ASSESSMENT.border,
            borderRadius: 16,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 16,
            gap: 12,
          }}
        >
          <View style={{ width: ICON, height: ICON }}>
            <PillBottleIcon />
          </View>
          <TextInput
            value={draft}
            onChangeText={(next) => {
              setDraft(next);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onSubmitEditing={() => {
              if (matches[0]) addEntry(matches[0]);
              else if (canAddCustom) add(trimmed);
            }}
            placeholder={ka.assessment.medPlaceholder}
            placeholderTextColor="#9CA3AF"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 22,
              color: ASSESSMENT.textPrimary,
              paddingVertical: 0,
            }}
          />
          <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8}>
            <ChevronDown size={CHEVRON} color="#9CA3AF" strokeWidth={2} />
          </Pressable>
        </View>

        {open ? (
          <View
            style={{
              marginTop: 6,
              maxHeight: 240,
              borderWidth: 1,
              borderColor: ASSESSMENT.border,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {canAddCustom && !exactInCatalog ? (
                <Pressable
                  onPress={() => add(trimmed)}
                  style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 15,
                      lineHeight: 22,
                      color: '#14B8A6',
                    }}
                  >
                    {ka.assessment.addMedication(trimmed)}
                  </Text>
                </Pressable>
              ) : null}
              {matches.map((entry) => {
                const selected = hasMedication(value, medicationLabel(entry));
                return (
                  <Pressable
                    key={entry.inn}
                    disabled={selected}
                    onPress={() => addEntry(entry)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      opacity: selected ? 0.45 : 1,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F3F4F6',
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
                      {entry.ka}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_400Regular',
                        fontSize: 13,
                        lineHeight: 18,
                        color: ASSESSMENT.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {entry.inn}
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
                    {ka.assessment.medSearchEmpty}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {value.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {value.map((name) => (
            <Chip key={name} label={name} selected onPress={() => remove(name)} />
          ))}
        </View>
      ) : null}

      <View style={{ alignItems: 'center', gap: 12 }}>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 14,
            lineHeight: 20,
            color: ASSESSMENT.textSecondary,
          }}
        >
          {ka.assessment.mostCommonMeds}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {common.map((entry) => {
            const label = medicationLabel(entry);
            const selected = hasMedication(value, label);
            return (
              <Chip
                key={entry.inn}
                label={label}
                selected={selected}
                onPress={() => (selected ? remove(label) : addEntry(entry))}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
