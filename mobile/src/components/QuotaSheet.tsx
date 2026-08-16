import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Check, Crown, X } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { ka } from '@/i18n/ka';
import { formatCountdown } from '@/lib/format';
import { useThemeColors } from '@/theme/colors';

const PERKS = [
  'შეუზღუდავი AI კონსულტაცია',
  'ანალიზების და სნიმოკების გაშიფვრა ლიმიტის გარეშე',
  'კონსილიუმი — 5 სპეციალისტამდე',
  'სამედიცინო ისტორიის სრული არქივი',
];

/** Shown when the backend answers an AI request with 429 DAILY_LIMIT_REACHED. */
export function QuotaSheet({
  visible,
  resetsInMs,
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  resetsInMs?: number;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-text-100/45" onPress={onClose}>
        <Pressable className="rounded-t-3xl border-t border-bg-300 bg-bg-100 px-5 pb-9 pt-3" onPress={() => undefined}>
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-bg-300" />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            hitSlop={12}
            className="absolute right-5 top-5"
            onPress={onClose}
          >
            <X size={20} color={colors.text300} strokeWidth={2.2} />
          </Pressable>

          <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-accent-100/50">
            <Crown size={26} color={colors.primary200} strokeWidth={2.2} />
          </View>

          <Text className="text-2xl font-bold text-text-100">{ka.usage.exhaustedTitle}</Text>
          <Text className="mt-1.5 text-base text-text-200">{ka.usage.exhaustedBody}</Text>

          {resetsInMs !== undefined ? (
            <Text className="mt-1 text-sm text-text-300">
              {ka.usage.resetsIn} {formatCountdown(resetsInMs)}
            </Text>
          ) : null}

          <View className="my-5 h-px bg-bg-300" />

          <Text className="text-lg font-bold text-text-100">{ka.usage.upsellTitle}</Text>
          <Text className="mt-1 text-sm text-text-200">{ka.usage.upsellBody}</Text>

          <View className="mt-4">
            {PERKS.map((perk) => (
              <View key={perk} className="mb-2.5 flex-row items-start">
                <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-state-successBg">
                  <Check size={12} color={colors.success} strokeWidth={3} />
                </View>
                <Text className="ml-2.5 flex-1 text-base text-text-200">{perk}</Text>
              </View>
            ))}
          </View>

          <View className="mt-4">
            <Button label={ka.usage.upsellCta} icon={Crown} onPress={onUpgrade} size="lg" />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
