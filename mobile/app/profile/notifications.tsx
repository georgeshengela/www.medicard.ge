import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Award,
  Bell,
  CalendarHeart,
  ChevronLeft,
  Droplets,
  Footprints,
  HeartHandshake,
  MessageCircle,
  Moon,
  Scale,
  Sparkles,
  CloudSun,
  Sun,
} from 'lucide-react-native';
import {
  PermissionGroup,
  PermissionSectionLabel,
  PermissionToggleRow,
} from '@/components/profile/PermissionToggleRow';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { ka } from '@/i18n/ka';
import {
  DEFAULT_ENGAGE_PREFS,
  loadEngagePrefs,
  saveEngagePrefs,
  type EngageFrequency,
  type EngageTopic,
  type MediEngagePrefs,
} from '@/lib/mediEngagePrefs';
import { runMediNotificationBrain } from '@/lib/mediNotificationBrain';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

const TOPIC_ROWS: Array<{ topic: EngageTopic; label: string; icon: typeof Bell; section: 'health' | 'medi' | 'news' }> = [
  { topic: 'hydration', label: ka.notifSettings.hydration, icon: Droplets, section: 'health' },
  { topic: 'stepsSmart', label: ka.notifSettings.steps, icon: Footprints, section: 'health' },
  { topic: 'weight', label: ka.notifSettings.weight, icon: Scale, section: 'health' },
  { topic: 'cycle', label: ka.notifSettings.cycle, icon: CalendarHeart, section: 'health' },
  { topic: 'dailyLog', label: ka.notifSettings.dailyLog, icon: Moon, section: 'health' },
  { topic: 'checkin', label: ka.notifSettings.checkin, icon: HeartHandshake, section: 'medi' },
  { topic: 'insight', label: ka.notifSettings.insight, icon: Sparkles, section: 'medi' },
  { topic: 'weekly', label: ka.notifSettings.weekly, icon: CalendarHeart, section: 'medi' },
  { topic: 'achievement', label: ka.notifSettings.achievement, icon: Award, section: 'medi' },
  { topic: 'chatFollowup', label: ka.notifSettings.chat, icon: MessageCircle, section: 'medi' },
  { topic: 'reengage', label: ka.notifSettings.reengage, icon: HeartHandshake, section: 'medi' },
  { topic: 'morning', label: ka.notifSettings.morning, icon: Sun, section: 'medi' },
  { topic: 'sleep', label: ka.notifSettings.sleep, icon: Moon, section: 'medi' },
  { topic: 'birthday', label: ka.notifSettings.birthday, icon: Sparkles, section: 'medi' },
  { topic: 'question', label: ka.notifSettings.question, icon: MessageCircle, section: 'medi' },
  { topic: 'unfinished', label: ka.notifSettings.unfinished, icon: Bell, section: 'medi' },
  { topic: 'visitFollowup', label: ka.notifSettings.visitFollowup, icon: CalendarHeart, section: 'health' },
  { topic: 'weather', label: ka.notifSettings.weather, icon: CloudSun, section: 'health' },
  { topic: 'questSmart', label: ka.notifSettings.questSmart, icon: Footprints, section: 'medi' },
  { topic: 'feature', label: ka.notifSettings.feature, icon: Bell, section: 'news' },
];

