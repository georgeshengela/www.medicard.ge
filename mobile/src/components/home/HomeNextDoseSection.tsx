import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check, Pill, RotateCcw } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { DoseCarouselSkeleton } from '@/components/ui/Skeleton';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { hubText } from '@/theme/hub';
import type { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { ScheduledDose } from '@/lib/api';
import { reopenDose } from '@/lib/doseReschedule';
import { formatTime24h, parseMedicationConfig, saveDoseLog, todayYmd } from '@/lib/medications.shared';
import { computeTodayDoses, type PendingDose } from '@/lib/home/todayDoses';
import { dueState, minuteOf, spanLabel } from '@/lib/home/doseDue';
import type { MedicationDoseLog } from '@/types/medications';
import { medicationSetupRoute } from '@/lib/home/medicationSetup';

/** Figma 11416:83298 — 288×~88 peeking dose cards. */
const CARD_W = 288;
const CARD_GAP = 10;
const SNAP = CARD_W + CARD_GAP;
/** How long a just-taken card stays (with its undo) before it leaves the row. */
const UNDO_MS = 6000;
type MedConfig = ReturnType<typeof parseMedicationConfig>;

type Props = {
  /** Shared medications bundle — Home loads it once for the hero rings and this carousel. */
  meds: ReturnType<typeof useMedications>;
  /**
   * A medicine named in the onboarding medication goal that is not tracked yet (`medicationToSetUp`):
   * a card leads to the MEDIPILL setup with the name filled in, so it is never silently dropped.
   */
  setupName?: string | null;
  /** „არა ახლა“: hides the setup card for that name on this account (`useMedicationSetupDismissals`). */
  onDismissSetup?: (name: string) => void;
};

function formLabel(cfg: MedConfig, dosage: string) {
  const form = cfg.form ? ka.meds.formLabels[cfg.form] : null;
  if (dosage && form && !dosage.toLowerCase().includes(form.toLowerCase())) {
    return `${dosage} ${form}`;
  }
  return dosage || form || '';
}

const keyOf = (d: { medicationId: string; time: string }) => `${d.medicationId}|${d.time}`;

/**
 * One compact dose card (owner 2026-10-03: same size as before, but with the time and a one-tap
 * answer): „09:00 · 2 სთ-ში“ (amber once late), the name, the amount, and a round ✓ that logs the
 * dose; for a few seconds after that the same spot undoes it.
 */
function NextDoseCard({
  dose,
  cfg,
  nowMinute,
  taken,
  onOpen,
  onTake,
  onUndo,
}: {
  dose: ScheduledDose & { dueTime?: string };
  cfg: MedConfig;
  nowMinute: number;
  taken: boolean;
  onOpen: () => void;
  onTake: () => void;
  onUndo: () => void;
}) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const subtitle = formLabel(cfg, dose.dosage);
  // A dose moved with „გადატანა“ is due at its new time, not „late“ since its old one.
  const at = dose.dueTime ?? dose.time;
  const due = dueState(minuteOf(at), nowMinute);
  // Hours later a counter only scolds: past three hours it is just „late“.
  const dueText =
    due.kind === 'late'
      ? due.minutes >= 180
        ? tx('დაგვიანებულია', 'late')
        : tx(`დაგვიანდა ${spanLabel(due.minutes, false)}`, `${spanLabel(due.minutes, true)} late`)
      : due.kind === 'now'
        ? tx('ახლა', 'now')
        : tx(`${spanLabel(due.minutes, false)}-ში`, `in ${spanLabel(due.minutes, true)}`);
  const timeColor = due.kind === 'late' ? c.warning : due.kind === 'now' ? accent.ink : c.text100;

  return (
    <View style={{ width: CARD_W, minHeight: 88, borderRadius: 20, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[dose.medName, subtitle, formatTime24h(at), taken ? tx('მიღებულია', 'taken') : dueText].filter(Boolean).join('. ')}
        onPress={onOpen}
        style={{ flex: 1, minWidth: 0, gap: 4, paddingVertical: 16, paddingLeft: 16, paddingRight: 8 }}
      >
        {taken ? (
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16, color: accent.ink }}>
            {tx('მიღებულია', 'Taken')}
          </Text>
        ) : (
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: c.text200 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: timeColor }}>{formatTime24h(at)}</Text>
            {` · ${dueText}`}
          </Text>
        )}
        <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, lineHeight: 24, color: c.text100 }}>
          {dose.medName}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: c.text200 }}>
            {subtitle}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={taken ? tx(`${dose.medName} — გაუქმება`, `${dose.medName} — undo`) : tx(`${dose.medName} — მივიღე`, `${dose.medName} — mark taken`)}
        hitSlop={6}
        onPress={taken ? onUndo : onTake}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          marginRight: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: taken ? c.bg200 : accent.soft,
        }}
      >
        {taken ? <RotateCcw size={19} color={c.text200} strokeWidth={2.4} /> : <Check size={22} color={accent.ink} strokeWidth={2.8} />}
      </Pressable>
    </View>
  );
}

