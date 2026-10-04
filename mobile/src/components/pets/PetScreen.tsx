import React, { useCallback, useRef } from 'react';
import { Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useKeyboardPad } from '@/components/ui/KeyboardFormShell';
import { petFocusScrollOffset } from '@/lib/petKeyboardLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, X, type LucideIcon } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { PetPanel as Card, PetText } from './PetUi';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { HUB } from '@/theme/hub';

/**
 * MEDIVET form page = the sign-in keyboard standard (KeyboardFormShell, AGENTS.md "Keyboard comfort"):
 * the footer's bottom padding animates to the MEASURED keyboard overlap with the keyboard's own curve,
 * so the actions ride just above the keyboard; the fields scroll and the focused one is brought into
 * view; a tap on empty space or a drag closes the keyboard. Never combined with another inset mechanism.
 */
export function PetFormScroll({
  children,
  footer,
  scrollRef,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const localScrollRef = useRef<ScrollView>(null);
  const formScrollRef = scrollRef ?? localScrollRef;
  const offset = useRef(0);
  const revealFocus = useCallback(() => {
    if (Platform.OS === 'web') return;
    requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scroll = formScrollRef.current;
      if (!input || !scroll) return;
      scroll.getNativeScrollRef?.()?.measureInWindow((_x, top, _w, height) => {
        input.measureInWindow((_ix, inputTop, _iw, inputHeight) => {
          if (TextInput.State.currentlyFocusedInput() !== input) return;
          const next = petFocusScrollOffset(offset.current, top, height, inputTop, inputHeight);
          if (Math.abs(next - offset.current) > 1) scroll.scrollTo({ y: next, animated: true });
        });
      });
    });
  }, [formScrollRef]);
  const { frameRef, onLayout, pad } = useKeyboardPad(Math.max(insets.bottom, 12), revealFocus);
  const footerStyle = useAnimatedStyle(() => ({ paddingBottom: pad.value }));
  const spacerStyle = useAnimatedStyle(() => ({ height: pad.value }));

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.bg100 }}>
      <View ref={frameRef} collapsable={false} onLayout={onLayout} style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          ref={formScrollRef}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: HUB.gutter, paddingTop: 8, paddingBottom: footer ? 16 : 0, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          onFocus={() => setTimeout(revealFocus, 60)}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
        >
          {children}
          {/* Empty space below the fields: a tap closes the keyboard. */}
          <Pressable onPress={Keyboard.dismiss} accessible={false} style={{ flexGrow: 1, minHeight: 12 }} />
          {!footer ? <Animated.View style={spacerStyle} /> : null}
        </ScrollView>
        {footer ? (
          <Animated.View style={[{ paddingTop: 10, paddingHorizontal: HUB.gutter, backgroundColor: colors.bg100, gap: 8 }, footerStyle]}>
            {footer}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A form's actions in one row: the secondary one (delete, archive, back, cancel) on the left at its own
 * width, the primary one filling the rest — the way iOS puts a destructive action beside „Save“.
 */
export function PetFormActions({ children, secondary }: { children: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 10 }}>
      {secondary ? <View style={{ flexShrink: 0, maxWidth: '50%' }}>{secondary}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

export function PetPageScroll({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg100 }}
      contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingTop: 8, paddingBottom: insets.bottom + 32, gap: 20 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function PetFactRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <>
      <View className="flex-row items-center">
        <Text className="flex-1 text-base text-text-200">{label}</Text>
        <Text className="max-w-[58%] text-right text-base font-bold text-text-100">{value}</Text>
      </View>
      {last ? null : <View className="my-3 h-px bg-bg-300" />}
    </>
  );
}

export function PetErrorText({ message }: { message: string | null }) {
  const colors = useThemeColors();
  if (!message) return null;
  return <View accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 14, backgroundColor: colors.dangerBg }}><PetText size={13} color={colors.danger}>{message}</PetText></View>;
}

export function PetSectionLabel({ label }: { label: string }) {
  const auth = useFigmaAuth();
  return (
    <Text
      style={{
        fontFamily: 'NotoSansGeorgian_600SemiBold',
        fontSize: 14,
        lineHeight: 20,
        color: auth.labelColor,
      }}
    >
      {label}
    </Text>
  );
}

export function PetIconWell({
  icon: Icon,
  art,
  size = HUB.tile,
}: {
  icon?: LucideIcon;
  /** 3D artwork rendered at the well's size instead of the tinted icon tile. */
  art?: ImageSourcePropType;
  size?: number;
}) {
  const colors = useThemeColors();
  const iconSize = size >= 56 ? 26 : 20;
  if (art) {
    return (
      <Image
        source={art}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: HUB.tileRadius,
        backgroundColor: colors.accent100,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Icon ? <Icon size={iconSize} color={colors.primary100} strokeWidth={2} /> : null}
    </View>
  );
}

