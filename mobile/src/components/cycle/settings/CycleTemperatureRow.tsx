/**
 * Cycle settings → პროფილი: „ტემპერატურა Apple Health-იდან“ / „Health Connect-იდან“ (train 1.0.0.20,
 * brief §9 „მერე“ item 5). Off by default; acts at once (not on „შენახვა“).
 *
 * Turning it on shows the one-button „გაგრძელება“ primer (App Review 5.1.1(iv): no Not now / close /
 * tap-outside before the system sheet), and only that button asks the OS for read access
 * (`connectHealthTemperature`, iOS 26 rule — never from an effect). After the sheet was answered the
 * card may close. The primer is shown once per device (`permissionPrimer.asked.temperature`); later
 * the switch goes straight to the sheet (iOS does not show it again for types already answered).
 * The primer is an in-window overlay, not an RN Modal, so the Health sheet can present over the app;
 * the screen renders `primer` beside its scroll view so the overlay covers the whole screen.
 */
import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Thermometer } from 'lucide-react-native';
import { CycleCard, CyclePrimaryButton } from '@/components/cycle/CycleUI';
import { useHideTabChromeWhile } from '@/components/navigation/tabChrome';
import { APP_MODAL_OVERLAY } from '@/components/ui/appModal';
import { connectHealthTemperature, isHealthPlatformSupported } from '@/lib/healthSync';
import { markPrimerAsked, primerCloseLabel, primerCopy, wasPrimerAsked } from '@/lib/permissionPrimer';
import { temperatureRowHint, temperatureRowLabel, temperatureStatusText } from '@/lib/cycleTemperatureImport';
import { isCycleTemperatureEnabled, setCycleTemperatureEnabled } from '@/lib/cycleTemperatureSync';
import { useCycleColors } from '@/theme/cycle';
import { SettingsRowSwitch } from './CycleSettingsKit';

type Status = Parameters<typeof temperatureStatusText>[0];

/** `card` goes in the profile form, `primer` beside the form (full-screen overlay). Null card = unsupported. */
export function useCycleTemperatureSetting(userId: string | null | undefined): { card: ReactNode; primer: ReactNode } {
  const c = useCycleColors();
  const os = Platform.OS;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [primer, setPrimer] = useState<'ask' | 'answered' | null>(null);

  useEffect(() => {
    let alive = true;
    void isCycleTemperatureEnabled(userId).then((on) => {
      if (alive) setEnabled(on);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!isHealthPlatformSupported() || !userId) return { card: null, primer: null };

  /** Only ever called from a tap: the primer's „გაგრძელება“ or the switch once the primer was seen. */
  const requestAccess = async () => {
    setBusy(true);
    try {
      const result = await connectHealthTemperature();
      await markPrimerAsked('temperature');
      if (result.ok) {
        await setCycleTemperatureEnabled(userId, true);
        setEnabled(true);
        setStatus('on');
        setPrimer(null);
        return;
      }
      setEnabled(false);
      setStatus(result.reason === 'denied' ? 'denied' : result.reason === 'error' ? 'error' : 'unavailable');
      setPrimer((p) => (p ? 'answered' : null));
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (next: boolean) => {
    if (busy) return;
    if (!next) {
      await setCycleTemperatureEnabled(userId, false).catch(() => undefined);
      setEnabled(false);
      setStatus('off');
      return;
    }
    setStatus(null);
    if (await wasPrimerAsked('temperature')) {
      await requestAccess();
      return;
    }
    setPrimer('ask');
  };

  return {
    card: (
      <CycleCard>
        <SettingsRowSwitch
          icon={Thermometer}
          label={temperatureRowLabel(os)}
          hint={temperatureRowHint(os)}
          value={enabled}
          disabled={busy}
          onChange={(v) => void onToggle(v)}
          c={c}
        />
        {status ? (
          <Text accessibilityLiveRegion="polite" style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
            {temperatureStatusText(status, os)}
          </Text>
        ) : null}
      </CycleCard>
    ),
    primer: (
      <TemperaturePrimer
        visible={primer != null}
        answered={primer === 'answered'}
        busy={busy}
        status={status}
        onContinue={() => void requestAccess()}
        onClose={() => setPrimer(null)}
      />
    ),
  };
}

function TemperaturePrimer({
  visible,
  answered,
  busy,
  status,
  onContinue,
  onClose,
}: {
  visible: boolean;
  answered: boolean;
  busy: boolean;
  status: Status | null;
  onContinue: () => void;
  onClose: () => void;
}) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  useHideTabChromeWhile(visible);
  if (!visible) return null;
  const copy = primerCopy('temperature');
  return (
    <View accessibilityViewIsModal style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000, elevation: 9000 }}>
      {/* Scrim: a sibling of the card; it closes only after the system sheet was answered. */}
      <Pressable
        accessible={false}
        disabled={busy || !answered}
        onPress={onClose}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }}
      />
      <ScrollView
        pointerEvents="box-none"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 20),
        }}
      >
        <View style={{ backgroundColor: c.card, borderRadius: 22, padding: 22, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: c.cardSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Thermometer size={22} color={c.brand} strokeWidth={2} />
            </View>
            <Text style={{ flex: 1, color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25 }}>
              {copy.title}
            </Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22 }}>{copy.body}</Text>
          {answered && status ? (
            <Text accessibilityLiveRegion="polite" style={{ color: c.ink, fontSize: 13, lineHeight: 19 }}>
              {temperatureStatusText(status, Platform.OS)}
            </Text>
          ) : null}
          {answered ? (
            <CyclePrimaryButton label={primerCloseLabel()} onPress={onClose} disabled={busy} />
          ) : (
            <CyclePrimaryButton label={copy.cta} onPress={onContinue} loading={busy} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
