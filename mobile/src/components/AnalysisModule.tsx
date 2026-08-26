import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, FileText, ImageIcon, RefreshCw, Sparkles, X, type LucideIcon } from 'lucide-react-native';
import { ChatBubbleAssistant, ChatBubbleUser, ChatTypingBubble } from '@/components/chat/ChatBubble';
import { ChatWidgetCard } from '@/components/chat/ChatExtras';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { ChatTopNav } from '@/components/chat/ChatTopNav';
import { Disclaimer } from '@/components/Disclaimer';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { FIGMA_CHAT } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api, type MedicalRecord } from '@/lib/api';
import { getAnalysisChatProfile, type AnalysisChatKind } from '@/lib/chatUiConfig';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';

const MAX_BYTES = 12 * 1024 * 1024;

type Picked = { uri: string; name: string; mimeType: string; isPdf: boolean };
type BodyRegion = { id: string; ka: string; en: string };

type Props = {
  kind: AnalysisChatKind;
  icon: LucideIcon;
  uploadTitle: string;
  uploadHint: string;
  contextLabel: string;
  contextPlaceholder: string;
  allowPdf?: boolean;
  bodyRegions?: BodyRegion[];
  regionLabel?: string;
  regionRequired?: string;
};

export function AnalysisModule({
  kind,
  icon,
  uploadTitle,
  uploadHint,
  contextLabel,
  contextPlaceholder,
  allowPdf = false,
  bodyRegions,
  regionLabel,
  regionRequired,
}: Props) {
  const router = useRouter();
  const profile = useMemo(() => getAnalysisChatProfile(kind), [kind]);
  const plan = usePlanUsage();
  const { applyUsage } = useAuth();

  const [picked, setPicked] = useState<Picked | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState<{ analysis: string; record: MedicalRecord } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const remainingLabel = useMemo(() => {
    if (plan.unlimited) return ka.usage.unlimitedBanner;
    if (plan.exhausted) return ka.usage.exhaustedTitle;
    if (plan.remaining != null) return ka.chat.chatsRemaining(plan.remaining);
    return undefined;
  }, [plan]);

  const accept = useCallback((asset: { uri: string; name: string; mimeType?: string | null; size?: number | null }) => {
    if (asset.size && asset.size > MAX_BYTES) {
      setError(ka.upload.fileTooLarge);
      return;
    }
    const mimeType = asset.mimeType ?? guessMime(asset.name);
    setPicked({ uri: asset.uri, name: asset.name, mimeType, isPdf: mimeType === 'application/pdf' });
    setResult(null);
    setSubmitted(false);
    setError(null);
  }, []);

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(ka.common.error, ka.upload.permissionDenied);
      return;
    }
    const pickResult = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, exif: false });
    if (pickResult.canceled) return;
    const asset = pickResult.assets[0];
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
    const pickResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, exif: false });
    if (pickResult.canceled) return;
    const asset = pickResult.assets[0];
    accept({
      uri: asset.uri,
      name: asset.fileName ?? `medicard-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
    });
  }, [accept]);

  const pickPdf = useCallback(async () => {
    const pickResult = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (pickResult.canceled) return;
    const asset = pickResult.assets[0];
    accept({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf', size: asset.size });
  }, [accept]);

  const analyze = useCallback(async () => {
    if (!picked) {
      setError(ka.upload.noFile);
      return;
    }

    const region = bodyRegions?.find((item) => item.id === regionId);
    if (bodyRegions?.length && !region) {
      setError(regionRequired ?? ka.modules.imaging.regionRequired);
      return;
    }

    setBusy(true);
    setError(null);
    setSubmitted(true);
    setStage(picked.isPdf ? ka.upload.reading : ka.upload.processing);

    const stageTimer = setTimeout(() => setStage(ka.upload.reasoning), 6000);

    const regionContext = region
      ? `AUTHORITATIVE BODY REGION (stated by the patient; do not override with chest/spine unless landmarks clearly contradict): ${region.en} (${region.ka}).`
      : '';
    const combinedContext = [regionContext, context.trim()].filter(Boolean).join('\n') || undefined;

    try {
      const response = await api.ai.analyzeImage({
        uri: picked.uri,
        name: picked.name,
        mimeType: picked.mimeType,
        kind,
        context: combinedContext,
      });

      setResult({ analysis: response.analysis, record: response.record });
      applyUsage(response.usage);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
      } else {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      }
      setSubmitted(false);
    } finally {
      clearTimeout(stageTimer);
      setBusy(false);
      setStage('');
    }
  }, [picked, context, kind, bodyRegions, regionId, regionRequired, applyUsage]);

  const reset = useCallback(() => {
    setPicked(null);
    setRegionId(null);
    setContext('');
    setResult(null);
    setError(null);
    setSubmitted(false);
  }, []);

  const userMessage = picked
    ? picked.isPdf
      ? `📄 ${picked.name}`
      : ka.chat.analysisUploadSent
    : '';

  return (
    <ChatScreenShell
      header={
        <ChatTopNav
          title={profile.title}
          subtitle={profile.subtitle}
          icon={icon}
          remainingLabel={remainingLabel}
          onBack={() => router.back()}
          onSettings={() => router.push('/package' as never)}
        />
      }
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }}
        contentContainerStyle={{ padding: 16, gap: FIGMA_CHAT.messageGap, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          <ChatBubbleAssistant icon={icon} timestamp={new Date().toISOString()}>
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textPrimary, fontWeight: '600' }}>{uploadTitle}</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textSecondary }}>{uploadHint}</Text>
            <ChatWidgetCard>
              {picked ? (
                <View style={{ gap: 12 }}>
                  {picked.isPdf ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <FileText size={22} color={FIGMA_CHAT.brand} strokeWidth={2} />
                      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: FIGMA_CHAT.textPrimary }} numberOfLines={2}>
                        {picked.name}
                      </Text>
                    </View>
                  ) : (
                    <Image source={{ uri: picked.uri }} style={{ width: '100%', height: 180, borderRadius: 8 }} resizeMode="cover" />
                  )}
                  <Pressable onPress={() => setPicked(null)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
                    <X size={18} color={FIGMA_CHAT.textMuted} strokeWidth={2.4} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <SourceButton icon={Camera} label={ka.upload.fromCamera} onPress={pickFromCamera} />
                  <SourceButton icon={ImageIcon} label={ka.upload.fromGallery} onPress={pickFromGallery} />
                  {allowPdf ? <SourceButton icon={FileText} label={ka.upload.fromFiles} onPress={pickPdf} /> : null}
                </View>
              )}

              {bodyRegions?.length ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_CHAT.textPrimary }}>{regionLabel}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {bodyRegions.map((item) => {
                      const selected = regionId === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => {
                            setRegionId(item.id);
                            setError(null);
                          }}
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderWidth: 1,
                            borderColor: selected ? FIGMA_CHAT.brand : FIGMA_CHAT.border,
                            backgroundColor: selected ? FIGMA_CHAT.brand : FIGMA_CHAT.white,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? FIGMA_CHAT.white : FIGMA_CHAT.textSecondary }}>
                            {item.ka}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_CHAT.textPrimary }}>
                  {contextLabel}{' '}
                  <Text style={{ fontWeight: '400', color: FIGMA_CHAT.textMuted }}>({ka.common.optional})</Text>
                </Text>
                <TextInput
                  value={context}
                  onChangeText={setContext}
                  placeholder={contextPlaceholder}
                  placeholderTextColor={FIGMA_CHAT.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={{
                    minHeight: 72,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: FIGMA_CHAT.border,
                    backgroundColor: FIGMA_CHAT.white,
                    padding: 12,
                    fontSize: 14,
                    lineHeight: 20,
                    color: FIGMA_CHAT.textPrimary,
                  }}
                />
              </View>

              <Pressable
                onPress={analyze}
                disabled={busy || !picked || Boolean(bodyRegions?.length && !regionId)}
                style={{
                  backgroundColor: FIGMA_CHAT.brand,
                  borderRadius: 12,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: busy || !picked || Boolean(bodyRegions?.length && !regionId) ? 0.55 : 1,
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Sparkles size={18} color="#fff" strokeWidth={2.2} />}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{busy ? stage || ka.common.analyzing : ka.common.analyze}</Text>
              </Pressable>
            </ChatWidgetCard>
          </ChatBubbleAssistant>

          {submitted && picked ? (
            <ChatBubbleUser content={userMessage} timestamp={new Date().toISOString()} userInitials="M" />
          ) : null}

          {busy ? <ChatTypingBubble icon={icon} /> : null}

          {result ? (
            <ChatBubbleAssistant icon={icon} timestamp={new Date().toISOString()}>
              <Markdown content={result.analysis} />
              <Pressable
                onPress={reset}
                style={{
                  marginTop: 8,
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 6,
                }}
              >
                <RefreshCw size={16} color={FIGMA_CHAT.brand} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_CHAT.brand }}>{ka.chat.newAnalysis}</Text>
              </Pressable>
            </ChatBubbleAssistant>
          ) : null}

          {error ? (
            <View style={{ padding: 12, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}>
              <Text style={{ fontSize: 14, color: '#DC2626' }}>{error}</Text>
            </View>
          ) : null}

          <Disclaimer />
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
    </ChatScreenShell>
  );
}

function SourceButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: FIGMA_CHAT.brandBorderLight,
        backgroundColor: FIGMA_CHAT.white,
        paddingHorizontal: 8,
        paddingVertical: 16,
      }}
    >
      <Icon size={22} color={FIGMA_CHAT.brand} strokeWidth={1.9} />
      <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '600', color: FIGMA_CHAT.textSecondary, textAlign: 'center' }}>{label}</Text>
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
