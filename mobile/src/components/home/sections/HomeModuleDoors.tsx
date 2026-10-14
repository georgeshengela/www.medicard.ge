import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HomeModuleTile, QuestTile, RunTile } from '@/components/home/sections/HomeChallenges';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import type { HomeLayoutId } from '@/lib/home/homeLayout';
import type { HomeCard as HoroscopeHomeCard } from '@/lib/horoscope/horoscopeApi';
import { signName } from '@/lib/horoscope/names';
import type { ScanKind } from '@/lib/scanThread';
import { clockOf, tonight } from '@/lib/sleep/sleepTime';
import type { SleepHub } from '@/lib/sleep/sleepTypes';
import { HUB } from '@/theme/hub';

type DoorId = 'sleep' | 'horoscope' | 'quest' | 'run' | 'pill' | 'vet' | 'scan';

/**
 * Which doors each Home offers, in order (Home 2.0, owner 2026-10-15). At most four show: a module that already
 * has a live card above (the MEDISLEEP card in the evening, MEDIPILL once a medicine is tracked) and a paused
 * module leave the grid. Standard already shows MEDIRUN and MEDIQUEST in „გამოწვევები“; the active Home has
 * them as cards of their own.
 */
const PLAN: Record<HomeLayoutId, DoorId[]> = {
  women: ['sleep', 'horoscope', 'quest', 'run'],
  standard: ['horoscope', 'sleep', 'pill', 'vet'],
  active: ['horoscope', 'sleep', 'scan', 'pill'],
  weight: ['horoscope', 'sleep', 'scan', 'run'],
};

type Props = {
  layout: HomeLayoutId;
  /** The hub query Home already holds (one subscriber); undefined while loading or with the module off. */
  sleepHub: SleepHub | undefined;
  /** True while the MEDISLEEP card is on the page (sleep mode running, or a plan in the evening / morning). */
  sleepLive: boolean;
  /** The horoscope Home card (undefined = module off or not shipped in this binary). */
  horoscope: HoroscopeHomeCard | undefined | null;
  /** Tracked medicines — with one or more, MEDIPILL has its dose cards above and needs no door. */
  medicationsCount: number;
  /** MEDISCAN choices whose switches are on (none = no door). */
  scanKinds: ScanKind[];
  /** „ყველა მოდული“ — opens the modules sheet the header button opens. */
  onAllModules: () => void;
};

/**
 * „მეტი MEDICARD-ში“ — the doors into the modules the person does not use yet, as one 2 × 2 grid at the end of
 * every Home (the live-or-door rule: a module keeps a card only while it is in use; everything else is a door
 * here, never a „დააყენე“ card in the middle of the page). Same reverse brand tile as „გამოწვევები“: the
 * wordmark, one live line (the sign and today's scores, tonight's bedtime, Medi Coins, this week's km) and the
 * module's colour only in lines. Tapping opens the module; nothing is started or asked from here.
 */
export function HomeModuleDoors({ layout, sleepHub, sleepLive, horoscope, medicationsCount, scanKinds, onAllModules }: Props) {
  const features = useFeatureState();
  const router = useRouter();
  const open = (href: string) => () => router.push(href as never);

  const doors = PLAN[layout]
    .map((id): React.ReactNode | null => {
      switch (id) {
        case 'sleep': {
          if (!isFeatureOn('sleep', features) || sleepLive) return null;
          const plan = sleepHub?.plan ?? null;
          const t = plan ? tonight(plan, new Date()) : null;
          const value = t ? tx(`დაწოლა ${clockOf(t.bedtime)}`, `Bedtime ${clockOf(t.bedtime)}`) : tx('ძილის გეგმა', 'Sleep plan');
          const caption = t ? tx(`ადგომა ${clockOf(t.wake)}`, `Up at ${clockOf(t.wake)}`) : tx('დაწოლის დრო, ხმები, მაღვიძარა', 'Bedtime, sounds and an alarm');
          return <HomeModuleTile key={id} module="sleep" value={value} caption={caption} valueSize="text" a11y={`MEDISLEEP. ${value}. ${caption}`} onPress={open('/sleep')} />;
        }
        case 'horoscope': {
          // undefined = module off or not in this binary; show === false = switched off by her or the admin.
          if (horoscope === undefined || horoscope?.show === false) return null;
          const sign = horoscope?.sign;
          const scores = horoscope?.scores;
          const value = sign ? signName(sign) : tx('ჰოროსკოპი', 'Horoscope');
          const caption = scores
            ? tx(`სიყვარული ${scores.love} · საქმე ${scores.money} · განწყობა ${scores.mood}`, `Love ${scores.love} · Work ${scores.money} · Mood ${scores.mood}`)
            : horoscope?.headline || tx('დღის ჰოროსკოპი შენი ნიშნისთვის', 'Today’s horoscope for your sign');
          return <HomeModuleTile key={id} module="horo" value={value} caption={caption} valueSize={sign ? 'number' : 'text'} a11y={`MEDIHOROSCOPE. ${value}. ${caption}`} onPress={open('/horoscope')} />;
        }
        case 'quest':
          return isFeatureOn('quest', features) ? <QuestTile key={id} /> : null;
        case 'run':
          return isFeatureOn('medirun', features) ? <RunTile key={id} /> : null;
        case 'pill': {
          if (!isFeatureOn('medications', features) || medicationsCount > 0) return null;
          const value = tx('პირველი წამალი', 'First medicine');
          const caption = tx('შეხსენება დროზე, ✓ ერთი შეხებით', 'Reminders on time, a one-tap ✓');
          return <HomeModuleTile key={id} module="pill" value={value} caption={caption} valueSize="text" a11y={`MEDIPILL. ${value}. ${caption}`} onPress={open('/(tabs)/medications')} />;
        }
        case 'vet': {
          if (!isFeatureOn('pets', features)) return null;
          const value = tx('შენი ცხოველი', 'Your pet');
          const caption = tx('მოვლა, წონა და Medi Vet', 'Care, weight and Medi Vet');
          return <HomeModuleTile key={id} module="vet" value={value} caption={caption} valueSize="text" a11y={`MEDIVET. ${value}. ${caption}`} onPress={open('/pets')} />;
        }
        case 'scan': {
          if (!scanKinds.length) return null;
          const value = tx('გადაიღე ფოტო', 'Snap a photo');
          const caption = tx('ანალიზი, გამოსახულება, კანი — Medi წაიკითხავს', 'Lab sheet, imaging, skin — Medi reads it');
          return <HomeModuleTile key={id} module="scan" value={value} caption={caption} valueSize="text" a11y={`MEDISCAN. ${value}. ${caption}`} onPress={open('/scan')} />;
        }
        default:
          return null;
      }
    })
    .filter((node): node is React.ReactNode => node != null)
    .slice(0, 4);
  if (!doors.length) return null;

  // Two per row; a lone last door takes the whole row.
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < doors.length; i += 2) rows.push(doors.slice(i, i + 2));

  return (
    <View style={s.section}>
      <HomeSectionHeading title={tx('მეტი MEDICARD-ში', 'More in MEDICARD')} linkLabel={tx('ყველა მოდული', 'All modules')} onLink={onAllModules} />
      <View style={s.grid}>
        {rows.map((row, i) => (
          <View key={i} style={s.row}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
});
