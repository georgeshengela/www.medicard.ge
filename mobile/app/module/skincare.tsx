import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronRight, Moon, Sparkles, Sun } from 'lucide-react-native';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { ChatAiAvatar } from '@/components/chat/ChatAiAvatar';
import { ChatTypingBubble } from '@/components/chat/ChatBubble';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { ChatTopNav } from '@/components/chat/ChatTopNav';
import { Disclaimer } from '@/components/Disclaimer';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { QuotaSheet } from '@/components/QuotaSheet';
import { SkincareConcernGrid, SkincareTypeList } from '@/components/skincare/SkincarePickers';
import { SkincareResultCard } from '@/components/skincare/SkincareResultCard';
import { KEYBOARD_DONE_ACCESSORY_ID, KeyboardDoneAccessory } from '@/components/ui/KeyboardDoneAccessory';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { usePlanUsage } from '@/lib/planUsage';
import {
  getLatestSkincareRoutine,
  saveSkincareRoutine,
  type SavedSkincareRoutine,
} from '@/lib/skincareStorage';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

export default function SkincareModule() {
  const FIGMA = useFigmaChat();
  const colors = useThemeColors();
  const router = useRouter();
  const { applyUsage } = useAuth();
  const plan = usePlanUsage();

  const [skinType, setSkinType] = useState<string>(ka.modules.skincare.skinTypes[0]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [products, setProducts] = useState('');
  const [busy, setBusy] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [result, setResult] = useState<SavedSkincareRoutine | null>(null);
  const [lastRoutine, setLastRoutine] = useState<SavedSkincareRoutine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  const remainingLabel = useMemo(() => {
    if (plan.unlimited) return ka.usage.unlimitedBanner;
    if (plan.exhausted) return ka.usage.exhaustedTitle;
    if (plan.remaining != null) return ka.chat.chatsRemaining(plan.remaining);
    return undefined;
  }, [plan]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void getLatestSkincareRoutine().then((saved) => {
        if (!alive || !saved) return;
        setLastRoutine((prev) => {
          if (prev && prev.recordId === saved.recordId) return prev;
          return { ...saved, analysis: prev?.analysis ?? '' };
        });
      });
      void api.records
        .list('SKINCARE')
        .then(({ records }) => {
          if (!alive || !records[0]) return;
          const latest = records[0];
          setLastRoutine((prev) => {
            if (prev && prev.recordId === latest.id && prev.analysis) return prev;
            if (prev && new Date(prev.createdAt).getTime() > new Date(latest.createdAt).getTime()) return prev;
            return {
              recordId: latest.id,
              createdAt: latest.createdAt,
              skinType: prev?.skinType ?? ka.modules.skincare.skinTypes[0],
              concerns: prev?.concerns ?? [],
              products: prev?.products,
              analysis: latest.aiAnalysis,
            };
          });
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, []),
  );

  const toggleConcern = (concern: string) => {
    setConcerns((prev) =>
      prev.includes(concern) ? prev.filter((item) => item !== concern) : prev.length < 10 ? [...prev, concern] : prev,
    );
    setError(null);
  };

  const openRoutine = async (routine: SavedSkincareRoutine) => {
    if (routine.analysis.trim()) {
      setResult(routine);
      return;
    }
    setHydrating(true);
    setError(null);
    try {
      const { record } = await api.records.get(routine.recordId);
      const next = { ...routine, analysis: record.aiAnalysis, createdAt: record.createdAt };
      setLastRoutine(next);
      setResult(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setHydrating(false);
    }
  };

  const build = async () => {
    if (plan.exhausted) {
      setQuotaBlock(plan.usage?.resetsInMs ?? 0);
      return;
    }
    if (concerns.length === 0) {
      setError(ka.modules.skincare.needConcern);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await api.ai.skincare({
        skinType,
        concerns,
        currentProducts: products.trim() || undefined,
      });
      applyUsage(response.usage);
      const routine: SavedSkincareRoutine = {
        recordId: response.recordId,
        createdAt: new Date().toISOString(),
        skinType,
        concerns,
        products: products.trim() || undefined,
        analysis: response.analysis,
      };
      await saveSkincareRoutine(routine);
      setLastRoutine(routine);
      setResult(routine);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ChatScreenShell
      header={
        <ChatTopNav
          title={ka.modules.skincare.title}
          subtitle={ka.modules.skincare.subtitle}
          icon={Sparkles}
          remainingLabel={remainingLabel}
          onBack={() => router.back()}
          onSettings={() => router.push('/package' as never)}
        />
      }
    >
      {result ? (
        <SkincareResultCard
          routine={result}
          onNew={() => {
            setResult(null);
            setConcerns([]);
            setProducts('');
            setError(null);
          }}
          onOpenRecord={() => router.push(`/record/${result.recordId}` as never)}
        />
      ) : busy ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 40, alignItems: 'center', gap: 20 }}>
          <ChatAiAvatar icon={Sparkles} size="lg" />
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 20,
              lineHeight: 28,
              color: FIGMA.textPrimary,
              textAlign: 'center',
            }}
          >
            {ka.modules.skincare.building}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: FIGMA.brandQuaternary,
                borderWidth: 1,
                borderColor: FIGMA.brandBorderLight,
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: FIGMA.brand }}>
                {skinType}
              </Text>
            </View>
            {concerns.map((concern) => (
              <View
                key={concern}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: FIGMA.white,
                  borderWidth: 1,
                  borderColor: FIGMA.border,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA.textSecondary }}>
                  {concern}
                </Text>
              </View>
            ))}
          </View>
          <ChatTypingBubble icon={Sparkles} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: FIGMA.white,
              borderWidth: 1,
              borderColor: FIGMA.border,
              borderRadius: 24,
              padding: 16,
              gap: 16,
              ...FIGMA.shadowXs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ChatAiAvatar icon={Sparkles} size="lg" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 18,
                    lineHeight: 24,
                    color: FIGMA.textPrimary,
                  }}
                >
                  {ka.modules.skincare.emptyTitle}
                </Text>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 14,
                    lineHeight: 20,
                    color: FIGMA.textSecondary,
                  }}
                >
                  {ka.modules.skincare.emptyBody}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <PreviewTile icon={Sun} label={ka.modules.skincare.morningLabel} />
              <PreviewTile icon={Moon} label={ka.modules.skincare.eveningLabel} />
            </View>
          </View>

          {lastRoutine ? (
            <View>
              <HomeSectionTitle title={ka.modules.skincare.lastRoutine} />
              <Pressable
                accessibilityRole="button"
                disabled={hydrating}
                onPress={() => void openRoutine(lastRoutine)}
                style={{
                  backgroundColor: FIGMA.white,
                  borderWidth: 1,
                  borderColor: FIGMA.border,
                  borderRadius: 16,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  ...FIGMA.shadowXs,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    backgroundColor: FIGMA.brandQuaternary,
                    borderWidth: 1,
                    borderColor: FIGMA.brandBorderLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {hydrating ? (
                    <ActivityIndicator color={FIGMA.brand} />
                  ) : (
                    <Sparkles size={20} color={FIGMA.brand} strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 14,
                      lineHeight: 20,
                      color: FIGMA.textPrimary,
                    }}
                  >
                    {lastRoutine.skinType}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 13,
                      lineHeight: 18,
                      color: FIGMA.textSecondary,
                    }}
                    numberOfLines={1}
                  >
                    {lastRoutine.concerns.length
                      ? lastRoutine.concerns.slice(0, 3).join(', ')
                      : formatRelative(lastRoutine.createdAt)}
                  </Text>
                </View>
                <ChevronRight size={20} color={FIGMA.textMuted} strokeWidth={2.2} />
              </Pressable>
            </View>
          ) : null}

          <View>
            <HomeSectionTitle title={ka.modules.skincare.skinTypeLabel} />
            <SkincareTypeList value={skinType} onChange={setSkinType} />
          </View>

          <View>
            <HomeSectionTitle title={ka.modules.skincare.concernsLabel} />
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 13,
                lineHeight: 18,
                color: FIGMA.textSecondary,
                marginBottom: 10,
                marginTop: -4,
              }}
            >
              {ka.modules.skincare.concernsHint}
            </Text>
            <SkincareConcernGrid selected={concerns} onToggle={toggleConcern} />
          </View>

          <View>
            <HomeSectionTitle title={ka.modules.skincare.productsLabel} />
            <TextInput
              value={products}
              onChangeText={setProducts}
              placeholder={ka.modules.skincare.productsPlaceholder}
              placeholderTextColor={FIGMA.textMuted}
              multiline
              textAlignVertical="top"
              inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              style={{
                minHeight: 88,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: FIGMA.border,
                backgroundColor: FIGMA.white,
                padding: 14,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 15,
                lineHeight: 22,
                color: FIGMA.textPrimary,
                ...FIGMA.shadowXs,
              }}
            />
          </View>

          {error ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.danger,
                backgroundColor: colors.dangerBg,
                padding: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.danger,
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          <AuthPrimaryButton
            label={ka.modules.skincare.build}
            loading={busy}
            disabled={concerns.length === 0}
            onPress={() => void build()}
          />

          <Disclaimer />
        </ScrollView>
      )}

      <KeyboardDoneAccessory />

      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
        onUpgrade={() => {
          setQuotaBlock(undefined);
          router.push('/package');
        }}
      />
    </ChatScreenShell>
  );
}

function PreviewTile({ icon: Icon, label }: { icon: typeof Sun; label: string }) {
  const FIGMA = useFigmaChat();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: FIGMA.brandQuaternary,
        borderWidth: 1,
        borderColor: FIGMA.brandBorderLight,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Icon size={16} color={FIGMA.brand} strokeWidth={2.2} />
      <Text
        style={{
          flex: 1,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          lineHeight: 16,
          color: FIGMA.brand,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
