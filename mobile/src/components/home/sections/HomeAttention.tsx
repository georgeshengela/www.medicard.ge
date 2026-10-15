import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CalendarCheck, FlaskConical, Syringe } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HubLinkRow } from '@/components/home/HubTiles';
import { doctorTypeLabel } from '@/constants/visits';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { api, type DoctorVisit } from '@/lib/api';
import { whenLabel } from '@/lib/book/bookFormat';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { formatYmd } from '@/lib/format';
import { daysUntil, recentLab, upcomingVisit } from '@/lib/home/homeAttention';
import { loadCanonicalLabPanels } from '@/lib/labStore';
import { FRESH } from '@/lib/queryClient';
import { todayYmd } from '@/lib/hydration';
import { tx } from '@/i18n/locale';
import { familyApi } from '@/lib/family/familyApi';
import { familyShipped } from '@/lib/family/familyAvailability';
import { useAuth } from '@/store/AuthContext';
import { HUB } from '@/theme/hub';
import type { LabPanel } from '@/types/lab';

/**
 * „არ გამოგრჩეს“ (owner 2026-10-04, standard Home): a visit in the next 7 days and a lab result from
 * the last 14 days, each only while it is true. Nothing to show → the section renders nothing.
 * Visits use the key `/api/visits` writes invalidate (`['visits','home']`); labs are read from the
 * device store only (no network on Home — the lab pages pull).
 */
export function HomeAttention() {
  const features = useFeatureState();
  const { user } = useAuth();
  const visitsOn = isHrefAvailable('/visits', features);
  const bookOn = isHrefAvailable('/book', features);
  const labsOn = isHrefAvailable('/lab', features);
  const today = todayYmd();

  const visits = useAccountQuery<DoctorVisit[]>({
    key: ['visits', 'home'],
    fetch: async () => (await api.visits.list()).visits,
    staleTime: FRESH.SHORT,
    enabled: visitsOn,
  });
  // MEDIBOOK: the next booking within a week (same key the hub and the door use).
  const bookings = useAccountQuery({ key: ['book', 'mine'], fetch: api.book.appointments, staleTime: FRESH.SHORT, enabled: bookOn });
  const booking = bookOn ? (bookings.data?.upcoming ?? []).find((a) => new Date(a.startsAt).getTime() - Date.now() <= 7 * 86_400_000) ?? null : null;
  const [panels, setPanels] = useState<LabPanel[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!labsOn || !user?.id) return undefined;
      let alive = true;
      loadCanonicalLabPanels()
        .then((rows) => {
          if (alive) setPanels(rows);
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, [labsOn, user?.id]),
  );

  // MEDIFAMILY: a child's vaccine that is overdue or due within a week (the list is cached app-wide).
  const familyOn = familyShipped() && isHrefAvailable('/family', features);
  const family = useAccountQuery({ key: ['family', 'list'], fetch: familyApi.list, staleTime: FRESH.SHORT, enabled: familyOn });
  const vaccines = familyOn ? (family.data?.members ?? []).filter((m) => m.vaccines.next && (m.vaccines.next.status === 'overdue' || daysUntil(m.vaccines.next.dueOn, today) <= 7)).slice(0, 2) : [];

  const visit = visitsOn ? upcomingVisit(visits.data ?? [], today) : null;
  const lab = labsOn ? recentLab(panels, today) : null;
  if (!visit && !lab && !vaccines.length && !booking) return null;

  const when = (ymd: string) => {
    const days = daysUntil(ymd, today);
    return days === 0 ? tx('დღეს', 'Today') : days === 1 ? tx('ხვალ', 'Tomorrow') : formatYmd(ymd);
  };

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap }}>
      <HomeSectionHeading title={tx('არ გამოგრჩეს', 'Don’t miss')} />
      <View style={{ gap: 8 }}>
        {booking ? (
          <HubLinkRow
            icon={CalendarCheck}
            ink="rose"
            title={tx(`ჯავშანი: ${booking.serviceName}`, `Booking: ${booking.serviceName}`)}
            detail={`${whenLabel(booking.startsAt)}${booking.business?.name ? ` · ${booking.business.name}` : ''}${booking.status === 'PENDING' ? tx(' · ელოდება დადასტურებას', ' · awaiting confirmation') : ''}`}
            href={`/book/appointments/${booking.id}`}
          />
        ) : null}
        {visit ? (
          <HubLinkRow
            icon={CalendarCheck}
            ink="teal"
            title={tx(`ვიზიტი: ${doctorTypeLabel(visit.doctorType)}`, `Visit: ${doctorTypeLabel(visit.doctorType)}`)}
            detail={`${when(visit.visitDate)}${visit.visitTime ? `, ${visit.visitTime}` : ''}`}
            href="/visits"
          />
        ) : null}
        {vaccines.map((m) => {
          const next = m.vaccines.next!;
          const overdue = next.status === 'overdue';
          return (
            <HubLinkRow
              key={m.id}
              icon={Syringe}
              ink={overdue ? 'amber' : 'teal'}
              title={overdue ? tx(`${m.name}: აცრა გადაცილებულია`, `${m.name}: a vaccine is overdue`) : tx(`${m.name}: აცრის დრო ახლოვდება`, `${m.name}: vaccines coming up`)}
              detail={overdue ? tx('დაგეგმე პედიატრთან — სერია თავიდან არ იწყება', 'Plan it with your pediatrician — the series never restarts') : when(next.dueOn)}
              href={`/family/${m.id}/vaccines`}
            />
          );
        })}
        {lab ? (
          <HubLinkRow
            icon={FlaskConical}
            ink={lab.outside > 0 ? 'amber' : 'blue'}
            title={
              lab.outside > 0
                ? tx(`ანალიზი: ${lab.outside} მაჩვენებელი ნორმის გარეთ`, `Lab: ${lab.outside} ${lab.outside === 1 ? 'value' : 'values'} outside the range`)
                : tx('ანალიზი: ყველა მაჩვენებელი ნორმაშია', 'Lab: every value is in range')
            }
            detail={tx(`${formatYmd(lab.date)} · ${lab.total} მაჩვენებელი — ნახე და ჰკითხე Medi-ს`, `${formatYmd(lab.date)} · ${lab.total} values — review and ask Medi`)}
            href={`/lab/${lab.date}`}
          />
        ) : null}
      </View>
    </View>
  );
}
