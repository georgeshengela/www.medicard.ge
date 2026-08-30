import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { ChevronRight, Heart } from 'lucide-react-native';
import { CycleDateField } from '@/components/cycle/CycleDateField';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  visible: boolean;
  saving?: boolean;
  userName?: string | null;
  error?: string | null;
  onSave: (iso: string) => void;
};

function firstName(full?: string | null) {
  const part = (full || '').trim().split(/\s+/)[0];
  return part || '';
}

/** First-visit gate: ask for last period start before the main cycle UI. */
export function CycleOnboarding({ visible, saving, userName, error, onSave }: Props) {
  const c = useCycleColors();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState('');
  const name = firstName(userName);
  const greeting = name ? `${ka.cycle.onboardHi}, ${name}` : ka.cycle.onboardHi;

  if (!visible) return null;

  return (
      <ScrollView
        style={{ flex: 1, backgroundColor: c.cream }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 22,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeIn.duration(480)} style={{ flexGrow: 1, justifyContent: 'center' }}>
          <Animated.View entering={FadeInUp.delay(40).duration(420)} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 18,
              }}
            >
              <Heart size={28} color={c.rose} strokeWidth={2.2} />
            </View>

            <Text
              style={{
                color: c.ink,
                fontSize: 30,
                fontFamily: 'NotoSansGeorgian_700Bold',
                textAlign: 'center',
                letterSpacing: -0.6,
              }}
            >
              {greeting}
            </Text>
            <Text
              style={{
                color: c.muted,
                fontSize: 15,
                lineHeight: 23,
                textAlign: 'center',
                marginTop: 12,
                marginBottom: 8,
                paddingHorizontal: 4,
                fontFamily: 'NotoSansGeorgian_500Medium',
              }}
            >
              {ka.cycle.onboardBody}
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInUp.delay(120).duration(420)}
            style={{
              marginTop: 18,
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 17,
                letterSpacing: -0.2,
              }}
            >
              {ka.cycle.lastPeriod}
            </Text>
            <Text
              style={{
                color: c.muted,
                fontSize: 13,
                lineHeight: 19,
                marginTop: 6,
                marginBottom: 16,
                fontFamily: 'NotoSansGeorgian_500Medium',
              }}
            >
              {ka.cycle.onboardHint}
            </Text>

            <CycleDateField
              value={date}
              onChange={setDate}
              placeholder={ka.cycle.onboardTapCalendar}
              range="past"
              variant="hero"
              inline
            />

            <View style={{ height: 32 }} />

            <Pressable
              disabled={!date || saving}
              onPress={() => date && onSave(date)}
              style={({ pressed }) => ({
                borderRadius: 16,
                overflow: 'hidden',
                opacity: !date || saving ? 0.45 : pressed ? 0.92 : 1,
              })}
            >
              <View
                style={{
                  minHeight: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  gap: 6,
                  backgroundColor: c.cta,
                }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text
                      style={{
                        color: '#fff',
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 16,
                      }}
                    >
                      {ka.cycle.onboardCta}
                    </Text>
                    {date ? <ChevronRight size={18} color="#fff" strokeWidth={2.6} /> : null}
                  </>
                )}
              </View>
            </Pressable>
            {error ? (
              <Text
                style={{
                  color: c.danger,
                  marginTop: 12,
                  textAlign: 'center',
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  lineHeight: 18,
                }}
              >
                {error}
              </Text>
            ) : null}
          </Animated.View>

          <Text
            style={{
              color: c.mutedSoft,
              fontSize: 11,
              textAlign: 'center',
              marginTop: 18,
              lineHeight: 16,
              paddingHorizontal: 8,
              fontFamily: 'NotoSansGeorgian_500Medium',
            }}
          >
            {ka.cycle.onboardPrivacy}
          </Text>
        </Animated.View>
      </ScrollView>
  );
}
