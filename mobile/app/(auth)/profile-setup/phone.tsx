import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { needsHealthAssessment, needsProfileSetup, useAuth } from '@/store/AuthContext';

function formatDisplayPhone(digits: string) {
  const d = digits.replace(/\D/g, '').replace(/^995/, '').slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** Profile setup — phone entry (Figma 8845:310502). */
export default function ProfileSetupPhoneScreen() {
  const router = useRouter();
  const { user, ready, healthProfile } = useAuth();
  const [local, setLocal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalised = useMemo(() => {
    const digits = local.replace(/\D/g, '').replace(/^995/, '').slice(0, 9);
    return digits.length === 9 ? `+995${digits}` : null;
  }, [local]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (needsHealthAssessment(healthProfile)) return <Redirect href="/(auth)/assessment" />;
  if (!needsProfileSetup(healthProfile)) return <Redirect href="/(tabs)/home" />;

  const continuePhone = async () => {
    if (!normalised || !/^\+9955\d{8}$/.test(normalised)) {
      setError(ka.auth.invalidPhone);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.auth.phoneLinkStart(normalised);
      router.push({ pathname: '/(auth)/profile-setup/verify', params: { phone: normalised } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileSetupShell
      title={ka.profileSetup.phoneTitle}
      body={ka.profileSetup.phoneBody}
      primaryLabel={ka.assessment.continue}
      canBack
      onBack={() => router.back()}
      loading={busy}
      primaryDisabled={!normalised}
      onPrimary={() => void continuePhone()}
      showStepper={false}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 32 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: error ? '#FCA5A5' : '#E5E7EB',
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 4,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Image
            source={{ uri: 'https://flagcdn.com/w40/ge.png' }}
            style={{ width: 28, height: 20, borderRadius: 3, marginRight: 12 }}
          />
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 18,
              color: '#374151',
              marginRight: 8,
            }}
          >
            +995
          </Text>
          <TextInput
            value={formatDisplayPhone(local)}
            onChangeText={(text) => setLocal(text.replace(/\D/g, '').replace(/^995/, '').slice(0, 9))}
            placeholder={ka.auth.phonePlaceholder}
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            autoComplete="tel"
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 20,
              color: '#111827',
              paddingVertical: 16,
            }}
          />
        </View>
        {error ? (
          <Text
            style={{
              marginTop: 10,
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              color: '#EF4444',
            }}
          >
            {error}
          </Text>
        ) : null}
      </View>
    </ProfileSetupShell>
  );
}
