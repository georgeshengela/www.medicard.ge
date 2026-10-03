/**
 * `/cycle/settings` — a short hub (W2-9, brief §9 wave 2 item 13): one purpose line and four rows
 * (პროფილი · შეხსენებები · კონფიდენციალურობა · მონაცემები), each opening its own screen with its own
 * save. Every row says in one line what is set now. An old `?section=` link opens that screen.
 */
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing, ChevronRight, CloudCheck, Database, LockKeyhole, UserRound, type LucideIcon } from 'lucide-react-native';
import { CycleAtmosphere, CycleCard, cycleNavHeader } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { CycleMode } from '@/lib/api';
import { getCycleReminderPrefs, isCyclePrivacyLockEnabled, type CycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { CYCLE_HISTORY_ACCOUNT_LINE, cycleSettingsRoute, cycleSettingsSection, type CycleSettingsSection } from '@/lib/cycleSettingsRoutes';
import { useIsDark } from '@/theme/colors';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';
import { useCycleSettingsView, type CycleColors } from './CycleSettingsKit';

const MODE_LABEL: Record<CycleMode, string> = {
  TRACK_PERIOD: ka.cycle.modePeriod,
  TRY_TO_CONCEIVE: ka.cycle.modeTtc,
  PREGNANCY: ka.cycle.modePregnancy,
  PERIMENOPAUSE: ka.cycle.modePeri,
  POSTPARTUM: ka.cycle.modePostpartum,
};

export function CycleSettingsHub() {
  const c = useCycleColors();
  const dark = useIsDark();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const { bundle } = useCycleSettingsView();
  const [prefs, setPrefs] = useState<CycleReminderPrefs | null>(null);
  const [lockOn, setLockOn] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.settings));
  }, [navigation, c]);

  // An old deep link (`/cycle/settings?section=reminders`) opens that screen once, above the hub.
  const routed = useRef(false);
  useEffect(() => {
    if (routed.current) return;
    const target = cycleSettingsSection(section);
    if (!target) return;
    routed.current = true;
    router.push(cycleSettingsRoute(target) as never);
  }, [section, router]);

  const mode = bundle?.profile.mode ?? null;
  // Device prefs (no server read): re-read whenever the hub shows again, so a row matches what was just set.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void Promise.all([getCycleReminderPrefs({ mode }), isCyclePrivacyLockEnabled()]).then(([next, lock]) => {
        if (!alive) return;
        setPrefs(next);
        setLockOn(lock);
      });
      return () => {
        alive = false;
      };
    }, [mode]),
  );

  const profile = bundle?.profile;
  const rows: { id: CycleSettingsSection; icon: LucideIcon; title: string; summary: string }[] = [
    {
      id: 'profile',
      icon: UserRound,
      title: tx('პროფილი', 'Profile'),
      summary: profile
        ? `${MODE_LABEL[profile.mode] ?? ka.cycle.modePeriod} · ${tx(
            `${profile.avgCycleLength ?? 28} / ${profile.avgPeriodLength ?? 5} დღე`,
            `${profile.avgCycleLength ?? 28} / ${profile.avgPeriodLength ?? 5} days`,
          )}`
        : tx('რეჟიმი, ციკლის სიგრძე, კონტრაცეფცია', 'Mode, cycle length, contraception'),
    },
    {
      id: 'reminders',
      icon: BellRing,
      title: ka.cycle.settingsReminders,
      summary: !prefs
        ? tx('შეხსენებები და ჩაკეტილი ეკრანი', 'Reminders and the lock screen')
        : !prefs.enabled
          ? tx('გამორთულია', 'Off')
          : prefs.maskNotifications || profile?.privacyEnabled
            ? tx('ჩართულია · ტექსტი დამალულია', 'On · text hidden')
            : tx('ჩართულია', 'On'),
    },
    {
      id: 'privacy',
      icon: LockKeyhole,
      title: ka.cycle.settingsPrivacy,
      summary: [
        lockOn === null
          ? tx('Face ID / PIN, პარტნიორთან გაზიარება', 'Face ID / PIN, partner sharing')
          : lockOn
            ? tx('Face ID / PIN ჩართულია', 'Face ID / PIN on')
            : tx('Face ID / PIN გამორთულია', 'Face ID / PIN off'),
        bundle?.partnerShare?.active ? tx('პარტნიორს უზიარებ', 'Shared with a partner') : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      id: 'data',
      icon: Database,
      title: tx('მონაცემები', 'Data'),
      summary: tx('ექიმის PDF, ექსპორტი, წაშლა', 'Doctor PDF, export, delete'),
    },
  ];

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginBottom: 18, paddingHorizontal: 2 }}>
          {tx('აირჩიე, რისი შეცვლა გინდა — თითოეული ცალკე ინახება.', 'Choose what to change — each part saves on its own.')}
        </Text>
        <CycleCard padded={false}>
          {rows.map((row, i) => (
            <View key={row.id}>
              {i > 0 ? <View style={{ height: 1, backgroundColor: c.border, marginLeft: 74 }} /> : null}
              <HubRow
                c={c}
                tile={cycleHexAlpha(c.ink, dark ? 0.15 : 0.08)}
                icon={row.icon}
                title={row.title}
                summary={row.summary}
                onPress={() => router.push(cycleSettingsRoute(row.id) as never)}
              />
            </View>
          ))}
        </CycleCard>
        {/* Brief [კ-31]: say on screen where her history lives. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18, paddingHorizontal: 4 }}>
          <CloudCheck size={16} color={c.success} strokeWidth={2.1} style={{ marginTop: 2 }} />
          <Text style={{ color: c.muted, fontSize: 12.5, lineHeight: 18, flex: 1 }}>
            {tx(CYCLE_HISTORY_ACCOUNT_LINE.ka, CYCLE_HISTORY_ACCOUNT_LINE.en)}
          </Text>
        </View>
      </ScrollView>
    </CycleAtmosphere>
  );
}

function HubRow({
  c,
  tile,
  icon: Icon,
  title,
  summary,
  onPress,
}: {
  c: CycleColors;
  tile: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${summary}`}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, minHeight: 72 }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: tile,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={c.ink} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, marginLeft: 16, marginRight: 8 }}>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 }}>{title}</Text>
        <Text style={{ color: c.muted, fontSize: 12.5, lineHeight: 17, marginTop: 2 }} numberOfLines={2}>
          {summary}
        </Text>
      </View>
      <ChevronRight size={18} color={c.mutedSoft} />
    </Pressable>
  );
}
