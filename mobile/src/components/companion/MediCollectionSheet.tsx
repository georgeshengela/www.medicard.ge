import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CosmeticPreview } from '@/components/companion/CosmeticPreview';
import type { CompanionCosmetic, CompanionEquipSlot, CompanionEquipment } from '@/lib/companion/api';
import { companionApi } from '@/lib/companion/api';
import {
  companionCopy,
  companionCosmeticBody,
  companionCosmeticTitle,
  companionSlotLabel,
} from '@/lib/companion/copy';
import { requestCompanionRefresh, writeCompanionCache, readCompanionCache } from '@/lib/companion/cache';
import { visualKeyForCosmetic } from '@/lib/companion/cosmeticVisuals';
import { trackQuestEvent } from '@/lib/productObservability';
import { useOffline } from '@/hooks/useOffline';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const SLOTS: CompanionEquipSlot[] = ['accent', 'accessory', 'background', 'decoration'];

type Props = {
  visible: boolean;
  onClose: () => void;
  equipment: CompanionEquipment;
  collection: CompanionCosmetic[];
  locale?: string;
  inline?: boolean;
  onEquipmentChange?: (next: CompanionEquipment) => void;
};

export function MediCollectionSheet({
  visible,
  onClose,
  equipment,
  collection,
  locale = 'ka',
  inline,
  onEquipmentChange,
}: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const offline = useOffline();
  const copy = companionCopy(locale);
  const [slot, setSlot] = useState<CompanionEquipSlot>('accent');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [localEquip, setLocalEquip] = useState(equipment);
  const [equipError, setEquipError] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalEquip(equipment);
  }, [equipment]);

  const items = useMemo(
    () => collection.filter((c) => c.slot === slot && c.unlocked),
    [collection, slot],
  );

  const equip = async (item: CompanionCosmetic | null) => {
    if (offline) return;
    const key = item?.key ?? null;
    const patch: Partial<CompanionEquipment> = { [slot]: key };
    setBusyKey(key || `__clear_${slot}`);
    setEquipError(null);
    const previous = localEquip;
    try {
      const { getCompanionDevScenario, isCompanionDevEnabled } = await import('@/lib/companion/devFixtures');
      if (isCompanionDevEnabled() && getCompanionDevScenario() !== 'LIVE') {
        const next = { ...localEquip, [slot]: key };
        if ((slot === 'accent' || slot === 'background') && !key) {
          next[slot] = slot === 'accent' ? 'COSMETIC_DEFAULT_ACCENT' : 'COSMETIC_DEFAULT_BACKGROUND';
        }
        setLocalEquip(next);
        onEquipmentChange?.(next);
        void trackQuestEvent('medi_cosmetic_equipped', key || slot);
        return;
      }
      const res = await companionApi.putEquipment(patch);
      const next = res.equipment;
      setLocalEquip(next);
      onEquipmentChange?.(next);
      void trackQuestEvent('medi_cosmetic_equipped', key || slot);
      const cached = await readCompanionCache();
      if (cached?.overview) {
        await writeCompanionCache({ ...cached.overview, equipment: next });
      }
      requestCompanionRefresh();
    } catch {
      setLocalEquip(previous);
      onEquipmentChange?.(previous);
      setEquipError(copy.loadError);
    } finally {
      setBusyKey(null);
    }
  };

  const body = (
    <View
      style={{
        backgroundColor: dark ? colors.surface : '#FFFFFF',
        borderTopLeftRadius: inline ? 0 : 20,
        borderTopRightRadius: inline ? 0 : 20,
        maxHeight: inline ? undefined : '88%',
        flex: inline ? 1 : undefined,
        paddingTop: 16,
        paddingBottom: 24,
      }}
    >
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
          {copy.collection}
        </Text>
        <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300 }}>
          {offline ? copy.offlineEquip : copy.style}
        </Text>
        {equipError ? (
          <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: '#DC2626' }}>
            {equipError}
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
      >
        {SLOTS.map((s) => {
          const active = s === slot;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={companionSlotLabel(s, locale)}
              onPress={() => setSlot(s)}
              className="active:opacity-90"
              style={{
                minHeight: 36,
                paddingHorizontal: 14,
                borderRadius: 999,
                justifyContent: 'center',
                backgroundColor: active
                  ? dark
                    ? '#0D9488'
                    : QUEST.accent.medi
                  : dark
                    ? colors.bg200
                    : QUEST.wash.lightSoft,
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  color: active ? '#FFFFFF' : colors.text200,
                }}
              >
                {companionSlotLabel(s, locale)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: colors.text300, paddingVertical: 20 }}>
            {copy.emptyCollection}
          </Text>
        ) : (
          items.map((item) => {
            const equipped = localEquip[slot] === item.key;
            const busy = busyKey === item.key;
            const vk = item.assetKey || visualKeyForCosmetic(item.key);
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected: equipped, disabled: offline || Boolean(busyKey) }}
                accessibilityLabel={`${companionCosmeticTitle(item.titleKey, locale)}. ${equipped ? copy.equipped : copy.equip}`}
                disabled={offline || Boolean(busyKey)}
                onPress={() => void equip(equipped && (slot === 'accessory' || slot === 'decoration') ? null : item)}
                className="active:opacity-90"
                style={{
                  minHeight: 72,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: QUEST.rowRadius,
                  borderWidth: equipped ? 2 : 1,
                  borderColor: equipped ? (dark ? colors.primary200 : QUEST.accent.medi) : colors.bg300,
                  backgroundColor: dark ? colors.bg200 : QUEST.wash.lightSoft,
                  opacity: offline ? 0.7 : 1,
                }}
              >
                {busy ? (
                  <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={dark ? colors.primary100 : QUEST.accent.medi} />
                  </View>
                ) : (
                  <View style={{ position: 'relative' }}>
                    <CosmeticPreview cosmeticKey={item.key} visualKey={vk} slot={item.slot} size={44} />
                    {equipped ? (
                      <View
                        style={{
                          position: 'absolute',
                          right: -4,
                          top: -4,
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: dark ? '#0D9488' : QUEST.accent.medi,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={11} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : null}
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.text100 }}>
                    {companionCosmeticTitle(item.titleKey, locale)}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: colors.text300 }} numberOfLines={2}>
                    {companionCosmeticBody(item.descriptionKey, locale)}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 12,
                    color: equipped ? (dark ? colors.primary100 : QUEST.accent.medi) : colors.text300,
                  }}
                >
                  {equipped ? copy.equipped : copy.equip}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {!inline ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="active:opacity-90"
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            minHeight: 48,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark ? colors.bg200 : colors.bg100,
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text100 }}>OK</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (inline) return body;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
        />
        {body}
      </View>
    </Modal>
  );
}
