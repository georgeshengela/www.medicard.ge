import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  CALENDAR_EXPORT_UI,
  CALENDAR_TITLE_MODE,
  calendarDateDiffers,
  resolveCalendarExportUi,
} from '@/lib/pregnancyCareCalendarExportContract.js';
import { localNowMinutes, resolvePlannedTime } from '@/lib/pregnancyCareAppointmentTimeContract.js';
import {
  exportCarePlanToCalendar,
  openCarePlanCalendarEvent,
  removeCarePlanCalendarEvent,
  resolveOwnedCalendarEvent,
  updateCarePlanCalendarEvent,
  type CalendarPermissionState,
  type CareCalendarOwnership,
} from '@/lib/pregnancyCareCalendar';

type Colors = {
  ink: string;
  muted: string;
  border: string;
  card: string;
  cta: string;
  brand: string;
  roseSoft: string;
};

type Copy = {
  calendarTitle: string;
  calendarHint: string;
  calendarAdd: string;
  calendarOpen: string;
  calendarUpdate: string;
  calendarRemove: string;
  calendarAdded: string;
  calendarUpdated: string;
  calendarRemoved: string;
  calendarMissing: string;
  calendarDateDiffers: string;
  calendarTimeDiffers: string;
  calendarAddAllDay: string;
  calendarAddTimed: string;
  calendarPermission: string;
  calendarPermissionDenied: string;
  calendarRevoked: string;
  calendarFailed: string;
  calendarGenericTitle: string;
  calendarDetailedTitle: string;
  calendarTitleHint: string;
  calendarUpdateHint: string;
  calendarPast: string;
  calendarPastTime: string;
  calendarNeedDate: string;
};

type Props = {
  userId: string;
  episodeId: string | null | undefined;
  careItemId: string;
  itemTitle: string;
  plannedDate: string | null | undefined;
  plannedTime?: string | null;
  today: string;
  colors: Colors;
  copy: Copy;
};

function btn(base: object) {
  return {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center' as const,
    ...base,
  };
}

