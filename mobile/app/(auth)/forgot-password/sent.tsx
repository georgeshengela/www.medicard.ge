import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { ka } from '@/i18n/ka';
import { showDevUi } from '@/lib/devUi';
import { openEmail } from '@/lib/openEmail';
import { useVelvet, velvetRaised, velvetWell } from '@/theme/velvet';

const DISC = 132;
const WELL = 92;

export default function ForgotPasswordSent() {
  const router = useRouter();
  const { email, devCode } = useLocalSearchParams<{ email: string; devCode?: string }>();
  const { palette: p } = useVelvet();

  const continueToVerify = () => {
    router.push({
      pathname: '/(auth)/forgot-password/verify',
      params: { email: email ?? '', devCode: devCode ?? '' },
    });
  };

  return (
    <AuthShell backgroundColor={p.surface}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
        {/* the letter rests in a well of a raised velvet disc, like the logo on the welcome screen */}
        <View
          style={{
            width: DISC,
            height: DISC,
            borderRadius: DISC / 2,
            backgroundColor: p.surface,
            boxShadow: velvetRaised(p),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: WELL,
              height: WELL,
              borderRadius: WELL / 2,
              backgroundColor: p.surface,
              boxShadow: velvetWell(p),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mail size={40} color="#F59E0B" strokeWidth={1.8} />
          </View>
        </View>

        <Text
          style={{
            marginTop: 34,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 24,
            lineHeight: 32,
            color: p.text,
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
            color: p.ink2,
            textAlign: 'center',
            paddingHorizontal: 8,
          }}
        >
          {ka.auth.forgotPasswordSentBody}
        </Text>

        {showDevUi() && devCode ? (
          <Text
            style={{
              marginTop: 16,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              color: p.ink,
              textAlign: 'center',
            }}
          >
            Dev code: {devCode}
          </Text>
        ) : null}
      </View>

      <VelvetButton palette={p} label={ka.auth.forgotPasswordEnterCode} onPress={continueToVerify} />

      <Pressable
        accessibilityRole="button"
        onPress={() => void openEmail()}
        style={{ marginTop: 14, alignItems: 'center', paddingVertical: 8 }}
      >
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: p.ink }}>
          {ka.auth.forgotPasswordOpenEmail}
        </Text>
      </Pressable>
    </AuthShell>
  );
}
