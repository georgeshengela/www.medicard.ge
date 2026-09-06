import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { Button } from '@/components/ui/Button';
import { q } from '@/lib/quest/copy';
import { rankLabel } from '@/lib/quest/logic.js';
import { QuestReward } from '@/components/quest/QuestReward';

export function QuestLevelUpSheet({
  visible,
  level,
  previousLevel,
  rankKey,
  coins,
  xp,
  locale = 'ka',
  onClose,
}: {
  visible: boolean;
  level: number;
  previousLevel?: number;
  rankKey?: string;
  coins?: number;
  xp?: number;
  locale?: string;
  onClose: () => void;
}) {
  const copy = q(locale);
  const insets = useSafeAreaInsets();
  const rank = rankKey ? rankLabel(rankKey, locale) : '';
  const jumped = previousLevel != null ? level - previousLevel : 0;
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }} onPress={onClose} />
        <View
          className="rounded-t-3xl bg-surface px-6 pt-8"
          style={{ paddingBottom: Math.max(insets.bottom, 20) + 8 }}
        >
          <Text className="text-center font-sans-semibold text-xs uppercase tracking-[1.4px] text-text-300">
            {copy.levelUp}
          </Text>
          <Text className="mt-3 text-center font-sans-bold text-[44px] leading-[50px] text-text-100">{level}</Text>
          {rank ? <Text className="mt-1 text-center font-sans text-[17px] text-text-200">{rank}</Text> : null}
          {jumped > 1 ? (
            <Text className="mt-2 text-center font-sans text-sm text-text-300">{copy.levelsUp(jumped)}</Text>
          ) : null}
          {coins || xp ? (
            <View className="mt-4 items-center">
              <QuestReward xp={xp || 0} coins={coins || 0} locale={locale} />
            </View>
          ) : null}
          <View className="mt-6">
            <Button label={copy.continue} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
