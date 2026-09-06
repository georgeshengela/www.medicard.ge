import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Flag, Flame } from 'lucide-react-native';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';

type Props = {
  percent: number;
  startLabel: string;
  endLabel: string;
  completed?: boolean;
};

export function WeightLinearProgress({ percent, startLabel, endLabel, completed }: Props) {
  const T = useFigmaWeight();
  const pct = Math.max(0.08, Math.min(0.96, percent / 100));

  return (
    <View style={{ width: '100%', gap: 4 }}>
      <View style={{ height: 32, justifyContent: 'flex-end' }}>
        <Text
          style={{
            position: 'absolute',
            left: `${pct * 100}%`,
            bottom: 32,
            marginLeft: -16,
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 12,
            lineHeight: 16,
            letterSpacing: 1,
            color: T.textPrimary,
          }}
        >
          {`${Math.round(percent)}%`}
        </Text>
        <View
          style={{
            height: 32,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: T.border,
            backgroundColor: T.surface,
            overflow: 'hidden',
            justifyContent: 'center',
          }}
        >
          <LinearGradient
            colors={completed ? ['rgba(34,197,94,0)', T.success] : ['rgba(245,158,11,0)', T.warning]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, borderRadius: 999 }}
          />
          <View
            style={{
              position: 'absolute',
              left: `${pct * 100}%`,
              marginLeft: -16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: T.surface,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {completed ? <Check size={16} color={T.success} strokeWidth={2.6} /> : <Flame size={16} color={T.warning} strokeWidth={2.2} />}
          </View>
          <View
            style={{
              position: 'absolute',
              right: 4,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: completed ? T.success : T.flag,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {completed ? <Check size={14} color="#FFFFFF" strokeWidth={2.6} /> : <Flag size={12} color="#FFFFFF" strokeWidth={2.2} />}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
          {startLabel}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: T.textSecondary }}>
          {endLabel}
        </Text>
      </View>
    </View>
  );
}
