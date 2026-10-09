import { brandHex } from '@/theme/brandTone';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Switch } from '@/components/ui/AppSwitch';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, FileDown } from 'lucide-react-native';
import { doctorTypeLabel } from '@/constants/visits';
import { useLab } from '@/hooks/useLab';
import { ka } from '@/i18n/ka';
import type { PassportLocale } from '@/i18n/healthPassport';
import { api } from '@/lib/api';
import { realFullName } from '@/lib/displayName';
import { buildCycleReportHtmlFromSummary } from '@/lib/cycleReport';
import { buildHealthPassportHtml, type PassportData } from '@/lib/healthPassport';
import { resolveLabTitle } from '@/lib/labNames';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { appLang, tx } from '@/i18n/locale';

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Health passport (Phase 3.3): profile, allergies, conditions, current medicines, latest lab
 * results with ranges and recent visits on one printable page. Built on the device from saved
 * data; nothing is sent to AI. The cycle part is added only when the person turns it on.
 */
export default function HealthPassportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const { user, healthProfile } = useAuth();
  const { panels } = useLab();
  const female = user?.gender === 'FEMALE';
  const [locale, setLocale] = useState<PassportLocale>(appLang());
  const [includeCycle, setIncludeCycle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collect = async (): Promise<PassportData> => {
    const [meds, visits] = await Promise.all([
      api.medications.list().catch(() => ({ medications: [] as never[] })),
      api.visits.list().catch(() => ({ visits: [] as never[] })),
    ]);
    const latestDate = panels.reduce<string | null>((acc, p) => (!acc || p.date > acc ? p.date : acc), null);
    const labRows = latestDate
      ? panels.filter((p) => p.date === latestDate).flatMap((p) => p.parameters).map((r) => ({
          name: r.nameKa || r.nameEn, nameEn: resolveLabTitle(r).nameEn, value: r.display, unit: r.unit, refLow: r.refLow, refHigh: r.refHigh, flag: r.flag,
        }))
      : [];
    const today = todayYmd();
    let cycleHtml: string | null = null;
    if (female && includeCycle) {
      const summary = await api.cycle.doctorSummary({ includeFertility: false, includeSexual: false, includeNotes: false });
      cycleHtml = buildCycleReportHtmlFromSummary(summary, locale);
    }
    return {
      person: {
        // The server's placeholder name is not her name: the passport shows „—“ instead.
        name: realFullName(user, healthProfile?.extraAnswers) || null,
        sex: user?.gender ?? null,
        birthDate: user?.birthDate ?? null,
        heightCm: healthProfile?.heightCm ?? null,
        weightKg: healthProfile?.weightKg ?? null,
        bloodType: healthProfile?.bloodType ?? null,
      },
      allergies: [...(healthProfile?.allergies ?? [])],
      conditions: [...(healthProfile?.chronicConditions ?? [])],
      medications: meds.medications.filter((m) => m.active).map((m) => ({ name: m.medName, dose: m.dosage, schedule: m.frequency })),
      labs: latestDate ? { date: latestDate, rows: labRows } : null,
      visits: visits.visits
        .filter((v) => v.visitDate <= today)
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
        .map((v) => {
          const doctorName = [v.doctorFirstName, v.doctorLastName].filter(Boolean).join(' ');
          return {
            date: v.visitDate,
            doctor: [doctorTypeLabel(v.doctorType), doctorName].filter(Boolean).join(' · '),
            doctorType: v.doctorType,
            doctorName,
            notes: v.notes,
          };
        }),
      cycleHtml,
      generatedOn: today,
    };
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const owner = localAccountId();
    try {
      const html = buildHealthPassportHtml(await collect(), locale);
      if (owner !== localAccountId()) return;
      void import('@/lib/funnel').then(({ trackFunnel }) => trackFunnel('health_passport_created')).catch(() => undefined);
      if (Platform.OS === 'web') {
        const win = typeof window !== 'undefined' ? window.open('', '_blank') : null;
        if (win) { win.document.write(html); win.document.close(); } else await Share.share({ message: html.replace(/<[^>]+>/g, ' ').slice(0, 4000) });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      setError(ka.passport.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100, paddingTop: insets.top }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან დაბრუნება', 'Go back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as never))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={c.text100} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 32, gap: 20 }}>
        <View style={{ gap: 6 }}>
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34, color: c.text100 }}>{ka.passport.title}</Text>
          <Text style={[hubText.body, { color: c.text200, fontSize: 14, lineHeight: 22 }]}>{ka.passport.body}</Text>
        </View>

        <View style={[s.card, { backgroundColor: c.surface }]}>
          {ka.passport.contents.map((line) => (
            <Text key={line} style={[hubText.body, { color: c.text100 }]}>• {line}</Text>
          ))}
          <Text style={[hubText.caption, { color: c.text300, marginTop: 6 }]}>{ka.passport.privacy}</Text>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={[hubText.sectionTitle, { color: c.text100 }]}>{ka.passport.language}</Text>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: c.bg200 }}>
            {(['ka', 'en'] as const).map((code) => (
              <Pressable key={code} accessibilityRole="radio" accessibilityState={{ selected: locale === code }} onPress={() => setLocale(code)}
                style={{ flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: locale === code ? c.surface : 'transparent' }}>
                <Text style={[hubText.link, { color: locale === code ? c.text100 : c.text200 }]}>{code === 'ka' ? 'ქართული' : 'English'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {female ? (
          <View style={[s.card, s.row, { backgroundColor: c.surface }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{ka.passport.includeCycle}</Text>
              <Text style={[hubText.caption, { color: c.text300 }]}>{ka.passport.includeCycleHint}</Text>
            </View>
            <Switch accessibilityLabel={ka.passport.includeCycle} value={includeCycle} onValueChange={setIncludeCycle} />
          </View>
        ) : null}

        {error ? <Text accessibilityRole="alert" style={[hubText.body, { color: c.danger }]}>{error}</Text> : null}

        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void share()}
          style={{ minHeight: 52, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: brandHex('#0D9488'), opacity: busy ? 0.6 : 1 }}>
          <FileDown size={20} color="#FFFFFF" />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF' }}>{busy ? ka.passport.busy : ka.passport.cta}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
