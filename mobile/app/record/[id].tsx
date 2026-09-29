import React, { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Markdown } from '@/components/ui/Markdown';
import { Disclaimer } from '@/components/Disclaimer';
import { DetailCardSkeleton } from '@/components/ui/Skeleton';
import { ka } from '@/i18n/ka';
import { ApiError, API_BASE_URL, api, type MedicalRecord } from '@/lib/api';
import { getToken } from '@/lib/storage';
import { privateFileImageSource } from '@/lib/privateFile';
import { useAuthImageSource } from '@/lib/authImageCache';
import { localAccountId } from '@/lib/localAccount';
import { formatDateTime } from '@/lib/format';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { FRESH } from '@/lib/queryClient';

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    void getToken().then(setToken);
  }, []);

  // A saved record does not change by itself; deleting it writes /api/records (invalidates 'records').
  const query = useAccountQuery<MedicalRecord>({
    key: ['records', 'detail', id],
    fetch: async () => (await api.records.get(String(id))).record,
    staleTime: FRESH.SHORT,
    enabled: Boolean(id),
  });
  const record = query.data ?? null;
  const error =
    !record && query.isError ? (query.error instanceof ApiError ? query.error.message : ka.common.error) : null;

  // Android's <Image> drops the Authorization header — show an authorised cached download instead.
  const imageSource = useAuthImageSource(privateFileImageSource(record?.imageUrl ?? null, token, API_BASE_URL), localAccountId());
  const isPdf = record?.imageUrl?.toLowerCase().endsWith('.pdf');

  return (
    <>
      <Stack.Screen options={{ title: record ? ka.records.types[record.type] ?? record.type : ka.records.title }} />

      <ScrollView className="flex-1 bg-bg-100" contentContainerClassName="px-4 pb-12 pt-3">
        {error ? (
          <View className="rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
            <Text className="text-sm text-state-danger">{error}</Text>
          </View>
        ) : !record ? (
          <DetailCardSkeleton />
        ) : (
          <>
            <View className="mb-3 flex-row items-center">
              <Badge label={ka.records.types[record.type] ?? record.type} tone="brand" />
              <Text className="ml-2.5 text-sm text-text-300">{formatDateTime(record.createdAt)}</Text>
            </View>

            {imageSource && !isPdf ? (
              <Image
                source={imageSource}
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
