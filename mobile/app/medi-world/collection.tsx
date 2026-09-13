import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { WorldButton, WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { useCompanionWorld } from '@/hooks/useCompanionWorld';
import { companionCopy } from '@/i18n/world/companion.js';
import { worldCopy } from '@/i18n/world/catalog.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { ApiError } from '@/lib/api';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';

const FONT = 1.3;

export default function CompanionCollectionScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const dark = useIsDark();
  const { payload, offline, refreshing, refresh, mutate } = useCompanionWorld();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => companionCopy(locale), [locale]);
  const energyCopy = useMemo(() => worldCopy(locale), [locale]);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };
  const item = payload?.catalog.find((row) => row.key === picked) || null;
  const equipped = payload?.companion.equipment;
  const canMutate = !offline && !busy;
  const energyLabel = item?.energyType ? (energyCopy as Record<string, string>)[item.energyType] : '';
  const balance = item?.energyType ? payload?.world.careEnergy[item.energyType] ?? 0 : 0;

  async function run(fn: () => Promise<NonNullable<typeof payload>>) {
    if (!canMutate) return;
    setBusy(true);
    setNotice(null);
    try {
      const next = await mutate(fn);
      if (next.unlock?.charged) setCelebrating(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'INSUFFICIENT_CARE_ENERGY') setNotice(copy.insufficient);
      else if (code === 'COMPANION_LEVEL_LOCKED') setNotice(`${copy.lockedLevel} ${item?.worldLevel || ''}`);
      else setNotice(copy.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={copy.collection} subtitle={offline ? copy.offline : undefined} backLabel={copy.back} />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 24,
          paddingHorizontal: 16,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true, { spinner: true })} tintColor={colors.primary200} />}
      >
        {(payload?.catalog || []).map((row) => {
          const slotLabel = (copy as Record<string, string>)[`slot_${row.slot}`] || row.slot;
          const isOn = equipped?.[row.slot] === row.key;
          return (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              onPress={() => setPicked(row.key)}
              className="active:opacity-75"
              style={{
                marginTop: 12,
                minHeight: 72,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                padding: QUEST.pad,
                backgroundColor: colors.surface,
                flexDirection: 'row',
                gap: 12,
                alignItems: 'flex-start',
                opacity: row.owned || row.eligible ? 1 : 0.7,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={20} color={colors.primary200} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={FONT} style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>
                  {(copy as Record<string, string>)[row.nameKey] || row.fallbackLabel}
                </Text>
                <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, fontSize: 14, color: colors.text200, marginTop: 4 }}>
                  {slotLabel}
                  {row.owned ? ` · ${copy.owned}` : row.eligible ? ` · ${row.price}` : ` · ${copy.lockedLevel} ${row.worldLevel}`}
                  {isOn ? ` · ${copy.equipped}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {notice ? (
          <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(item)} {...APP_MODAL_PROPS} onRequestClose={() => setPicked(null)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setPicked(null)} />
          {item ? (
            <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100 }}>
                {(copy as Record<string, string>)[item.nameKey] || item.fallbackLabel}
              </Text>
              <Text style={{ ...fontBody, fontSize: 15, color: colors.text200, marginTop: 8 }}>
                {(copy as Record<string, string>)[item.descriptionKey] || item.fallbackLabel}
              </Text>
              {!item.owned ? (
                <>
                  <Text style={{ ...fontMed, fontSize: 14, color: colors.text200, marginTop: 12 }}>
                    {copy.unlockBody}
                  </Text>
                  <Text style={{ ...fontMed, fontSize: 14, color: colors.text200, marginTop: 8 }}>
                    {copy.remainingBefore}: {balance} {energyLabel} · {copy.lockedLevel} {item.worldLevel}
                  </Text>
                  <Text style={{ ...fontMed, fontSize: 14, color: colors.text200, marginTop: 4 }}>
                    {copy.remainingAfter}: {Math.max(0, balance - item.price)} {energyLabel}
                  </Text>
                  <WorldButton
                    label={!item.eligible ? `${copy.lockedLevel} ${item.worldLevel}` : balance < item.price ? copy.insufficient : copy.unlockConfirm}
                    disabled={!canMutate || !item.eligible || balance < item.price}
                    onPress={() => void run(() => mediWorldApi.unlockCosmetic(item.key, `unlock:${item.key}`))}
                  />
                </>
              ) : (
                <WorldButton
                  label={equipped?.[item.slot] === item.key ? copy.unequip : copy.equip}
                  disabled={!canMutate}
                  onPress={() =>
                    void run(() =>
                      mediWorldApi.equipCosmetic(
                        item.slot,
                        equipped?.[item.slot] === item.key && item.slot !== 'aura' ? null : item.key,
                      ),
                    )
                  }
                />
              )}
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={celebrating} {...APP_MODAL_PROPS} onRequestClose={() => setCelebrating(false)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 22 }}>
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100 }}>{copy.celebrateUnlock}</Text>
            <Text style={{ ...fontBody, fontSize: 16, color: colors.text200, marginTop: 10 }}>{copy.celebrateUnlockBody}</Text>
            {item?.energyType ? (
              <Text style={{ ...fontMed, fontSize: 15, color: colors.text200, marginTop: 8 }}>
                {copy.remainingAfter}: {payload?.unlock?.resultingBalance ?? payload?.world.careEnergy[item.energyType]} {energyLabel}
              </Text>
            ) : null}
            <WorldButton label={copy.close} onPress={() => setCelebrating(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