/**
 * A list in one flat card (the hub list look): rows sit edge to edge with a hairline between them.
 * Put `PetListRow`s inside; a single row may also stand alone.
 */
export function PetListGroup({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const rows = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <View style={{ borderRadius: HUB.cardRadius, backgroundColor: colors.surface, overflow: 'hidden' }}>
      {rows.map((row, index) => React.cloneElement(row as React.ReactElement<{ grouped?: boolean; first?: boolean }>, { grouped: true, first: index === 0 }))}
    </View>
  );
}

export function PetListRow({
  title,
  subtitle,
  onPress,
  tone = 'default',
  icon,
  art,
  right,
  grouped,
  first,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'default' | 'muted';
  icon?: LucideIcon;
  art?: ImageSourcePropType;
  /** Short value on the right (e.g. „31.4 კგ“). */
  right?: string;
  /** Set by PetListGroup. */
  grouped?: boolean;
  first?: boolean;
}) {
  const leading = Boolean(icon || art);
  const colors = useThemeColors();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {leading ? <PetIconWell icon={icon} art={art} /> : null}
      <View
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: grouped ? 14 : 0,
          paddingRight: grouped ? 14 : 0,
          borderTopWidth: grouped && !first ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.bg300,
          alignSelf: 'stretch',
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            numberOfLines={2}
            style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 21, color: tone === 'muted' ? colors.text300 : colors.text100 }}
          >
            {title}
          </Text>
          {subtitle ? <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 18, color: colors.text300 }}>{subtitle}</Text> : null}
        </View>
        {right ? <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: colors.text100 }}>{right}</Text> : null}
        <ChevronRight size={18} color={colors.text300} strokeWidth={2} />
      </View>
    </View>
  );
  if (grouped) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={[title, right, subtitle].filter(Boolean).join('. ')} onPress={onPress} style={{ paddingLeft: 14, backgroundColor: colors.surface }}>
        {body}
      </Pressable>
    );
  }
  return <Card onPress={onPress}>{body}</Card>;
}

export function PetChoiceRows<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  const colors = useThemeColors();
  return (
    <Card padded={false}>
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            className="active:opacity-80"
            style={{
              minHeight: 52,
              paddingHorizontal: 16,
              paddingVertical: 14,
              flexDirection: 'row',
              alignItems: 'center',
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.bg300,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 15,
                color: colors.text100,
              }}
            >
              {option.label}
            </Text>
            {selected ? <Check size={18} color={colors.primary200} strokeWidth={2.4} /> : null}
          </Pressable>
        );
      })}
    </Card>
  );
}

/** Figma 11358:72329 Chip — min-h 48, radius 16, 24px icon, mint selected. */
export function PetFilterChip({
  label,
  selected,
  onPress,
  icon: Icon,
  art,
  fill = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  /** 3D artwork (32px) shown instead of the icon. */
  art?: ImageSourcePropType;
  fill?: boolean;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: fill ? 'flex-start' : 'center',
        gap: 8,
        alignSelf: fill ? 'stretch' : 'flex-start',
        width: fill ? '100%' : undefined,
        backgroundColor: selected ? colors.accent100 : colors.surface,
        borderColor: selected ? colors.primary200 : colors.bg300,
        maxWidth: '100%',
      }}
    >
      {art ? (
        <Image source={art} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: 32, height: 32 }} />
      ) : Icon ? (
        <Icon
          size={24}
          color={selected ? colors.primary100 : colors.text100}
          strokeWidth={2}
        />
      ) : null}
      <Text
        style={{
          flex: fill ? 1 : undefined,
          flexShrink: 1,
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 14,
          lineHeight: 22,
          color: selected ? colors.primary100 : colors.text100,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PetChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}

export function PetSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  // The keyboard standard (useKeyboardPad): the sheet rides on the measured keyboard top.
  const { frameRef, onLayout, pad } = useKeyboardPad(Math.max(insets.bottom, 16));
  const sheetPad = useAnimatedStyle(() => ({ paddingBottom: pad.value }));

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View
        ref={frameRef}
        collapsable={false}
        onLayout={onLayout}
        style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 12 }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: APP_MODAL_OVERLAY }} onPress={onClose} />
          <Animated.View
            accessibilityViewIsModal
            style={[{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '94%',
            }, sheetPad]}
          >
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: 100,
                backgroundColor: dark ? colors.bg300 : '#E5E7EB',
                alignSelf: 'center',
                marginTop: 16,
              }}
            />
            <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 18,
                    lineHeight: 24,
                    color: colors.text100,
                  }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text
                    style={{
                      marginTop: 4,
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 16,
                      lineHeight: 26,
                      color: colors.text200,
                    }}
                  >
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ka.common.close}
                hitSlop={12}
                onPress={onClose}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, borderRadius: 22 }}
              >
                <X size={24} color={colors.text100} strokeWidth={2} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 16, paddingTop: 20, flexShrink: 1 }}>{children}</View>
          </Animated.View>
      </View>
    </Modal>
  );
}
