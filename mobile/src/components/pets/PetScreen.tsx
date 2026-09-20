import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, Keyboard as KeyboardIcon, X, type LucideIcon } from 'lucide-react-native';
import { usePetFormKeyboard } from './usePetFormKeyboard';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { PetPanel as Card, PetText } from './PetUi';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';

function usePetKeyboard() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

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
  const keyboard = usePetFormKeyboard(formScrollRef);

  return (
    <View
      ref={keyboard.frameRef}
      collapsable={false}
      onLayout={keyboard.measureFrame}
      style={{ flex: 1, minHeight: 0, backgroundColor: colors.bg100 }}
    >
    {/* Only this inner region shrinks. Android already resizes the window. */}
    <View style={{ flex: 1, minHeight: 0, paddingBottom: keyboard.bottom }}>
      <ScrollView
        ref={formScrollRef}
        style={{ flex: 1, minHeight: 0 }}
        onLayout={keyboard.revealFocus}
        onFocus={keyboard.onFocus}
        onBlur={keyboard.onBlur}
        onScroll={keyboard.onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: footer ? 16 : insets.bottom + 28,
          gap: 20,
        }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            flexShrink: 0,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: keyboard.open ? 8 : Math.max(insets.bottom, 12),
            backgroundColor: colors.bg100,
            borderTopWidth: 1,
            borderTopColor: colors.bg300,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>{footer}</View>
          {keyboard.open ? <Pressable accessibilityRole="button" accessibilityLabel="კლავიატურის დამალვა" onPress={Keyboard.dismiss} style={{ width: 48, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised }}><KeyboardIcon size={22} color={colors.primary100} /></Pressable> : null}
        </View>
      ) : null}
    </View>
    </View>
  );
}

export function PetPageScroll({ children }: { children: React.ReactNode }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg100 }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}
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
  size = 44,
}: {
  icon: LucideIcon;
  size?: number;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const iconSize = size >= 56 ? 26 : 22;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: dark ? colors.accent100 : '#F0FDFA',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={iconSize} color={dark ? colors.primary100 : colors.primary200} strokeWidth={2} />
    </View>
  );
}

export function PetListRow({
  title,
  subtitle,
  onPress,
  tone = 'default',
  icon,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'default' | 'muted';
  icon?: LucideIcon;
}) {
  const colors = useThemeColors();
  return (
    <Card onPress={onPress}>
      <View className="flex-row items-center">
        {icon ? <PetIconWell icon={icon} /> : null}
        <View className={icon ? 'flex-1 px-3' : 'flex-1 pr-3'}>
          <Text
            className="text-base font-semibold"
            style={{
              color: tone === 'muted' ? colors.text300 : colors.text100,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
            }}
          >
            {title}
          </Text>
          {subtitle ? <Text className="mt-1 text-sm text-text-300">{subtitle}</Text> : null}
        </View>
        <ChevronRight size={18} color={colors.text300} strokeWidth={2} />
      </View>
    </Card>
  );
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
  fill = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  fill?: boolean;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();

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
        backgroundColor: selected ? (dark ? colors.accent100 : '#F0FDFA') : dark ? colors.bg200 : '#F9FAFB',
        borderColor: selected ? colors.primary200 : dark ? colors.bg300 : '#D1D5DB',
        maxWidth: '100%',
      }}
    >
      {Icon ? (
        <Icon
          size={24}
          color={selected ? (dark ? colors.primary100 : colors.primary200) : colors.text100}
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
          color: selected ? (dark ? colors.primary100 : colors.primary200) : colors.text100,
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
  const keyboard = usePetKeyboard();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 12 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: APP_MODAL_OVERLAY }} onPress={onClose} />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '94%',
              paddingBottom: keyboard ? 12 : Math.max(insets.bottom, 16),
            }}
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
          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
