import React from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound, Mail, Smartphone } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthBackHeader } from '@/components/auth/AuthBackHeader';
import { AuthMethodCard } from '@/components/auth/AuthMethodCard';
import { ka } from '@/i18n/ka';

export default function ForgotPasswordIndex() {
  const router = useRouter();

  return (
    <AuthShell>
      <AuthBackHeader title={ka.auth.forgotPasswordTitle} subtitle={ka.auth.forgotPasswordChoose} />

      <View style={{ gap: 12 }}>
        <AuthMethodCard
          icon={Mail}
          iconBg="#F0FDFA"
          iconColor="#14B8A6"
          label={ka.auth.forgotPasswordViaEmail}
          onPress={() => router.push('/(auth)/forgot-password/email')}
        />
        <AuthMethodCard
          icon={Smartphone}
          iconBg="#FDF2F8"
          iconColor="#DB2777"
          label={ka.auth.forgotPasswordViaSms}
          onPress={() => Alert.alert(ka.auth.forgotPasswordViaSms, ka.auth.forgotPasswordComingSoon)}
          disabled
        />
        <AuthMethodCard
          icon={KeyRound}
          iconBg="#FFFBEB"
          iconColor="#D97706"
          label={ka.auth.forgotPasswordVia2fa}
          onPress={() => Alert.alert(ka.auth.forgotPasswordVia2fa, ka.auth.forgotPasswordComingSoon)}
          disabled
        />
      </View>
    </AuthShell>
  );
}
