import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, ScrollView, TextInput, View, type KeyboardEvent, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { focusedFieldOffset, keyboardFrameOverlap } from '@/lib/analysisFlow';

const ChatKeyboard = createContext(false);
export function useChatKeyboardOpen() { return useContext(ChatKeyboard); }

/** The bottom inset belongs to the home indicator OR the keyboard, never both. */
export function ChatActionDock({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const C = useFigmaChat();
  const insets = useSafeAreaInsets();
  const open = useChatKeyboardOpen();
  return <View style={[{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: open ? 10 : Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.white }, style]}>{children}</View>;
}

export function ChatScreenShell({ header, footer, children, style }: {
  header: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; style?: ViewStyle;
}) {
  const C = useFigmaChat();
  const frame = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const alive = useRef(true);
  const [overlap, setOverlap] = useState(0);
  const [open, setOpen] = useState(false);
  const measure = useCallback(() => {
    frame.current?.measureInWindow((_x, top, _width, height) => {
      if (!alive.current || Platform.OS !== 'ios') return;
      const next = keyboardFrameOverlap(top, height, keyboardTop.current);
      setOverlap(next); setOpen(next > 0);
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    if (Platform.OS === 'web') return () => { alive.current = false; };
    const update = (event: KeyboardEvent) => {
      const { height, screenY } = event.endCoordinates;
      keyboardTop.current = height > 0 ? (screenY > 0 ? screenY : Dimensions.get('window').height - height) : null;
      if (Platform.OS === 'ios') { Keyboard.scheduleLayoutAnimation(event); measure(); }
      else setOpen(height > 0); // Android already resizes the window.
    };
    const hide = (event: KeyboardEvent) => {
      keyboardTop.current = null;
      if (Platform.OS === 'ios') Keyboard.scheduleLayoutAnimation(event);
      setOverlap(0); setOpen(false);
    };
    const subscriptions = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', update),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    const metrics = Keyboard.metrics();
    if (metrics) { keyboardTop.current = metrics.screenY; setOpen(true); }
    measure();
    return () => { alive.current = false; subscriptions.forEach(s => s.remove()); };
  }, [measure]);
  return (
    <ChatKeyboard.Provider value={open}>
      <View style={[{ flex: 1, minHeight: 0, backgroundColor: C.cardBg }, style]}>
        {header}
        <View ref={frame} collapsable={false} onLayout={measure} style={{ flex: 1, minHeight: 0 }}>
          <View style={{ flex: 1, minHeight: 0, marginBottom: overlap }}>
            {children}
            {footer}
          </View>
        </View>
      </View>
    </ChatKeyboard.Provider>
  );
}

/** Keep the active multiline field inside the resized viewport above the dock. */
export const ChatFormScroll = forwardRef<ScrollView, ScrollViewProps>(function ChatFormScroll(props, ref) {
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const frame = useRef<number | null>(null);
  const alive = useRef(true);
  const open = useChatKeyboardOpen();
  useImperativeHandle(ref, () => scroll.current!, []);
  const reveal = useCallback(() => {
    if (Platform.OS === 'web') return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const input = TextInput.State.currentlyFocusedInput();
      if (!alive.current || !input) return;
      scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top, _w, height) => {
        input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
          if (!alive.current || TextInput.State.currentlyFocusedInput() !== input) return;
          const next = focusedFieldOffset(offset.current, top, height, inputTop, inputHeight);
          if (Math.abs(next - offset.current) > 1) scroll.current?.scrollTo({ y: next, animated: false });
        });
      });
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    const subscription = Keyboard.addListener('keyboardDidShow', reveal);
    return () => { alive.current = false; subscription.remove(); if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [reveal]);
  return <ScrollView {...props} ref={scroll} automaticallyAdjustKeyboardInsets={false}
    keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} scrollEventThrottle={16}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; props.onScroll?.(event); }}
    onLayout={event => { props.onLayout?.(event); if (open) reveal(); }}
    onContentSizeChange={(w, h) => { props.onContentSizeChange?.(w, h); if (open) reveal(); }} />;
});