export function PregnancyCareCalendarExport({
  userId,
  episodeId,
  careItemId,
  itemTitle,
  plannedDate,
  plannedTime,
  today,
  colors: c,
  copy,
}: Props) {
  const [permission, setPermission] = useState<CalendarPermissionState | null>(null);
  const [ownership, setOwnership] = useState<CareCalendarOwnership | null>(null);
  const [eventExists, setEventExists] = useState<boolean | null>(null);
  const [titleMode, setTitleMode] = useState<'generic' | 'detailed'>(CALENDAR_TITLE_MODE.GENERIC);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId || !episodeId || !careItemId) {
      setOwnership(null);
      setEventExists(null);
      return;
    }
    const snap = await resolveOwnedCalendarEvent({ userId, episodeId, careItemId });
    setPermission(snap.permission);
    setOwnership(snap.ownership);
    setEventExists(snap.eventExists);
    if (snap.ownership?.titleMode) setTitleMode(snap.ownership.titleMode);
  }, [userId, episodeId, careItemId]);

  useEffect(() => {
    setMessage(null);
    void refresh();
  }, [refresh, plannedDate, plannedTime]);

  const nowMinutes = localNowMinutes();
  const ui = resolveCalendarExportUi({
    plannedDate,
    plannedTime,
    today,
    nowMinutes,
    ownership,
    eventExists,
    permission,
    episodeId,
  });
  const timed = Boolean(resolvePlannedTime({ plannedDate, plannedTime }));
  const addLabel = timed
    ? `${copy.calendarAddTimed} ${resolvePlannedTime({ plannedDate, plannedTime })}`
    : copy.calendarAddAllDay;

  if (!episodeId) return null;
  if (ui === CALENDAR_EXPORT_UI.HIDDEN) return null;

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function onAdd() {
    await run(async () => {
      const result = await exportCarePlanToCalendar({
        userId,
        episodeId: episodeId!,
        careItemId,
        plannedDate: plannedDate || '',
        plannedTime: plannedTime || null,
        itemTitle,
        titleMode,
        today,
        nowMinutes,
      });
      if (!result.ok) {
        setMessage(
          result.reason === 'permission_denied' ? copy.calendarPermissionDenied : copy.calendarFailed,
        );
        await refresh();
        return;
      }
      setOwnership(result.ownership);
      setEventExists(true);
      setPermission('granted');
      setMessage(copy.calendarAdded);
    });
  }

  async function onUpdate() {
    await run(async () => {
      const result = await updateCarePlanCalendarEvent({
        userId,
        episodeId: episodeId!,
        careItemId,
        plannedDate: plannedDate || '',
        plannedTime: plannedTime || null,
        itemTitle,
        titleMode,
        today,
      });
      if (!result.ok) {
        setMessage(
          result.reason === 'missing'
            ? copy.calendarMissing
            : result.reason === 'permission_revoked'
              ? copy.calendarRevoked
              : copy.calendarFailed,
        );
        await refresh();
        return;
      }
      setOwnership(result.ownership);
      setEventExists(true);
      setMessage(copy.calendarUpdated);
    });
  }

  async function onRemove() {
    await run(async () => {
      const result = await removeCarePlanCalendarEvent({
        userId,
        episodeId: episodeId!,
        careItemId,
      });
      if (!result.ok) {
        setMessage(result.reason === 'permission_revoked' ? copy.calendarRevoked : copy.calendarFailed);
        await refresh();
        return;
      }
      setOwnership(null);
      setEventExists(null);
      setMessage(copy.calendarRemoved);
    });
  }

  async function onOpen() {
    await run(async () => {
      const result = await openCarePlanCalendarEvent({
        userId,
        episodeId: episodeId!,
        careItemId,
      });
      if (!result.ok) {
        setMessage(result.reason === 'missing' ? copy.calendarMissing : copy.calendarFailed);
        await refresh();
      }
    });
  }

  const showTitleChoice =
    ui === CALENDAR_EXPORT_UI.NOT_EXPORTED ||
    ui === CALENDAR_EXPORT_UI.DATE_DIFFERS ||
    ui === CALENDAR_EXPORT_UI.PERMISSION_DENIED;
  const showManage = ui === CALENDAR_EXPORT_UI.EXPORTED || ui === CALENDAR_EXPORT_UI.DATE_DIFFERS;

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 }}>
        {copy.calendarTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{copy.calendarHint}</Text>

      {ui === CALENDAR_EXPORT_UI.PAST_NO_EXPORT ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          {plannedDate === today && timed ? copy.calendarPastTime : copy.calendarPast}
        </Text>
      ) : null}

      {ui === CALENDAR_EXPORT_UI.EVENT_UNAVAILABLE || eventExists === false ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{copy.calendarMissing}</Text>
      ) : null}

      {ui === CALENDAR_EXPORT_UI.DATE_DIFFERS ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          {calendarDateDiffers(ownership, plannedDate || null)
            ? copy.calendarDateDiffers
            : copy.calendarTimeDiffers}
        </Text>
      ) : null}

      {ui === CALENDAR_EXPORT_UI.PERMISSION_DENIED || ui === CALENDAR_EXPORT_UI.PERMISSION_REVOKED ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          {ui === CALENDAR_EXPORT_UI.PERMISSION_REVOKED ? copy.calendarRevoked : copy.calendarPermission}
        </Text>
      ) : null}

      {showTitleChoice ? (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>{copy.calendarTitleHint}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={() => setTitleMode(CALENDAR_TITLE_MODE.GENERIC)}
              accessibilityRole="button"
              accessibilityLabel={copy.calendarGenericTitle}
              accessibilityState={{ selected: titleMode === CALENDAR_TITLE_MODE.GENERIC }}
              disabled={busy}
              style={btn({
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: titleMode === CALENDAR_TITLE_MODE.GENERIC ? c.roseSoft : c.card,
              })}
            >
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                {copy.calendarGenericTitle}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTitleMode(CALENDAR_TITLE_MODE.DETAILED)}
              accessibilityRole="button"
              accessibilityLabel={copy.calendarDetailedTitle}
              accessibilityState={{ selected: titleMode === CALENDAR_TITLE_MODE.DETAILED }}
              disabled={busy}
              style={btn({
                borderWidth: 1,
                borderColor: c.border,
                backgroundColor: titleMode === CALENDAR_TITLE_MODE.DETAILED ? c.roseSoft : c.card,
              })}
            >
              <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                {copy.calendarDetailedTitle}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {ui === CALENDAR_EXPORT_UI.DATE_DIFFERS ? (
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{copy.calendarUpdateHint}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {ui === CALENDAR_EXPORT_UI.NOT_EXPORTED ||
        ui === CALENDAR_EXPORT_UI.EVENT_UNAVAILABLE ||
        ui === CALENDAR_EXPORT_UI.PERMISSION_DENIED ||
        (eventExists === false && ui !== CALENDAR_EXPORT_UI.PAST_NO_EXPORT) ? (
          <Pressable
            onPress={() => void onAdd()}
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            disabled={busy}
            style={btn({ backgroundColor: c.roseSoft })}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.calendarAdd}</Text>
          </Pressable>
        ) : null}

        {showManage ? (
          <Pressable
            onPress={() => void onOpen()}
            accessibilityRole="button"
            accessibilityLabel={copy.calendarOpen}
            disabled={busy}
            style={btn({ borderWidth: 1, borderColor: c.border, backgroundColor: c.card })}
          >
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.calendarOpen}</Text>
          </Pressable>
        ) : null}

        {ui === CALENDAR_EXPORT_UI.DATE_DIFFERS || ui === CALENDAR_EXPORT_UI.EXPORTED ? (
          <Pressable
            onPress={() => void onUpdate()}
            accessibilityRole="button"
            accessibilityLabel={copy.calendarUpdate}
            disabled={busy}
            style={btn({ backgroundColor: ui === CALENDAR_EXPORT_UI.DATE_DIFFERS ? c.cta : c.roseSoft })}
          >
            <Text
              style={{
                color: ui === CALENDAR_EXPORT_UI.DATE_DIFFERS ? '#fff' : c.brand,
                fontFamily: 'NotoSansGeorgian_700Bold',
              }}
            >
              {copy.calendarUpdate}
            </Text>
          </Pressable>
        ) : null}

        {showManage ? (
          <Pressable
            onPress={() => void onRemove()}
            accessibilityRole="button"
            accessibilityLabel={copy.calendarRemove}
            disabled={busy}
            style={btn({ borderWidth: 1, borderColor: c.border })}
          >
            <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold' }}>{copy.calendarRemove}</Text>
          </Pressable>
        ) : null}
      </View>

      {message ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{message}</Text>
      ) : null}
    </View>
  );
}