function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? '#0D9488' : colors.bg200,
      }}
    >
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          color: active ? '#FFFFFF' : colors.text200,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const FIGMA = useFigmaHealthMetrics();
  const colors = useThemeColors();
  const { user, healthProfile } = useAuth();
  const [prefs, setPrefs] = useState<MediEngagePrefs>(DEFAULT_ENGAGE_PREFS);

  useFocusEffect(
    useCallback(() => {
      void loadEngagePrefs().then(setPrefs);
    }, []),
  );

  const persist = async (next: MediEngagePrefs) => {
    setPrefs(next);
    await saveEngagePrefs(next);
    void runMediNotificationBrain(user, healthProfile);
  };

  const setTopic = (topic: EngageTopic, value: boolean) => {
    void persist({ ...prefs, topics: { ...prefs.topics, [topic]: value } });
  };

  const section = (id: 'health' | 'medi' | 'news') => TOPIC_ROWS.filter((row) => row.section === id);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({ width: 44, height: 44, justifyContent: 'center', opacity: pressed ? 0.55 : 1 })}
        >
          <ChevronLeft size={24} color={FIGMA.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'right',
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 17,
            color: FIGMA.textPrimary,
          }}
        >
          {ka.notifSettings.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 28, gap: 20 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: colors.text300 }}>
          {ka.notifSettings.intro}
        </Text>

        <View style={{ gap: 8 }}>
          <PermissionSectionLabel title={ka.notifSettings.essential} />
          <PermissionGroup>
            <View style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 4 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text100 }}>
                {ka.notifSettings.essentialBody}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300 }}>
                {ka.notifSettings.essentialHint}
              </Text>
            </View>
          </PermissionGroup>
        </View>

        <View style={{ gap: 8 }}>
          <PermissionSectionLabel title={ka.notifSettings.health} />
          <PermissionGroup>
            {section('health').map((row, i, arr) => (
              <PermissionToggleRow
                key={row.topic}
                icon={row.icon}
                label={row.label}
                value={prefs.topics[row.topic]}
                isLast={i === arr.length - 1}
                onValueChange={(next) => setTopic(row.topic, next)}
              />
            ))}
          </PermissionGroup>
        </View>

        <View style={{ gap: 8 }}>
          <PermissionSectionLabel title={ka.notifSettings.medi} />
          <PermissionGroup>
            {section('medi').map((row, i, arr) => (
              <PermissionToggleRow
                key={row.topic}
                icon={row.icon}
                label={row.label}
                value={prefs.topics[row.topic]}
                isLast={i === arr.length - 1}
                onValueChange={(next) => setTopic(row.topic, next)}
              />
            ))}
          </PermissionGroup>
        </View>

        <View style={{ gap: 8 }}>
          <PermissionSectionLabel title={ka.notifSettings.news} />
          <PermissionGroup>
            {section('news').map((row, i, arr) => (
              <PermissionToggleRow
                key={row.topic}
                icon={row.icon}
                label={row.label}
                value={prefs.topics[row.topic]}
                isLast={i === arr.length - 1}
                onValueChange={(next) => setTopic(row.topic, next)}
              />
            ))}
          </PermissionGroup>
        </View>

        <View style={{ gap: 8 }}>
          <PermissionSectionLabel title={ka.notifSettings.privacy} />
          <PermissionGroup>
            <PermissionToggleRow
              icon={Moon}
              label={ka.notifSettings.discreet}
              value={prefs.discreet}
              isLast
              onValueChange={(next) => void persist({ ...prefs, discreet: next })}
            />
          </PermissionGroup>
        </View>

        <View style={{ gap: 8 }}>
          <PermissionSectionLabel title={ka.notifSettings.quiet} />
          <View style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 14, gap: 10 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300 }}>
              {ka.notifSettings.quietHint(prefs.quietStart, prefs.quietEnd)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['21:00', '22:00', '23:00'].map((value) => (
                <Pill key={value} label={value} active={prefs.quietStart === value} onPress={() => void persist({ ...prefs, quietStart: value })} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['07:00', '08:00', '09:00'].map((value) => (
                <Pill key={value} label={value} active={prefs.quietEnd === value} onPress={() => void persist({ ...prefs, quietEnd: value })} />
              ))}
            </View>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <PermissionSectionLabel title={ka.notifSettings.frequency} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['rare', 'balanced', 'often'] as EngageFrequency[]).map((value) => (
              <Pill
                key={value}
                label={ka.notifSettings.frequencyLabel[value]}
                active={prefs.frequency === value}
                onPress={() => void persist({ ...prefs, frequency: value })}
              />
            ))}
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300 }}>
            {ka.notifSettings.frequencyHint[prefs.frequency]}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
