import React from 'react';
import { LegalDocumentScreen } from '@/components/profile/LegalDocumentScreen';
import { TERMS_OF_USE_KA } from '@/constants/termsOfUseKa';
import { TERMS_OF_USE_EN } from '@/constants/termsOfUseEn';
import { isEn } from '@/i18n/locale';

export default function TermsOfUseScreen() {
  const TERMS = isEn() ? TERMS_OF_USE_EN : TERMS_OF_USE_KA;
  return (
    <LegalDocumentScreen
      title={TERMS.title}
      effectiveDate={TERMS.effectiveDate}
      intro={TERMS.intro}
      highlight={TERMS.highlight}
      sections={TERMS.sections}
    />
  );
}
