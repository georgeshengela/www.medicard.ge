import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronRight, Plus } from 'lucide-react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedsRing } from '@/components/medications/MedsHubUI';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { Medication, ScheduledDose } from '@/lib/api';
import { computeTodayDoses } from '@/lib/home/todayDoses';
import { DAY_LETTERS, formatTime24h, parseMedicationConfig } from '@/lib/medications.shared';
import { HUB } from '@/theme/hub';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import type { MedicationDoseLog } from '@/types/medications';

const BRAND = MODULE_BRANDS.pill;
/** A past day with a dose that was not taken: warm amber reads as „look here“ on the blue. */
const ATTENTION = '#FCD34D';

type DayBox = { key: string; letter: string; taken: number; total: number; past: boolean; today: boolean };

/**
 * MEDIPILL's one hero card: today's ring, the next dose with a one-tap „მივიღე“, and the week as a
 * pill organiser — seven compartments that fill as the doses are taken. The card opens the day's
 * schedule; a compartment opens that day. Without any active medication it invites the first one.
 */
export function MedipillHero({
  medications,
  schedule,
  doseLogs,
  images,
  onOpenSchedule,
  onOpenDay,
  onTake,
  onAdd,
}: {
  medications: Medication[];
  schedule: ScheduledDose[];
  doseLogs: MedicationDoseLog[];
  images: Record<string, string | null | undefined>;
  onOpenSchedule: () => void;
  onOpenDay: (ymd: string) => void;
  onTake: (dose: ScheduledDose) => void;
  onAdd: () => void;
}) {
  const hasActive = medications.some((med) => med.active);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = ymd(today);
  const todayView = useMemo(
    () => computeTodayDoses(medications, schedule, doseLogs, todayKey, today),
    [medications, schedule, doseLogs, todayKey, today],
  );
  const week = useMemo(() => weekBoxes(medications, schedule, doseLogs, today), [medications, schedule, doseLogs, today]);

  if (!hasActive) {
    return (
      <HeroShell onPress={onAdd} label={tx('დაამატე პირველი წამალი', 'Add your first medication')}>
        <View style={s.head}>
          <View style={s.plusTile}>
            <Plus size={24} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={s.title}>{tx('დაამატე პირველი წამალი', 'Add your first medication')}</Text>
            <Text style={[s.sub, { color: BRAND.onHero }]}>
              {tx('შეგახსენებთ დროზე, აქ კი ყოველი მიღებული დოზა შეივსება', 'We remind you on time, and every dose you take fills in here')}
            </Text>
          </View>
        </View>
        <Organizer days={week} preview />
      </HeroShell>
    );
  }

  const { taken, total, pending } = todayView;
  const next = pending[0];
  const nextMed = next ? medications.find((med) => med.id === next.medicationId) : undefined;
  const nextCfg = parseMedicationConfig(nextMed?.config);
  const title = total === 0 ? tx('დღეს თავისუფალია', 'Free today') : ka.meds.todayProgress(taken, total);
  const sub =
    total === 0
      ? tx('მიღება სხვა დღეებშია', 'Doses fall on other days')
      : next
        ? `${tx('დღეს', 'Today')} · ${ka.meds.remainingDoses(pending.length)}`
        : ka.meds.todayAllTaken;
  const pastBoxes = week.filter((day) => day.past || day.today);
  const weekTaken = pastBoxes.reduce((sum, day) => sum + day.taken, 0);
  const weekTotal = pastBoxes.reduce((sum, day) => sum + day.total, 0);

  return (
    <HeroShell>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${sub}. ${ka.meds.remindersScreenTitle}`} onPress={onOpenSchedule} style={s.head}>
        <MedsRing size={60} stroke={6} progress={total > 0 ? taken / total : 0} color="#FFFFFF" track="rgba(255,255,255,0.18)">
          {total > 0 && taken === total ? (
            <Check size={24} color="#FFFFFF" strokeWidth={2.8} />
          ) : (
            <Text style={s.ringText}>{total > 0 ? `${taken}/${total}` : '—'}</Text>
          )}
        </MedsRing>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={s.title}>{title}</Text>
          <Text numberOfLines={1} style={[s.sub, { color: BRAND.onHero }]}>{sub}</Text>
        </View>
        <View style={s.more}>
          <Text style={s.moreText}>{ka.meds.remindersScreenTitle}</Text>
          <ChevronRight size={15} color="#FFFFFF" strokeWidth={2.4} />
        </View>
      </Pressable>

      {next ? (
        <View style={s.next}>
          <View style={s.nextPill}>
            <MedicationPillIcon
              color={nextCfg.pillColor}
              shape={nextCfg.pillShape ?? 'long'}
              size={36}
              imageUrl={images[next.medicationId] ?? nextCfg.imageUrl}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[s.nextLabel, { color: BRAND.onHero }]}>
              {tx('შემდეგი', 'Next')} · {formatTime24h(next.dueTime)}
            </Text>
            <Text numberOfLines={1} style={s.nextName}>{next.medName}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${ka.meds.actionTake}: ${next.medName}, ${formatTime24h(next.dueTime)}`}
            onPress={() => onTake(next)}
            hitSlop={6}
            style={s.take}
          >
            <Check size={16} color={BRAND.gradient[1]} strokeWidth={2.8} />
            <Text style={[s.takeText, { color: BRAND.gradient[0] }]}>{tx('მივიღე', 'Taken')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <View style={s.weekHead}>
          <Text style={[s.weekLabel, { color: BRAND.onHero }]}>{tx('ამ კვირაში', 'This week')}</Text>
          {weekTotal > 0 ? (
            <Text style={s.weekCount}>{tx(`${weekTaken}/${weekTotal} მიღებული`, `${weekTaken}/${weekTotal} taken`)}</Text>
          ) : null}
        </View>
        <Organizer days={week} onOpenDay={onOpenDay} />
      </View>
    </HeroShell>
  );
}

