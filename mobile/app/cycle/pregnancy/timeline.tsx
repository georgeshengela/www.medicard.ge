import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CycleAtmosphere, cycleNavHeader, formatCycleDateKa } from '@/components/cycle/CycleUI';
import {
  CyclePregnancyCalendarRail,
} from '@/components/cycle/CyclePregnancyTimelinePeek';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import {
  timelineCategoryLabel,
  timelineCopy,
  timelineStatusLabel,
  timelineTrimesterLabel,
} from '@/i18n/cycle/pregnancyTimeline.js';
import { api, ApiError, type CyclePregnancyPayload, type CyclePregnancyTimelineMilestone } from '@/lib/api';
import { loadCycleView } from '@/lib/cycleOffline';
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
  const [payload, setPayload] = useState<CyclePregnancyPayload | null>(null);
  const [offlineTimeline, setOfflineTimeline] = useState<CyclePregnancyPayload['timeline']>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const copy = ka.cycle.timeline;

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, copy.journey));
  }, [navigation, c, copy.journey]);

  useEffect(() => {
    let alive = true;
    if (!user?.id) return undefined;
    loadCycleView(user.id)
      .then((view) => {
        if (!alive) return null;
        if (!supportsCycleCapability(view.display?.profile?.mode, 'showPregnancyOverview')) {
          router.replace('/cycle');
          return null;
        }
        const cachedAge = view.display?.pregnancy?.age;
        if (view.reachable === false && view.display?.pregnancy) {
          setOfflineTimeline(
            presentPregnancyTimeline({
              mode: 'PREGNANCY',
              pregnancyActive: true,
              dating: {
                reviewRequired: Boolean(view.display.pregnancy.reviewRequired),
                estimatedGestationalAge: cachedAge || null,
                estimatedDueDate: view.display.pregnancy.dueDate
                  ? { date: view.display.pregnancy.dueDate, estimated: true }
                  : null,
              },
            }),
          );
        }
        return api.cycle.pregnancy();
      })
      .then((next) => {
        if (!alive || !next) return;
        setPayload(next);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) router.replace('/cycle');
      });
    return () => {
      alive = false;
    };
  }, [user?.id, router]);

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
                      backgroundColor: active ? c.roseSoft : c.card,
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
                            borderColor: c.roseSoft,
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
            <Pressable
              onPress={() => setSourcesOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={copy.sources}
              style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.sources}</Text>
            </Pressable>
          </Frame>
        ) : (
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{ka.common.loading}</Text>
        )}
      </ScrollView>

      <Modal visible={sourcesOpen} {...APP_MODAL_PROPS} onRequestClose={() => setSourcesOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            onPress={() => setSourcesOpen(false)}
            style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }}
          />
          <View
            style={{
              backgroundColor: c.card,
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: insets.bottom + 20,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 18,
                lineHeight: 24,
              }}
            >
              {copy.sources}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 10 }}>{copy.sourcesBody}</Text>
            <Pressable
              onPress={() => setSourcesOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              style={{ minHeight: 44, justifyContent: 'center', marginTop: 12 }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.common.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </CycleAtmosphere>
  );
}
