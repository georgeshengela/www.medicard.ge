import React from 'react';
import { LegalDocumentScreen } from '@/components/profile/LegalDocumentScreen';
import { PRIVACY_POLICY_KA } from '@/constants/privacyPolicyKa';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title={PRIVACY_POLICY_KA.title}
      effectiveDate={PRIVACY_POLICY_KA.effectiveDate}
      intro={PRIVACY_POLICY_KA.intro}
      highlight={PRIVACY_POLICY_KA.highlight}
      sections={PRIVACY_POLICY_KA.sections}
    />
  );
}
