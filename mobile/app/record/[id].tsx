import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Markdown } from '@/components/ui/Markdown';
import { Disclaimer } from '@/components/Disclaimer';
import { ka } from '@/i18n/ka';
import { ApiError, absoluteUrl, api, type MedicalRecord } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useThemeColors } from '@/theme/colors';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();

  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.records
      .get(id)
      .then((response) => setRecord(response.record))
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error));
  }, [id]);

  const imageUrl = absoluteUrl(record?.imageUrl ?? null);
  const isPdf = record?.imageUrl?.endsWith('.pdf');

  return (
    <>
      <Stack.Screen options={{ title: record ? ka.records.types[record.type] ?? record.type : ka.common.loading }} />

      <ScrollView className="flex-1 bg-bg-100" contentContainerClassName="px-4 pb-12 pt-3">
        {error ? (
          <View className="rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
            <Text className="text-sm text-state-danger">{error}</Text>
          </View>
        ) : !record ? (
          <View className="items-center py-16">
            <ActivityIndicator color={colors.primary200} />
          </View>
        ) : (
          <>
            <View className="mb-3 flex-row items-center">
              <Badge label={ka.records.types[record.type] ?? record.type} tone="brand" />
              <Text className="ml-2.5 text-sm text-text-300">{formatDateTime(record.createdAt)}</Text>
            </View>

            {imageUrl && !isPdf ? (
              <Image
                source={{ uri: imageUrl }}
                className="mb-3 h-60 w-full rounded-2xl border border-bg-300"
                resizeMode="cover"
              />
            ) : null}

            <Card>
              <Markdown content={record.aiAnalysis} />
            </Card>

            <Disclaimer className="mt-4" />
          </>
        )}
      </ScrollView>
    </>
  );
}
