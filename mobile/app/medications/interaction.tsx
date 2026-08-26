import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export default function MedicationInteractionScreen() {
  const { applyUsage } = useAuth();
  const [review, setReview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  const runReview = async () => {
    setBusy(true);
    try {
      const response = await api.ai.medicationReview();
      setReview(response.analysis);
      applyUsage(response.usage);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        Alert.alert(ka.common.error, err instanceof ApiError ? err.message : ka.common.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: ka.meds.reviewTitle }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: FIGMA_MEDS.brandQuaternary,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: FIGMA_MEDS.brandBorder,
            alignItems: 'center',
          }}
        >
          <ShieldCheck size={48} color={FIGMA_MEDS.brand} strokeWidth={2} />
          <Text style={{ marginTop: 16, fontSize: 20, fontWeight: '900', color: FIGMA_MEDS.textPrimary, textAlign: 'center' }}>
            {ka.meds.interactionScreenTitle}
          </Text>
          <Text style={{ marginTop: 8, color: FIGMA_MEDS.textSecondary, textAlign: 'center', lineHeight: 22 }}>
            {ka.meds.interactionScreenBody}
          </Text>
          <View style={{ marginTop: 20, width: '100%' }}>
            <Button label={ka.meds.reviewCta} icon={ShieldCheck} loading={busy} onPress={runReview} />
          </View>
        </View>

        {review ? (
          <View
            style={{
              marginTop: 20,
              backgroundColor: '#fff',
              borderRadius: 24,
              padding: 18,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: FIGMA_MEDS.textPrimary, marginBottom: 12 }}>
              {ka.meds.reviewTitle}
            </Text>
            <Markdown content={review} />
          </View>
        ) : null}
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
