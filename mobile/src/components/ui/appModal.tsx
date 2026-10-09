import React from 'react';
import { Modal as NativeModal, type ModalProps } from 'react-native';
import { useHideTabChromeWhile } from '@/components/navigation/tabChrome';

/**
 * Default overlay Modal — fade the dim in place.
 * Never use animationType="slide" on a transparent Modal: the scrim
 * slides up and the screen behind shows through.
 */
export const APP_MODAL_PROPS = {
  transparent: true,
  animationType: 'fade' as const,
  statusBarTranslucent: true,
  presentationStyle: 'overFullScreen' as const,
};

export const APP_MODAL_OVERLAY = 'rgba(15, 23, 42, 0.55)';

/**
 * iOS cannot present a view controller while another one is still dismissing: a Modal, the camera or
 * the photo picker opened in that window never appears (the awaiting code hangs), and two Modals
 * dismissed in the same frame (a nested one and its parent) can leave an invisible one on screen that
 * swallows every touch. Close the first, wait this long, then open the next. Never nest a Modal in a
 * Modal — render the inner sheet as an overlay inside the outer one.
 */
export const MODAL_HANDOFF_MS = 450;

/**
 * Use this instead of react-native's Modal. On iOS the tab pill lives in a
 * FullWindowOverlay window that sits above every RN Modal, so it covered sheets and
 * dialogs. While this Modal is visible the app chrome (tab pill, run badge) is hidden.
 */
export function Modal(props: ModalProps) {
  useHideTabChromeWhile(props.visible !== false);
  return <NativeModal {...props} />;
}
