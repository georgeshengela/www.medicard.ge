import React, { useMemo, useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, FileText, ShieldCheck, Utensils } from 'lucide-react-native';
import { OnboardingExitCard } from '@/components/auth/OnboardingExit';
import { QuietAction, StepHeader } from '@/components/onboarding/OnboardingKit';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { PRIVACY_POLICY_KA } from '@/constants/privacyPolicyKa';
import { PRIVACY_POLICY_EN } from '@/constants/privacyPolicyEn';
import { ka } from '@/i18n/ka';
import { isEn, tx } from '@/i18n/locale';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { startAdMeasurement } from '@/lib/adMeasurement';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { ONBOARDING_COUNTED_QUESTIONS, ONBOARDING_TAIL_STEPS } from '@/constants/assessmentSteps';
import { velvetField, velvetLift, useVelvet, type VelvetPalette } from '@/theme/velvet';

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

function PolicySection({ section, open, onToggle, palette: p }: { section: Section; open: boolean; onToggle: () => void; palette: VelvetPalette }) {
  const { n, title } = splitTitle(section.title);

  return (
    <View style={[styles.card, { backgroundColor: p.raised, boxShadow: velvetLift(p) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={styles.cardHead}
      >
        <View style={[styles.badge, { backgroundColor: p.field, boxShadow: velvetField(p) }]}>
          {n ? (
            <Text style={[styles.badgeText, { color: p.ink }]}>{n}</Text>
          ) : isReviewSummary(section) ? (
            <FileText size={16} color={p.ink} strokeWidth={2.2} />
          ) : (
            <Utensils size={16} color={p.ink} strokeWidth={2.2} />
          )}
        </View>
        <Text style={[styles.cardTitle, { color: p.text }]}>{title}</Text>
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <ChevronDown size={20} color={p.inkOff} strokeWidth={2.2} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.cardBody}>
          {section.intro ? <Text style={[styles.body, { color: p.ink2 }]}>{section.intro}</Text> : null}
          {section.paragraphs?.map((para) => (
            <Text key={para} style={[styles.body, { color: p.ink2 }]}>
              {para}
            </Text>
          ))}
          {section.bullets?.length ? (
            <View style={{ gap: 8, marginTop: 2 }}>
              {section.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <View style={[styles.dot, { backgroundColor: p.pulse }]} />
                  <Text style={[styles.body, { color: p.ink2, flex: 1, marginBottom: 0 }]}>{b}</Text>
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
  const { palette: p } = useVelvet();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const english = isEn();
  const policy = english ? PRIVACY_POLICY_EN : PRIVACY_POLICY_KA;
  // Georgian: the English-language App Review summary is dropped. English: it stays as the first section.
  const sections = useMemo(() => (english ? policy.sections : policy.sections.filter((s) => !isReviewSummary(s))), [english, policy]);
  const allOpen = openKeys.size === sections.length;

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface }}>
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
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await patchProfileExtra(healthProfile, user, {
        privacyAccepted: true,
        privacyAcceptedAt: new Date().toISOString(),
      });
      setHealthProfile(updated);
      if (!preview) startAdMeasurement(updated.extraAnswers);
      router.replace(onboardingStepHref('/(auth)/profile-setup/ai-privacy', preview) as never);
    } catch (e) {
      // The acceptance is a legal record: it moves on only once the server stored it.
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // Declining never records anything; the card offers reading again, signing out or deleting the account.
  const decline = () => setDeclineOpen(true);

  return (
    <View style={{ flex: 1, backgroundColor: p.surface }}>
      {viewing ? <View style={{ height: insets.top + 10 }} /> : <StepHeader palette={p} step={ONBOARDING_COUNTED_QUESTIONS} total={ONBOARDING_COUNTED_QUESTIONS + ONBOARDING_TAIL_STEPS} />}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>{policy.title}</Text>
        <Text style={[styles.dateText, { color: p.inkOff }]}>{ka.profileSetup.privacyEffective(policy.effectiveDate)}</Text>

        {/* The one thing to know */}
        <View style={[styles.highlight, { backgroundColor: p.raised, boxShadow: velvetLift(p) }]}>
          <View style={[styles.heroTile, { backgroundColor: p.field, boxShadow: velvetField(p) }]}>
            <ShieldCheck size={24} color={p.pulse} strokeWidth={2.1} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.highlightTitle, { color: p.ink }]}>{tx('მთავარი', 'The short version')}</Text>
            <Text style={[styles.highlightBody, { color: p.text }]}>{policy.highlight}</Text>
          </View>
        </View>

        <Text style={[styles.intro, { color: p.ink2 }]}>{policy.intro}</Text>

        {/* Sections */}
        <View style={styles.listHead}>
          <Text style={[styles.listTitle, { color: p.text }]}>{tx('სრული პოლიტიკა', 'Full policy')}</Text>
          <Pressable accessibilityRole="button" onPress={toggleAll} hitSlop={10}>
            <Text style={[styles.listLink, { color: p.ink }]}>
              {allOpen ? tx('ყველას დაკეცვა', 'Collapse all') : tx('ყველას გახსნა', 'Expand all')}
            </Text>
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          {sections.map((section) => (
            <PolicySection
              key={section.title}
              section={section}
              open={openKeys.has(section.title)}
              onToggle={() => toggle(section.title)}
              palette={p}
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: p.surface }]}>
        {viewing ? null : (
          <Text style={[styles.footNote, { color: p.inkOff }]}>
            {tx(
              '„ვეთანხმები“ ნიშნავს, რომ პოლიტიკა წაიკითხე და ეთანხმები.',
              'Tapping “I agree” means you have read and accept this policy.',
            )}
          </Text>
        )}
        {error ? <VelvetNotice palette={p} text={error} /> : null}
        <VelvetButton palette={p} label={viewing ? ka.common.done : ka.profileSetup.privacyAccept} onPress={() => void accept()} busy={busy} />
        {viewing ? null : <QuietAction palette={p} label={ka.profileSetup.privacyDecline} onPress={decline} disabled={busy} />}
      </View>
      {viewing ? null : (
        <OnboardingExitCard
          visible={declineOpen}
          title={tx('პოლიტიკის გარეშე ვერ გავაგრძელებთ', 'We can’t continue without the policy')}
          body={tx(
            'აპის გამოყენების გასაგრძელებლად საჭიროა პოლიტიკის დათანხმება. თუ არ ეთანხმები, შეგიძლია გახვიდე ან წაშალო ანგარიში და მასთან ერთად შენახული პასუხები.',
            'To keep using the app, you need to accept the policy. If you don’t agree, you can sign out, or delete your account together with the answers stored with it.',
          )}
          stayLabel={tx('წავიკითხავ ხელახლა', 'Read it again')}
          onClose={() => setDeclineOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroTile: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 26,
    lineHeight: 35,
  },
  dateText: {
    marginTop: 6,
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  highlight: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 22,
    padding: 18,
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
    marginTop: 28,
    marginBottom: 12,
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
    borderRadius: 20,
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
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  footNote: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  declineText: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
});
