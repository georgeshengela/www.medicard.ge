import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Mail } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { ka } from '@/i18n/ka';

export default function ForgotPasswordSent() {
  const router = useRouter();
  const { email, devCode } = useLocalSearchParams<{ email: string; devCode?: string }>();

  const continueToVerify = () => {
    router.push({
      pathname: '/(auth)/forgot-password/verify',
      params: { email: email ?? '', devCode: devCode ?? '' },
    });
  };

  return (
    <AuthShell>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            backgroundColor: '#FFFBEB',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Mail size={56} color="#F59E0B" strokeWidth={1.8} />
        </View>

        <Text
          style={{
            marginTop: 28,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 24,
            lineHeight: 32,
            color: '#0F172A',
            textAlign: 'center',
          }}
        >
          {ka.auth.forgotPasswordSentTitle}
        </Text>

        <Text
          style={{
            marginTop: 12,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 15,
            lineHeight: 24,
            color: '#64748B',
            textAlign: 'center',
            paddingHorizontal: 8,
          }}
        >
          {ka.auth.forgotPasswordSentBody}
        </Text>

        {__DEV__ && devCode ? (
          <Text
            style={{
              marginTop: 16,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              color: '#0D9488',
              textAlign: 'center',
            }}
          >
            Dev code: {devCode}
          </Text>
        ) : null}
      </View>

      <AuthPrimaryButton label={ka.auth.forgotPasswordEnterCode} onPress={continueToVerify} />

      <Pressable
        accessibilityRole="button"
        onPress={() => Linking.openURL('mailto:')}
        style={{ marginTop: 14, alignItems: 'center', paddingVertical: 8 }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#14B8A6' }}>
          {ka.auth.forgotPasswordOpenEmail}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