/**
 * „დააყენე შეხსენება: Metformin“ — the onboarding medicine, waiting for its dose and times. A quiet
 * „არა ახლა“ under it (a sibling, never nested in the card's own Pressable) hides it for that name: an
 * as-needed medicine, a name that differs from the catalogue brand, or one she deleted later.
 */
function SetupMedicationCard({ name, onDismiss }: { name: string; onDismiss?: (name: string) => void }) {
  const router = useRouter();
  const c = useThemeColors();
  return (
    <View>
      <HubFeatureCard
        icon={Pill}
        ink="blue"
        title={tx(`დააყენე შეხსენება: ${name}`, `Set up reminders: ${name}`)}
        body={tx(
          'მიუთითე დოზა და მიღების დრო — და დროზე შეგახსენებთ.',
          'Add the dose and the times you take it, and we will remind you on time.',
        )}
        cta={tx('დაყენება', 'Set up')}
        onPress={() => router.push(medicationSetupRoute(name))}
      />
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx(`${name}: არა ახლა`, `${name}: not now`)}
          hitSlop={8}
          onPress={() => onDismiss(name)}
          style={styles.notNow}
        >
          <Text style={[hubText.link, { color: c.text200 }]}>{tx('არა ახლა', 'Not now')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notNow: { alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', paddingHorizontal: 4, marginTop: 4 },
});

export function HomeNextDoseSection({ meds, setupName, onDismissSetup }: Props) {
  const router = useRouter();
  const { medications, schedule, doseLogs, setDoseLogs, loading } = meds;
  const today = todayYmd();
  const [now, setNow] = useState(() => new Date());
  /** Doses taken from this row a moment ago, kept in place for the undo. */
  const [justTaken, setJustTaken] = useState<PendingDose[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    const pendingTimers = timers.current;
    return () => {
      clearInterval(id);
      pendingTimers.forEach(clearTimeout);
    };
  }, []);

  const { pending } = useMemo(
    () => computeTodayDoses(medications, schedule, doseLogs, today),
    [doseLogs, medications, schedule, today],
  );
  const cards = useMemo(() => {
    const kept = justTaken.filter((d) => !pending.some((p) => keyOf(p) === keyOf(d)));
    return [...pending, ...kept].sort((a, b) => a.dueTime.localeCompare(b.dueTime));
  }, [pending, justTaken]);

  if (loading) {
    return (
      <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
        <HomeSectionTitle title={ka.home.nextDose} style={{ fontSize: 17, lineHeight: 24, marginBottom: 12 }} />
        <DoseCarouselSkeleton />
      </View>
    );
  }

  if (cards.length === 0 && !setupName) return null;

  const keep = (entry: MedicationDoseLog) =>
    setDoseLogs((prev) => [...prev.filter((l) => !(l.medicationId === entry.medicationId && l.date === today && l.time === entry.time)), entry]);
  const writeTaken = async (dose: ScheduledDose) => {
    const entry: MedicationDoseLog = { medicationId: dose.medicationId, date: today, time: dose.time, status: 'taken', updatedAt: new Date().toISOString() };
    await saveDoseLog(entry);
    keep(entry);
  };
  const take = async (dose: PendingDose) => {
    const key = keyOf(dose);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setJustTaken((prev) => [...prev.filter((d) => keyOf(d) !== key), dose]);
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(() => setJustTaken((prev) => prev.filter((d) => keyOf(d) !== key)), UNDO_MS));
    await writeTaken(dose);
  };
  // Undo writes „pending“ (the same answer the web undo writes), so the dose is due again; a dose moved
  // with „გადატანა“ goes back to its moved time and gets its reminder back.
  const undo = async (dose: PendingDose) => {
    const key = keyOf(dose);
    clearTimeout(timers.current.get(key));
    setJustTaken((prev) => prev.filter((d) => keyOf(d) !== key));
    keep(await reopenDose(dose, today));
  };

  const nowMinute = now.getHours() * 60 + now.getMinutes();

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
      <HomeSectionTitle title={ka.home.nextDose} style={{ fontSize: 17, lineHeight: 24, marginBottom: 12 }} />
      {cards.length > 0 ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={SNAP}
          snapToAlignment="start"
          disableIntervalMomentum
          style={{ marginHorizontal: -20 }}
          contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: 20 }}
        >
          {cards.map((dose) => {
            const med = medications.find((item) => item.id === dose.medicationId);
            const taken = !pending.some((p) => keyOf(p) === keyOf(dose));
            return (
              <NextDoseCard
                key={keyOf(dose)}
                dose={dose}
                cfg={parseMedicationConfig(med?.config)}
                nowMinute={nowMinute}
                taken={taken}
                onOpen={() => router.push(`/medications/${dose.medicationId}?time=${dose.time}&date=${today}` as never)}
                onTake={() => void take(dose)}
                onUndo={() => void undo(dose)}
              />
            );
          })}
        </ScrollView>
      ) : null}
      {setupName ? (
        <View style={{ marginTop: cards.length > 0 ? 10 : 0 }}>
          <SetupMedicationCard name={setupName} onDismiss={onDismissSetup} />
        </View>
      ) : null}
    </View>
  );
}
