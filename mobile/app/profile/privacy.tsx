import React from 'react';
import { LegalDocumentScreen } from '@/components/profile/LegalDocumentScreen';
import { PRIVACY_POLICY_KA } from '@/constants/privacyPolicyKa';
import { PRIVACY_POLICY_EN } from '@/constants/privacyPolicyEn';
import { isEn } from '@/i18n/locale';

export default function PrivacyPolicyScreen() {
  const PRIVACY_POLICY = isEn() ? PRIVACY_POLICY_EN : PRIVACY_POLICY_KA;
  return (
    <LegalDocumentScreen
      title={PRIVACY_POLICY.title}
      effectiveDate={PRIVACY_POLICY.effectiveDate}
      intro={PRIVACY_POLICY.intro}
      highlight={PRIVACY_POLICY.highlight}
      sections={PRIVACY_POLICY.sections}
    />
  );
}
