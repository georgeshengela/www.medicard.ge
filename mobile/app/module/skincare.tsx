import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { RefreshCw, Sparkles } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Markdown } from '@/components/ui/Markdown';
import { Disclaimer } from '@/components/Disclaimer';
import { QuotaSheet } from '@/components/QuotaSheet';
import { UsageBanner } from '@/components/PlanUsageCard';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

export default function SkincareModule() {
  const { applyUsage } = useAuth();
  const colors = useThemeColors();

  const [skinType, setSkinType] = useState<string>(ka.modules.skincare.skinTypes[0]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [products, setProducts] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  const toggleConcern = (concern: string) => {
    setConcerns((prev) =>
      prev.includes(concern) ? prev.filter((c) => c !== concern) : prev.length < 10 ? [...prev, concern] : prev,
    );
  };

  const build = async () => {
    if (concerns.length === 0) {
      setError('აირჩიეთ მინიმუმ ერთი პრობლემა');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Age comes from the registered birth date, so the form no longer asks for it.
      const response = await api.ai.skincare({
        skinType,
        concerns,
        currentProducts: products.trim() || undefined,
      });
      setResult(response.analysis);
      applyUsage(response.usage);
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
    <>
      <ScrollView
        className="flex-1 bg-bg-100"
        contentContainerClassName="px-4 pb-12 pt-3"
        keyboardShouldPersistTaps="handled"
      >
        <UsageBanner compact />

        {result ? (
          <View className="mt-4">
            <Card>
              <View className="mb-3 flex-row items-center">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-100/50">
                  <Sparkles size={17} color={colors.primary200} strokeWidth={2.2} />
                </View>
                <Text className="ml-2.5 flex-1 text-lg font-bold text-text-100">თქვენი რუტინა</Text>
              </View>
              <Markdown content={result} />
            </Card>

            <Disclaimer className="mt-4" />

            <View className="mt-4">
              <Button
                label="ახალი რუტინა"
                icon={RefreshCw}
                variant="secondary"
                onPress={() => {
                  setResult(null);
                  setConcerns([]);
                }}
              />
            </View>
          </View>
        ) : (
          <>
            <Card className="mt-4">
              <Text className="mb-2.5 text-sm font-semibold text-text-200">{ka.modules.skincare.skinTypeLabel}</Text>
              <View className="flex-row flex-wrap">
                {ka.modules.skincare.skinTypes.map((type) => (
                  <Chip key={type} label={type} selected={skinType === type} onPress={() => setSkinType(type)} />
                ))}
              </View>
            </Card>

            <Card className="mt-3">
              <Text className="text-sm font-semibold text-text-200">{ka.modules.skincare.concernsLabel}</Text>
              <Text className="mb-2.5 text-xs text-text-300">{ka.modules.skincare.concernsHint}</Text>
              <View className="flex-row flex-wrap">
                {ka.modules.skincare.concerns.map((concern) => (
                  <Chip
                    key={concern}
                    label={concern}
                    selected={concerns.includes(concern)}
                    onPress={() => toggleConcern(concern)}
                  />
                ))}
              </View>
            </Card>

            <Card className="mt-3">
              <Text className="mb-1.5 text-sm font-semibold text-text-200">
                {ka.modules.skincare.productsLabel}{' '}
                <Text className="font-normal text-text-300">({ka.common.optional})</Text>
              </Text>
              <TextInput
                value={products}
                onChangeText={setProducts}
                placeholder={ka.modules.skincare.productsPlaceholder}
                placeholderTextColor={colors.text300}
                multiline
                textAlignVertical="top"
                className="min-h-[76px] rounded-xl border border-bg-300 bg-bg-100 p-3 text-base text-text-100"
                style={{ fontSize: 15, lineHeight: 21 }}
              />
            </Card>

            {error ? (
              <View className="mt-3 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
                <Text className="text-sm text-state-danger">{error}</Text>
              </View>
            ) : null}

            <View className="mt-4">
              <Button
                label={busy ? ka.common.analyzing : ka.modules.skincare.build}
                icon={Sparkles}
                size="lg"
                loading={busy}
                disabled={concerns.length === 0}
                onPress={build}
              />
            </View>

            <Disclaimer className="mt-4" />
          </>
        )}
      </ScrollView>

      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
        onUpgrade={() => {
          setQuotaBlock(undefined);
          Alert.alert(ka.usage.upsellTitle, ka.usage.premiumSoon);
        }}
      />
    </>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={`mb-2 mr-2 rounded-full border px-3.5 py-2 active:opacity-70 ${
        selected ? 'border-primary-200 bg-primary-200' : 'border-bg-300 bg-bg-100'
      }`}
    >
      <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-text-200'}`}>{label}</Text>
    </Pressable>
  );
}
