import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, FileText, ShieldCheck, Utensils } from 'lucide-react-native';
import { ProfileSetupPrimaryButton } from '@/components/profile/ProfileSetupButtons';
import { PRIVACY_POLICY_KA } from '@/constants/privacyPolicyKa';
import { PRIVACY_POLICY_EN } from '@/constants/privacyPolicyEn';
import { ka } from '@/i18n/ka';
import { isEn, tx } from '@/i18n/locale';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { startAdMeasurement } from '@/lib/adMeasurement';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubTint } from '@/theme/hub';

type Section = (typeof PRIVACY_POLICY_KA)['sections'][number];

/** "5. AI data" → { n: '5', title: 'AI data' }; un-numbered titles keep n = null. */
function splitTitle(title: string): { n: string | null; title: string } {
  const m = /^(\d+)\.\s*(.+)$/.exec(title.trim());
  if (m) return { n: m[1], title: m[2] };
  return { n: null, title: title.replace(/\s*\(App Review\)\s*$/i, '').replace(/^English summary$/i, 'Summary').trim() };
}

/** The App Review summary is written in English inside the Georgian source; it belongs to the English view only. */
function isReviewSummary(section: Section): boolean {
  return /english summary|app review/i.test(section.title);
}

function PolicySection({ section, open, onToggle }: { section: Section; open: boolean; onToggle: () => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const teal = hubInk('teal', dark);
  const { n, title } = splitTitle(section.title);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.cardHead}
      >
        <View style={[styles.badge, { backgroundColor: hubTint(teal, dark) }]}>
          {n ? (
            <Text style={[styles.badgeText, { color: teal }]}>{n}</Text>
          ) : isReviewSummary(section) ? (
            <FileText size={16} color={teal} strokeWidth={2.2} />
          ) : (
            <Utensils size={16} color={teal} strokeWidth={2.2} />
          )}
        </View>
        <Text style={[styles.cardTitle, { color: colors.text100 }]}>{title}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={20} color={colors.text300} strokeWidth={2.2} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.cardBody}>
          {section.intro ? <Text style={[styles.body, { color: colors.text200 }]}>{section.intro}</Text> : null}
          {section.paragraphs?.map((p) => (
            <Text key={p} style={[styles.body, { color: colors.text200 }]}>
              {p}
            </Text>
          ))}
          {section.bullets?.length ? (
            <View style={{ gap: 8, marginTop: 2 }}>
              {section.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: teal }]} />
                  <Text style={[styles.body, { color: colors.text200, flex: 1, marginBottom: 0 }]}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Privacy policy — same copy as medicard.ge/privacy, laid out as a readable list of sections. */
export default function ProfileSetupPrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const teal = hubInk('teal', dark);
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const english = isEn();
  const policy = english ? PRIVACY_POLICY_EN : PRIVACY_POLICY_KA;
  // Georgian: the English-language App Review summary is dropped. English: it stays as the first section.
  const sections = useMemo(() => (english ? policy.sections : policy.sections.filter((s) => !isReviewSummary(s))), [english, policy]);
  const allOpen = openKeys.size === sections.length;

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg100 }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user || !healthProfile) return <Redirect href="/(auth)/sign-in" />;
  const blocked = onboardingScreenBlocked(preview, user, healthProfile);
  if (blocked === 'assessment') return <Redirect href="/(auth)/assessment" />;
  const viewing = blocked === 'home';

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKeys(allOpen ? new Set() : new Set(sections.map((s) => s.title)));
  };

  const accept = async () => {
    if (viewing) {
      router.back();
      return;
    }
    setBusy(true);
    try {
      const updated = await patchProfileExtra(healthProfile, user, {
        privacyAccepted: true,
        privacyAcceptedAt: new Date().toISOString(),
      });
      setHealthProfile(updated);
      if (!preview) startAdMeasurement(updated.extraAnswers);
      router.replace(onboardingStepHref('/(auth)/profile-setup/ai-privacy', preview) as never);
    } finally {
      setBusy(false);
    }
  };

  const decline = () => {
    Alert.alert(
      ka.profileSetup.privacyTitle,
      tx('აპის გამოყენების გასაგრძელებლად საჭიროა პოლიტიკის დათანხმება.', 'To keep using the app, you need to accept the policy.'),
      [{ text: ka.common.cancel, style: 'cancel' }],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: welcomeTopInset(insets.top) }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 24 }}>
          <View style={[styles.heroTile, { backgroundColor: hubTint(teal, dark) }]}>
            <ShieldCheck size={30} color={teal} strokeWidth={2} />
          </View>
          <Text style={[styles.title, { color: colors.text100 }]}>{policy.title}</Text>
          <View style={[styles.datePill, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dateText, { color: colors.text200 }]}>{ka.profileSetup.privacyEffective(policy.effectiveDate)}</Text>
          </View>
        </View>

        {/* The one thing to know */}
        <View style={[styles.highlight, { backgroundColor: hubTint(teal, dark) }]}>
          <Text style={[styles.highlightTitle, { color: teal }]}>{tx('მთავარი', 'The short version')}</Text>
          <Text style={[styles.highlightBody, { color: colors.text100 }]}>
            {policy.highlight}
          </Text>
        </View>

        <Text style={[styles.intro, { color: colors.text200 }]}>{policy.intro}</Text>

        {/* Sections */}
        <View style={styles.listHead}>
          <Text style={[styles.listTitle, { color: colors.text100 }]}>{tx('სრული პოლიტიკა', 'Full policy')}</Text>
          <Pressable accessibilityRole="button" onPress={toggleAll} hitSlop={10}>
            <Text style={[styles.listLink, { color: teal }]}>
              {allOpen ? tx('ყველას დაკეცვა', 'Collapse all') : tx('ყველას გახსნა', 'Expand all')}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 10 }}>
          {sections.map((section) => (
            <PolicySection
              key={section.title}
              section={section}
              open={openKeys.has(section.title)}
              onToggle={() => toggle(section.title)}
            />
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.bg100, borderTopColor: colors.bg300 },
        ]}
      >
        {viewing ? null : (
          <Text style={[styles.footNote, { color: colors.text300 }]}>
            {tx(
              '„ვეთანხმები“ ნიშნავს, რომ პოლიტიკა წაიკითხე და ეთანხმები.',
              'Tapping “I agree” means you have read and accept this policy.',
            )}
          </Text>
        )}
        <ProfileSetupPrimaryButton
          label={viewing ? ka.common.done : ka.profileSetup.privacyAccept}
          onPress={() => void accept()}
          loading={busy}
          icon="check"
        />
        {viewing ? null : (
          <Pressable accessibilityRole="button" onPress={decline} hitSlop={8} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={[styles.declineText, { color: colors.text300 }]}>{ka.profileSetup.privacyDecline}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 16,
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 24,
    lineHeight: 32,
    textAlign: 'center',
  },
  datePill: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dateText: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  highlight: {
    borderRadius: HUB.cardRadius,
    padding: HUB.cardPad,
  },
  highlightTitle: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  highlightBody: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 15,
    lineHeight: 23,
  },
  intro: {
    marginTop: 18,
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },
  listHead: {
    marginTop: HUB.sectionGap,
    marginBottom: HUB.headingGap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listTitle: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 17,
    lineHeight: 24,
  },
  listLink: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 14,
    lineHeight: 18,
  },
  cardTitle: {
    flex: 1,
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 2,
  },
  body: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: HUB.gutter,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footNote: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  declineText: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
});
