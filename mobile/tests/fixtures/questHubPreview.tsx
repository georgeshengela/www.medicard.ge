// Manual visual fixture selected only by the local export launcher. No auth or API calls.
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { QuestHubView } from '@/components/quest/QuestHubView';
import { QuestProfileCard } from '@/components/quest/QuestProfileCard';
import previewJourney from './questJourneyPreview.json';
import { applyClaimToDashboard, type QuestHubTab } from '@/lib/quest/hubPresentation';
import type { QuestDashboard, QuestItem } from '@/lib/quest/api';
import type { CompanionOverview } from '@/lib/companion/api';
import '../../global.css';

const mission = (id: string, type: string, progress: number, target: number, completed = false): QuestItem => ({ id, key: id, category: type === 'STEPS' ? 'MOVEMENT' : type === 'HYDRATION_GOAL_PERCENT' ? 'HYDRATION' : 'MEDI', cadence: id.includes('weekly') ? 'WEEKLY' : 'DAILY', titleKey: null, descriptionKey: null, progressType: type, target, progress, progressPercent: progress / target * 100, status: completed ? 'COMPLETED' : 'ACTIVE', periodKey: '2026-09-19', assignedAt: null, completedAt: completed ? '2026-09-19T10:00:00Z' : null, claimedAt: null, expiresAt: null, rewardCoins: 30, rewardXp: 50, claimable: completed });
const initial: QuestDashboard = { profile: { level: 7, rankKey: 'LEVEL_5_9', totalXp: 1840, coinBalance: 320, currentStreak: 6, longestStreak: 12, levelProgress: { level: 7, progressPercent: 62, nextLevelXp: 2000 }, timezone: 'Europe/Brussels' }, daily: { periodKey: '2026-09-19', timezone: 'Europe/Brussels', quests: [mission('daily_steps', 'STEPS', 3540, 5000), mission('daily_hydration', 'HYDRATION_GOAL_PERCENT', 100, 100, true), mission('daily_medi', 'MEDI_DAILY_USE', 0, 1)] }, weekly: { periodKey: '2026-W38', quests: [mission('weekly_steps', 'STEPS', 17400, 30000)] }, summary: { dailyCompleted: 1, dailyTotal: 3, dailyClaimable: 1, weeklyCompleted: 0, unclaimedRewards: 1 } };
function Preview() {
  const theme = useTheme();
  const [dashboard, setDashboard] = useState(initial), [tab, setTab] = useState<QuestHubTab>('missions');
  const [mode, setMode] = useState('ready'), [profile, setProfile] = useState(false), [message, setMessage] = useState('');
  const [overview, setOverview] = useState<CompanionOverview>(previewJourney as CompanionOverview);
  const [claimError, setClaimError] = useState<{ id: string; message: string } | null>(null);
  const [fonts] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold });
  if (!fonts) return null;
  return <View style={{ flex: 1 }}>
    <View style={{ height: 40, backgroundColor: '#1F2937' }}><ScrollView horizontal contentContainerStyle={{ alignItems: 'center', gap: 18, paddingHorizontal: 10 }}>
      {[['Theme', () => theme.setPreference(theme.scheme === 'dark' ? 'light' : 'dark')], ['Profile', () => setProfile(!profile)], ...['ready', 'offline', 'error', 'unavailable', 'empty', 'claim-error', 'journey-error'].map(m => [m, () => { setMode(m); setDashboard(initial); setClaimError(null); }])].map(([label, action]) => <Pressable key={String(label)} onPress={action as () => void} accessibilityRole="button"><Text style={{ color: '#FFFFFF', fontSize: 12 }}>{String(label)}</Text></Pressable>)}
    </ScrollView></View>
    {message ? <Pressable onPress={() => setMessage('')}><Text style={{ backgroundColor: '#CCFBF1', color: '#0F766E', padding: 8 }}>{message}</Text></Pressable> : null}
    {profile ? <View style={{ flex: 1, backgroundColor: theme.scheme === 'dark' ? '#030712' : '#F5F7F7', paddingTop: 30 }}><QuestProfileCard dashboard={dashboard} loading={false} error={false} stale={false} onOpen={() => setProfile(false)} onRetry={() => undefined} /></View> : <QuestHubView
      dashboard={mode === 'error' ? null : mode === 'unavailable' ? { ...dashboard, unavailable: true, profile: null } : mode === 'empty' ? { ...dashboard, daily: { ...dashboard.daily, quests: [] }, weekly: { ...dashboard.weekly, quests: [] }, summary: { dailyCompleted: 0, dailyTotal: 0, dailyClaimable: 0, weeklyCompleted: 0, unclaimedRewards: 0 } } : dashboard}
      loading={false} error={mode === 'error'} stale={mode === 'offline'} offline={mode === 'offline'} tab={tab} onTab={setTab} onBack={() => setProfile(true)} onNavigate={path => setMessage('Selected destination: ' + path)} refreshing={false} onRefresh={() => setMode('ready')}
      claimingId={null} claimError={claimError} onClaim={id => { if (mode === 'claim-error') { setClaimError({ id, message: 'ჯილდოს მიღება ვერ დადასტურდა. სცადე ხელახლა.' }); return; } const result = { ok: true, claimed: true, alreadyClaimed: false, quest: { id, key: id, status: 'CLAIMED' as const, completedAt: '2026-09-19T10:00:00Z', claimedAt: '2026-09-19T11:00:00Z' }, reward: { coinsAwarded: 30, xpAwarded: 50 }, profile: { coinBalance: 350, totalXp: 1890, previousLevel: 7, currentLevel: 7, leveledUp: false, levelProgress: dashboard.profile!.levelProgress, currentStreak: 6, longestStreak: 12 } }; setDashboard(applyClaimToDashboard(dashboard, result)); }}
      companion={mode === 'journey-error' ? null : overview} companionLoading={false} companionError={mode === 'journey-error'} companionStale={mode === 'offline'} onCompanionRetry={() => setMode('ready')} onEquip={(item, clear) => setOverview({ ...overview, equipment: { ...overview.equipment, [item.slot]: clear ? null : item.key } })} equipBusy={null} equipError={null} />}
  </View>;
}
registerRootComponent(() => <SafeAreaProvider><ThemeProvider><Preview /></ThemeProvider></SafeAreaProvider>);
