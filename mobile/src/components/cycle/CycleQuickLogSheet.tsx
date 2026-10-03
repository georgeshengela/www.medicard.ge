import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import { ChatScreenShell, ChatFormScroll } from '@/components/chat/ChatScreenShell';
import React from 'react';
import {
  ActivityIndicator,
  Text,
  useWindowDimensions,
  View} from 'react-native';
import { X, CalendarDays, Check } from 'lucide-react-native';
import { CyclePrimaryButton } from './CycleUI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { CycleSexSection } from '@/components/cycle/CycleSexSection';
import { CycleMoreTracking } from '@/components/cycle/CycleMoreTracking';
import { CycleQuickLogBody } from '@/components/cycle/CycleQuickLogBody';
import { CyclePregnancyQuickLog } from '@/components/cycle/CyclePregnancyQuickLog';
import { CyclePerimenopauseQuickLog } from '@/components/cycle/CyclePerimenopauseQuickLog';
import { CyclePostpartumQuickLog } from '@/components/cycle/CyclePostpartumQuickLog';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { useCycleQuickLog, type CycleQuickLogState } from '@/components/cycle/useCycleQuickLog';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { lastLoggedBbt } from '@/lib/cycleBbt';
import type { CycleView } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  date: string;
  onClose: () => void;
  onSaved: (view?: CycleView | null) => void;
  isPeriodStart?: boolean;
  /** Funnel source: the cycle screen's sheet (`quick`) or the Home hero's (`home`). */
  funnelSource?: 'quick' | 'home';
  onOpenFull?: () => void;
};

/** One hint line per mode under the date. */
export function quickLogModeHint(caps: NonNullable<CycleQuickLogState['caps']>): string {
  return caps.showPregnancyOverview
    ? ka.cycle.pregnancyQuickLogHint
    : caps.showPostpartumTracking
      ? ka.cycle.postpartumQuickLogHint
      : caps.showPerimenopauseTracking
        ? ka.cycle.periQuickLogHint
        : ka.cycle.quickLogHint;
}

/**
 * The fields of a quick log for the hydrated mode — the classic icon-tile body or the pregnancy /
 * postpartum / perimenopause bodies (which carry sex & sex drive and „more“ after them). Shared by
 * `CycleQuickLogSheet` and the calendar's `CycleDaySheet` so both log a day the same way.
 */
export function CycleQuickLogFields({ q, date }: { q: CycleQuickLogState; date: string }) {
  const caps = q.caps;
  if (!caps) return null;
  const other = caps.showPregnancyObservations || caps.showPostpartumTracking || caps.showPerimenopauseTracking;
  return (
    <>
      {caps.showPregnancyObservations ? (
        <CyclePregnancyQuickLog form={q.form} onChange={q.patch} assessmentReady={q.hydrated} />
      ) : caps.showPostpartumTracking ? (
        <CyclePostpartumQuickLog form={q.form} onChange={q.patch} />
      ) : caps.showPerimenopauseTracking ? (
        <CyclePerimenopauseQuickLog form={q.form} onChange={q.patch} assessmentReady={q.hydrated} />
      ) : (
        <CycleQuickLogBody
          form={q.form}
          onChange={q.patch}
          disabled={q.saving}
          date={date}
          logs={q.logs}
          showFertility={Boolean(caps.showFertilityShortcuts)}
          expected={q.expected}
        />
      )}

      {/* Other modes have their own quick logs; sex and sex drive follow them there. */}
      {other ? <CycleSexSection form={q.form} disabled={q.saving} onChange={q.patch} /> : null}

      {other ? (
        <View style={{ marginTop: 16 }}>
          <CycleMoreTracking form={q.form} onChange={q.patch} compact mode={q.mode || undefined} lastBbt={lastLoggedBbt(q.logs, date)} />
        </View>
      ) : null}
    </>
  );
}

export function CycleQuickLogSheet({
  visible,
  date,
  onClose,
  onSaved,
  isPeriodStart,
  onOpenFull,
  funnelSource = 'quick',
}: Props) {
  const { user } = useAuth();
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const q = useCycleQuickLog({ active: visible, date, userId: user?.id, onSaved, funnelSource });
  const { caps, hydrated, saving, saveError } = q;

  const save = async (markStart?: boolean) => {
    if (await q.save(markStart)) onClose();
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <ChatScreenShell header={null} style={{ backgroundColor: c.overlay }}>
        <View style={{ flex: 1, minHeight: 0, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={onClose} style={{ position: 'absolute', inset: 0 }} />
          <View role="dialog" aria-modal={true} accessibilityLabel={ka.cycle.quickLogTitle} accessibilityViewIsModal
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
              maxHeight: fontScale >= 1.5 ? '94%' : fontScale >= 1.3 ? '90%' : '92%',
              borderTopWidth: 1,
              borderColor: c.border,
            }}
          >
            <ChatFormScroll style={{ flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            >
              <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
              <View style={{width:30,height:34,borderRadius:12,backgroundColor:c.accentSoft,alignItems:'center',justifyContent:'center'}}><CalendarDays size={18} color={c.brand}/></View>
              <Text style={{ flex:1, color: c.ink, fontSize: 18, lineHeight:26, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                {ka.cycle.logTodayCta}
              </Text>
              <Pressable onPress={onClose} disabled={saving} accessibilityRole="button" accessibilityLabel={ka.common.close}
                style={{width:44,height:44,borderRadius:22,backgroundColor:c.cardSoft,alignItems:'center',justifyContent:'center'}}><X size={20} color={c.muted}/></Pressable>
              </View>
              {!hydrated || !caps ? (
                <View style={{ minHeight: 120, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 }}>
                  {!saveError ? <ActivityIndicator color={c.brand} /> : null}
                  <Text
                    accessibilityLabel={ka.common.loading}
                    style={{ color: c.muted, fontSize: 13, marginTop: 10 }}
                  >
                    {saveError || ka.common.loading}
                  </Text>
                  {saveError ? <CyclePrimaryButton label={tx('ხელახლა ცდა', 'Try again')} onPress={q.retry}/> : null}
                </View>
              ) : (
              <>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 4, marginBottom: 14 }}>
                {formatCycleDateKa(date)} · {quickLogModeHint(caps)}
              </Text>

              <CycleQuickLogFields q={q} date={date} />

              {saveError ? (
                <Text
                  style={{
                    color: c.danger,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 13,
                    marginTop: 12,
                  }}
                >
                  {saveError}
                </Text>
              ) : null}
              </>
              )}
            </ChatFormScroll>
            {hydrated && caps ? <View style={{paddingHorizontal:16,paddingTop:10,paddingBottom:Math.max(insets.bottom,8),borderTopWidth:1,borderColor:c.border,backgroundColor:c.card,gap:0}}>
              <CyclePrimaryButton label={isPeriodStart && caps.showClassicCycleOverview ? ka.cycle.quickLogStart : ka.cycle.saveLog}
                loading={saving} onPress={() => void save(isPeriodStart)} icon={Check}/>
              {onOpenFull ? <Pressable onPress={onOpenFull} disabled={saving} accessibilityRole="button" accessibilityLabel={ka.cycle.fullLog}
                style={{minHeight:44,alignItems:'center',justifyContent:'center'}}>
                <Text style={{color:c.brand,fontSize:13,lineHeight:20,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{ka.cycle.fullLog}</Text>
              </Pressable> : null}
            </View> : null}
          </View>
        </View>
      </ChatScreenShell>
    </Modal>
  );
}
