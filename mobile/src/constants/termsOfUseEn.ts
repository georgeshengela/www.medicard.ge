import type { LegalSection } from './privacyPolicyKa';

/**
 * Medicard.GE — Terms of Use (English translation of TERMS_OF_USE_KA).
 * The Georgian text is the legal record; keep sections and numbering in step with termsOfUseKa.ts.
 */
export const TERMS_OF_USE_EN = {
  title: 'Terms of Use',
  effectiveDate: 'September 28, 2026',
  intro:
    'This is an English translation. If it differs from the Georgian version, the Georgian version applies.\n\nThese terms govern your use of the Medicard.GE app and related services. By registering in or using the app, you agree to these terms.',
  highlight:
    'Medicard is a tool for health information and self-management. It does not replace a doctor, a diagnosis or emergency care.',
  sections: [
    {
      title: '1. The service',
      paragraphs: [
        'Medicard lets you keep health records, a medication calendar, metrics and cycle tracking, and get informational answers from the AI assistant, Medi.',
      ],
    },
    {
      title: '2. Your account',
      bullets: [
        'Your account is personal. Do not share your password or SMS code with anyone.',
        'Enter your correct name, contact details and medical profile — this affects the assessments.',
        'You are responsible for the data stored on your device and for the permissions you grant.',
        'If you think your account has been compromised, contact us: support@medicard.ge.',
      ],
    },
    {
      title: '3. Medical disclaimer',
      paragraphs: [
        'Medi and other AI answers are educational. They are not a diagnosis, a prescription or a treatment order.',
        'Cycle predictions, the fertile window and logged test results are your own observations — Medicard does not confirm pregnancy or ovulation.',
      ],
    },
    {
      title: '4. Free access',
      paragraphs: [
        'In this release, registration and use of all consumer features are free. There is no paid plan, subscription, trial period or commercial daily/monthly AI quota.',
        'Technical limits for security, concurrent requests and file size apply. Sending data to AI requires separate consent.',
      ],
    },
    {
      title: '5. Acceptable use',
      intro: 'You must not:',
      bullets: [
        'Use another person’s data or medical records without their consent.',
        'Hack or scrape the app, send excessive automated requests or bypass security.',
        'Upload unlawful, harmful or misleading content.',
        'Use the service to present Medicard as giving an official medical opinion.',
        'In MEDI COACH, insult or harass others, post inappropriate content or spam, use a fake profile or certificate, or use another person’s shared data for anything other than training. Trainers are independent professionals; you can report a violation and block someone from the app, and MEDICARD may suspend a trainer’s status or account.',
      ],
    },
    {
      title: '6. Intellectual property',
      paragraphs: [
        'The app’s design, logo, texts and software code belong to Medicard.GE or its licensors.',
        'You remain the owner of the records and notes you upload. You grant us a license to use them only to provide the service.',
      ],
    },
    {
      title: '7. Limitation of liability',
      paragraphs: [
        'The service is provided “as is”. We do not guarantee that AI answers are complete, error-free or accurate for your clinical situation.',
      ],
    },
    {
      title: '8. Account deletion and termination',
      paragraphs: [
        'You can delete your account in the app: Profile → Delete account. Your profile, records, chats, medications, cycle data and related data are deleted.',
        'We may suspend or delete an account if these terms or the law are broken.',
        'After deletion you can no longer sign in. Some technical logs may remain temporarily for auditing.',
      ],
    },
    {
      title: '9. Changes',
      paragraphs: [
        'We may update these terms. If there is a significant change, we will let you know in the app or by email. Continuing to use the service means you agree.',
      ],
    },
    {
      title: '10. Contact',
      paragraphs: [
        'Service provider: George Shengelia (გიორგი შენგელია), an individual.',
        'Country and city of operation: Tbilisi, Georgia.',
        'For questions: support@medicard.ge',
        'MEDICARD — a digital health platform. Website: https://medicard.ge',
      ],
    },
  ] satisfies LegalSection[],
};
