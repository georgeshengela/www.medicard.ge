import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { Platform, Pressable, Text, type AccessibilityProps } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Trash2 } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useIsDark } from '@/theme/colors';

/** iOS system red (light / dark), the colour every iPhone list uses for „Delete“. */
export const SWIPE_RED = { light: '#FF3B30', dark: '#FF453A' } as const;
const ACTION_WIDTH = 88;

export type RowA11y = Pick<AccessibilityProps, 'accessibilityActions' | 'onAccessibilityAction'>;

type Group = { opened: (row: SwipeableMethods) => void; closed: (row: SwipeableMethods) => void; closeAll: () => void };
const SwipeGroupContext = createContext<Group | null>(null);

/** One open row at a time, like Mail: opening a row closes the previous one. */
export function SwipeGroup({ children }: { children: React.ReactNode }) {
  const current = useRef<SwipeableMethods | null>(null);
  const group = useMemo<Group>(() => ({
    opened: (row) => {
      if (current.current && current.current !== row) current.current.close();
      current.current = row;
    },
    closed: (row) => {
      if (current.current === row) current.current = null;
    },
    closeAll: () => {
      current.current?.close();
      current.current = null;
    },
  }), []);
  return <SwipeGroupContext.Provider value={group}>{children}</SwipeGroupContext.Provider>;
}

export function useSwipeGroup() {
  return useContext(SwipeGroupContext);
}

/**
 * iPhone-style row: drag left and a red „წაშლა“ appears behind it; tap it to delete. A long press opens
 * the same action (for people who don't swipe) and VoiceOver / TalkBack get a „წაშლა“ custom action, so
 * the gesture is never the only way in.
 */
export function SwipeDeleteRow({
  children,
  onDelete,
  deleteLabel = ka.common.delete,
}: {
  /** The row: gets `open` (for its long press) and the accessibility props to spread on its button. */
  children: (open: () => void, a11y: RowA11y) => React.ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  const dark = useIsDark();
  const group = useSwipeGroup();
  const ref = useRef<SwipeableMethods>(null);
  const red = dark ? SWIPE_RED.dark : SWIPE_RED.light;

  const open = useCallback(() => ref.current?.openRight(), []);
  const remove = useCallback(() => {
    ref.current?.close();
    onDelete();
  }, [onDelete]);

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      dragOffsetFromRightEdge={12}
      onSwipeableWillOpen={() => {
        if (ref.current) group?.opened(ref.current);
        if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
      }}
      onSwipeableClose={() => {
        if (ref.current) group?.closed(ref.current);
      }}
      renderRightActions={(progress) => (
        <DeleteAction progress={progress} color={red} label={deleteLabel} onPress={remove} />
      )}
    >
      {children(open, {
        accessibilityActions: [{ name: 'delete', label: deleteLabel }],
        onAccessibilityAction: (event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        },
      })}
    </ReanimatedSwipeable>
  );
}

function DeleteAction({ progress, color, label, onPress }: {
  progress: SharedValue<number>; color: string; label: string; onPress: () => void;
}) {
  // The label and bin fade and grow in as the row slides away, the way iOS reveals its actions.
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1]) }],
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: ACTION_WIDTH, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, content]}>
        <Trash2 size={20} color="#FFFFFF" strokeWidth={2.1} />
        <Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16 }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
