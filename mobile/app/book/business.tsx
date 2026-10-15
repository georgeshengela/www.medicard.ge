import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, CalendarDays, ExternalLink, Store, Users } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { FlatCard } from '@/components/book/BookUI';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const PANEL_URL = 'https://medicard.ge/business';

/**
 * „შენი ბიზნესია?“ — the way in for an owner, and where the business-side pushes land. The panel itself
 * lives on the web (medicard.ge/business): a calendar, clients and money want a big screen.
 */
export default function BookBusinessScreen() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const rows = [
    { icon: CalendarDays, title: tx('კალენდარი და ჯავშნები', 'Calendar and bookings'), body: tx('კლიენტები აპიდან პირდაპირ შენს კალენდარში ჩაეწერებიან; შენ ადასტურებ, გადააქვს, ხურავ.', 'Clients book from the app straight into your calendar; you confirm, move and close them.') },
    { icon: Users, title: tx('გუნდი, სერვისები, კლიენტები', 'Team, services, clients'), body: tx('თანამშრომლები თავისი გრაფიკით, სერვისები ფასით და ხანგრძლივობით, კლიენტების ბაზა ისტორიით.', 'Staff with their own schedules, services with price and duration, a client book with history.') },
    { icon: BarChart3, title: tx('ფინანსები და ანალიტიკა', 'Money and analytics'), body: tx('შემოსავალი, ხარჯი, დატვირთვის კოეფიციენტი, ფასდაკლებები, შეფასებები — ყველაფერი ერთ პანელში.', 'Income, expenses, utilisation, discounts, reviews — in one panel.') },
  ];
  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: HUB.gutter }} showsVerticalScrollIndicator={false}>
      <ModuleHeader module="book" subtitle={tx('ბიზნესისთვის', 'For businesses')} fallbackHref="/book" />
      <FlatCard style={{ marginTop: 20, padding: 20, gap: 10 }}>
        <View style={[s.tile, { backgroundColor: c.accent100 }]}>
          <Store size={22} color={c.primary100} strokeWidth={1.9} />
        </View>
        <Text style={[hubText.sectionTitle, { color: c.text100 }]}>{tx('შენი ბიზნესი MEDICARD-ზე', 'Your business on MEDICARD')}</Text>
        <Text style={[hubText.body, { color: c.text200 }]}>
          {tx('სტომატოლოგია, სალონი, ესთეტიკის ცენტრი, კლინიკა თუ სტუდია — მოიძიე კატალოგში და დაადასტურე, ან დაარეგისტრირე ახალი. უფასოდ.', 'A dental clinic, a salon, an aesthetic centre, a clinic or a studio — find it in the catalogue and claim it, or register a new one. Free.')}
        </Text>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(PANEL_URL)} style={[s.cta, { backgroundColor: c.primary100 }]}>
          <Text style={[hubText.link, { color: '#fff', fontSize: 15 }]}>medicard.ge/business</Text>
          <ExternalLink size={16} color="#fff" strokeWidth={2.2} />
        </Pressable>
        <Text style={[hubText.small, { color: c.text300 }]}>{tx('პანელი იხსნება კომპიუტერში ან ტელეფონის ბრაუზერში იმავე ანგარიშით, რითაც აპში შედიხარ.', 'The panel opens on a computer or in the phone browser with the same account you use in the app.')}</Text>
      </FlatCard>
      <FlatCard style={{ marginTop: 14 }}>
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <View key={row.title} style={[s.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
              <View style={[s.tileSmall, { backgroundColor: c.bg200 }]}>
                <Icon size={18} color={c.primary100} strokeWidth={1.9} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[hubText.cardTitle, { color: c.text100 }]}>{row.title}</Text>
                <Text style={[hubText.caption, { color: c.text200 }]}>{row.body}</Text>
              </View>
            </View>
          );
        })}
      </FlatCard>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  tileSmall: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
});
