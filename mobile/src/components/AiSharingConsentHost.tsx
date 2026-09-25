import React, { useEffect } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { cancelAiSharingPrompt, decideAiSharing, useAiSharingPrompt } from '@/lib/aiSharingConsent';
import { disclosureCopy } from '@/lib/aiDisclosureCopy';
import { AiPrivacySummary } from '@/components/privacy/AiPrivacySummary';

/**
 * Full-screen permission shown only when current AI consent is missing.
 * After Allow, this does not appear again until consent is revoked or the version changes.
 */
export function AiSharingConsentHost() {
  const prompt = useAiSharingPrompt();
  const { user } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (prompt) Keyboard.dismiss();
  }, [prompt?.promise]);

  useEffect(() => {
    if (!prompt) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!prompt.busy) cancelAiSharingPrompt();
      return true;
    });
    return () => handler.remove();
  }, [prompt]);

  useEffect(() => {
    if (prompt && prompt.owner !== user?.id) cancelAiSharingPrompt();
  }, [prompt, user?.id]);

  if (!prompt || prompt.owner !== user?.id) return null;
  const copy = disclosureCopy(prompt.status.manifest);
  const allowLabel = prompt.status.accepted ? copy.keep : copy.agree;
  const secondaryLabel = prompt.status.accepted ? copy.revoke : copy.decline;

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => { if (!prompt.busy) cancelAiSharingPrompt(); }} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: insets.top + 8 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <AiPrivacySummary manifest={prompt.status.manifest} />
          {prompt.status.accepted ? (
            <Text style={{ marginTop: 12, color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, textAlign: 'center' }}>
              {copy.introAccepted}
            </Text>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16), gap: 8, borderTopWidth: 1, borderColor: colors.bg300, backgroundColor: colors.bg100 }}>
          {prompt.error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
              {prompt.error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: prompt.busy, busy: prompt.busy }}
            disabled={prompt.busy}
            onPress={() => { void decideAiSharing(true); }}
            style={{ minHeight: 52, borderRadius: 16, backgroundColor: '#0F766E', alignItems: 'center', justifyContent: 'center', opacity: prompt.busy ? 0.65 : 1 }}
          >
            {prompt.busy ? <ActivityIndicator color="#FFFFFF" /> : (
              <Text style={{ color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16 }}>{allowLabel}</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={prompt.busy}
            onPress={() => { void decideAiSharing(false); }}
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.text100, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16 }}>{secondaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
