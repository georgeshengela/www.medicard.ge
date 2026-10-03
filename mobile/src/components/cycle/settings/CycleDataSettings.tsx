/**
 * `/cycle/settings/data` — მონაცემები (W2-9, [კ-31]): where her history lives, the doctor summary PDF,
 * calendar (ICS) and JSON exports, and deleting cycle data (two confirmations in CycleExplainSheet).
 * Same calls as the former one-page settings; nothing here waits for a „შენახვა“.
 */
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useLayoutEffect, useState } from 'react';
import { Platform, ScrollView, Share, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CalendarPlus, ChevronRight, CloudCheck, Download, FileText, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react-native';
import { CycleExplainSheet } from '@/components/cycle/CycleExplainSheet';
import { CycleAtmosphere, CycleCard, CycleLoading, CycleSection, cycleNavHeader } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { api, ApiError } from '@/lib/api';
import { destroyCycleOfflineAccount, peekCyclePendingCount } from '@/lib/cycleOffline';
import { buildCycleIcs } from '@/lib/cycleCalendarExport';
import { putCycleBundle } from '@/lib/cycleViewCache';
import { CYCLE_HISTORY_ACCOUNT_LINE } from '@/lib/cycleSettingsRoutes';
import { useCycleColors } from '@/theme/cycle';
import { SettingsDivider, SettingsNotice, useCycleSettingsView, type CycleColors } from './CycleSettingsKit';

export function CycleDataSettings() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, bundle, canonical, pendingCount, loading } = useCycleSettingsView();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<'success' | 'error'>('success');
  /** Delete cycle data: 0 = closed, 1 = first confirmation, 2 = second confirmation (same sheet, two steps). */
  const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
  const [wiping, setWiping] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, tx('მონაცემები', 'Data')));
  }, [navigation, c]);

  const fail = (err: unknown) => {
    setMsgTone('error');
    setMsg(err instanceof ApiError ? err.message : ka.common.error);
  };

  /** Exports wait until offline changes reached the server (an export must match what she sees). */
  const hasPending = async () => (pendingCount || (userId ? await peekCyclePendingCount(userId) : 0)) > 0;

  const exportCalendar = async () => {
    const source = canonical ?? bundle;
    if (!source) return;
    setMsg(null);
    try {
      if (await hasPending()) {
        setMsgTone('error');
        setMsg(ka.cycle.reportPendingWarn);
        return;
      }
      const ics = buildCycleIcs(source);
      if (Platform.OS === 'web') {
        await Share.share({ message: ics });
        return;
      }
      const path = `${FileSystem.cacheDirectory}medicard-cycle.ics`;
      await FileSystem.writeAsStringAsync(path, ics, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/calendar', UTI: 'public.calendar-event' });
      }
      setMsgTone('success');
      setMsg(ka.common.share);
    } catch (err) {
      fail(err);
    }
  };

  const exportJson = async () => {
    setMsg(null);
    try {
      if (await hasPending()) {
        setMsgTone('error');
        setMsg(ka.cycle.reportPendingWarn);
        return;
      }
      const data = await api.cycle.exportData();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        await Share.share({ message: json });
        return;
      }
      const path = `${FileSystem.cacheDirectory}medicard-cycle-export.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', UTI: 'public.json' });
      }
      setMsgTone('success');
      setMsg(ka.cycle.exportJsonDone);
    } catch (err) {
      fail(err);
    }
  };

  const runWipeCycleData = async () => {
    if (wiping) return;
    setWiping(true);
    try {
      const result = await api.cycle.wipeData();
      if (userId) {
        await destroyCycleOfflineAccount(userId);
        const { wipePregnancyCareCalendarOwnership } = await import('@/lib/pregnancyCareCalendar');
        await wipePregnancyCareCalendarOwnership(userId);
        putCycleBundle(userId, result.bundle);
      }
      setMsgTone('success');
      setMsg(ka.cycle.deleteCycleDone);
    } catch (err) {
      fail(err);
    } finally {
      setWiping(false);
      setWipeStep(0);
    }
  };

  if (!bundle && loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <SettingsNotice c={c} tone={msgTone} text={msg} />

        <CycleCard style={{ marginBottom: 24 }}>
          <TrustLine c={c} icon={CloudCheck} text={tx(CYCLE_HISTORY_ACCOUNT_LINE.ka, CYCLE_HISTORY_ACCOUNT_LINE.en)} strong />
          <SettingsDivider c={c} />
          <TrustLine
            c={c}
            icon={ShieldCheck}
            text={tx(
              'შენი ნებართვის გარეშე გარე AI-ს მონაცემებს არ ვუგზავნით.',
              'Without your permission we do not send data to third-party AI.',
            )}
          />
        </CycleCard>

        <CycleSection title={tx('ექსპორტი', 'Export')}>
          <CycleCard>
            <DataRow
              c={c}
              icon={FileText}
              label={tx('ექიმის შეჯამება (PDF)', 'Doctor summary (PDF)')}
              hint={tx('ციკლები, სიმპტომები და თარიღები ექიმისთვის. PDF ტელეფონზე იქმნება.', 'Cycles, symptoms and dates for your doctor. The PDF is made on your phone.')}
              onPress={() => router.push('/cycle/summary' as never)}
              chevron
            />
            <SettingsDivider c={c} gap={8} />
            <DataRow
              c={c}
              icon={CalendarPlus}
              label={ka.cycle.calendarExport}
              hint={ka.cycle.calendarExportHint}
              onPress={() => void exportCalendar()}
            />
            <SettingsDivider c={c} gap={8} />
            <DataRow
              c={c}
              icon={Download}
              label={ka.cycle.exportJson}
              hint={ka.cycle.exportJsonHint}
              onPress={() => void exportJson()}
            />
          </CycleCard>
        </CycleSection>

        <CycleSection title={tx('წაშლა', 'Delete')}>
          <CycleCard>
            <DataRow
              c={c}
              icon={Trash2}
              danger
              label={ka.cycle.deleteCycleTitle}
              hint={ka.cycle.deleteCycleBody}
              onPress={() => setWipeStep(1)}
            />
          </CycleCard>
        </CycleSection>
      </ScrollView>

      {/* Delete cycle data: two confirmations in the app's own sheet (was a double native alert). */}
      <CycleExplainSheet
        visible={wipeStep > 0}
        title={wipeStep === 2 ? ka.cycle.deleteCycleAgain : ka.cycle.deleteCycleTitle}
        body={ka.cycle.deleteCycleBody}
        accent={c.danger}
        actions={[
          {
            label: ka.cycle.deleteCycleConfirm,
            tone: 'destructive',
            icon: Trash2,
            loading: wiping,
            onPress: () => {
              if (wipeStep === 1) setWipeStep(2);
              else void runWipeCycleData();
            },
          },
        ]}
        onClose={() => {
          if (!wiping) setWipeStep(0);
        }}
      />
    </CycleAtmosphere>
  );
}

function TrustLine({ c, icon: Icon, text, strong = false }: { c: CycleColors; icon: LucideIcon; text: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <Icon size={18} color={strong ? c.success : c.muted} strokeWidth={2.1} style={{ marginTop: 1 }} />
      <Text
        style={{
          flex: 1,
          color: strong ? c.ink : c.muted,
          fontSize: strong ? 14 : 12.5,
          lineHeight: strong ? 20 : 18,
          fontFamily: strong ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular',
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function DataRow({
  c,
  icon: Icon,
  label,
  hint,
  onPress,
  danger = false,
  chevron = false,
}: {
  c: CycleColors;
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 4 }}
    >
      <Icon size={20} color={danger ? c.danger : c.brand} strokeWidth={2} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={{ color: danger ? c.danger : c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20 }}>
          {label}
        </Text>
        {hint ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{hint}</Text> : null}
      </View>
      {chevron ? <ChevronRight size={18} color={c.mutedSoft} /> : null}
    </Pressable>
  );
}
