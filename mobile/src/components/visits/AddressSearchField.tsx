import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { CheckCircle2, MapPin, Search, X } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { api, type GeocodeResult } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

type Props = {
  value: string;
  selected: GeocodeResult | null;
  onChangeText: (text: string) => void;
  onSelect: (result: GeocodeResult | null) => void;
};

export function AddressSearchField({ value, selected, onChangeText, onSelect }: Props) {
  const colors = useThemeColors();
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingRef = useRef(false);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 3 || (selected && selected.label === q)) {
      setResults([]);
      setSearchError(false);
      setLoading(false);
      return;
    }

    timer.current = setTimeout(async () => {
      setLoading(true);
      setSearchError(false);
      try {
        const { results: rows } = await api.visits.geocode(q);
        setResults(rows);
      } catch {
        setResults([]);
        setSearchError(true);
      } finally {
        setLoading(false);
      }
    }, 320);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, selected]);

  const trimmed = value.trim();
  const showPanel = focused && trimmed.length >= 3 && !selected;
  const hasResults = results.length > 0;

  const pick = (row: GeocodeResult) => {
    selectingRef.current = true;
    onChangeText(row.label);
    onSelect(row);
    setFocused(false);
    setResults([]);
    requestAnimationFrame(() => {
      selectingRef.current = false;
    });
  };

  const handleBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      if (!selectingRef.current) setFocused(false);
    }, 280);
  };

  return (
    <View>
      <Text className="mb-2 text-sm font-semibold text-text-200">{ka.visits.address}</Text>

      <View
        className={`flex-row items-center rounded-2xl border px-3.5 py-3 ${
          selected ? 'border-primary-200 bg-accent-100/25' : 'border-bg-300 bg-bg-100'
        }`}
      >
        {selected ? (
          <CheckCircle2 size={18} color={colors.primary200} strokeWidth={2.2} />
        ) : (
          <Search size={18} color={colors.text300} strokeWidth={2} />
        )}
        <TextInput
          value={value}
          onChangeText={(t) => {
            onChangeText(t);
            if (selected && t !== selected.label) onSelect(null);
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={handleBlur}
          placeholder={ka.visits.addressPh}
          placeholderTextColor={colors.text300}
          className="ml-2.5 flex-1 text-base text-text-100"
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary200} />
        ) : value ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              onChangeText('');
              onSelect(null);
              setResults([]);
            }}
          >
            <X size={16} color={colors.text300} />
          </Pressable>
        ) : null}
      </View>

      {showPanel ? (
        <View className="mt-2 overflow-hidden rounded-2xl border border-bg-300 bg-bg-100">
          {loading ? (
            <View className="flex-row items-center px-4 py-3.5">
              <ActivityIndicator size="small" color={colors.primary200} />
              <Text className="ml-2.5 text-sm text-text-300">{ka.visits.addressSearching}</Text>
            </View>
          ) : searchError ? (
            <Text className="px-4 py-3.5 text-sm text-state-danger">{ka.visits.addressError}</Text>
          ) : hasResults ? (
            results.map((row, index) => (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                onPressIn={() => pick(row)}
                className={`flex-row items-start px-4 py-3.5 active:bg-bg-200 ${
                  index < results.length - 1 ? 'border-b border-bg-300' : ''
                }`}
              >
                <MapPin size={16} color={colors.primary200} strokeWidth={2} style={{ marginTop: 2 }} />
                <Text className="ml-2.5 flex-1 text-sm leading-5 text-text-100">{row.label}</Text>
              </Pressable>
            ))
          ) : (
            <Text className="px-4 py-3.5 text-sm text-text-300">{ka.visits.addressEmpty}</Text>
          )}
        </View>
      ) : null}

      <Text className="mt-1.5 text-xs text-text-300">
        {selected ? ka.visits.addressSelected : ka.visits.addressHint}
      </Text>
    </View>
  );
}
