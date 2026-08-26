import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { Activity, Footprints, HeartPulse } from 'lucide-react-native';
import { FIGMA_HEALTH_METRICS_HOME as H } from '@/constants/figmaHealthMetricsHomeLayout';

function MiniBadge({
  icon: Icon,
  color,
  label,
  style,
}: {
  icon: typeof HeartPulse;
  color: string;
  label: string;
  style: object;
}) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#FFFFFF',
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: H.cardBorder,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
        style,
      ]}
    >
      <Icon size={14} color={color} strokeWidth={2.2} />
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 11,
          color: H.textPrimary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Figma 8912:73627 — empty-state hero art. */
export function HomeHealthMetricsEmptyIllustration() {
  return (
    <View
      style={{
        height: H.illustrationHeight,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <LinearGradient
        colors={['#F0FDFA', '#CCFBF1', '#99F6E4']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          width: 112,
          height: 112,
          borderRadius: 56,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#99F6E4',
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: 'rgba(255,255,255,0.72)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Activity size={34} color={H.brand} strokeWidth={2.2} />
        </View>
      </LinearGradient>

      <MiniBadge icon={HeartPulse} color="#F43F5E" label="72 bpm" style={{ top: 18, left: 24 }} />
      <MiniBadge icon={Footprints} color={H.brand} label="8.2k" style={{ top: 28, right: 20 }} />
      <MiniBadge icon={Activity} color="#8B5CF6" label="120/80" style={{ bottom: 22, left: 48 }} />
    </View>
  );
}
