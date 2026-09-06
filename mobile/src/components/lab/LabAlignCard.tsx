import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Sparkles } from 'lucide-react-native';
import { QuotaSheet } from '@/components/QuotaSheet';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { applyLabMaps, uniqueLabAnalytes } from '@/lib/labAlign';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';
import type { LabPanel } from '@/types/lab';

type Result = { joined: number; leftover: number };

export function LabAlignCard({
  panels,
  onApplied,
}: {
  panels: LabPanel[];
  onApplied: (next: LabPanel[]) => Promise<void>;
}) {
  const T = useFigmaLab();
  const router = useRouter();
  const plan = usePlanUsage();
  const { applyUsage } = useAuth();
  const [quota, setQuota] = useState<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(ka.lab.alignStageCollect);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!busy) return;
    const steps = [ka.lab.alignStageCollect, ka.lab.alignStageModel, ka.lab.alignStageSave];
    let i = 0;
    const tick = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1);
      setStage(steps[i]);
    }, 1400);
    return () => clearInterval(tick);
  }, [busy]);

  const start = () => {
    if (!panels.length) return;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < 1) {
      setQuota(plan.usage?.resetsInMs);
      return;
    }
    setOpen(true);
    setError(null);
    setResult(null);
    void run();
  };

  const run = async () => {
    setBusy(true);
    setStage(ka.lab.alignStageCollect);
    try {
      const analytes = uniqueLabAnalytes(panels);
      if (!analytes.length) {
        setError(ka.lab.alignEmpty);
        return;
      }
      setStage(ka.lab.alignStageModel);
      const response = await api.ai.alignLab(analytes);
      applyUsage(response.usage);
      setStage(ka.lab.alignStageSave);
      await onApplied(applyLabMaps(panels, response.maps));
      setResult({ joined: response.joined, leftover: response.leftover.length });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setOpen(false);
        setQuota(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
        return;
      }
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 18, color: T.textPrimary, marginBottom: 8 }}>
          {ka.lab.alignTitle}
        </Text>
        <View
          style={{
            backgroundColor: T.cardBg,
            borderWidth: 1,
            borderColor: T.brand,
            borderRadius: 16,
            padding: 16,
            gap: 14,
            opacity: panels.length ? 1 : 0.55,
            ...T.shadowXs,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: T.brandSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MedicardLogoMark size={28} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: T.textPrimary }}>
                {ka.lab.alignHeadline}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: T.textSecondary }}>
                {ka.lab.alignBody}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.lab.alignCta}
            onPress={start}
            disabled={!panels.length}
            style={{
              height: 48,
              borderRadius: 14,
              backgroundColor: '#0D9488',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Sparkles size={16} color="#FFFFFF" />
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF' }}>{ka.lab.alignCta}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={open} {...APP_MODAL_PROPS} onRequestClose={() => (busy ? undefined : setOpen(false))}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ backgroundColor: APP_MODAL_OVERLAY, position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            onPress={() => (busy ? undefined : setOpen(false))}
          />
          <View
            style={{
              backgroundColor: T.cardBg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 22,
              paddingBottom: 32,
              gap: 14,
            }}
          >
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  backgroundColor: T.brandSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {busy ? <ActivityIndicator color={T.brand} /> : <MedicardLogoMark size={34} />}
              </View>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: T.textPrimary, textAlign: 'center' }}>
                {result ? ka.lab.alignDoneTitle : ka.lab.alignHeadline}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: T.textSecondary, textAlign: 'center' }}>
                {error
                  ? error
                  : result
                    ? [
                        result.joined ? ka.lab.alignDoneJoined(result.joined) : ka.lab.alignDoneClean,
                        result.leftover ? ka.lab.alignDoneLeftover(result.leftover) : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : stage}
              </Text>
            </View>
            {busy ? <Text style={{ textAlign: 'center', color: T.textMuted, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.lab.alignBusy}</Text> : null}
            {!busy ? (
              <Pressable
                onPress={() => setOpen(false)}
                style={{
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: '#0D9488',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF' }}>{ka.lab.alignClose}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <QuotaSheet
        visible={quota != null}
        resetsInMs={quota}
        onClose={() => setQuota(undefined)}
        onUpgrade={() => {
          setQuota(undefined);
          router.push('/package');
        }}
      />
    </>
  );
}
