import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { HeartPulse } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';
import { ProfileScreenHeader } from '@/components/ui/ProfileScreenHeader';

export function FreeAccessCard() {
  const colors = useThemeColors();
  return <View style={{ padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.bg300, backgroundColor: colors.surface, gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <HeartPulse size={24} color={colors.primary200} />
      <Text style={{ flex: 1, color: colors.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 17 }}>ყველაფერი ხელმისაწვდომია</Text>
    </View>
    <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 23 }}>რეგისტრაცია და MEDICARD-ის ყველა ფუნქცია უფასოა. AI-ის გამოყენებას კომერციული დღიური ან თვიური ლიმიტი არ აქვს.</Text>
  </View>;
}
export function FreeAccessScreen() {
  const colors = useThemeColors();
  return <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
    <ProfileScreenHeader title="შენი წვდომა" />
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}><FreeAccessCard />
      <Text style={{ color: colors.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 23 }}>Medi, ანალიზები, ჯანმრთელობის ჩანაწერები, MEDIRUN, MEDI QUEST და ცხოველების მოვლა — გამოიყენე შენთვის მოსახერხებელ დროს.</Text>
    </ScrollView>
  </View>;
}
