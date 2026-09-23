/** Pick Georgian or English AI-disclosure copy. App Review devices are English. */

import bundled from '../config/aiDisclosure.json' with { type: 'json' };

const KA_HEADINGS = {
  recipients: 'მონაცემების მიმღებები',
  sent: 'რა იგზავნება',
  processors: 'ვინ ამუშავებს',
};

export function isGeorgianLocale(locale) {
  return /^ka\b/i.test(String(locale || ''));
}

export function deviceLanguageTag() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  } catch {
    return 'en';
  }
}

export function disclosureCopy(manifest, locale = deviceLanguageTag()) {
  const english = manifest?.en || bundled.en;
  if (english && !isGeorgianLocale(locale)) {
    return {
      title: english.title,
      purpose: english.purpose,
      categories: english.categories,
      recipients: english.recipients || manifest.recipients,
      retention: english.retention,
      choice: english.choice,
      headings: english.headings || {
        recipients: 'Who receives the data',
        sent: 'What is sent',
        processors: 'Who processes it',
      },
      intro: english.intro,
      introAccepted: english.introAccepted,
      agree: english.agree,
      decline: english.decline,
      keep: english.keep,
      revoke: english.revoke,
      policy: english.policy,
      policyHide: english.policyHide,
      closeAllow: english.closeAllow,
      closeDeny: english.closeDeny,
    };
  }
  return {
    title: manifest.title,
    purpose: manifest.purpose,
    categories: manifest.categories,
    recipients: manifest.recipients,
    retention: manifest.retention,
    choice: manifest.choice,
    headings: KA_HEADINGS,
    intro: 'შენი ნებართვის გარეშე გარე AI-ს მონაცემებს არ ვუგზავნით.',
    introAccepted: 'გაზიარება ნებადართულია. არჩევანის შეცვლა ნებისმიერ დროს შეგიძლია.',
    agree: 'ვეთანხმები AI-სთან გაზიარებას',
    decline: 'გაგრძელება AI-ის გარეშე',
    keep: 'თანხმობის შენარჩუნება',
    revoke: 'თანხმობის გაუქმება',
    policy: 'MEDICARD-ის კონფიდენციალურობის პოლიტიკა',
    policyHide: 'პოლიტიკის შეკეცვა',
    closeAllow: 'დახურვა — არჩევანის შეუცვლელად',
    closeDeny: 'დახურვა — გაზიარების გარეშე',
  };
}
