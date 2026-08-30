import React from 'react';
import { LegalDocumentScreen } from '@/components/profile/LegalDocumentScreen';
import { TERMS_OF_USE_KA } from '@/constants/termsOfUseKa';

export default function TermsOfUseScreen() {
  return (
    <LegalDocumentScreen
      title={TERMS_OF_USE_KA.title}
      effectiveDate={TERMS_OF_USE_KA.effectiveDate}
      intro={TERMS_OF_USE_KA.intro}
      highlight={TERMS_OF_USE_KA.highlight}
      sections={TERMS_OF_USE_KA.sections}
    />
  );
}
