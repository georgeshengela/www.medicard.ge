import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HomeModuleTile, QuestTile, RunTile } from '@/components/home/sections/HomeChallenges';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import type { HomeLayoutId } from '@/lib/home/homeLayout';
import type { ScanKind } from '@/lib/scanThread';
import { HUB } from '@/theme/hub';

type DoorId = 'quest' | 'run' | 'pill' | 'vet' | 'scan';

/**
 * Which doors each Home offers, in order (Home 2.0, owner 2026-10-15; train 1.0.0.21 — no MEDISLEEP or
 * MEDIHOROSCOPE in this binary, main has them as doors too). A paused module and MEDIPILL once a medicine is
 * tracked leave the grid. Standard already shows MEDIRUN and MEDIQUEST in „გამოწვევები“; the active Home has
 * them as cards of their own.
 */
const PLAN: Record<HomeLayoutId, DoorId[]> = {
  women: ['quest', 'run'],
  standard: ['pill', 'vet'],
  active: ['scan', 'pill'],
  weight: ['scan', 'run'],
};

type Props = {
  layout: HomeLayoutId;
  /** Tracked medicines — with one or more, MEDIPILL has its dose cards above and needs no door. */
  medicationsCount: number;
  /** MEDISCAN choices whose switches are on (none = no door). */
  scanKinds: ScanKind[];
  /** „ყველა მოდული“ — opens the modules sheet the header button opens. */
  onAllModules: () => void;
};

/**
 * „მეტი MEDICARD-ში“ — the doors into the modules the person does not use yet, as one grid at the end of
 * every Home (the live-or-door rule: a module keeps a card only while it is in use; everything else is a door
 * here, never a „დააყენე“ card in the middle of the page). Same reverse brand tile as „გამოწვევები“: the
 * wordmark, one live line (Medi Coins, this week's km) and the module's colour only in lines. Tapping opens
 * the module; nothing is started or asked from here.
 */
export function HomeModuleDoors({ layout, medicationsCount, scanKinds, onAllModules }: Props) {
  const features = useFeatureState();
  const router = useRouter();
  const open = (href: string) => () => router.push(href as never);

  const doors = PLAN[layout]
    .map((id): React.ReactNode | null => {
      switch (id) {
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
