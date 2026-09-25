import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import { CyclePregnancyPayload } from '@/lib/api';
import { pregnancyEmptyCopyAllowed, pregnancyQueryPending } from '@/lib/cyclePregnancyQuery';
import { pregnancyObservationLines } from '@/lib/pregnancyObservationPresent';
import { CyclePrimaryButton, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { CalendarDays, Check, Heart, Plus } from 'lucide-react-native';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { PregnancyWeekMetrics, PregnancyWeekOpenCta } from '@/components/cycle/CyclePregnancyWeekVisual';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  pregnancy: CyclePregnancyPayload | null;
  status?: string;
  errorKind?: string | null;
  onRetry?: () => void;
  onLog?: () => void;
  onOpenWeek?: () => void;
};

function weekLine(age: CyclePregnancyPayload['estimatedGestationalAge']) {
  if (!age) return null;
  return ka.cycle.pregnancyWeekDay(age.week, age.day);
}

export function CyclePregnancyCard({
  pregnancy,
  status,
  errorKind,
  onRetry,
  onLog,
  onOpenWeek,
}: Props) {
  const c = useCycleColors();
  const pending = pregnancyQueryPending(status);
  const canEmpty = pregnancyEmptyCopyAllowed(status);

  if (pending && !pregnancy) {
    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={ka.common.loading}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
        }}
      >
        <ActivityIndicator color={c.ink} />
        <Text style={{ color: c.muted, marginTop: 10, fontSize: 13 }}>{ka.common.loading}</Text>
      </View>
    );
  }

  if (status === 'error' && !pregnancy) {
    return (
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
        }}
      >
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
          {ka.cycle.pregnancyModeTitle}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
          {errorKind === 'network' ? ka.cycle.offlineBanner : ka.common.error}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={ka.common.retry}
            style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.common.retry}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const age = pregnancy?.estimatedGestationalAge ?? null;
  const due = pregnancy?.estimatedDueDate?.date ?? null;
  const source =
    pregnancy?.referenceType === 'LMP'
      ? ka.cycle.pregnancySourceLmp
      : pregnancy?.referenceType === 'USER_SELECTED'
        ? ka.cycle.pregnancySourceSelected
        : null;
  const today = pregnancy?.todayObservations;
  const todayBits = today ? pregnancyObservationLines(today, { includeIntimate: false }) : [];
  const hasToday = todayBits.length > 0;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={ka.cycle.pregnancyModeTitle}
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 16,
      }}
    >
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <Heart size={16} color={c.brand} strokeWidth={1.8}/>
      <Text
        style={{
          color: c.brand,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          lineHeight: 20,
        }}
      >
        {ka.cycle.pregnancyModeTitle}
      </Text>
      </View>
      {pregnancy?.reviewRequired ? (
        <Text
          accessibilityLabel={ka.cycle.pregnancyReviewRequired}
          style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}
        >
          {ka.cycle.pregnancyReviewRequired}
        </Text>
      ) : age ? (
        <Text
          accessibilityLabel={ka.cycle.pregnancyWeekA11y(age.week, age.day)}
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 22,
            lineHeight: 30,
            marginTop: 8,
          }}
        >
          {weekLine(age)}
        </Text>
      ) : null}
      {due && !pregnancy?.reviewRequired ? (
        <View style={{flexDirection:'row',gap:8,alignItems:'flex-start',marginTop:8}}>
        <CalendarDays size={16} color={c.mutedSoft} style={{marginTop:2}}/>
        <Text
          accessibilityLabel={ka.cycle.pregnancyDueA11y(formatCycleDateKa(due))}
          style={{ flex:1,color: c.muted, fontSize: 12, lineHeight: 20 }}
        >
          {ka.cycle.pregnancyEstimatedDue}: {formatCycleDateKa(due)}
        </Text>
        </View>
      ) : null}
      {source ? (
        <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{source}</Text>
      ) : null}
      {pregnancy?.weekDevelopment && !pregnancy?.reviewRequired ? (
        <View style={{ marginTop: 16 }}>
          <PregnancyWeekMetrics development={pregnancy.weekDevelopment} compact />
          {onOpenWeek ? <PregnancyWeekOpenCta onPress={onOpenWeek} /> : null}
        </View>
      ) : null}
      <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 18, marginTop: 8 }}>
        {ka.cycle.pregnancyNotDiagnosis}
      </Text>
      {!pregnancy?.reviewRequired ? (
        <MedicalSourcesLink sourceIds={['pregnancyDueDate', 'fetalGrowth', 'fetalLength', 'fetalDevelopment', 'pregnancyWeeks']} />
      ) : null}
      <View style={{ marginTop: 16,paddingTop:16,borderTopWidth:1,borderColor:c.border }}>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13 }}>
          {ka.cycle.pregnancyTodayTitle}
        </Text>
        {canEmpty && !hasToday ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            {ka.cycle.pregnancyTodayEmpty}
          </Text>
        ) : hasToday ? (
          <View style={{ marginTop: 8, gap: 8,flexDirection:'row',flexWrap:'wrap' }}>
            {todayBits.map((bit) => (
              <View key={bit} style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:6,borderRadius:12,backgroundColor:c.cardSoft,maxWidth:'100%'}}>
              <Check size={13} color={c.todayRing}/>
              <Text style={{flexShrink:1,color: c.ink, fontSize: 12, lineHeight: 20 }}>
                {bit}
              </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {onLog ? (
        <View style={{marginTop:16}}><CyclePrimaryButton label={ka.cycle.logFab} onPress={onLog} icon={Plus}/></View>
      ) : null}
    </View>
  );
}
