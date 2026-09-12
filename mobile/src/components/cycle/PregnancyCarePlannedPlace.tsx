import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { isCivilDateKey } from '@/lib/pregnancyCareCatalog.js';
import { PLANNED_PLACE_MAX, normalizePlannedPlace } from '@/lib/pregnancyCareVisitPlaceContract.js';

type Colors = {
  ink: string;
  muted: string;
  mutedSoft: string;
  border: string;
  card: string;
};

type Copy = {
  plannedPlace: string;
  plannedPlaceHint: string;
  plannedPlacePlaceholder: string;
  plannedPlaceClear: string;
  plannedPlaceNeedDate: string;
};

type Props = {
  plannedDate: string;
  plannedPlace: string | null;
  disabled?: boolean;
  colors: Colors;
  copy: Copy;
  onSave: (place: string | null) => void;
  onClear: () => void;
  onInvalid?: (message: string) => void;
};

export function PregnancyCarePlannedPlace({
  plannedDate,
  plannedPlace,
  disabled,
  colors: c,
  copy,
  onSave,
  onClear,
  onInvalid,
}: Props) {
  const hasDate = isCivilDateKey(plannedDate);
  const saved = typeof plannedPlace === 'string' && plannedPlace ? plannedPlace : null;
  const [draft, setDraft] = useState(saved || '');

  useEffect(() => {
    setDraft(saved || '');
  }, [saved]);

  if (!hasDate) {
    return (
      <View style={{ marginTop: 10 }}>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{copy.plannedPlaceNeedDate}</Text>
      </View>
    );
  }

  function commit() {
    let next = null;
    try {
      next = normalizePlannedPlace(draft);
    } catch (err) {
      onInvalid?.(err instanceof Error ? err.message : copy.plannedPlaceHint);
      return;
    }
    if ((next || null) === saved) return;
    onSave(next);
  }

  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{copy.plannedPlace}</Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{copy.plannedPlaceHint}</Text>
      <TextInput
        value={draft}
        onChangeText={(text) => setDraft(text.replace(/[\r\n]+/g, ' '))}
        onEndEditing={commit}
        onSubmitEditing={commit}
        placeholder={copy.plannedPlacePlaceholder}
        placeholderTextColor={c.mutedSoft}
        accessibilityLabel={copy.plannedPlace}
        accessibilityHint={copy.plannedPlaceHint}
        editable={!disabled}
        maxLength={PLANNED_PLACE_MAX}
        autoCorrect={false}
        autoCapitalize="sentences"
        returnKeyType="done"
        blurOnSubmit
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        testID="care-place-input"
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: c.ink,
          marginTop: 8,
          fontSize: 16,
          lineHeight: 22,
        }}
      />
      {saved ? (
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel={copy.plannedPlaceClear}
          testID="care-place-clear"
          disabled={disabled}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            justifyContent: 'center',
            alignSelf: 'flex-start',
            marginTop: 8,
          }}
        >
          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.plannedPlaceClear}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
