import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { GoalCloseX } from '@/components/health/steps-goal/StepsGoalIcons';

type Item = { key: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  items: Item[];
  selectedKey: string;
  onClose: () => void;
  onSelect: (key: string) => void;
};

export function GoalPickSheet({ visible, title, items, selectedKey, onClose, onSelect }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.35)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: FIGMA_STEPS.pageBg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '70%',
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View style={{ alignItems: 'center', paddingTop: 5, height: 16 }}>
            <View style={{ width: 36, height: 5, borderRadius: 100, backgroundColor: FIGMA_STEPS.border }} />
          </View>
          <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                flex: 1,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 18,
                color: FIGMA_STEPS.textPrimary,
              }}
            >
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <GoalCloseX size={24} />
            </Pressable>
          </View>
          <ScrollView>
            {items.map((item) => {
              const selected = item.key === selectedKey;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    onSelect(item.key);
                    onClose();
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    backgroundColor: selected ? FIGMA_STEPS.brandQuaternary : '#FFFFFF',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: selected ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular',
                      fontSize: 16,
                      color: selected ? FIGMA_STEPS.brand : FIGMA_STEPS.textPrimary,
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function upcomingDeadlineItems(count = 60): Item[] {
  const items: Item[] = [];
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  for (let i = 1; i <= count; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    items.push({
      key,
      label: d.toLocaleDateString('ka-GE', { weekday: 'short', day: 'numeric', month: 'long' }),
    });
  }
  return items;
}

export function reminderTimeItems(): Item[] {
  const items: Item[] = [];
  for (let hour = 6; hour <= 22; hour += 1) {
    for (const minute of [0, 30]) {
      const key = `${hour}:${minute}`;
      const d = new Date();
      d.setHours(hour, minute, 0, 0);
      items.push({
        key,
        label: d.toLocaleTimeString('ka-GE', { hour: 'numeric', minute: '2-digit' }),
      });
    }
  }
  return items;
}
