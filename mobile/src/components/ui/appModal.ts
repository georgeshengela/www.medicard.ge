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
