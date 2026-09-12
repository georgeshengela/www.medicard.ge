import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BarChart3, FileDown, MessageSquareText, Sparkles } from 'lucide-react-native';
import { CyclePeriodHistory } from '@/components/cycle/CyclePeriodHistory';
import { CyclePmsHeatmap } from '@/components/cycle/CyclePmsHeatmap';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CyclePrimaryButton,
  CycleSection,
  formatCycleDateKa,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { DOCTOR_SUMMARY_LOCALES } from '@/i18n/cycle/doctorSummary.js';
import { ka } from '@/i18n/ka';
import { ApiError, api, type CycleBundle, type CycleDoctorSummary } from '@/lib/api';
import { hasPmsPattern } from '@/lib/cycleAnalytics';
import {
  doctorSummaryCopy,
  doctorSummaryEnumLabel,
  formatDoctorCivilDate,
  formatDoctorGestationalAge,
  formatDoctorPregnancyReference,
} from '@/lib/cycleDoctorSummaryI18n';
import { loadCycleView } from '@/lib/cycleOffline';
import { cycleHistoryPresentation } from '@/lib/cycleHistoryCopy';
import { buildCycleReportHtmlFromSummary } from '@/lib/cycleReport';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

export default function CycleSummary() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [includeFertility, setIncludeFertility] = useState(false);
  const [includeSexual, setIncludeSexual] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [reportLocale, setReportLocale] = useState<'ka' | 'en' | 'fr' | 'ru'>('ka');
  const copy = doctorSummaryCopy(reportLocale);
  const reportTitleFont = reportLocale === 'ka' ? 'NotoSansGeorgian_700Bold' : undefined;
  const localeNames = {
    ka: copy.localeKa,
    en: copy.localeEn,
    fr: copy.localeFr,
    ru: copy.localeRu,
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      ...cycleNavHeader(c, copy.title),
      headerTitleStyle: {
        color: c.ink,
        fontFamily: reportTitleFont,
        fontSize: 17,
      },
    });
  }, [navigation, c, copy.title, reportLocale, reportTitleFont]);

  const reload = () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadCycleView(user.id)
      .then((view) => {
        setBundle(view.display);
        setPendingCount(view.pendingCount);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [user?.id]);

  if (loading) return <CycleLoading />;

  const history = cycleHistoryPresentation(bundle?.profile?.mode);
  const s = bundle?.summary;
  const fmt = (iso: string | null | undefined) =>
    iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? formatDoctorCivilDate(iso, reportLocale) : '—';

  const chatCopy = doctorSummaryCopy('ka');
  const chatContext = s?.menstrualHistory?.episodes?.length
    ? [
        `${chatCopy.historyDisclaimer}`,
        ...s.menstrualHistory.episodes.map(
          (e) =>
            `${formatDoctorCivilDate(e.start, 'ka')} – ${formatDoctorCivilDate(e.end, 'ka')} (${chatCopy.days(e.durationDays)})`,
        ),
      ].join('\n')
    : chatCopy.historyDisclaimer;

  const sharePdf = async () => {
    setPdfBusy(true);
    try {
      const payload: CycleDoctorSummary = await api.cycle.doctorSummary({
        includeFertility,
        includeSexual,
        includeNotes,
      });
      const html = buildCycleReportHtmlFromSummary(payload, reportLocale);
      if (Platform.OS === 'web') {
        await Share.share({ message: html.replace(/<[^>]+>/g, ' ').slice(0, 4000) });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch {
      setError(copy.pdfFail);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={{ color: c.danger, fontWeight: '600' }}>{error}</Text>
        ) : null}
        {pendingCount > 0 ? (
          <Text style={{ color: c.muted, marginBottom: 12, lineHeight: 20 }}>
            {ka.cycle.reportPendingWarn}
          </Text>
        ) : null}

        {s ? (
          <>
            <Animated.View entering={FadeInUp.duration(420)} style={{ marginBottom: 16 }}>
              <View
                style={{
                  borderRadius: 16,
                  padding: 22,
                  backgroundColor: c.card,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Sparkles size={18} color={c.brand} />
                  <Text
                    style={{
                      color: c.brand,
                      fontFamily: reportTitleFont,
                      marginLeft: 8,
                      fontSize: 12,
                      letterSpacing: 0.4,
                    }}
                  >
                    {copy.title}
                  </Text>
                </View>
                <Text
                  style={{
                    color: c.ink,
                    fontSize: 22,
                    fontFamily: reportTitleFont,
                    fontWeight: reportTitleFont ? undefined : '700',
                  }}
                >
                  {copy.reportTitle}
                </Text>
                <Text style={{ color: c.muted, marginTop: 6, lineHeight: 20 }}>
                  {copy.historyDisclaimer}
                </Text>
              </View>
            </Animated.View>

            <CycleSection title={copy.preview} delay={40}>
              <CycleCard>
                <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
                  {copy.includeTitle}
                </Text>
                <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>{copy.reportLocale}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {DOCTOR_SUMMARY_LOCALES.map((locale) => {
                    const selected = reportLocale === locale;
                    const chip = doctorSummaryCopy(locale).localeChip;
                    return (
                      <Pressable
                        key={locale}
                        onPress={() => setReportLocale(locale as 'ka' | 'en' | 'fr' | 'ru')}
                        accessibilityLabel={`${copy.reportLocale}: ${localeNames[locale]}`}
                        accessibilityState={{ selected }}
                        style={{
                          minHeight: 44,
                          minWidth: 44,
                          paddingHorizontal: 14,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? c.brand : c.card,
                          borderWidth: 1,
                          borderColor: selected ? c.brand : c.border,
                        }}
                      >
                        <Text
                          style={{
                            color: selected ? '#fff' : c.ink,
                            fontWeight: '700',
                            fontSize: 13,
                          }}
                        >
                          {chip}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <AlwaysOnRow
                  c={c}
                  label={copy.menstrualOn}
                  alwaysOn={copy.alwaysOn}
                />
                {s.pregnancyContext ? (
                  <AlwaysOnRow
                    c={c}
                    label={copy.pregnancyAlwaysOn}
                    alwaysOn={copy.alwaysOn}
                  />
                ) : null}
                {s.perimenopauseContext ? (
                  <AlwaysOnRow
                    c={c}
                    label={copy.perimenopauseAlwaysOn}
                    alwaysOn={copy.alwaysOn}
                  />
                ) : null}
                {s.postpartumContext ? (
                  <AlwaysOnRow
                    c={c}
                    label={copy.postpartumAlwaysOn}
                    alwaysOn={copy.alwaysOn}
                  />
                ) : null}
                <AlwaysOnRow c={c} label={copy.painOn} alwaysOn={copy.alwaysOn} />
                <AlwaysOnRow c={c} label={copy.wellnessOn} alwaysOn={copy.alwaysOn} />
                <ToggleRow
                  c={c}
                  label={copy.fertilityToggle}
                  value={includeFertility}
                  onValueChange={setIncludeFertility}
                />
                <ToggleRow
                  c={c}
                  label={copy.sexualToggle}
                  value={includeSexual}
                  onValueChange={setIncludeSexual}
                />
                <ToggleRow
                  c={c}
                  label={copy.notesToggle}
                  value={includeNotes}
                  onValueChange={setIncludeNotes}
                  last
                />
              </CycleCard>
            </CycleSection>

            {s.pregnancyContext ? (
              <CycleSection title={copy.pregnancyContextTitle} delay={40}>
                <CycleCard>
                  <Line
                    c={c}
                    k={copy.pregnancyTrackingMode}
                    v={copy.pregnancyTrackingModeValue}
                  />
                  {formatDoctorPregnancyReference(s.pregnancyContext, reportLocale) ? (
                    <Line
                      c={c}
                      k={copy.pregnancyDatingReference}
                      v={formatDoctorPregnancyReference(s.pregnancyContext, reportLocale)}
                    />
                  ) : null}
                  {s.pregnancyContext.reviewRequired ? (
                    <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginTop: 8 }}>
                      {copy.pregnancyReviewRequired}
                    </Text>
                  ) : (
                    <>
                      {s.pregnancyContext.estimatedGestationalAge ? (
                        <Line
                          c={c}
                          k={
                            s.pregnancyContext.referenceType === 'LMP'
                              ? copy.pregnancyEstimatedAgeLmp
                              : copy.pregnancyEstimatedAge
                          }
                          v={formatDoctorGestationalAge(
                            s.pregnancyContext.estimatedGestationalAge,
                            reportLocale,
                          )}
                          last={!s.pregnancyContext.estimatedDueDate?.date}
                        />
                      ) : null}
                      {s.pregnancyContext.estimatedDueDate?.date ? (
                        <Line
                          c={c}
                          k={copy.pregnancyEstimatedDue}
                          v={fmt(s.pregnancyContext.estimatedDueDate.date)}
                          last
                        />
                      ) : null}
                    </>
                  )}
                </CycleCard>
              </CycleSection>
            ) : null}

            {s.perimenopauseContext ? (
              <CycleSection title={copy.perimenopauseContextTitle} delay={40}>
                <CycleCard>
                  <Line
                    c={c}
                    k={copy.perimenopauseTrackingMode}
                    v={copy.perimenopauseTrackingModeValue}
                    last={!s.perimenopauseContext.variability}
                  />
                  {s.perimenopauseContext.variability ? (
                    <>
                      <Line
                        c={c}
                        k={copy.perimenopauseIntervalRangeLabel}
                        v={copy.perimenopauseIntervalRange(
                          s.perimenopauseContext.variability.shortestDays,
                          s.perimenopauseContext.variability.longestDays,
                        )}
                      />
                      <Line
                        c={c}
                        k={copy.perimenopauseIntervalCountLabel}
                        v={copy.perimenopauseIntervalCount(s.perimenopauseContext.variability.intervalCount)}
                        last
                      />
                    </>
                  ) : null}
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 10 }}
                    accessibilityLabel={copy.perimenopauseCurrentNote}
                  >
                    {copy.perimenopauseCurrentNote}
                  </Text>
                </CycleCard>
              </CycleSection>
            ) : null}

            {s.postpartumContext ? (
              <CycleSection title={copy.postpartumContextTitle} delay={40}>
                <CycleCard>
                  <Line
                    c={c}
                    k={copy.postpartumTrackingMode}
                    v={copy.postpartumTrackingModeValue}
                  />
                  <Line
                    c={c}
                    k={copy.postpartumReferenceLabel}
                    v={
                      s.postpartumContext.referenceDate
                        ? fmt(s.postpartumContext.referenceDate)
                        : copy.postpartumReferenceMissing
                    }
                    last={!s.postpartumContext.elapsed}
                  />
                  {s.postpartumContext.elapsed ? (
                    <Line
                      c={c}
                      k={copy.postpartumElapsedLabel}
                      v={formatDoctorGestationalAge(s.postpartumContext.elapsed, reportLocale)}
                      last
                    />
                  ) : null}
                  <Text
                    style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 10 }}
                    accessibilityLabel={copy.postpartumCurrentNote}
                  >
                    {copy.postpartumCurrentNote}
                  </Text>
                </CycleCard>
              </CycleSection>
            ) : null}

            {s.menstrualHistory?.episodes?.length ? (
              <CycleSection title={copy.menstrualOn} delay={60}>
                <CycleCard>
                  {s.menstrualHistory.episodes.map((e, i) => (
                    <Line
                      key={e.start}
                      c={c}
                      k={`${fmt(e.start)} – ${fmt(e.end)}`}
                      v={copy.days(e.durationDays)}
                      last={i === s.menstrualHistory!.episodes.length - 1 && !s.menstrualHistory!.cycleLengths.length}
                    />
                  ))}
                  {s.menstrualHistory.cycleLengths.length ? (
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                      {copy.cycleLengths}: {s.menstrualHistory.cycleLengths.map((x) => x.lengthDays).join(', ')}
                    </Text>
                  ) : null}
                  {s.menstrualHistory.spottingDates.length ? (
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                      {copy.spotting}: {s.menstrualHistory.spottingDates.map(fmt).join(', ')}
                    </Text>
                  ) : null}
                  {s.contraception?.method ? (
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                      {copy.contraceptionTitle}:{' '}
                      {doctorSummaryEnumLabel('contraception', s.contraception.method, reportLocale) || ''}
                    </Text>
                  ) : null}
                </CycleCard>
              </CycleSection>
            ) : null}

            {history.showPeriodHistory && bundle ? (
              <CyclePeriodHistory bundle={bundle} onChanged={reload} />
            ) : null}

            {s.pain ? (
              <CycleSection title={copy.pain} delay={80}>
                <CycleCard>
                  {s.pain.aggregates
                    .map((p) => ({
                      ...p,
                      label: doctorSummaryEnumLabel('painType', p.type, reportLocale),
                    }))
                    .filter((p) => p.label)
                    .map((p, i, rows) => (
                    <Line
                      key={p.type}
                      c={c}
                      k={p.label!}
                      v={`${copy.loggedDays(p.dayCount)}${p.severityMode ? ` · ${doctorSummaryEnumLabel('painSeverity', p.severityMode, reportLocale) ?? ''}` : ''}`}
                      last={i === rows.length - 1}
                    />
                  ))}
                </CycleCard>
              </CycleSection>
            ) : null}

            {s.symptoms?.rows?.length ? (
              <CycleSection title={copy.symptoms} delay={100}>
                <CycleCard>
                  {s.symptoms.rows
                    .map((row) => ({
                      ...row,
                      label: doctorSummaryEnumLabel('symptom', row.key, reportLocale),
                    }))
                    .filter((row) => row.label)
                    .map((row, i, rows) => (
                    <Line
                      key={row.key}
                      c={c}
                      k={row.label!}
                      v={copy.loggedDays(row.dayCount)}
                      last={i === rows.length - 1}
                    />
                  ))}
                </CycleCard>
              </CycleSection>
            ) : null}

            {s.wellness ? (
              <CycleSection title={copy.wellnessOn} delay={110}>
                <CycleCard>
                  {s.wellness.energy?.length ? (
                    <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                      {copy.energyTitle}: {copy.loggedDays(s.wellness.energy.length)}
                    </Text>
                  ) : null}
                  {s.wellness.sleep?.length ? (
                    <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginBottom: 8 }}>
                      {copy.sleepTitle}: {copy.loggedDays(s.wellness.sleep.length)}
                    </Text>
                  ) : null}
                  {s.wellness.stress?.length ? (
                    <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20 }}>
                      {copy.stressTitle}: {copy.loggedDays(s.wellness.stress.length)}
                    </Text>
                  ) : null}
                </CycleCard>
              </CycleSection>
            ) : null}

            {bundle?.predictions?.nextPeriodStart &&
            !s.pregnancyContext &&
            !s.perimenopauseContext &&
            !s.postpartumContext ? (
              <CycleSection title={copy.estimatesTitle} delay={120}>
                <CycleCard>
                  <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 8 }}>
                    {copy.estimatesHint}
                  </Text>
                  <Line c={c} k={copy.estimatedNextPeriod} v={fmt(bundle.predictions.nextPeriodStart)} last />
                </CycleCard>
              </CycleSection>
            ) : null}

            {history.showPmsPattern && bundle && hasPmsPattern(bundle) ? (
              <CycleSection title={ka.cycle.pmsPattern} delay={130}>
                <CyclePmsHeatmap bundle={bundle} />
              </CycleSection>
            ) : null}

            <View style={{ marginTop: 8, gap: 10 }}>
              <CyclePrimaryButton
                label={pdfBusy ? copy.pdfGenerating : copy.pdfShare}
                onPress={sharePdf}
                icon={FileDown}
                disabled={pdfBusy}
              />
              <Pressable
                onPress={() => router.push('/cycle/trends' as never)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 14,
                  minHeight: 44,
                  borderRadius: 18,
                  backgroundColor: c.lavenderSoft,
                }}
              >
                <BarChart3 size={18} color={c.lavender} />
                <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 8 }}>
                  {ka.cycle.trendsOpen}
                </Text>
              </Pressable>
              <CyclePrimaryButton
                label={ka.cycle.openChat}
                onPress={() =>
                  router.push({
                    pathname: '/chat/doctor',
                    params: { prefill: chatContext },
                  } as never)
                }
                icon={MessageSquareText}
              />
            </View>
          </>
        ) : (
          <Text style={{ color: c.muted, fontWeight: '600' }}>{ka.cycle.emptyHint}</Text>
        )}
      </ScrollView>
    </CycleAtmosphere>
  );
}

function AlwaysOnRow({
  c,
  label,
  alwaysOn,
}: {
  c: ReturnType<typeof useCycleColors>;
  label: string;
  alwaysOn: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}. ${alwaysOn}`}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 44,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: c.ink, flex: 1, paddingRight: 12, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: c.muted, fontSize: 12 }}>{alwaysOn}</Text>
    </View>
  );
}

function ToggleRow({
  c,
  label,
  value,
  onValueChange,
  last,
}: {
  c: ReturnType<typeof useCycleColors>;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: 44,
        paddingVertical: 8,
        borderBottomWidth: last ? 0 : 0,
      }}
    >
      <Text style={{ color: c.ink, flex: 1, paddingRight: 12, fontSize: 14 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: c.border, true: c.brand }}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Line({
  c,
  k,
  v,
  last,
}: {
  c: ReturnType<typeof useCycleColors>;
  k: string;
  v: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <Text style={{ color: c.muted, flex: 1, paddingRight: 12, flexWrap: 'wrap' }}>{k}</Text>
      <Text style={{ color: c.ink, fontWeight: '700', flex: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );
}
