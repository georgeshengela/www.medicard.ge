import React from 'react';
import { Text } from 'react-native';

export function QuestSectionTitle({ title }: { title: string }) {
  return <Text className="font-sans-bold text-[15px] text-text-100">{title}</Text>;
}
