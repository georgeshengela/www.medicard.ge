import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BellRing, Check } from 'lucide-react-native';
import { FlatCard } from '@/components/book/BookUI';
import { ChosenPills, FlowHeader, StepTitle, bundleLine, useBookingFlow } from '@/components/book/BookFlow';
import { ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { addDays, dayLabel, monthDay, tbilisiYmd } from '@/lib/book/bookFormat';
import type { BookDayPart, BookWaitlistEntry } from '@/lib/book/bookTypes';
import { isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { invalidate } from '@/lib/queryClient';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

type RangeKey = 'day' | '7' | '14' | '30';
const PARTS: Array<{ key: BookDayPart; ka: string; en: string; hint: string }> = [
  { key: 'MORNING', ka: 'დილა', en: 'Morning', hint: '–12:00' },
  { key: 'AFTERNOON', ka: 'დღე', en: 'Afternoon', hint: '12–17' },
  { key: 'EVENING', ka: 'საღამო', en: 'Evening', hint: '17:00–' },
];

/**
 * The waiting list — the way out when no time fits: the chosen services and person, which days (one day, or
 * the next 7 / 14 / 30), which parts of the day, a note. As soon as a booking is cancelled or moved, or the
 * business frees time, the first fitting slot is pushed with a link straight to that day; a booking in the
 * range closes the entry by itself.
 */
export default function BookWaitStep() {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  const insets = useSafeAreaInsets();
  const { router, b, query, service, serviceIds, selected, bundle, staffId, person, params } = useBookingFlow();
  const fromDay = params.date && /^\d{4}-\d{2}-\d{2}$/.test(String(params.date)) && String(params.date) >= tbilisiYmd() ? String(params.date) : null;
  const [range, setRange] = useState<RangeKey>(fromDay ? 'day' : '14');
  const [parts, setParts] = useState<BookDayPart[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<BookWaitlistEntry | null>(null);

  const horizon = Math.max(1, b?.settings.horizonDays ?? 30);
  const dates = useMemo(() => {
    const today = tbilisiYmd();
    if (range === 'day' && fromDay) return { from: fromDay, to: fromDay };
    const days = Math.min(horizon, Number(range));
    return { from: today, to: addDays(today, days) };
  }, [range, fromDay, horizon]);

  const togglePart = (p: BookDayPart) => {
    void Haptics.selectionAsync().catch(() => undefined);
    setParts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  const submit = async () => {
    if (!b || !service) return;
    setBusy(true);
    try {
      const { entry } = await api.book.waitlist.join({
        businessId: b.id,
        ...(serviceIds.length > 1 ? { serviceIds } : { serviceId: service.id }),
        staffId: staffId ?? null,
        fromDate: dates.from,
        toDate: dates.to,
        dayParts: parts,
        note: note.trim() || undefined,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setDone(entry);
      void invalidate('book');
    } catch (error) {
      if (isPhoneRequiredError(error)) {
        offerPhoneVerification(router, tx('მოლოდინის სიისთვის ტელეფონის ნომერი საჭიროა — ბიზნესი ასე დაგიკავშირდება.', 'A phone number is needed for the waiting list — this is how the business reaches you.'));
      } else {
        Alert.alert(tx('ვერ ჩაიწერა', 'Could not join'), error instanceof Error ? error.message : tx('სცადე ხელახლა.', 'Please try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        <ModuleStackHeader module="book" subtitle={tx('მოლოდინის სია', 'Waiting list')} fallbackHref="/book" onBack={() => router.dismissTo('/book' as never)} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 40 }}>
          <FlatCard style={{ padding: 22, alignItems: 'center', gap: 10 }}>
            <View style={[s.check, { backgroundColor: c.successBg }]}><Check size={30} color={c.success} strokeWidth={2.6} /></View>
            <Text style={[hubText.sectionTitle, { color: c.text100, textAlign: 'center' }]}>{tx('სიაში ხარ', 'You are on the list')}</Text>
            <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>
              {done.serviceName} · {done.business?.name ?? b?.name}{'\n'}{rangeLabel(done.fromDate, done.toDate)}{done.staffName ? ` · ${done.staffName}` : ''}
            </Text>
            <Text style={[hubText.caption, { color: c.text300, textAlign: 'center' }]}>
              {tx('როგორც კი დრო გათავისუფლდება, შეტყობინება მოგივა — ერთი შეხებით დაჯავშნი. ჯავშნის შემდეგ ჩანაწერი თავისით იხურება.', 'As soon as a time opens up you get a notification — one tap books it. Once you book, the entry closes by itself.')}
            </Text>
            <View style={{ width: '100%', gap: 10, marginTop: 8 }}>
              <Button label={tx('ჩემი ჯავშნები', 'My bookings')} onPress={() => router.replace('/book/appointments' as never)} />
              <Button label={tx('MEDIBOOK-ზე დაბრუნება', 'Back to MEDIBOOK')} variant="secondary" onPress={() => router.dismissTo('/book' as never)} />
            </View>
          </FlatCard>
        </ScrollView>
      </View>
    );
  }

  const header = <FlowHeader b={b} />;
  const footer = (
    <View style={{ paddingHorizontal: HUB.gutter, paddingTop: 10, paddingBottom: insets.bottom + 12, backgroundColor: c.bg100 }}>
      {b && service ? <Text style={[hubText.caption, { color: c.text200, textAlign: 'center', marginBottom: 8 }]}>{rangeLabel(dates.from, dates.to)} · {bundleLine(bundle)}</Text> : null}
      <Button label={busy ? tx('იწერება…', 'Joining…') : tx('სიაში ჩაწერა', 'Join the list')} size="lg" icon={BellRing} onPress={() => void submit()} disabled={!b || !service || busy} loading={busy} />
    </View>
  );

  return (
    <KeyboardFormShell header={header} footer={footer} background={c.bg100} contentStyle={{ paddingHorizontal: HUB.gutter, paddingBottom: 24 }}>
      {!b || !service ? (
        query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ბიზნესი ვერ მოიძებნა.', 'Business not found.')}</Text> : <RecordsPageSkeleton />
      ) : (
        <>
          <StepTitle title={tx('მოლოდინის სია', 'Waiting list')} sub={tx('თავისუფალი დრო არ ჩანს? ჩაეწერე — გათავისუფლებულ დროს პირველი შენ გაიგებ.', 'No free time in sight? Join — you hear first when one opens up.')} />
          <ChosenPills items={[...selected.map((x) => x.name), person ? person.name : staffId ? null : tx('ნებისმიერი', 'Anyone')]} />

          <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: 4 }]}>{tx('რომელ დღეებში?', 'Which days?')}</Text>
          <View style={[s.wrap, { marginTop: 10 }]}>
            {fromDay ? <Chip on={range === 'day'} label={dayLabel(fromDay)} onPress={() => setRange('day')} /> : null}
            {(['7', '14', '30'] as RangeKey[]).filter((k) => Number(k) <= horizon || k === '7').map((k) => (
              <Chip key={k} on={range === k} label={tx(`უახლოეს ${k} დღეში`, `Next ${k} days`)} onPress={() => setRange(k)} />
            ))}
          </View>

          <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: HUB.sectionGap }]}>{tx('დღის რომელ ნაწილში?', 'Which part of the day?')}</Text>
          <Text style={[hubText.caption, { color: c.text300, marginTop: 2 }]}>{tx('არაფერი მონიშნო = ნებისმიერი დრო', 'Nothing ticked = any time')}</Text>
          <View style={[s.wrap, { marginTop: 10 }]}>
            {PARTS.map((p) => <Chip key={p.key} on={parts.includes(p.key)} label={`${tx(p.ka, p.en)} ${p.hint}`} onPress={() => togglePart(p.key)} />)}
          </View>

          <Text style={[hubText.sectionTitle, { color: c.text100, marginTop: HUB.sectionGap }]}>{tx('შენიშვნა ბიზნესისთვის', 'A note for the business')}</Text>
          <View style={{ marginTop: 10 }}>
            <Input value={note} onChangeText={setNote} placeholder={tx('არასავალდებულო — მაგ. მხოლოდ შაბათს, სამსახურის შემდეგ…', 'Optional — e.g. Saturdays only, after work…')} multiline maxLength={300} style={{ minHeight: 64 }} />
          </View>

          <View style={[s.how, { borderColor: ink, backgroundColor: c.surface }]}>
            <Text style={[hubText.caption, { color: c.text200 }]}>
              <Text style={{ color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('როგორ მუშაობს: ', 'How it works: ')}</Text>
              {tx('გაუქმებული ან გადატანილი ჯავშანი, მოხსნილი დასვენება — ყველა გათავისუფლებული დრო რიგში პირველს ეთავაზება. შეტყობინებიდან ერთი შეხებით იმ დღეზე გადახვალ და დაჯავშნი. ბიზნესსაც შეუძლია დრო შემოგთავაზოს.', 'A cancelled or moved booking, removed time off — every freed time is offered to the first in line. One tap from the notification takes you to that day to book. The business can offer you a time too.')}
            </Text>
          </View>
        </>
      )}
    </KeyboardFormShell>
  );
}

function rangeLabel(from: string, to: string): string {
  return from === to ? dayLabel(from) : `${monthDay(from)} – ${monthDay(to)}`;
}

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('book', dark);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.chip, { borderColor: on ? ink : c.bg300, backgroundColor: c.surface }]}>
      {on ? <Check size={14} color={ink} strokeWidth={3} /> : null}
      <Text style={[hubText.small, { color: c.text100, fontFamily: on ? 'NotoSansGeorgian_600SemiBold' : undefined }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 44, borderRadius: 999, borderWidth: 1.5 },
  how: { padding: 12, borderRadius: 14, marginTop: HUB.sectionGap, borderWidth: 1 },
  check: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
