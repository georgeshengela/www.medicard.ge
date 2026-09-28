import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, Pressable, ScrollView, TextInput, View, type KeyboardEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { petFocusScrollOffset, petKeyboardOverlap } from '@/lib/petKeyboardLayout';
import { keyboardTopFromEvent } from '@/lib/keyboardTop';

const KEYBOARD_EASE = Easing.bezier(0.17, 0.59, 0.4, 0.77);
const GUTTER = 12;

/**
 * The app's keyboard-safe form page — the sign-in behaviour for every form (AGENTS.md "Keyboard comfort").
 *
 *  - No KeyboardAvoidingView. The scroll area sits above a footer whose bottom padding animates, with the
 *    keyboard's own duration/curve, to the MEASURED overlap between this frame and the keyboard. Measuring
 *    (instead of trusting the event height) is right on both platforms: if Android resized the window the
 *    overlap is 0; if edge-to-edge ignored adjustResize it is the real keyboard height.
 *  - The primary action (footer) always sits just above the keyboard; the content shrinks and scrolls.
 *  - The focused field is scrolled into view (on focus and after the keyboard settles).
 *  - Tapping empty space dismisses the keyboard. No shadow/fade above the footer (owner 2026-09-28).
 */
export function KeyboardFormShell({
  header,
  children,
  footer,
  background,
  contentStyle,
  dismissOnTap = true,
}: {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  background: string;
  contentStyle?: ViewStyle;
  dismissOnTap?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const revealFocus = useCallback(() => {
    if (Platform.OS === 'web') return;
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      if (!input || !scroll) return;
      scroll.getNativeScrollRef?.()?.measureInWindow((_x, top, _w, height) => {
        input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
          if (TextInput.State.currentlyFocusedInput() !== input) return;
          const next = petFocusScrollOffset(offset.current, top, height, inputTop, inputHeight);
          if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: true });
        });
      });
    });
  }, []);
  const { frameRef, onLayout, pad, open } = useKeyboardPad(Math.max(insets.bottom, 16), revealFocus);
  const footerStyle = useAnimatedStyle(() => ({ paddingBottom: pad.value }));
  const spacerStyle = useAnimatedStyle(() => ({ height: pad.value }));

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      {header}
      <View ref={frameRef} onLayout={onLayout} style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[{ flexGrow: 1, paddingBottom: footer ? 16 : 0 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          onFocus={() => setTimeout(revealFocus, 60)}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
        >
          {children}
          {dismissOnTap ? <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ flexGrow: 1, minHeight: 12 }} /> : null}
          {!footer ? <Animated.View style={spacerStyle} /> : null}
        </ScrollView>
        {footer ? (
          <Animated.View style={[{ paddingTop: 10, paddingHorizontal: 20, backgroundColor: background, gap: 8 }, footerStyle]}>
            {footer}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Measured keyboard padding for a frame (see KeyboardFormShell). Returns an animated `pad` = overlap between
 * the frame's bottom and the keyboard top + a gutter while the keyboard is open, `restPad` otherwise.
 */
export function useKeyboardPad(restPad: number, onSettled?: () => void) {
  const frameRef = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const alive = useRef(true);
  const [open, setOpen] = useState(false);
  const pad = useSharedValue(restPad);
  const bottomInset = useRef(0);
  bottomInset.current = useSafeAreaInsets().bottom;

  const apply = useCallback(
    (ms: number) => {
      frameRef.current?.measureInWindow((_x, top, _w, height) => {
        if (!alive.current) return;
        const overlap = petKeyboardOverlap(top, height, keyboardTop.current);
        const target = keyboardTop.current === null ? restPad : overlap + GUTTER;
        pad.value = withTiming(target, { duration: ms, easing: KEYBOARD_EASE });
        setOpen(keyboardTop.current !== null);
        if (onSettled) setTimeout(onSettled, ms + 30);
      });
    },
    [pad, restPad, onSettled],
  );

  useEffect(() => {
    alive.current = true;
    if (Platform.OS === 'web') return () => {
      alive.current = false;
    };
    const ms = (e: KeyboardEvent) => (typeof e.duration === 'number' && e.duration > 0 ? e.duration : Platform.OS === 'ios' ? 250 : 160);
    const show = (e: KeyboardEvent) => {
      keyboardTop.current = keyboardTopFromEvent(e, bottomInset.current);
      apply(ms(e));
      // Android may resize the window after the event: re-measure once the layout settles.
      if (Platform.OS === 'android') setTimeout(() => apply(120), 90);
    };
    const hide = (e: KeyboardEvent) => {
      keyboardTop.current = null;
      apply(ms(e));
    };
    const subs = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', show),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    return () => {
      alive.current = false;
      subs.forEach((sub) => sub.remove());
    };
  }, [apply]);

  useEffect(() => {
    if (keyboardTop.current === null) pad.value = restPad;
  }, [pad, restPad]);

  return { frameRef, onLayout: () => apply(0), pad, open };
}

/**
 * For long pages that already own their ScrollView (no pinned footer): adds keyboard space at the end of the
 * content and scrolls the focused field into view. Spread `frameProps` on a View wrapping the ScrollView,
 * `scrollProps` on the ScrollView, and render `spacer` as the last child of the scroll content.
 */
export function useKeyboardScroll() {
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const reveal = useCallback(() => {
    if (Platform.OS === 'web') return;
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = scrollRef.current;
      if (!input || !scroll) return;
      scroll.getNativeScrollRef?.()?.measureInWindow((_x, top, _w, height) => {
        input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
          if (TextInput.State.currentlyFocusedInput() !== input) return;
          const next = petFocusScrollOffset(offset.current, top, height, inputTop, inputHeight);
          if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: true });
        });
      });
    });
  }, []);
  const { frameRef, onLayout, pad } = useKeyboardPad(0, reveal);
  const spacerStyle = useAnimatedStyle(() => ({ height: pad.value }));
  return {
    frameProps: { ref: frameRef, onLayout, style: { flex: 1 } as ViewStyle, collapsable: false },
    scrollProps: {
      ref: scrollRef,
      onFocus: () => setTimeout(reveal, 60),
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = e.nativeEvent.contentOffset.y;
      },
      scrollEventThrottle: 32,
      keyboardShouldPersistTaps: 'handled' as const,
      keyboardDismissMode: (Platform.OS === 'ios' ? 'interactive' : 'on-drag') as 'interactive' | 'on-drag',
      automaticallyAdjustKeyboardInsets: false,
    },
    spacer: <Animated.View style={spacerStyle} />,
  };
}
