// Isolated visual QA: real anatomy, chips and modal components, synthetic local data only.
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { SymptomBodyMap } from '@/components/symptoms/SymptomBodyMap';
import { SymptomSheet } from '@/components/symptoms/SymptomSheet';
import { SymptomChip } from '@/components/symptoms/SymptomChip';
import { bodyPartById, organById, symptomsForSelection } from '@/constants/symptomCatalog';
import { addSymptom, removeSymptom, updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';
import { AiSharingConsentHost } from '@/components/AiSharingConsentHost';
import { requestAiSharingPrompt } from '@/lib/aiSharingConsent';
import { setLocalAccountId } from '@/lib/localAccount';
import disclosure from '@/config/aiDisclosure.json';
import '../../global.css';

function Preview() {
  const theme = useTheme(), s = useSymptomChecker();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [fonts] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold });
  if (!fonts) return null;
  return <View style={{ flex: 1, backgroundColor: theme.scheme === 'dark' ? '#030712' : '#F5F7F7' }}>
    <View style={{ height: 44, backgroundColor: '#1F2937' }}><ScrollView horizontal contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 12, gap: 18 }}>
      {['Consent', 'Failed save', 'Theme', 'MALE', 'FEMALE', 'Front', 'Back', 'Muscles', 'Organs', '16 symptoms', 'Clear'].map(label => <Pressable key={label} accessibilityRole="button" onPress={() => {
        if (label === 'Consent' || label === 'Failed save') {
          setLocalAccountId('synthetic-visual-qa');
          const status = { version: 'synthetic-preview', accepted: false, decision: null, updatedAt: null, manifest: disclosure };
          void requestAiSharingPrompt('synthetic-visual-qa', status, async decision => {
            if (label === 'Failed save') throw new Error('საცდელი კავშირის შეცდომა — არჩევანი არ შენახულა.');
            setChoice(decision); return { ...status, accepted: decision === 'accepted', decision };
          }).then(accepted => setChoice(accepted ? 'accepted' : 'not accepted'));
        }
        if (label === 'Theme') theme.setPreference(theme.scheme === 'dark' ? 'light' : 'dark');
        if (label === 'MALE' || label === 'FEMALE') updateSymptomChecker({ gender: label });
        if (label === 'Front' || label === 'Back') updateSymptomChecker({ side: label === 'Front' ? 'front' : 'back' });
        if (label === 'Muscles' || label === 'Organs') updateSymptomChecker({ mode: label === 'Muscles' ? 'muscle' : 'organ' });
        if (label === '16 symptoms') for (let i = 1; i <= 16; i++) addSymptom(`საცდელი სიმპტომი ${i}`);
        if (label === 'Clear') s.symptoms.forEach(removeSymptom);
      }}><Text style={{ color: '#FFFFFF', fontSize: 12 }}>{label}</Text></Pressable>)}
    </ScrollView></View>
    {choice ? <Text accessibilityLiveRegion="polite">{choice}</Text> : null}
    <SymptomBodyMap gender={s.gender} side={s.side} mode={s.mode} selectedPartId={s.selectedPartId} selectedOrganId={s.selectedOrganId} symptoms={s.symptoms}
      onToggleSide={() => updateSymptomChecker({ side: s.side === 'front' ? 'back' : 'front' })}
      onSelectPart={id => { updateSymptomChecker({ selectedPartId: id }); setOpen(true); }}
      onSelectOrgan={id => { updateSymptomChecker({ selectedOrganId: id }); setOpen(true); }}
      onOpenList={() => setOpen(true)} onRemoveSymptom={removeSymptom} onContinue={() => setOpen(true)} />
    <SymptomSheet visible={open} title={bodyPartById(s.selectedPartId)?.labelKa || organById(s.selectedOrganId)?.labelKa || 'სიმპტომები'} onClose={() => setOpen(false)} ctaLabel="გაგრძელება" onCta={() => setOpen(false)}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{symptomsForSelection(s.mode, s.selectedPartId, s.selectedOrganId).map(label => <SymptomChip key={label} label={label} selected={s.symptoms.includes(label)} onPress={() => s.symptoms.includes(label) ? removeSymptom(label) : addSymptom(label)} />)}</View>
    </SymptomSheet>
    <AiSharingConsentHost />
  </View>;
}
registerRootComponent(() => <SafeAreaProvider><ThemeProvider><Preview /></ThemeProvider></SafeAreaProvider>);
