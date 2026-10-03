import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CycleAtmosphere, cycleNavHeader, formatCycleDateKa } from '@/components/cycle/CycleUI';
import {
  CyclePregnancyCalendarRail,
} from '@/components/cycle/CyclePregnancyTimelinePeek';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import {
  timelineCategoryLabel,
  timelineCopy,
  timelineStatusLabel,
  timelineTrimesterLabel,
} from '@/i18n/cycle/pregnancyTimeline.js';
import { ApiError, type CyclePregnancyPayload, type CyclePregnancyTimelineMilestone } from '@/lib/api';
import { useCyclePregnancy } from '@/lib/cycleQueries';
import { useCycleView } from '@/lib/cycleViewCache';
import { supportsCycleCapability } from '@/lib/cycleModes';
import { presentPregnancyTimeline } from '@/lib/pregnancyTimelinePresent.js';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

function markerColor(c: ReturnType<typeof useCycleColors>, status: string, current: boolean) {
  if (current) return c.rose;
  if (status === 'PAST') return c.mutedSoft;
  return c.border;
}

function MilestoneRow({
  item,
  isCurrent,
  onPress,
  last,
}: {
  item: CyclePregnancyTimelineMilestone;
  isCurrent: boolean;
  onPress: () => void;
  last: boolean;
}) {
  const c = useCycleColors();
  const copy = ka.cycle.timeline;
  const status = timelineStatusLabel(item.status);
  const title = timelineCopy(item.titleKey);
  const body = timelineCopy(item.bodyKey);
  const around =
    item.status === 'UPCOMING' ? copy.typicallyAround(item.week) : ka.cycle.pregnancyWeekTitle(item.week);
  const label = `${status}, ${ka.cycle.pregnancyWeekTitle(item.week)}, ${title}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', minHeight: 44 }}
    >
      <View style={{ width: 28, alignItems: 'center' }}>
        <View
          style={{
            width: isCurrent ? 16 : 10,
            height: isCurrent ? 16 : 10,
            borderRadius: 99,
            marginTop: isCurrent ? 2 : 5,
            backgroundColor: markerColor(c, item.status, isCurrent),
            borderWidth: item.status === 'UPCOMING' ? 2 : 0,
            borderColor: c.mutedSoft,
          }}
        />
        {last ? null : (
          <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginTop: 4 }} />
        )}
      </View>
      <View style={{ flex: 1, paddingBottom: 22, paddingLeft: 8 }}>
        <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16 }}>
          {status} · {around}
        </Text>
        <Text
          style={{
            color: c.ink,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 16,
            lineHeight: 22,
            marginTop: 4,
          }}
        >
          {title}
        </Text>
        <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginTop: 2 }}>
          {timelineCategoryLabel(item.category)}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 6 }}>{body}</Text>
      </View>
    </Pressable>
  );
}

export default function CyclePregnancyTimelineScreen() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = usePrefersReducedMotion();
  const { user } = useAuth();
  const copy = ka.cycle.timeline;

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, copy.journey));
  }, [navigation, c, copy.journey]);

  // Shared cached view decides the mode; the pregnancy payload is cached under ['cycle','pregnancy']
  // (SHORT), shared with the week screens. Offline, the timeline is drawn from the cached bundle.
  const viewQuery = useCycleView(user?.id);
  const view = viewQuery.data;
  const pregnancyMode = view ? supportsCycleCapability(view.display?.profile?.mode, 'showPregnancyOverview') : false;
  const pregnancy = useCyclePregnancy(pregnancyMode);
  const notFound = pregnancy.error instanceof ApiError && pregnancy.error.status === 404;
  useEffect(() => {
    if ((view && !pregnancyMode) || notFound) router.replace('/cycle');
  }, [view, pregnancyMode, notFound, router]);
  const payload: CyclePregnancyPayload | null = pregnancy.data ?? null;
  const offlineTimeline = useMemo<CyclePregnancyPayload['timeline']>(() => {
    if (!view || view.reachable !== false || !view.display?.pregnancy) return null;
    return presentPregnancyTimeline({
      mode: 'PREGNANCY',
      pregnancyActive: true,
      dating: {
        reviewRequired: Boolean(view.display.pregnancy.reviewRequired),
        estimatedGestationalAge: view.display.pregnancy.age || null,
        estimatedDueDate: view.display.pregnancy.dueDate
          ? { date: view.display.pregnancy.dueDate, estimated: true }
          : null,
      },
    });
  }, [view]);

  const timeline = payload ? payload.timeline : offlineTimeline;
  const pregnancyActive = payload ? payload.pregnancyActive : true;

  const items = useMemo(() => {
    if (!timeline?.available) return [];
    return timeline.milestones;
  }, [timeline]);

  const currentIndex = items.findIndex((row) => row.status === 'CURRENT');
  const insertNowBefore =
    timeline?.available && timeline.currentMarker?.betweenMilestones
      ? items.findIndex((row) => row.status === 'UPCOMING')
      : -1;

  function openWeek(week: number) {
    router.push(`/cycle/week/${week}`);
  }

  const Frame = reduced ? View : Animated.View;
  const frameProps = reduced ? {} : { entering: FadeIn.duration(280) };

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {!pregnancyActive && payload ? (
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{copy.hiddenEnded}</Text>
        ) : timeline?.reviewRequired ? (
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{copy.review}</Text>
        ) : timeline?.available ? (
          <Frame {...frameProps}>
            <Text
              style={{
                color: c.brand,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {timelineTrimesterLabel(timeline.trimester)}
            </Text>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 22,
                lineHeight: 28,
                marginTop: 6,
              }}
            >
              {ka.cycle.pregnancyWeekDay(timeline.currentWeek ?? 0, timeline.currentDay ?? 0)}
            </Text>
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, marginTop: 4 }}>
              {copy.weekOf40(timeline.currentWeek ?? 0)}
            </Text>
            <CyclePregnancyCalendarRail
              fraction={timeline.progress?.fraction}
              label={copy.progressHint}
            />
            {timeline.beyondStandardTerm ? (
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 10 }}>
                {copy.beyondTerm}. {copy.beyondHint}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {timeline.trimesterBands.map((band) => {
                const active = band.trimester === timeline.trimester;
                return (
                  <View
                    key={band.trimester}
                    accessibilityLabel={`${timelineTrimesterLabel(band.trimester)}, ${copy.trimesterWeeks(band.fromWeek, band.toWeek)}`}
                    style={{
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: active ? c.rose : c.border,
                      backgroundColor: active ? c.accentSoft : c.card,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      maxWidth: '100%',
                    }}
                  >
                    <Text
                      style={{
                        color: c.ink,
                        fontFamily: 'NotoSansGeorgian_600SemiBold',
                        fontSize: 12,
                        lineHeight: 17,
                      }}
                    >
                      {timelineTrimesterLabel(band.trimester)}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
                      {copy.trimesterWeeks(band.fromWeek, band.toWeek)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ marginTop: 22 }}>
              {items.map((item, index) => (
                <View key={item.id}>
                  {insertNowBefore === index ? (
                    <View
                      accessibilityLabel={copy.nowMarker(timeline.currentWeek ?? 0, timeline.currentDay ?? 0)}
                      style={{ flexDirection: 'row', marginBottom: 16 }}
                    >
                      <View style={{ width: 28, alignItems: 'center' }}>
                        <View
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 99,
                            backgroundColor: c.rose,
                            borderWidth: 3,
                            borderColor: c.accentSoft,
                          }}
                        />
                        <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginTop: 4 }} />
                      </View>
                      <Text
                        style={{
                          color: c.rose,
                          fontFamily: 'NotoSansGeorgian_700Bold',
                          fontSize: 13,
                          lineHeight: 18,
                          paddingLeft: 8,
                          paddingBottom: 8,
                        }}
                      >
                        {copy.nowMarker(timeline.currentWeek ?? 0, timeline.currentDay ?? 0)}
                      </Text>
                    </View>
                  ) : null}
                  <MilestoneRow
                    item={item}
                    isCurrent={index === currentIndex}
                    last={false}
                    onPress={() => openWeek(item.week)}
                  />
                </View>
              ))}

              {timeline.beyondStandardTerm ||
              (insertNowBefore === -1 && timeline.currentMarker?.betweenMilestones) ? (
                <View
                  accessibilityLabel={copy.nowMarker(timeline.currentWeek ?? 0, timeline.currentDay ?? 0)}
                  style={{ flexDirection: 'row', marginBottom: 16 }}
                >
                  <View style={{ width: 28, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 99,
                        backgroundColor: c.rose,
                      }}
                    />
                    <View style={{ width: 2, height: 18, backgroundColor: c.border, marginTop: 4 }} />
                  </View>
                  <Text
                    style={{
                      color: c.rose,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 13,
                      lineHeight: 18,
                      paddingLeft: 8,
                    }}
                  >
                    {copy.nowMarker(timeline.currentWeek ?? 0, timeline.currentDay ?? 0)}
                  </Text>
                </View>
              ) : null}

              {timeline.estimatedDueDate?.date ? (
                <View
                  accessibilityLabel={`${copy.estimatedDueEnd}, ${formatCycleDateKa(timeline.estimatedDueDate.date)}`}
                  style={{ flexDirection: 'row' }}
                >
                  <View style={{ width: 28, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 99,
                        backgroundColor: c.mutedSoft,
                        marginTop: 5,
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, paddingLeft: 8 }}>
                    <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16 }}>{copy.estimatedDueEnd}</Text>
                    <Text
                      style={{
                        color: c.ink,
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 16,
                        lineHeight: 22,
                        marginTop: 4,
                      }}
                    >
                      {formatCycleDateKa(timeline.estimatedDueDate.date)}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      {ka.cycle.pregnancyEstimatedDue}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 20 }}>{copy.honesty}</Text>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{copy.sourcesBody}</Text>
            <MedicalSourcesLink sourceIds={['pregnancyWeeks', 'fetalDevelopment', 'pregnancyDueDate']} />
          </Frame>
        ) : (
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{ka.common.loading}</Text>
        )}
      </ScrollView>

    </CycleAtmosphere>
  );
}
