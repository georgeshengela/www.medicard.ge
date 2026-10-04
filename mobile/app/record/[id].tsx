import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2 } from 'lucide-react-native';
import { recordLook } from '@/components/records/recordTypes';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { Disclaimer } from '@/components/Disclaimer';
import { useMedilab } from '@/components/lab/MedilabUI';
import { Markdown } from '@/components/ui/Markdown';
import { DetailCardSkeleton } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError, API_BASE_URL, api, type MedicalRecord } from '@/lib/api';
import { useAuthImageSource } from '@/lib/authImageCache';
import { formatDateTime } from '@/lib/format';
import { localAccountId } from '@/lib/localAccount';
import { privateFileImageSource } from '@/lib/privateFile';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { getToken } from '@/lib/storage';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

/** A saved report in MEDILAB: what it is and when, the photo if there is one, then Medi's reading. */
export default function RecordDetail() {
  const M = useMedilab();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const error = !record && query.isError ? (query.error instanceof ApiError ? query.error.message : ka.common.error) : null;

  // Android's <Image> drops the Authorization header — show an authorised cached download instead.
  const imageSource = useAuthImageSource(privateFileImageSource(record?.imageUrl ?? null, token, API_BASE_URL), localAccountId());
  const isPdf = record?.imageUrl?.toLowerCase().endsWith('.pdf');
  const typeName = record ? ka.records.types[record.type] ?? record.type : ka.records.title;
  const look = record ? recordLook(record.type) : null;

  // Deleting a medical record is permanent, so the detail page asks first (the list uses swipe + undo).
  const confirmDelete = () => {
    if (!record) return;
    Alert.alert(ka.records.deleteConfirm, undefined, [
      { text: ka.common.cancel, style: 'cancel' },
      {
        text: ka.common.delete,
        style: 'destructive',
        onPress: () => {
          queryClient.setQueryData<MedicalRecord[]>(accountKey('records', 'list'), (prev) => prev?.filter((r) => r.id !== record.id));
          void api.records.remove(record.id).catch(() => undefined);
          router.back();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.c.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, paddingHorizontal: HUB.gutter }}
        showsVerticalScrollIndicator={false}
      >
        <ModuleHeader
          module="lab"
          subtitle={tx('შენახული დასკვნა', 'Saved report')}
          right={record ? <ModuleHeaderButton label={ka.common.delete} icon={Trash2} onPress={confirmDelete} /> : undefined}
        />

        <View style={{ marginTop: 20 }}>
          {error ? (
            <View style={[s.card, { backgroundColor: M.c.surface, padding: HUB.cardPad }]}>
              <Text style={[hubText.body, { color: M.attention }]}>{error}</Text>
            </View>
          ) : !record || !look ? (
            <DetailCardSkeleton />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <View style={[s.tile, { backgroundColor: hubTint(hubInk(look.ink, M.dark), M.dark) }]}>
                  <look.icon size={20} color={hubInk(look.ink, M.dark)} strokeWidth={1.9} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={[hubText.sectionTitle, { color: M.c.text100 }]}>{look.title()}</Text>
                  <Text numberOfLines={1} style={[hubText.caption, { color: M.c.text300 }]}>{formatDateTime(record.createdAt)}</Text>
                </View>
              </View>

              {imageSource && !isPdf ? (
                <Image source={imageSource} resizeMode="cover" accessibilityIgnoresInvertColors style={s.photo} />
              ) : null}

              <View style={[s.card, { backgroundColor: M.c.surface, padding: HUB.cardPad }]}>
                <Text style={[hubText.link, { color: M.ink, marginBottom: 6 }]}>{tx('Medi-ს დასკვნა', "Medi's reading")}</Text>
                <Markdown content={record.aiAnalysis} />
              </View>

              <Disclaimer className="mt-4" />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: 240, borderRadius: HUB.cardRadius, marginBottom: 16 },
});
