import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';

const WEEKDAYS = ['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'] as const;

export default function MedicationCalendarScreen() {
  const router = useRouter();
  const { doseLogs } = useMedications();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const monthLabel = cursor.toLocaleDateString('ka-GE', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const total = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < firstDay; i += 1) cells.push({ day: null, key: `e-${i}` });
    for (let d = 1; d <= total; d += 1) cells.push({ day: d, key: `d-${d}` });
    return cells;
  }, [cursor]);

  const statusForDay = (day: number) => {
    const ymd = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const logs = doseLogs.filter((l) => l.date === ymd);
    if (!logs.length) return 'none';
    if (logs.every((l) => l.status === 'taken')) return 'taken';
    if (logs.some((l) => l.status === 'skipped')) return 'skipped';
    return 'partial';
  };

  return (
    <>
      <Stack.Screen options={{ title: ka.meds.calendarTitle }} />
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft size={24} color={FIGMA_MEDS.textPrimary} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '900', color: FIGMA_MEDS.textPrimary, textTransform: 'capitalize' }}>
            {monthLabel}
          </Text>
          <Pressable onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight size={24} color={FIGMA_MEDS.textPrimary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={{ flex: 1, textAlign: 'center', fontWeight: '700', color: FIGMA_MEDS.textMuted, fontSize: 12 }}>
              {w}
            </Text>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {days.map(({ day, key }) => (
            <View key={key} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 4 }}>
              {day ? (
                <View
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: dotBg(statusForDay(day)),
                    borderWidth: 1,
                    borderColor: FIGMA_MEDS.border,
                  }}
                >
                  <Text style={{ fontWeight: '800', color: FIGMA_MEDS.textPrimary }}>{day}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 20, justifyContent: 'center' }}>
          <Legend color="#DCFCE7" label={ka.meds.statusTaken} />
          <Legend color="#FEE2E2" label={ka.meds.statusSkipped} />
          <Legend color="#fff" label={ka.meds.calendarNoData} />
        </View>

        <Pressable
          onPress={() => router.push('/medications/reminders')}
          style={{
            marginTop: 24,
            backgroundColor: FIGMA_MEDS.brandQuaternary,
            borderRadius: 16,
            padding: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: FIGMA_MEDS.brandBorder,
          }}
        >
          <Text style={{ fontWeight: '800', color: FIGMA_MEDS.brand }}>{ka.meds.calendarBackToSchedule}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function dotBg(status: string) {
  if (status === 'taken') return '#DCFCE7';
  if (status === 'skipped') return '#FEE2E2';
  if (status === 'partial') return '#FEF9C3';
  return '#fff';
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 1, borderColor: FIGMA_MEDS.border }} />
      <Text style={{ marginLeft: 6, fontSize: 12, color: FIGMA_MEDS.textSecondary }}>{label}</Text>
    </View>
  );
}
