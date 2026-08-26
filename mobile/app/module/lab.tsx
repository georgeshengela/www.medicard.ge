import React from 'react';
import { FlaskConical } from 'lucide-react-native';
import { AnalysisModule } from '@/components/AnalysisModule';
import { ka } from '@/i18n/ka';

export default function LabModule() {
  return (
    <AnalysisModule
      kind="LAB"
      icon={FlaskConical}
      uploadTitle={ka.modules.lab.uploadTitle}
      uploadHint={ka.modules.lab.uploadHint}
      contextLabel={ka.modules.lab.contextLabel}
      contextPlaceholder={ka.modules.lab.contextPlaceholder}
      allowPdf
    />
  );
}
