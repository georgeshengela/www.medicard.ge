import React from 'react';
import { Stack } from 'expo-router';
import { ScanLine } from 'lucide-react-native';
import { AnalysisModule } from '@/components/AnalysisModule';
import { ka } from '@/i18n/ka';

export default function ImagingModule() {
  return (
    <>
      <Stack.Screen options={{ title: ka.modules.imaging.title }} />
      <AnalysisModule
        kind="IMAGING"
        icon={ScanLine}
        uploadTitle={ka.modules.imaging.uploadTitle}
        uploadHint={ka.modules.imaging.uploadHint}
        contextLabel={ka.modules.imaging.contextLabel}
        contextPlaceholder={ka.modules.imaging.contextPlaceholder}
      />
    </>
  );
}