/** The gradient card. Pressable as a whole only when nothing inside it is (the empty invitation). */
function HeroShell({ children, onPress, label }: { children: React.ReactNode; onPress?: () => void; label?: string }) {
  const body = (
    <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
      {/* Corner glow and two thin rings — the module hero's light, kept small. */}
      <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
      <View pointerEvents="none" style={[s.ring, s.ringOuter]} />
      <View pointerEvents="none" style={[s.ring, s.ringInner]} />
      {children}
    </LinearGradient>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.wrap}>
      {body}
    </Pressable>
  ) : (
    <View style={s.wrap}>{body}</View>
  );
}

/**
 * The week as a pill organiser: a compartment per day, filled from the bottom by the share of that
 * day's doses taken. Today is outlined; a past day with a dose not taken gets an amber dot.
 */
function Organizer({ days, preview, onOpenDay }: { days: DayBox[]; preview?: boolean; onOpenDay?: (ymd: string) => void }) {
  return (
    <View style={[s.organizer, preview && { opacity: 0.6 }]} accessible={preview ? false : undefined}>
      {days.map((day, index) => {
        const share = preview ? [1, 1, 0.5, 1, 0, 0, 0][index] : day.total ? day.taken / day.total : 0;
        const missed = !preview && day.past && day.total > 0 && day.taken < day.total;
        const full = !preview && day.total > 0 && day.taken === day.total;
        const label = day.total
          ? tx(`${day.letter}: ${day.taken}/${day.total} მიღებული`, `${day.letter}: ${day.taken}/${day.total} taken`)
          : tx(`${day.letter}: მიღება არ არის`, `${day.letter}: no doses`);
        const box = (
          <>
            <Text style={[s.dayLetter, { color: day.today ? '#FFFFFF' : BRAND.onHero }]}>{day.letter}</Text>
            <View style={[s.compartment, day.today && s.compartmentToday]}>
              {share > 0 ? <View style={[s.fill, { height: `${Math.max(18, Math.round(share * 100))}%` }]} /> : null}
              {!preview && day.total === 0 ? <View style={s.restDot} /> : null}
              {full ? <View style={s.fullCheck}><Check size={16} color={BRAND.gradient[1]} strokeWidth={3} /></View> : null}
              {missed ? <View style={s.missedDot} /> : null}
            </View>
          </>
        );
        return onOpenDay && !preview ? (
          <Pressable key={day.key} accessibilityRole="button" accessibilityLabel={label} onPress={() => onOpenDay(day.key)} hitSlop={4} style={s.day}>
            {box}
          </Pressable>
        ) : (
          <View key={day.key} style={s.day}>{box}</View>
        );
      })}
    </View>
  );
}

function weekBoxes(medications: Medication[], schedule: ScheduledDose[], doseLogs: MedicationDoseLog[], today: Date): DayBox[] {
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = ymd(date);
    const view = computeTodayDoses(medications, schedule, doseLogs, key, date);
    return {
      key,
      letter: DAY_LETTERS[index],
      taken: view.taken,
      total: view.total,
      past: date < today,
      today: key === ymd(today),
    };
  });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  wrap: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  card: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 16, overflow: 'hidden' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -70, top: -90 },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(191,219,254,0.16)' },
  ringOuter: { width: 240, height: 240, borderRadius: 120, right: -100, top: -110 },
  ringInner: { width: 160, height: 160, borderRadius: 80, right: -60, top: -70 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plusTile: {
    width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(30,58,138,0.35)', borderWidth: 1, borderColor: 'rgba(191,219,254,0.28)',
  },
  ringText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  sub: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 17 },
  more: {
    flexDirection: 'row', alignItems: 'center', gap: 2, height: 30, paddingLeft: 12, paddingRight: 8, borderRadius: 15,
    backgroundColor: 'rgba(30,58,138,0.35)', borderWidth: 1, borderColor: 'rgba(191,219,254,0.22)',
  },
  moreText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  next: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingRight: 10, borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.22)', borderWidth: 1, borderColor: 'rgba(191,219,254,0.18)',
  },
  nextPill: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  nextLabel: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16 },
  nextName: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
  take: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 38, paddingHorizontal: 14, borderRadius: 19,
    backgroundColor: '#FFFFFF',
  },
  takeText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13.5, lineHeight: 18 },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekLabel: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16 },
  weekCount: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, lineHeight: 16, color: '#FFFFFF' },
  organizer: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 5 },
  dayLetter: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, lineHeight: 14 },
  compartment: {
    alignSelf: 'stretch', height: 40, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(191,219,254,0.20)',
  },
  compartmentToday: { borderColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5 },
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.88)' },
  fullCheck: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  restDot: { position: 'absolute', top: 17, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(191,219,254,0.45)' },
  missedDot: { position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: ATTENTION },
});
