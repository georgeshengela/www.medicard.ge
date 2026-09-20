import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { ShieldCheck, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { cancelAiSharingPrompt, decideAiSharing, useAiSharingPrompt } from '@/lib/aiSharingConsent';
import { PRIVACY_POLICY_KA } from '@/constants/privacyPolicyKa';

export function AiSharingConsentHost() {
  const prompt = useAiSharingPrompt(), { user } = useAuth(), colors = useThemeColors(), insets = useSafeAreaInsets();
  const [policyOpen, setPolicyOpen] = useState(false);
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
  const { manifest } = prompt.status;
  const body = { color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 23 };
  return <View accessibilityViewIsModal style={{ position: 'absolute', inset: 0, zIndex: 12000, elevation: 12000, backgroundColor: 'rgba(3,7,18,0.65)', justifyContent: 'center', paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }}>
    <View style={{ maxHeight: '100%', backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.bg300, overflow: 'hidden' }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ShieldCheck size={30} color={colors.primary200} />
          <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" disabled={prompt.busy} onPress={cancelAiSharingPrompt} hitSlop={12} style={{ padding: 8 }}><X size={22} color={colors.text200} /></Pressable>
        </View>
        <Text accessibilityRole="header" style={{ color: colors.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 21, lineHeight: 30 }}>{manifest.title}</Text>
        <Text style={body}>{manifest.purpose}</Text>
        <Text style={[body, { color: colors.text100 }]}>{manifest.recipients.map(p => p.name).join(' · ')}</Text>
        <Text style={[body, { fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }]}>რა იგზავნება</Text>
        {manifest.categories.map(text => <Text key={text} style={body}>• {text}</Text>)}
        <Text style={[body, { fontFamily: 'NotoSansGeorgian_700Bold', color: colors.text100 }]}>ვინ ამუშავებს</Text>
        {manifest.recipients.map(provider => <View key={provider.name} style={{ gap: 3 }}><Text style={[body, { fontFamily: 'NotoSansGeorgian_600SemiBold', color: colors.text100 }]}>{provider.name}</Text><Text style={body}>{provider.role}</Text></View>)}
        <Text style={body}>{manifest.retention}</Text><Text style={body}>{manifest.choice}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: policyOpen }} onPress={() => setPolicyOpen(!policyOpen)} style={{ paddingVertical: 8 }}><Text style={[body, { color: colors.primary200, textDecorationLine: 'underline' }]}>{policyOpen ? 'პოლიტიკის შეკეცვა' : 'კონფიდენციალურობის პოლიტიკის წაკითხვა'}</Text></Pressable>
        {policyOpen ? <View style={{ gap: 12 }}><Text style={body}>{PRIVACY_POLICY_KA.intro}</Text>{PRIVACY_POLICY_KA.sections.map(section => <View key={section.title} style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={[body, { color: colors.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{section.title}</Text>
          {section.intro ? <Text style={body}>{section.intro}</Text> : null}
          {section.paragraphs?.map(text => <Text key={text} style={body}>{text}</Text>)}
          {section.bullets?.map(text => <Text key={text} style={body}>• {text}</Text>)}
        </View>)}</View> : null}
      </ScrollView>
      <View style={{ padding: 16, borderTopWidth: 1, borderColor: colors.bg300, gap: 8 }}>
        {prompt.error ? <Text accessibilityRole="alert" style={[body, { color: colors.danger }]}>{prompt.error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={prompt.busy} onPress={() => { void decideAiSharing(true); }} style={{ minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' }}>
          {prompt.busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#FFFFFF', textAlign: 'center' }}>{prompt.status.accepted ? 'თანხმობის შენარჩუნება' : 'ვეთანხმები გაზიარებას'}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" disabled={prompt.busy} onPress={() => { void decideAiSharing(false); }} style={{ minHeight: 46, padding: 10, alignItems: 'center', justifyContent: 'center' }}><Text style={[body, { color: colors.text100 }]}>{prompt.status.accepted ? 'თანხმობის გაუქმება' : 'არ ვეთანხმები'}</Text></Pressable>
      </View>
    </View>
  </View>;
}
