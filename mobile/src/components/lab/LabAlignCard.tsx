import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Link2 } from 'lucide-react-native';
import { QuotaSheet } from '@/components/QuotaSheet';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { MedilabActionRow, useMedilab } from '@/components/lab/MedilabUI';
import { tx } from '@/i18n/locale';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { AiConsentDeclinedNote } from '@/components/ui/AiConsentDeclinedNote';
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
  const M = useMedilab();
  const plan = usePlanUsage();
  const { applyUsage } = useAuth();
  const [quota, setQuota] = useState<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>(ka.lab.alignStageCollect);
  const [error, setError] = useState<string | null>(null);
  // Declined / closed the AI disclosure: a calm note with „ხელახლა ცდა“ in the sheet, not an error.
  const [declined, setDeclined] = useState(false);
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
    setDeclined(false);
    setResult(null);
    void run();
  };

  const run = async () => {
    setBusy(true);
    setDeclined(false);
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
      if (isAiConsentDeclined(err)) { setDeclined(true); return; }
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
      {/* A maintenance tool, so a quiet row — not a second hero on the page. */}
      <MedilabActionRow
        icon={Link2}
        title={tx('სახელების გაერთიანება', 'Join names')}
        body={tx('ერთ მაჩვენებელს ერთ გრაფიკზე აერთიანებს', 'Puts one value on one chart')}
        onPress={start}
      />

      <Modal visible={open} {...APP_MODAL_PROPS} onRequestClose={() => (busy ? undefined : setOpen(false))}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ backgroundColor: APP_MODAL_OVERLAY, position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            onPress={() => (busy ? undefined : setOpen(false))}
          />
          <View
            style={{
              backgroundColor: M.c.surface,
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
                  backgroundColor: M.inkSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {busy ? <ActivityIndicator color={M.ink} /> : <MedicardLogoMark size={34} />}
              </View>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: M.c.text100, textAlign: 'center' }}>
                {result ? ka.lab.alignDoneTitle : ka.lab.alignHeadline}
              </Text>
              {declined && !busy ? null : <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: M.c.text200, textAlign: 'center' }}>
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
              </Text>}
            </View>
            {declined && !busy ? <AiConsentDeclinedNote background={M.c.bg100} onRetry={() => void run()} /> : null}
            {busy ? <Text style={{ textAlign: 'center', color: M.c.text300, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.lab.alignBusy}</Text> : null}
            {!busy ? (
              <Pressable
                onPress={() => setOpen(false)}
                style={{
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: M.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: M.onInk }}>{ka.lab.alignClose}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <QuotaSheet
        visible={quota != null}
        resetsInMs={quota}
        onClose={() => setQuota(undefined)}
      />
    </>
  );
}
