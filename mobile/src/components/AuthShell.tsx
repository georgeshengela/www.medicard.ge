import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { HeartPulse } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

/** Shared chrome for the sign-in, sign-up and phone screens. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg-100"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }}
        contentContainerClassName="px-6 grow justify-center"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-8 items-center">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-primary-200">
            <HeartPulse size={30} color={colors.onPrimary} strokeWidth={2.2} />
          </View>
          <Text className="mt-4 text-2xl font-bold text-text-100">{ka.app.name}</Text>
          <Text className="mt-0.5 text-sm text-text-300">{ka.app.tagline}</Text>
        </View>

        <View className="mb-6">
          <Text className="text-2xl font-bold text-text-100">{title}</Text>
          <Text className="mt-1.5 text-base text-text-200">{subtitle}</Text>
        </View>

        {children}

        {footer ? <View className="mt-6">{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
