import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarClock, Droplet, Pill, Stethoscope, type LucideIcon } from 'lucide-react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubTint, type HubInk } from '@/theme/hub';
import { tx } from '@/i18n/locale';
import { MediOrb } from './MediOrb';
import { consiliumInk } from './mediTheme';

type Starter = { icon: LucideIcon; ink: HubInk; text: string };

/** Fixed starter questions (never built from her data). Each one shows a different thing Medi does. */
const STARTERS = (): Starter[] => [
  { icon: Stethoscope, ink: 'teal', text: tx('თავი 3 დღეა მტკივა — რატომ?', 'My head has hurt for 3 days — why?') },
  { icon: Pill, ink: 'blue', text: tx('დამიმატე წამალი შეხსენებით', 'Add a medicine with a reminder') },
  { icon: Droplet, ink: 'sky', text: tx('ჩამიწერე 2 ჭიქა წყალი', 'Log 2 glasses of water') },
  { icon: CalendarClock, ink: 'amber', text: tx('ხვალ 10-ზე ექიმთან ვიზიტი მაქვს', 'Doctor visit tomorrow at 10') },
];

const DEEP_STARTERS = (): Starter[] => [
  { icon: Stethoscope, ink: 'violet', text: tx('ხშირად მაქვს დაღლილობა და თავბრუსხვევა', 'I often feel tired and dizzy') },
  { icon: Stethoscope, ink: 'violet', text: tx('ფერიტინი დაბალი მაქვს — რა ვქნა?', 'My ferritin is low — what now?') },
];

/** The empty conversation: Medi's sphere is the one bold element, then plain starters to tap. */
export function MediWelcome({ name, consilium, onStarter, notice }: { name?: string; consilium: boolean; onStarter: (text: string) => void; notice?: string | null }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const starters = consilium ? DEEP_STARTERS() : STARTERS();
  return (
    <View style={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24, gap: 28 }}>
      <View style={{ alignItems: 'center', gap: 18 }}>
        <MediOrb size={84} deep={consilium} breathing />
        <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 12 }}>
          <Text style={{ color: c.text100, fontSize: 24, lineHeight: 34, textAlign: 'center', fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
            {consilium ? tx('კონსილიუმი ჩართულია', 'Consilium is on') : name ? tx(`გამარჯობა, ${name}`, `Hi, ${name}`) : tx('გამარჯობა', 'Hi')}
          </Text>
          <Text style={{ color: consilium ? consiliumInk(dark) : c.text200, fontSize: 14, lineHeight: 22, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', maxWidth: 300 }}>
            {consilium
              ? tx('შენს საკითხს რამდენიმე სპეციალისტი ერთად განიხილავს. პასუხს ცოტა მეტი დრო სჭირდება.', 'Several specialists review your question together. The answer takes a little longer.')
              : tx('ჰკითხე ჯანმრთელობაზე, ან მთხოვე რამე ჩავწერო და შეგახსენო.', 'Ask about your health, or ask me to log something and remind you.')}
          </Text>
        </View>
      </View>
      {notice ? <Text accessibilityRole="alert" style={{ color: c.text200, fontSize: 13, lineHeight: 21, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', paddingHorizontal: 8 }}>{notice}</Text> : null}
      <View style={{ gap: 8 }}>
        {starters.map(starter => {
          const ink = hubInk(starter.ink, dark);
          const Icon = starter.icon;
          return (
            <Pressable key={starter.text} accessibilityRole="button" onPress={() => onStarter(starter.text)}
              style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: c.surface }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hubTint(ink, dark) }}>
                <Icon size={18} color={ink} />
              </View>
              <Text style={{ flex: 1, color: c.text100, fontSize: 14, lineHeight: 21, fontFamily: 'NotoSansGeorgian_400Regular' }}>{starter.text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
