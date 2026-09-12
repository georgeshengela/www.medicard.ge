import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, FlaskConical, Sparkles, Stethoscope } from 'lucide-react-native';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { ka } from '@/i18n/ka';
import { ApiError, type AiEngineId } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

const OPTIONS: Array<{
  id: AiEngineId;
  icon: typeof Sparkles;
  title: string;
  badge: string;
  hint: string;
}> = [
  {
    id: 'gemini_flash',
    icon: Sparkles,
    title: ka.profile.aiEngineGemini,
    badge: ka.profile.aiEngineGeminiBadge,
    hint: ka.profile.aiEngineGeminiHint,
  },
  {
    id: 'ling_free',
    icon: FlaskConical,
    title: ka.profile.aiEngineLing,
    badge: ka.profile.aiEngineLingBadge,
    hint: ka.profile.aiEngineLingHint,
  },
  {
    id: 'evidencemd',
    icon: Stethoscope,
    title: ka.profile.aiEngineEvidence,
    badge: ka.profile.aiEngineEvidenceBadge,
    hint: ka.profile.aiEngineEvidenceHint,
  },
];

export default function AiEngineSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const FIGMA = useFigmaHealthMetrics();
  const colors = useThemeColors();
  const { user, updateProfile } = useAuth();
  const selected: AiEngineId =
    user?.aiEngine === 'ling_free' || user?.aiEngine === 'evidencemd' ? user.aiEngine : 'gemini_flash';
  const [saving, setSaving] = useState<AiEngineId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cards = useMemo(() => OPTIONS, []);

  const pick = async (id: AiEngineId) => {
    if (id === selected || saving) return;
    setSaving(id);
    setError(null);
    setSaved(false);
    try {
      await updateProfile({ aiEngine: id });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          style={{ width: 44, height: 44, justifyContent: 'center' }}
        >
          <ChevronLeft size={24} color={FIGMA.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: 'right',
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 17,
            color: FIGMA.textPrimary,
          }}
        >
          {ka.profile.aiEngine}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 28, gap: 12 }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 13,
            lineHeight: 20,
            color: colors.text300,
            marginBottom: 4,
          }}
        >
          {ka.profile.aiEngineHint}
        </Text>

        {cards.map((option) => {
          const on = selected === option.id;
          const Icon = option.icon;
          return (
            <Pressable
              key={option.id}
              onPress={() => void pick(option.id)}
              disabled={saving != null}
              accessibilityRole="button"
              accessibilityState={{ selected: on, busy: saving === option.id }}
              style={{
                borderRadius: 18,
                padding: 16,
                borderWidth: on ? 2 : 1,
                borderColor: on ? '#0D9488' : colors.bg300,
                backgroundColor: colors.surface,
                opacity: saving && saving !== option.id ? 0.55 : 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: on ? '#0D948814' : colors.bg200,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={20} color={on ? '#0D9488' : colors.text200} strokeWidth={2.1} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 16,
                        color: colors.text100,
                      }}
                    >
                      {option.title}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        backgroundColor: on ? '#0D9488' : colors.bg200,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_600SemiBold',
                          fontSize: 11,
                          color: on ? '#FFFFFF' : colors.text300,
                        }}
                      >
                        {option.badge}
                      </Text>
                    </View>
                  </View>
                </View>
                {on ? <Check size={20} color="#0D9488" strokeWidth={2.4} /> : null}
              </View>
              <Text
                style={{
                  marginTop: 10,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 13,
                  lineHeight: 19,
                  color: colors.text300,
                }}
              >
                {option.hint}
              </Text>
            </Pressable>
          );
        })}

        {saved ? (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 13,
              color: '#0D9488',
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            {ka.profile.aiEngineSaved}
          </Text>
        ) : null}
        {error ? (
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 13,
              color: colors.danger,
              textAlign: 'center',
            }}
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
