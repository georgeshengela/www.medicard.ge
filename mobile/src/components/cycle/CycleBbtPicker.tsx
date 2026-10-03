import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SvgXml } from 'react-native-svg';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { CYCLE_ICON_SVG } from '@/constants/cycleIconSvg';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import {
  BBT_COUNT,
  bbtAt,
  bbtFromForm,
  bbtIndex,
  bbtStorage,
  bbtValues,
  formatBbt,
  spokenBbt,
  wheelStart,
} from '@/lib/cycleBbt';
import { useCycleColors } from '@/theme/cycle';

const ITEM_H = 40;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
/** At most one selection tick per this many ms while the wheel spins (never one per scroll frame). */
const HAPTIC_GAP_MS = 70;

/** Web has no `snapToInterval`; CSS scroll-snap does the same job there. */
const WEB_SNAP_SCROLL = Platform.OS === 'web' ? ({ scrollSnapType: 'y mandatory' } as object) : null;
const WEB_SNAP_ITEM = Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as object) : null;

/**
 * BBT as a wheel (brief §8.3 item 9) instead of a typed number: a header row with the thermometer and the
 * day's value (or „არ გამიზომავს“); opening it starts the wheel at the day's value, else the last BBT she
 * logged, else 36.50 — and logs nothing. A value is logged only when she moves the wheel, taps a row or
 * taps „ეს მნიშვნელობა“ (shown while the day is still empty); closing without any of these leaves the day empty.
 * 35.50–38.00 °C in 0.05 steps, snap scrolling, one selection tick per step (throttled), „არ გამიზომავს“
 * clears the day. Screen readers get one adjustable control (swipe up/down = ±0.05 °C) with the spoken value.
 * Pure RN — no native module.
 */
