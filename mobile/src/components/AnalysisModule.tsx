import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Camera, FileText, ImageIcon, RefreshCw, Sparkles, X, type LucideIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Markdown } from '@/components/ui/Markdown';
import { Disclaimer } from '@/components/Disclaimer';
import { QuotaSheet } from '@/components/QuotaSheet';
import { UsageBanner } from '@/components/UsageBanner';
import { ka } from '@/i18n/ka';
import { ApiError, api, type MedicalRecord } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

const MAX_BYTES = 12 * 1024 * 1024;

type Picked = { uri: string; name: string; mimeType: string; isPdf: boolean };

type Props = {
  kind: 'LAB' | 'IMAGING' | 'SKIN';
  icon: LucideIcon;
  uploadTitle: string;
  uploadHint: string;
  contextLabel: string;
  contextPlaceholder: string;
  allowPdf?: boolean;
};

export function AnalysisModule({
  kind,
  icon: Icon,
  uploadTitle,
  uploadHint,
  contextLabel,
  contextPlaceholder,
  allowPdf = false,
}: Props) {
  const { applyUsage } = useAuth();
  const colors = useThemeColors();

  const [picked, setPicked] = useState<Picked | null>(null);
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>('');
  const [result, setResult] = useState<{ analysis: string; record: MedicalRecord } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  const accept = useCallback((asset: { uri: string; name: string; mimeType?: string | null; size?: number | null }) => {
    if (asset.size && asset.size > MAX_BYTES) {
      setError(ka.upload.fileTooLarge);
      return;
    }
    const mimeType = asset.mimeType ?? guessMime(asset.name);
    setPicked({ uri: asset.uri, name: asset.name, mimeType, isPdf: mimeType === 'application/pdf' });
    setResult(null);
    setError(null);
  }, []);

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(ka.common.error, ka.upload.permissionDenied);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, exif: false });
    if (result.canceled) return;

    const asset = result.assets[0];
    accept({
      uri: asset.uri,
      name: asset.fileName ?? `medicard-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
    });
  }, [accept]);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(ka.common.error, ka.upload.permissionDenied);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, exif: false });
    if (result.canceled) return;

    const asset = result.assets[0];
    accept({
      uri: asset.uri,
      name: asset.fileName ?? `medicard-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
    });
  }, [accept]);

  const pickPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;

    const asset = result.assets[0];
    accept({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf', size: asset.size });
  }, [accept]);

  const analyze = useCallback(async () => {
    if (!picked) {
      setError(ka.upload.noFile);
      return;
    }

    setBusy(true);
    setError(null);
    setStage(picked.isPdf ? ka.upload.reading : ka.upload.processing);

    // The reasoning pass dominates the wall-clock time, so advance the label once
    // the extraction step has plausibly finished rather than leaving it stuck.
    const stageTimer = setTimeout(() => setStage(ka.upload.reasoning), 6000);

    try {
      const response = await api.ai.analyzeImage({
        uri: picked.uri,
        name: picked.name,
        mimeType: picked.mimeType,
        kind,
        context: context.trim() || undefined,
      });

      setResult({ analysis: response.analysis, record: response.record });
      applyUsage(response.usage);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      }
    } finally {
      clearTimeout(stageTimer);
      setBusy(false);
      setStage('');
    }
  }, [picked, context, kind, applyUsage]);

  const reset = useCallback(() => {
    setPicked(null);
    setContext('');
    setResult(null);
    setError(null);
  }, []);

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
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-state-successBg">
                  <Sparkles size={17} color={colors.success} strokeWidth={2.2} />
                </View>
                <Text className="ml-2.5 flex-1 text-lg font-bold text-text-100">დასკვნა მზადაა</Text>
              </View>
              <Markdown content={result.analysis} />
            </Card>

            <Disclaimer className="mt-4" />

            <View className="mt-4">
              <Button label="ახალი ანალიზი" icon={RefreshCw} variant="secondary" onPress={reset} />
            </View>
          </View>
        ) : (
          <>
            <Card className="mt-4">
              <View className="mb-1 flex-row items-center">
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-100/50">
                  <Icon size={17} color={colors.primary200} strokeWidth={2.2} />
                </View>
                <Text className="ml-2.5 flex-1 text-base font-bold text-text-100">{uploadTitle}</Text>
              </View>
              <Text className="mb-4 text-sm text-text-300">{uploadHint}</Text>

              {picked ? (
                <View className="overflow-hidden rounded-2xl border border-bg-300 bg-bg-200">
                  {picked.isPdf ? (
                    <View className="flex-row items-center p-4">
                      <FileText size={22} color={colors.primary200} strokeWidth={2} />
                      <Text numberOfLines={1} className="ml-3 flex-1 text-base font-semibold text-text-100">
                        {picked.name}
                      </Text>
                    </View>
                  ) : (
                    <Image source={{ uri: picked.uri }} className="h-56 w-full" resizeMode="cover" />
                  )}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={ka.upload.change}
                    hitSlop={8}
                    onPress={() => setPicked(null)}
                    className="absolute right-2.5 top-2.5 h-8 w-8 items-center justify-center rounded-full border border-bg-300 bg-surface"
                  >
                    <X size={16} color={colors.text200} strokeWidth={2.4} />
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row">
                  <SourceButton icon={Camera} label={ka.upload.fromCamera} onPress={pickFromCamera} />
                  <View className="w-2.5" />
                  <SourceButton icon={ImageIcon} label={ka.upload.fromGallery} onPress={pickFromGallery} />
                  {allowPdf ? (
                    <>
                      <View className="w-2.5" />
                      <SourceButton icon={FileText} label={ka.upload.fromFiles} onPress={pickPdf} />
                    </>
                  ) : null}
                </View>
              )}
            </Card>

            <Card className="mt-3">
              <Text className="mb-1.5 text-sm font-semibold text-text-200">
                {contextLabel} <Text className="font-normal text-text-300">({ka.common.optional})</Text>
              </Text>
              <TextInput
                value={context}
                onChangeText={setContext}
                placeholder={contextPlaceholder}
                placeholderTextColor={colors.text300}
                multiline
                textAlignVertical="top"
                className="min-h-[84px] rounded-xl border border-bg-300 bg-bg-100 p-3 text-base text-text-100"
                style={{ fontSize: 15, lineHeight: 21 }}
              />
            </Card>

            {error ? (
              <View className="mt-3 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
                <Text className="text-sm text-state-danger">{error}</Text>
              </View>
            ) : null}

            {busy ? (
              <Card className="mt-3">
                <View className="flex-row items-center">
                  <ActivityIndicator color={colors.primary200} />
                  <Text className="ml-3 text-base text-text-200">{stage || ka.common.analyzing}</Text>
                </View>
              </Card>
            ) : null}

            <View className="mt-4">
              <Button
                label={busy ? ka.common.analyzing : ka.common.analyze}
                icon={Sparkles}
                size="lg"
                loading={busy}
                disabled={!picked}
                onPress={analyze}
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

function SourceButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 items-center rounded-2xl border border-dashed border-primary-300/40 bg-bg-200 px-2 py-5 active:opacity-70"
    >
      <Icon size={22} color={colors.primary200} strokeWidth={1.9} />
      <Text className="mt-2 text-center text-xs font-semibold text-text-200">{label}</Text>
    </Pressable>
  );
}

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
