import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FIGMA_AUTH } from '@/constants/figmaAuthLayout';
import { AuthBrandHeader } from '@/components/auth/AuthBrandHeader';
import { useThemeColors } from '@/theme/colors';
import { ka } from '@/i18n/ka';

type Props = {
  /** Nightingale hero header (logo + app name). */
  hero?: boolean;
  heroSubtitle?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Shared chrome for splash-adjacent auth screens. */
export function AuthShell({
  hero,
  heroSubtitle,
  title,
  subtitle,
  children,
  footer,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <KeyboardAvoidingView
      className="flex-1 font-sans"
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <View className="flex-1">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingBottom: footer ? 16 : insets.bottom + 24,
            paddingHorizontal: FIGMA_AUTH.screenPaddingX,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {hero ? (
            <AuthBrandHeader subtitle={heroSubtitle ?? ka.app.tagline} />
          ) : title ? (
            <View className="mb-6">
              <Text className="font-sans-bold text-2xl" style={{ color: colors.text100 }}>
                {title}
              </Text>
              {subtitle ? (
                <Text className="mt-1.5 font-sans text-base" style={{ color: colors.text200 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}

          {children}
        </ScrollView>

        {footer ? (
          <View
            style={{
              paddingHorizontal: FIGMA_AUTH.screenPaddingX,
              paddingTop: 12,
              paddingBottom: insets.bottom + 12,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.bg300,
            }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
