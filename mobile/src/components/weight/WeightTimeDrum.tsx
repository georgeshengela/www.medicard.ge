import React, { useEffect, useMemo, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, View } from 'react-native';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';

const ITEM_H = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function Wheel({
  values,
  selected,
  onSelect,
}: {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  const T = useFigmaWeight();
  const ref = useRef<ScrollView>(null);
  const pad = ITEM_H * 2;

  useEffect(() => {
    const index = Math.max(0, values.indexOf(selected));
    requestAnimationFrame(() => {
      ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    });
  }, [selected, values]);

  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_H);
    const next = values[Math.max(0, Math.min(values.length - 1, index))] ?? selected;
    onSelect(next);
    ref.current?.scrollTo({ y: values.indexOf(next) * ITEM_H, animated: true });
  };

  return (
    <ScrollView
      ref={ref}
      style={{ flex: 1, height: ITEM_H * 5 }}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={onEnd}
      contentContainerStyle={{ paddingVertical: pad }}
    >
      {values.map((value) => {
        const active = value === selected;
        return (
          <View key={value} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 20,
                lineHeight: 28,
                color: active ? T.brand : T.textTertiary,
              }}
            >
              {String(value).padStart(2, '0')}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function WeightTimeDrum({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const T = useFigmaWeight();
  const hours = useMemo(() => HOURS, []);
  const minutes = useMemo(() => MINUTES, []);

  return (
    <View style={{ height: ITEM_H * 5, paddingHorizontal: 16 }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          top: ITEM_H * 2,
          height: ITEM_H,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: T.brand,
          backgroundColor: T.brandSoft,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 16, flex: 1 }}>
        <Wheel values={hours} selected={hour} onSelect={(next) => onChange(next, minute)} />
        <Wheel values={minutes} selected={minute} onSelect={(next) => onChange(hour, next)} />
      </View>
    </View>
  );
}
