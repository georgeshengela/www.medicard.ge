// Manual visual fixture, selected only by the local design export launcher.
// No authentication, GPS recording, database writes, or production entry-point changes.
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { useThemeColors } from '@/theme/colors';
import { RunFinishedView } from '@/components/run/RunFinishedView';
import { PulseCollection } from '@/components/run/PulseCollection';
import { Action, Card, Copy, Sheet } from '@/components/run/PulseUi';
import { PulseNicknameField } from '@/components/run/PulseNicknameField';
import { createJourney } from '@/lib/medipulsi/core/journey';
import { MISSIONS, emptyBook } from '@/lib/medipulsi/core/missions';
import { EMPTY_SIGNAL, type Snapshot } from '@/lib/medipulsi/types';
import type { PulseView } from '@/lib/medipulsi/sessionClient';
import type { RunSummary } from '@/lib/run/history';
import route from './pulse-route.json';
import '../../global.css';

const journey = createJourney('gps'), book = emptyBook();
book.progress[MISSIONS[0].id] = { meters: MISSIONS[0].meters, seconds: MISSIONS[0].seconds, completedAt: '2026-09-19T12:00:00Z' };
const snapshot: Snapshot = {
  userId: 'design-fixture', state: { journey, book }, settings: {}, handle: 'Preview', leaderboardOptIn: false, session: null,
  history: [2210, 3540, 1710, 1980, 1636].map((meters, index) => ({ id: String(index), startedAt: '2026-09-19T12:00:00Z', meters, seconds: 1800, steps: Math.round(meters / .72), newMeters: meters })),
  claims: [{ id: 'fixture', giftId: 'fixture', status: 'PENDING', code: 'DEMO-ONLY', reward: { title: 'საცდელი საჩუქარი', description: 'ვიზუალური ნიმუში — რეალური პრიზი არ არის.', kind: 'PHYSICAL' }, createdAt: '2026-09-19T12:00:00Z' }],
  missions: MISSIONS, config: { enabled: true, giftsEnabled: true, leaderboardEnabled: true, message: '' },
};
const view: PulseView = { snapshot, journey, book, signal: EMPTY_SIGNAL, loading: false, running: false, pending: 0, message: '', conflict: false };
const summary: RunSummary = { id: 'fixture', startedAt: '2026-09-19T12:00:00Z', endedAt: '2026-09-19T12:30:00Z', target: { kind: 'km', value: 0 }, targetMeters: 0, distanceM: 2210, movingMs: 1800000, elapsedMs: 2100000, calories: 135, steps: 3069, paceSecPerKm: 814, reachedPin: false, completedTarget: false, pin: null, origin: { lat: route[0][1], lng: route[0][0] }, path: route.map(p => ({ lng: p[0], lat: p[1] })) };

function Preview() {
  const [fonts] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_700Bold });
  const [collection, setCollection] = useState(false), [empty, setEmpty] = useState(false), [goal, setGoal] = useState(false);
  const [leaderboard, setLeaderboard] = useState(false), [nickname, setNickname] = useState('george'), [savedNickname, setSavedNickname] = useState('');
  const c = useThemeColors(), theme = useTheme();
  const emptyView: PulseView = { ...view, book: emptyBook(), snapshot: { ...snapshot, history: [], claims: [] } };
  if (!fonts) return null;
  return <View style={{ flex: 1, backgroundColor: c.bg100 }}>
    <View style={{ flexDirection: 'row', gap: 5, padding: 6, backgroundColor: c.bg200 }}>
      {[{ text: 'თემა', press: () => theme.setPreference(theme.scheme === 'dark' ? 'light' : 'dark') }, { text: empty ? 'შევსებული' : 'ცარიელი', press: () => setEmpty(x => !x) }, { text: 'კოლექცია', press: () => setCollection(true) }, { text: 'მიზანი', press: () => setGoal(x => !x) }, { text: 'მეტსახელი', press: () => setLeaderboard(true) }].map(item => <Pressable key={item.text} onPress={item.press} style={{ padding: 7, borderRadius: 8, backgroundColor: c.surface }}><Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', color: c.text100, fontSize: 11 }}>{item.text}</Text></Pressable>)}
    </View>
    <RunFinishedView summary={goal ? { ...summary, target: { kind: 'km', value: 3 }, targetMeters: 3000 } : summary} title="გასეირნება დასრულდა" footer={<Action label="MEDIRUN-ში დაბრუნება" onPress={() => setCollection(true)} />} />
    <Sheet visible={collection} title="შენი აღმოჩენები" onClose={() => setCollection(false)}><PulseCollection key={String(empty)} view={empty ? emptyView : view} /></Sheet>
    <Sheet visible={leaderboard} title="ერთად უფრო შორს" keyboardAware onClose={() => setLeaderboard(false)} footer={<Action label="სახელის შენახვა" onPress={() => setSavedNickname(nickname)} />}><PulseNicknameField value={nickname} onChange={setNickname} /><Card><Copy bold>ყოველი გასეირნება ითვლება</Copy><Copy>დასრულებული სესიების დადასტურებული მანძილი, ნებისმიერი ქალაქიდან. სიაში მონაწილეობას შენ ირჩევ.</Copy></Card>{savedNickname ? <Copy>ნიმუშში შენახულია: {savedNickname}</Copy> : null}{[1, 2, 3, 4, 5, 6].map(index => <Card key={index}><Copy>მოთამაშე {index} · 2.1 კმ</Copy></Card>)}</Sheet>
  </View>;
}

registerRootComponent(() => <SafeAreaProvider><ThemeProvider><Preview /></ThemeProvider></SafeAreaProvider>);
