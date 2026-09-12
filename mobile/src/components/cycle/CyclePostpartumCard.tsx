import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ka } from '@/i18n/ka';
import type { CyclePostpartumPayload } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { energyLabel, formatPainEntry, sleepLabel } from '@/lib/cycleObservations';
import { postpartumEmptyCopyAllowed, postpartumQueryPending } from '@/lib/cyclePostpartumQuery';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  postpartum: CyclePostpartumPayload | null;
  status?: string;
  errorKind?: string | null;
  onRetry?: () => void;
  onLog?: () => void;
};

function todayFactLines(row: CyclePostpartumPayload['todayObservations'] | null | undefined): string[] {
  if (!row) return [];
  const bits: string[] = [];
  if (row.flow) bits.push(`${ka.cycle.postpartumBleeding} — ${cycleChipLabel(row.flow)}`);
  for (const entry of row.painEntries || []) bits.push(formatPainEntry(entry));
  for (const key of row.symptoms || []) bits.push(cycleChipLabel(key));
  for (const mood of row.moods || []) bits.push(cycleChipLabel(mood));
  if (row.sleepQuality) bits.push(`${ka.cycle.sleep}: ${sleepLabel(row.sleepQuality)}`);
  if (row.energy) bits.push(`${ka.cycle.energy}: ${energyLabel(row.energy)}`);
  return bits;
}

export function CyclePostpartumCard({ postpartum, status, errorKind, onRetry, onLog }: Props) {
  const c = useCycleColors();
  const pending = postpartumQueryPending(status);
  const canEmpty = postpartumEmptyCopyAllowed(status);
  const elapsed = postpartum?.elapsed;
  const facts = todayFactLines(postpartum?.todayObservations);

  if (pending && !postpartum) {
    return (
      <View
        accessibilityRole="summary"
        accessibilityLabel={ka.cycle.postpartumLoading}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          padding: 16,
          minHeight: 88,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={c.brand} />
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 10 }}>{ka.cycle.postpartumLoading}</Text>
      </View>
    );
  }

  if (errorKind && !postpartum) {
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
          {ka.cycle.postpartumLoadError}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.retry}
            style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.retry}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={ka.cycle.postpartumModeTitle}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.card,
        padding: 16,
      }}
    >
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22 }}>
        {ka.cycle.postpartumModeTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
        {ka.cycle.postpartumNotDiagnosis}
      </Text>

      {elapsed ? (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 28 }}>
            {ka.cycle.postpartumElapsed(elapsed.week, elapsed.day)}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            {ka.cycle.postpartumElapsedHint}
          </Text>
        </View>
      ) : canEmpty || postpartum ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 14 }}>
          {ka.cycle.postpartumNoReference}
        </Text>
      ) : null}

      <Text
        style={{
          color: c.ink,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 13,
          marginTop: 16,
        }}
      >
        {ka.cycle.postpartumTodayFacts}
      </Text>
      {facts.length ? (
        facts.map((line) => (
          <Text key={line} style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            {line}
          </Text>
        ))
      ) : (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          {ka.cycle.postpartumTodayEmpty}
        </Text>
      )}

      {postpartum?.latestClassified ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 12 }}>
          {ka.cycle.postpartumLatestClassified}
        </Text>
      ) : null}

      {onLog ? (
        <Pressable
          onPress={onLog}
          accessibilityRole="button"
          accessibilityLabel={ka.cycle.quickLogTitle}
          style={{
            minHeight: 44,
            borderRadius: 12,
            backgroundColor: c.cta,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 14,
          }}
        >
          <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
            {ka.cycle.quickLogTitle}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
