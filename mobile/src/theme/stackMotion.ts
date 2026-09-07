/** Shared native-stack motion. Keep this on every Stack so pages glide the same way. */
export const STACK_PUSH = {
  animation: 'slide_from_right' as const,
  animationDuration: 280,
  animationTypeForReplace: 'push' as const,
  freezeOnBlur: true,
};

export const STACK_FADE = {
  animation: 'fade' as const,
  animationDuration: 200,
  freezeOnBlur: true,
};

export const STACK_REDUCED = {
  animation: 'fade' as const,
  animationDuration: 140,
  freezeOnBlur: true,
};