export function CycleBbtPicker({
  value,
  onChange,
  lastLogged,
  disabled = false,
}: {
  /** The form string (`CycleLogForm.bbt`): '' = not measured. */
  value: string;
  onChange: (next: string) => void;
  /** The last BBT logged on another day (`lastLoggedBbt`) — only where the wheel starts. */
  lastLogged?: number | null;
  disabled?: boolean;
}) {
  const c = useCycleColors();
  const own = bbtFromForm(value);
  const [open, setOpen] = useState(false);
  const values = useMemo(() => bbtValues(), []);
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(bbtIndex(wheelStart(value, lastLogged)));
  const [index, setIndex] = useState(indexRef.current);
  const lastTick = useRef(0);

  const scrollToIndex = useCallback((i: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ y: i * ITEM_H, animated });
  }, []);

  // A change from outside (reset, another control) moves the wheel; the wheel's own commits match already.
  useEffect(() => {
    if (own == null || !open) return;
    const i = bbtIndex(own);
    if (i !== indexRef.current) {
      indexRef.current = i;
      setIndex(i);
      scrollToIndex(i, false);
    }
  }, [own, open, scrollToIndex]);

  const tick = () => {
    const now = Date.now();
    if (now - lastTick.current < HAPTIC_GAP_MS) return;
    lastTick.current = now;
    Haptics.selectionAsync().catch(() => undefined);
  };

  const commit = (i: number, { haptic = true }: { haptic?: boolean } = {}) => {
    const next = Math.min(BBT_COUNT - 1, Math.max(0, i));
    if (next === indexRef.current) return;
    indexRef.current = next;
    setIndex(next);
    if (haptic) tick();
    onChange(bbtStorage(bbtAt(next)));
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    commit(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
  };

  const toggleOpen = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => undefined);
    if (open) {
      setOpen(false);
      return;
    }
    const start = bbtIndex(wheelStart(value, lastLogged));
    indexRef.current = start;
    setIndex(start);
    // Opening only looks: nothing is logged until she moves the wheel, taps a row or confirms.
    setOpen(true);
  };

  /** „ეს მნიშვნელობა“ — logs the value the wheel shows (only offered while the day is still empty). */
  const confirm = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onChange(bbtStorage(bbtAt(indexRef.current)));
  };

  const clear = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onChange('');
    setOpen(false);
  };

  const onA11y = (e: AccessibilityActionEvent) => {
    const dir = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
    if (!dir) return;
    const next = Math.min(BBT_COUNT - 1, Math.max(0, indexRef.current + dir));
    commit(next);
    scrollToIndex(next, false);
  };

  const shown = own != null ? formatBbt(own) : tx('არ გამიზომავს', 'Not measured');
  const current = bbtAt(index);

  return (
    <View style={s.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled }}
        accessibilityLabel={`${ka.cycle.bbt}, ${own != null ? spokenBbt(own) : shown}`}
        accessibilityHint={open ? tx('ხურავს ბორბალს', 'Closes the wheel') : tx('ხსნის ტემპერატურის ბორბალს', 'Opens the temperature wheel')}
        disabled={disabled}
        onPress={toggleOpen}
        style={[s.head, { backgroundColor: c.cardSoft, opacity: disabled ? 0.5 : 1 }]}
      >
        <View style={[s.glyph, { backgroundColor: c.creamDeep }]}>
          <SvgXml xml={CYCLE_ICON_SVG.thermometer} width={22} height={22} color={c.fertile} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.title, { color: c.ink }]}>{ka.cycle.bbt}</Text>
          <Text numberOfLines={2} style={[s.sub, { color: c.mutedSoft }]}>
            {own != null
              ? tx('დილით, ადგომამდე', 'In the morning, before getting up')
              : `${shown} · ${tx('დილით, ადგომამდე', 'in the morning, before getting up')}`}
          </Text>
        </View>
        {own != null ? <Text style={[s.value, { color: c.fertile, fontSize: 20 }]}>{shown}</Text> : null}
        {open ? <ChevronDown size={18} color={c.muted} /> : <ChevronRight size={18} color={c.muted} />}
      </Pressable>

      {open ? (
        <View style={s.body}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={ka.cycle.bbt}
            aria-valuemin={0}
            aria-valuemax={BBT_COUNT - 1}
            aria-valuenow={index}
            aria-valuetext={spokenBbt(current)}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={onA11y}
            style={[s.wheel, { height: ITEM_H * VISIBLE }]}
          >
            <View pointerEvents="none" style={[s.band, { top: PAD, backgroundColor: c.fertilitySoft }]} />
            <ScrollView
              ref={scrollRef}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={ITEM_H}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onScroll}
              onLayout={() => scrollToIndex(indexRef.current, false)}
              contentContainerStyle={{ paddingVertical: PAD }}
              style={WEB_SNAP_SCROLL}
            >
              {values.map((v, i) => {
                const d = Math.abs(i - index);
                const on = d === 0;
                return (
                  <Pressable
                    key={v}
                    accessible={false}
                    onPress={() => {
                      // A tap is a choice even on the row already in the middle.
                      if (i === indexRef.current) {
                        tick();
                        onChange(bbtStorage(bbtAt(i)));
                      } else commit(i);
                      scrollToIndex(i, true);
                    }}
                    style={[s.item, WEB_SNAP_ITEM]}
                  >
                    <Text
                      style={[
                        s.itemText,
                        {
                          color: on ? c.fertile : c.muted,
                          fontSize: on ? 22 : d === 1 ? 17 : 15,
                          opacity: on ? 1 : d === 1 ? 0.85 : 0.5,
                          fontFamily: on ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
                        },
                      ]}
                    >
                      {v.toFixed(2)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text pointerEvents="none" style={[s.unit, { top: PAD, color: c.fertile }]}>
              °C
            </Text>
          </View>
          <View style={s.actions}>
            {own == null ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${tx('ეს მნიშვნელობა', 'Use this value')}, ${spokenBbt(current)}`}
                onPress={confirm}
                style={[s.confirm, { backgroundColor: c.fertile }]}
              >
                <Text style={[s.confirmText, { color: c.card }]}>{tx('ეს მნიშვნელობა', 'Use this value')}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel={tx('არ გამიზომავს — მოხსნა', 'Not measured — clear')} onPress={clear} style={s.clear}>
              <Text style={[s.clearText, { color: c.brand }]}>{tx('არ გამიზომავს', 'Not measured')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, minHeight: 60 },
  glyph: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20 },
  sub: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11.5, lineHeight: 15 },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontVariant: ['tabular-nums'] },
  body: { alignItems: 'center' },
  wheel: { width: '100%', maxWidth: 260, overflow: 'hidden' },
  band: { position: 'absolute', left: 0, right: 0, height: ITEM_H, borderRadius: 12 },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontVariant: ['tabular-nums'] },
  unit: { position: 'absolute', right: 18, height: ITEM_H, lineHeight: ITEM_H, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  confirm: { minHeight: 44, borderRadius: 22, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  confirmText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 },
  clear: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 },
});
