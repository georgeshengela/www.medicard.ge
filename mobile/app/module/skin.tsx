import React from 'react';
import { Stack } from 'expo-router';
import { Stethoscope } from 'lucide-react-native';
import { AnalysisModule } from '@/components/AnalysisModule';
import { ka } from '@/i18n/ka';

export default function SkinModule() {
  return (
    <>
      <Stack.Screen options={{ title: ka.modules.skin.title }} />
      <AnalysisModule
        kind="SKIN"
        icon={Stethoscope}
        uploadTitle={ka.modules.skin.uploadTitle}
        uploadHint={ka.modules.skin.uploadHint}
        contextLabel={ka.modules.skin.contextLabel}
        contextPlaceholder={ka.modules.skin.contextPlaceholder}
      />
    </>
  );
}
