import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Dimensions, Keyboard, Platform, TextInput, View, type KeyboardEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from 'react-native';
import { petFocusScrollOffset, petKeyboardOverlap } from '@/lib/petKeyboardLayout';

/** Measure the real screen instead of guessing the height of nested native headers. */
export function usePetFormKeyboard(scrollRef: RefObject<ScrollView | null>) {
  const frameRef = useRef<View>(null);
  const bounds = useRef({ top: 0, height: 0 });
  const keyboardTop = useRef<number | null>(null);
  const offset = useRef(0);
  const focused = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput> | null>(null);
  const alive = useRef(true);
  const focusFrame = useRef<number | null>(null);
  const [bottom, setBottom] = useState(0);
  const [open, setOpen] = useState(false);

  const revealFocus = useCallback(() => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    if (Platform.OS === 'web') return; // The browser handles DOM input focus.
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      const input = focused.current;
      const scroll = scrollRef.current;
      if (!alive.current || !input || !scroll || TextInput.State.currentlyFocusedInput() !== input) return;
      scroll.getNativeScrollRef()?.measureInWindow((_x, top, _width, height) => {
        input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
          if (!alive.current || focused.current !== input || TextInput.State.currentlyFocusedInput() !== input) return;
          const next = petFocusScrollOffset(offset.current, top, height, inputTop, inputHeight);
          if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: false });
        });
      });
    });
  }, [scrollRef]);

  const measureFrame = useCallback(() => {
    frameRef.current?.measureInWindow((_x, top, _width, height) => {
      if (!alive.current) return;
      bounds.current = { top, height };
      if (Platform.OS === 'ios') setBottom(petKeyboardOverlap(top, height, keyboardTop.current));
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    if (Platform.OS === 'web') return () => { alive.current = false; };
    const update = (event: KeyboardEvent) => {
      const { screenY, height } = event.endCoordinates;
      // iOS cross-fade accessibility mode can report screenY=0.
      const top = screenY > 0 ? screenY : Dimensions.get('window').height - height;
      keyboardTop.current = height > 0 ? top : null;
      const overlap = petKeyboardOverlap(bounds.current.top, bounds.current.height, keyboardTop.current);
      if (Platform.OS === 'ios') {
        Keyboard.scheduleLayoutAnimation(event);
        setBottom(overlap);
      }
      setOpen(height > 0 && (Platform.OS !== 'ios' || overlap > 0));
      measureFrame();
    };
    const hide = (event: KeyboardEvent) => {
      keyboardTop.current = null;
      if (Platform.OS === 'ios') Keyboard.scheduleLayoutAnimation(event);
      setBottom(0);
      setOpen(false);
    };
    const subscriptions = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', update),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
      Keyboard.addListener('keyboardDidShow', revealFocus),
    ];
    const metrics = Keyboard.metrics();
    if (metrics) { keyboardTop.current = metrics.screenY; setOpen(true); }
    measureFrame();
    return () => {
      alive.current = false;
      subscriptions.forEach(subscription => subscription.remove());
      if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    };
  }, [measureFrame, revealFocus]);

  return {
    frameRef, bottom, open, measureFrame, revealFocus,
    onFocus: () => { if (Platform.OS !== 'web') { focused.current = TextInput.State.currentlyFocusedInput(); revealFocus(); } },
    onBlur: () => { focused.current = null; },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => { offset.current = event.nativeEvent.contentOffset.y; },
  };
}
