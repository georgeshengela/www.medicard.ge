import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Sparkles, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { CycleInsightCard } from '@/lib/api';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { CyclePrimaryButton } from '@/components/cycle/CycleUI';
import { resolveInsightAction } from '@/lib/cycleInsightActions';
import { scheduleCycleReminder } from '@/lib/notifications';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

const TONE_ACCENT: Record<string, string> = {
  calm: '#AB47BC',
  energy: '#EC407A',
  care: '#C2185B',
  fertile: '#8E24AA',
  pregnancy: '#EC407A',
  mood: '#D81B60',
};

type Props = {
  visible: boolean;
  card: CycleInsightCard | null;
  headline?: string;
  onClose: () => void;
};

export function CycleInsightDetailSheet({ visible, card, headline, onClose }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const plan = useMemo(() => (card ? resolveInsightAction(card) : null), [card]);
  const accent = card ? TONE_ACCENT[card.tone] || c.rose : c.rose;

  if (!card || !plan) return null;

  const closeAndNavigate = (pathname: string, params?: Record<string, string>) => {
    onClose();
    setTimeout(() => {
      router.push({ pathname, params: { date: todayKey(), ...params } } as never);
    }, 220);
  };

  const runManual = async () => {
    Haptics.selectionAsync().catch(() => undefined);
    if (plan.kind === 'info_only') {
      onClose();
      return;
    }
    if (plan.route) {
      closeAndNavigate(plan.route.pathname, plan.route.params);
      return;
    }
    if (plan.kind === 'open_chat' && plan.chatPrefill) {
      onClose();
      setTimeout(() => {
        router.push({
          pathname: '/chat/doctor',
          params: { prefill: plan.chatPrefill! },
        } as never);
      }, 220);
    }
  };

  const runAuto = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setBusy(true);
    try {
      if (plan.kind === 'reminder' && plan.autoMinutes) {
        const ok = await scheduleCycleReminder({
          title: plan.reminderTitle || ka.cycle.aiReminderTitle,
          body: plan.reminderBody || card.action || card.title,
          minutesFromNow: plan.autoMinutes,
        });
        if (ok) {
          Alert.alert(ka.cycle.aiReminderSet, ka.cycle.aiReminderSetBody(plan.autoMinutes));
          onClose();
        } else {
          Alert.alert(ka.cycle.aiReminderDenied, ka.meds.notificationsDenied);
        }
        return;
      }

      if (plan.route) {
        closeAndNavigate(plan.route.pathname, plan.route.params);
        return;
      }

      if (plan.kind === 'open_chat' && plan.chatPrefill) {
        onClose();
        setTimeout(() => {
          router.push({
            pathname: '/chat/doctor',
            params: { prefill: plan.chatPrefill! },
          } as never);
        }, 220);
      }
    } finally {
      setBusy(false);
    }
  };

  const showAuto = Boolean(plan.autoLabel && (plan.autoMinutes || plan.route || plan.chatPrefill));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: c.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 16,
            borderTopWidth: 1,
            borderColor: c.border,
            maxHeight: '88%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.creamDeep,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <LinearGradient
              colors={[c.roseSoft, c.lavenderSoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Sparkles size={20} color={accent} strokeWidth={2.2} />
            </LinearGradient>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700' }}>
                {headline || ka.cycle.aiTips}
              </Text>
              <Text
                style={{
                  color: c.ink,
                  fontSize: 20,
                  fontWeight: '800',
                  marginTop: 4,
                  lineHeight: 26,
                  letterSpacing: -0.3,
                }}
              >
                {card.title}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: c.roseSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={c.rose} strokeWidth={2.4} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            <View
              style={{
                backgroundColor: c.cardSoft,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: c.border,
                borderLeftWidth: 4,
                borderLeftColor: accent,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: c.ink, fontSize: 15, lineHeight: 24, fontWeight: '500' }}>
                {card.body}
              </Text>
            </View>

            {card.action ? (
              <View
                style={{
                  backgroundColor: c.cardSoft,
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 14,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Text
                  style={{
                    color: c.rose,
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 0.3,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                  }}
                >
                  {ka.cycle.aiSuggestedAction}
                </Text>
                <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 }}>
                  {card.action}
                </Text>
              </View>
            ) : null}

            <Text
              style={{
                color: c.ink,
                fontSize: 14,
                fontWeight: '800',
                marginBottom: 10,
              }}
            >
              {ka.cycle.aiHowTo}
            </Text>

            <View style={{ gap: 8, marginBottom: 14 }}>
              {plan.steps.map((step, idx) => (
                <View key={`${card.id}-step-${idx}`} style={{ flexDirection: 'row', gap: 10 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: c.roseSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: c.rose, fontSize: 12, fontWeight: '800' }}>{idx + 1}</Text>
                  </View>
                  <Text style={{ flex: 1, color: c.muted, fontSize: 13, lineHeight: 19, paddingTop: 2 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            <Text
              style={{
                color: c.mutedSoft,
                fontSize: 11,
                lineHeight: 17,
                marginBottom: 8,
              }}
            >
              {ka.cycle.aiDisclaimer}
            </Text>
          </ScrollView>

          <View style={{ gap: 10, marginTop: 4 }}>
            <CyclePrimaryButton
              label={plan.manualLabel}
              onPress={runManual}
              disabled={busy}
            />
            {showAuto ? (
              <Pressable
                onPress={runAuto}
                disabled={busy}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 24,
                  borderWidth: 1.5,
                  borderColor: c.border,
                  backgroundColor: pressed ? c.roseSoft : c.cardSoft,
                  opacity: busy ? 0.6 : 1,
                })}
              >
                <Bell size={16} color={c.rose} strokeWidth={2.2} />
                <Text style={{ color: c.rose, fontWeight: '800', fontSize: 14 }}>
                  {plan.autoLabel || ka.cycle.aiAutomate}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
