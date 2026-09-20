// Custom web entry needs the same async-chunk loader as Expo Router's normal entry.
import '@expo/metro-runtime';
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { setLocalAccountId } from '@/lib/localAccount';
import Lab from '../../app/module/lab';
import Imaging from '../../app/module/imaging';
import Skin from '../../app/module/skin';
import Skincare from '../../app/module/skincare';
import Chat from '../../app/chat/[mode]';
import { preview } from './analysisPreviewRuntime';
import '../../global.css';

function Preview() {
  const theme = useTheme();
  const [screen, setScreen] = useState('lab');
  const [revision, setRevision] = useState(0);
  const [compact, setCompact] = useState(false);
  const [, updateScenario] = useState('success');
  const [calls, setCalls] = useState('');
  const [fonts] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold });
  if (!fonts) return null;
  setLocalAccountId(preview.owner);
  const Screen = { lab: Lab, imaging: Imaging, skin: Skin, skincare: Skincare, chat: Chat }[screen] ?? Lab;
  return <View style={{ flex: 1, backgroundColor: '#030712' }}>
    <Text style={{ color: '#99F6E4', fontSize: 10, textAlign: 'center' }}>SYNTHETIC QA · no network · {preview.scenario}</Text>
    <ScrollView horizontal style={{ flexGrow: 0, height: 38 }} contentContainerStyle={{ gap: 14, alignItems: 'center', paddingHorizontal: 10 }}>
      {['lab', 'imaging', 'skin', 'skincare', 'chat', 'Theme', 'Compact', 'Reset'].map(label => <Pressable key={label} accessibilityRole="button" onPress={() => {
        if (label === 'Theme') theme.setPreference(theme.scheme === 'dark' ? 'light' : 'dark');
        else if (label === 'Compact') setCompact(v => !v);
        else { if (label !== 'Reset') { preview.screen = label; setScreen(label); } preview.calls = []; preview.attempt = 0; setRevision(v => v + 1); }
      }}><Text style={{ color: '#FFFFFF', fontSize: 12 }}>{label}</Text></Pressable>)}
    </ScrollView>
    <ScrollView horizontal style={{ flexGrow: 0, height: 30 }} contentContainerStyle={{ gap: 14, alignItems: 'center', paddingHorizontal: 10 }}>
      {['success', 'error', 'empty', 'partial', 'oversized', 'cancel', 'denied', 'Calls', 'Account'].map(label => <Pressable key={label} accessibilityRole="button" onPress={() => {
        if (label === 'Calls') setCalls(preview.calls.join(', '));
        else if (label === 'Account') { preview.owner = preview.owner === 'analysis-preview-A' ? 'analysis-preview-B' : 'analysis-preview-A'; setLocalAccountId(preview.owner); setRevision(v => v + 1); }
        else { preview.scenario = label; updateScenario(label); }
      }}><Text style={{ color: '#99F6E4', fontSize: 11 }}>{label}</Text></Pressable>)}
    </ScrollView>
    {calls ? <Text style={{ color: '#FFFFFF', fontSize: 11 }}>Calls: {calls}</Text> : null}
    <View style={{ flex: 1, minHeight: 0 }}><Screen key={`${screen}:${revision}`} /></View>
    {compact ? <View style={{ height: 300, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', textAlign: 'center' }}>შემცირებული სივრცის ტესტი · 300 px</Text></View> : null}
  </View>;
}
registerRootComponent(() => <SafeAreaProvider><ThemeProvider><Preview /></ThemeProvider></SafeAreaProvider>);
