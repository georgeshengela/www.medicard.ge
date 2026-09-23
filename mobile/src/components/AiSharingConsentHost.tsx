import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Linking, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { ShieldCheck, X, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { cancelAiSharingPrompt, decideAiSharing, useAiSharingPrompt } from '@/lib/aiSharingConsent';
import { disclosureCopy } from '@/lib/aiDisclosureCopy';
import { PRIVACY_POLICY_KA } from '@/constants/privacyPolicyKa';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';

export function AiSharingConsentHost() {
  const prompt = useAiSharingPrompt(), { user } = useAuth(), colors = useThemeColors(), insets = useSafeAreaInsets();
  const [policyOpen, setPolicyOpen] = useState(false);
  const { height, width } = useWindowDimensions();
  useEffect(() => { if (prompt) Keyboard.dismiss(); setPolicyOpen(false); }, [prompt?.promise]);
  useEffect(() => {
    if (!prompt) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (policyOpen) setPolicyOpen(false);
      else if (!prompt.busy) cancelAiSharingPrompt();
      return true;
    });
    return () => handler.remove();
  }, [prompt, policyOpen]);
  useEffect(() => { if (prompt && prompt.owner !== user?.id) cancelAiSharingPrompt(); }, [prompt, user?.id]);
  if (!prompt || prompt.owner !== user?.id) return null;
  const copy = disclosureCopy(prompt.status.manifest);
  const body = { color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 23 };
  const close = () => { if (policyOpen) setPolicyOpen(false); else if (!prompt.busy) cancelAiSharingPrompt(); };
  const cardMax = Math.min(720, width - 24);
  return <Modal visible {...APP_MODAL_PROPS} onRequestClose={close}>
    <View style={{ flex: 1, backgroundColor: 'rgba(3,7,18,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}>
    <View accessibilityViewIsModal style={{ width: '100%', maxWidth: cardMax, maxHeight: Math.max(240, height - insets.top - insets.bottom - 24), backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.bg300, overflow: 'hidden' }}>
      <View style={{ padding: 20, paddingBottom: 14, gap: 10, borderBottomWidth: 1, borderColor: colors.bg300 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ShieldCheck size={26} color={colors.primary100} />
          <Pressable accessibilityRole="button" accessibilityLabel={prompt.status.accepted ? copy.closeAllow : copy.closeDeny} disabled={prompt.busy} onPress={cancelAiSharingPrompt} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><X size={22} color={colors.text200} /></Pressable>
        </View>
        <Text accessibilityRole="header" style={{ color: colors.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 29 }}>{copy.title}</Text>
        <Text style={[body, { fontSize: 12, lineHeight: 19 }]}>{prompt.status.accepted ? copy.introAccepted : copy.intro}</Text>
      </View>
      <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={[body, { fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }]}>{copy.headings.recipients}</Text>
          <Text style={body}>{copy.recipients.map(provider => provider.name).join(' · ')}</Text>
        </View>
        <Text style={body}>{copy.purpose}</Text>
        <Text style={[body, { fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }]}>{copy.headings.sent}</Text>
        {copy.categories.map(text => <Text key={text} style={body}>• {text}</Text>)}
        <Text style={[body, { fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }]}>{copy.headings.processors}</Text>
        {copy.recipients.map(provider => <View key={provider.name} style={{ gap: 3 }}>
          <Pressable accessibilityRole="link" accessibilityLabel={`${provider.name} privacy policy`} onPress={() => { void Linking.openURL(provider.url).catch(() => undefined); }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[body, { flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', color: colors.primary100 }]}>{provider.name}</Text><ExternalLink size={16} color={colors.primary100} />
          </Pressable><Text style={body}>{provider.role}</Text>
        </View>)}
        <Text style={body}>{copy.retention}</Text><Text style={body}>{copy.choice}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: policyOpen }} onPress={() => setPolicyOpen(!policyOpen)} style={{ minHeight: 44, paddingVertical: 8 }}><Text style={[body, { color: colors.primary100, textDecorationLine: 'underline' }]}>{policyOpen ? copy.policyHide : copy.policy}</Text></Pressable>
        {policyOpen ? <View style={{ gap: 12 }}><Text style={body}>{PRIVACY_POLICY_KA.intro}</Text>{PRIVACY_POLICY_KA.sections.map(section => <View key={section.title} style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={[body, { color: colors.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{section.title}</Text>
          {section.intro ? <Text style={body}>{section.intro}</Text> : null}
          {section.paragraphs?.map(text => <Text key={text} style={body}>{text}</Text>)}
          {section.bullets?.map(text => <Text key={text} style={body}>• {text}</Text>)}
        </View>)}</View> : null}
      </ScrollView>
      <View style={{ padding: 16, borderTopWidth: 1, borderColor: colors.bg300, gap: 8 }}>
        {prompt.error ? <Text accessibilityRole="alert" style={[body, { color: colors.danger }]}>{prompt.error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: prompt.busy, busy: prompt.busy }} disabled={prompt.busy} onPress={() => { void decideAiSharing(true); }} style={{ minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: '#0F766E', opacity: prompt.busy ? 0.65 : 1, alignItems: 'center', justifyContent: 'center' }}>
          {prompt.busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#FFFFFF', textAlign: 'center' }}>{prompt.status.accepted ? copy.keep : copy.agree}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={prompt.busy} onPress={() => { void decideAiSharing(false); }} style={{ minHeight: 46, padding: 10, alignItems: 'center', justifyContent: 'center' }}><Text style={[body, { color: colors.text100, textAlign: 'center' }]}>{prompt.status.accepted ? copy.revoke : copy.decline}</Text></Pressable>
      </View>
    </View>
  </View></Modal>;
}
