import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarHeart, CalendarRange, ChartNoAxesColumn, ChefHat, Target, Trophy } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubLinkRow, HubTileGrid, type HubTile } from '@/components/home/HubTiles';
import type { HomeNutritionState } from '@/components/home/sections/HomeEnergyCard';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

/**
 * „კვების ხელსაწყოები“ — doors into the existing nutrition sub-pages plus MEDI QUEST; everything else is
 * in Explore. Each tile disappears while its module is paused. Without a nutrition plan the first tile
 * opens the goal page instead of the meal plan. Women also get a no-fetch „ჩემი ციკლი“ row.
 * (`HubTileGrid` takes a closed `HubInk`, so the nutrition tiles use the hub green.)
 */
export function HomeNutritionTools({ nutrition, female, first = false }: { nutrition: HomeNutritionState; female: boolean; first?: boolean }) {
  const router = useRouter();
  const features = useFeatureState();
  // Unknown (still loading) counts as "has a plan": the plan page explains itself when there is none.
  const hasPlan = nutrition.data ? Boolean(nutrition.data.program) : true;

  const all: HubTile[] = [
    hasPlan
      ? { key: 'plan', title: tx('რაციონი', 'Meal plan'), detail: tx('7 დღის გეგმა და საყიდლები', '7-day plan and shopping list'), href: '/nutrition/plan', icon: CalendarRange, ink: 'green' }
      : { key: 'goal', title: tx('კვების მიზანი', 'Nutrition goal'), detail: tx('დაკლება, შენარჩუნება თუ მომატება', 'Lose, maintain or gain'), href: '/nutrition/goal', icon: Target, ink: 'green' },
    { key: 'progress', title: tx('პროგრესი', 'Progress'), detail: tx('კვირები, წონა და ტენდენცია', 'Weeks, weight and trend'), href: '/nutrition/progress', icon: ChartNoAxesColumn, ink: 'green' },
    { key: 'recipes', title: tx('რეცეპტები', 'Recipes'), detail: tx('შენი კერძები ერთ ადგილას', 'Your dishes in one place'), href: '/nutrition/recipes', icon: ChefHat, ink: 'green' },
    { key: 'quest', title: 'MEDI QUEST', detail: tx('მისიები, პროგრესი და ჯილდოები', 'Missions, progress and rewards'), href: '/medi-quest', icon: Trophy, ink: 'amber' },
  ];
  const tiles = all.filter((tile) => isHrefAvailable(tile.href, features));
  const cycle = female && isHrefAvailable('/cycle', features);
  if (!tiles.length && !cycle) return null;

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: first ? 22 : HUB.sectionGap }}>
      <HomeSectionHeading title={tx('კვების ხელსაწყოები', 'Nutrition tools')} linkLabel={tx('ყველა ფუნქცია', 'All features')} onLink={() => router.push('/explore' as never)} />
      {tiles.length ? <HubTileGrid tiles={tiles} /> : null}
      {cycle ? (
        <HubLinkRow
          icon={CalendarHeart}
          ink="rose"
          title={tx('ჩემი ციკლი', 'My cycle')}
          detail={tx('კალენდარი და ჩანაწერები', 'Calendar and logs')}
          href="/cycle"
          style={tiles.length ? { marginTop: 10 } : undefined}
        />
      ) : null}
    </View>
  );
}
