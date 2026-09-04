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
import { useAssessment } from '@/constants/assessmentLayout';
import {
  commonConditions,
  conditionLabel,
  hasCondition,
  resolveConditionLabel,
  searchConditions,
  type ConditionEntry,
} from '@/constants/conditionCatalog';
import { ka } from '@/i18n/ka';

const ICON = 24;
const CHEVRON = 20;
const FIELD_H = 56;

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

function HeartPulseIcon() {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.25C11.7348 20.25 11.4805 20.1446 11.293 19.957L4.636 13.3C2.45467 11.1187 2.45467 7.63133 4.636 5.45C6.81733 3.26867 10.3047 3.26867 12.486 5.45L12 5.936L11.514 5.45C13.6953 3.26867 17.1827 3.26867 19.364 5.45C21.5453 7.63133 21.5453 11.1187 19.364 13.3L12.707 19.957C12.5195 20.1446 12.2652 20.25 12 20.25Z"
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
  const ASSESSMENT = useAssessment();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: selected ? ASSESSMENT.brand : ASSESSMENT.border,
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

/** Combobox + catalog search + custom add — same pattern as MedicationPicker. */
export function ConditionPicker({ value, onChange }: Props) {
  const ASSESSMENT = useAssessment();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => searchConditions(draft, 8), [draft]);
  const common = useMemo(() => commonConditions(), []);
  const trimmed = draft.trim();
  const canAddCustom = trimmed.length >= 2 && !hasCondition(value, trimmed);
  const exactInCatalog = matches.some(
    (entry) => conditionLabel(entry).toLowerCase() === trimmed.toLowerCase() || entry.id.toLowerCase() === trimmed.toLowerCase(),
  );

  const add = (name: string) => {
    const label = resolveConditionLabel(name.trim());
    if (!label || hasCondition(value, label)) return;
    pickerSelectionTick();
    onChange([...value, label]);
    setDraft('');
    setOpen(false);
    Keyboard.dismiss();
  };

  const addEntry = (entry: ConditionEntry) => add(conditionLabel(entry));

  const remove = (name: string) => {
    pickerSelectionTick();
    onChange(value.filter((item) => resolveConditionLabel(item) !== resolveConditionLabel(name)));
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
            borderColor: open ? ASSESSMENT.brand : ASSESSMENT.border,
            borderRadius: 16,
            backgroundColor: ASSESSMENT.surface,
            paddingHorizontal: 16,
            gap: 12,
          }}
        >
          <View style={{ width: ICON, height: ICON }}>
            <HeartPulseIcon />
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
            placeholder={ka.assessment.conditionPlaceholder}
            placeholderTextColor={ASSESSMENT.muted}
            autoCorrect={false}
            autoCapitalize="sentences"
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
            <ChevronDown size={CHEVRON} color={ASSESSMENT.muted} strokeWidth={2} />
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
              backgroundColor: ASSESSMENT.surface,
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
                  style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: ASSESSMENT.rowLine }}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 15,
                      lineHeight: 22,
                      color: ASSESSMENT.brand,
                    }}
                  >
                    {ka.assessment.addCondition(trimmed)}
                  </Text>
                </Pressable>
              ) : null}
              {matches.map((entry) => {
                const selected = hasCondition(value, conditionLabel(entry));
                return (
                  <Pressable
                    key={entry.id}
                    disabled={selected}
                    onPress={() => addEntry(entry)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      opacity: selected ? 0.45 : 1,
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
                      {entry.ka}
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
                    {ka.assessment.conditionSearchEmpty}
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
            <Chip key={name} label={resolveConditionLabel(name)} selected onPress={() => remove(name)} />
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
          {ka.assessment.mostCommonConditions}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {common.map((entry) => {
            const label = conditionLabel(entry);
            const selected = hasCondition(value, label);
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
    </View>
  );
}
