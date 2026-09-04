import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, FileText, ImageIcon, RefreshCw, Sparkles, X, type LucideIcon } from 'lucide-react-native';
import { ChatBubbleAssistant, ChatBubbleUser, ChatTypingBubble } from '@/components/chat/ChatBubble';
import { ChatWidgetCard } from '@/components/chat/ChatExtras';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { ChatTopNav } from '@/components/chat/ChatTopNav';
import { Disclaimer } from '@/components/Disclaimer';
import { LabDateSheet } from '@/components/lab/LabDateSheet';
import { LabAnalyzeDock, LabDecodeStudio } from '@/components/lab/LabDecodeStudio';
import { LabLogRow } from '@/components/lab/LabLogRow';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { ApiError, api, type MedicalRecord } from '@/lib/api';
import { getAnalysisChatProfile, type AnalysisChatKind } from '@/lib/chatUiConfig';
import { IMAGE_PICKER_OPTIONS, toUploadableImage } from '@/lib/imageUpload';
import { formatLabDateKa, mergeLabExtracts, parseLabExtract, stripLabJson } from '@/lib/labExtract';
import { setLabPanelAnalysis, upsertLabPanel } from '@/lib/labStore';
import { usePlanUsage } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';
import type { LabExtract, LabPanel } from '@/types/lab';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_LAB_FILES = 8;

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
  const FIGMA_CHAT = useFigmaChat();
  const router = useRouter();
  const profile = useMemo(() => getAnalysisChatProfile(kind), [kind]);
  const plan = usePlanUsage();
  const { applyUsage } = useAuth();
  const isLab = kind === 'LAB';

  const [files, setFiles] = useState<Picked[]>([]);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [waitIndex, setWaitIndex] = useState(0);
  const [result, setResult] = useState<{
    analysis: string;
    record: MedicalRecord;
    extract?: LabExtract;
    visionNotes?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);
  const [askDate, setAskDate] = useState(false);
  const [pendingExtract, setPendingExtract] = useState<{
    extract: LabExtract;
    analysis: string;
    recordIds: string[];
    visionNotes?: string;
  } | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [savedMeta, setSavedMeta] = useState<{ date: string; count: number } | null>(null);
  const [showAnotherShot, setShowAnotherShot] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const remainingLabel = useMemo(() => {
    if (plan.unlimited) return ka.usage.unlimitedBanner;
    if (plan.exhausted) return ka.usage.exhaustedTitle;
    if (plan.remaining != null) return ka.chat.chatsRemaining(plan.remaining);
    return undefined;
  }, [plan]);

  const acceptMany = useCallback(
    async (assets: Array<{ uri: string; name?: string; fileName?: string; mimeType?: string | null; size?: number | null; fileSize?: number | null }>) => {
      const next: Picked[] = [];
      for (const asset of assets) {
        const file = await toUploadableImage(asset);
        if (file.size && file.size > MAX_BYTES) {
          setError(ka.upload.fileTooLarge);
          continue;
        }
        next.push({ uri: file.uri, name: file.name, mimeType: file.mimeType, isPdf: file.mimeType === 'application/pdf' });
      }
      if (!next.length) return;
      setFiles((prev) => {
        const merged = isLab ? [...prev, ...next].slice(0, MAX_LAB_FILES) : next.slice(0, 1);
        return merged;
      });
      setResult(null);
      setSubmitted(false);
      setSavedMeta(null);
      setError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    },
    [isLab],
  );

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(ka.common.error, ka.upload.permissionDenied);
      return;
    }
    const pickResult = await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS);
    if (pickResult.canceled) return;
    const asset = pickResult.assets[0];
    await acceptMany([asset]);
    if (isLab) setShowAnotherShot(true);
  }, [acceptMany, isLab]);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(ka.common.error, ka.upload.permissionDenied);
      return;
    }
    const pickResult = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_PICKER_OPTIONS,
      allowsMultipleSelection: isLab,
      selectionLimit: isLab ? MAX_LAB_FILES : 1,
    });
    if (pickResult.canceled) return;
    setShowAnotherShot(false);
    await acceptMany(pickResult.assets);
  }, [acceptMany, isLab]);

  const pickPdf = useCallback(async () => {
    const pickResult = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
      multiple: isLab,
    });
    if (pickResult.canceled) return;
    setShowAnotherShot(false);
    acceptMany(
      pickResult.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/pdf',
        size: asset.size,
      })),
    );
  }, [acceptMany, isLab]);

  const persistLab = useCallback(
    async (date: string, extract: LabExtract, analysis: string, recordIds: string[], visionNotes?: string) => {
      const panel: LabPanel = {
        id: `lab-${date}-${Date.now()}`,
        date,
        createdAt: new Date().toISOString(),
        recordIds,
        analysis,
        visionNotes,
        parameters: extract.parameters,
      };
      await upsertLabPanel(panel);
      setSavedMeta({ date, count: extract.parameters.length });
    },
    [],
  );

  const analyze = useCallback(async () => {
    if (!files.length) {
      setError(ka.upload.noFile);
      return;
    }

    const region = bodyRegions?.find((item) => item.id === regionId);
    if (bodyRegions?.length && !region) {
      setError(regionRequired ?? ka.modules.imaging.regionRequired);
      return;
    }

    const creditCost = isLab ? 1 : files.length;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < creditCost) {
      setQuotaBlock(plan.usage?.resetsInMs);
      return;
    }

    setBusy(true);
    setError(null);
    setSubmitted(true);
    setSavedMeta(null);
    setShowAnotherShot(false);
    setWaitIndex(0);
    setStage(isLab ? ka.lab.extractBusy(files.length) : files[0]?.isPdf ? ka.upload.reading : ka.upload.processing);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

    const regionContext = region
      ? `AUTHORITATIVE BODY REGION (stated by the patient; do not override with chest/spine unless landmarks clearly contradict): ${region.en} (${region.ka}).`
      : '';
    const combinedContext = [regionContext, context.trim()].filter(Boolean).join('\n') || undefined;

    try {
      if (isLab) {
        const response = await api.ai.extractLab({
          files: files.map((file) => ({ uri: file.uri, name: file.name, mimeType: file.mimeType })),
          context: combinedContext,
        });
        applyUsage(response.usage);
        const merged = mergeLabExtracts([
          response.labExtract ?? { date: null, parameters: [] },
          parseLabExtract(response.notes),
        ]);
        setResult({
          analysis: '',
          record: response.record,
          extract: merged,
          visionNotes: response.notes,
        });
        if (merged.parameters.length) {
          if (merged.date) {
            await persistLab(merged.date, merged, '', [response.record.id], response.notes);
          } else {
            setPendingExtract({
              extract: merged,
              analysis: '',
              recordIds: [response.record.id],
              visionNotes: response.notes,
            });
            setAskDate(true);
          }
        }
        return;
      }

      const file = files[0];
      setStage(file.isPdf ? ka.upload.reading : ka.upload.processing);
      const response = await api.ai.analyzeImage({
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        kind,
        context: combinedContext,
      });
      applyUsage(response.usage);
      setResult({ analysis: response.analysis, record: response.record });
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      }
      setSubmitted(false);
    } finally {
      setBusy(false);
      setStage('');
    }
  }, [files, context, kind, bodyRegions, regionId, regionRequired, applyUsage, isLab, persistLab, plan]);

  const askMedi = useCallback(async () => {
    const extract = result?.extract ?? pendingExtract?.extract;
    if (!extract?.parameters.length || !result) return;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < 1) {
      setQuotaBlock(plan.usage?.resetsInMs);
      return;
    }

    setExplaining(true);
    setError(null);
    try {
      const response = await api.ai.explainLab({
        parameters: extract.parameters,
        visionNotes: result.visionNotes ?? pendingExtract?.visionNotes,
        date: savedMeta?.date ?? extract.date ?? undefined,
        context: context.trim() || undefined,
        recordId: result.record.id,
      });
      applyUsage(response.usage);
      setResult({ ...result, analysis: response.analysis });
      if (pendingExtract) {
        setPendingExtract({ ...pendingExtract, analysis: response.analysis });
      }
      if (savedMeta?.date) {
        await setLabPanelAnalysis(savedMeta.date, response.analysis);
      }
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      }
    } finally {
      setExplaining(false);
    }
  }, [applyUsage, context, pendingExtract, plan, result, savedMeta]);

  const reset = useCallback(() => {
    setFiles([]);
    setRegionId(null);
    setContext('');
    setResult(null);
    setError(null);
    setSubmitted(false);
    setSavedMeta(null);
    setPendingExtract(null);
    setAskDate(false);
    setShowAnotherShot(false);
    setExplaining(false);
  }, []);

  const userMessage = files.length
    ? files.every((file) => file.isPdf)
      ? files.map((file) => `📄 ${file.name}`).join('\n')
      : files.length > 1
        ? ka.lab.pageOf(files.length, files.length)
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
      footer={
        isLab && !result ? (
          <LabAnalyzeDock
            busy={busy}
            waitIndex={waitIndex}
            total={files.length}
            disabled={busy || !files.length}
            onPress={analyze}
          />
        ) : undefined
      }
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }}
        contentContainerStyle={{ padding: 16, gap: FIGMA_CHAT.messageGap, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          {isLab && !result ? (
            <LabDecodeStudio
              files={files}
              busy={busy}
              waitIndex={waitIndex}
              stage={stage}
              allowPdf={allowPdf}
              context={context}
              contextLabel={contextLabel}
              contextPlaceholder={contextPlaceholder}
              showAnotherShot={showAnotherShot && files.length < MAX_LAB_FILES}
              onCamera={pickFromCamera}
              onGallery={pickFromGallery}
              onPdf={allowPdf ? pickPdf : undefined}
              onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
              onContext={setContext}
              onAnotherShotYes={() => {
                setShowAnotherShot(false);
                void pickFromCamera();
              }}
              onAnotherShotNo={() => setShowAnotherShot(false)}
            />
          ) : (
          <ChatBubbleAssistant icon={icon} timestamp={new Date().toISOString()}>
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textPrimary, fontWeight: '600' }}>{uploadTitle}</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textSecondary }}>{uploadHint}</Text>
            <ChatWidgetCard>
              {files.length ? (
                <FilePreview
                  files={files}
                  multi={false}
                  onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
                  onAddCamera={pickFromCamera}
                  onAddGallery={pickFromGallery}
                />
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
                          <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? FIGMA_CHAT.textOnBrand : FIGMA_CHAT.textSecondary }}>
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
                disabled={busy || !files.length || Boolean(bodyRegions?.length && !regionId)}
                style={{
                  backgroundColor: FIGMA_CHAT.brand,
                  borderRadius: 12,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: busy || !files.length || Boolean(bodyRegions?.length && !regionId) ? 0.55 : 1,
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Sparkles size={18} color="#fff" strokeWidth={2.2} />}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{busy ? stage || ka.common.analyzing : ka.common.analyze}</Text>
              </Pressable>
            </ChatWidgetCard>
          </ChatBubbleAssistant>
          )}

          {submitted && files.length && !isLab ? (
            <ChatBubbleUser content={userMessage} timestamp={new Date().toISOString()} userInitials="M" />
          ) : null}

          {busy && !isLab ? <ChatTypingBubble icon={icon} /> : null}

          {result ? (
            isLab ? (
              <View
                style={{
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: FIGMA_CHAT.border,
                  backgroundColor: FIGMA_CHAT.white,
                  padding: 16,
                  gap: 12,
                }}
              >
                {savedMeta ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: FIGMA_CHAT.textPrimary }}>
                    {ka.lab.savedOn(formatLabDateKa(savedMeta.date), savedMeta.count)}
                  </Text>
                ) : result.extract?.parameters.length ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: FIGMA_CHAT.textPrimary }}>
                    {ka.lab.extractedTitle}
                  </Text>
                ) : (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: FIGMA_CHAT.textSecondary }}>{ka.lab.noParams}</Text>
                )}
                {(result.extract?.parameters ?? []).map((row) => (
                  <LabLogRow
                    key={row.key}
                    title={`${row.nameKa || row.nameEn}  ${row.display} ${row.unit}`.trim()}
                    subtitle={row.unit || row.nameEn}
                    flag={row.flag}
                    onPress={() => {
                      if (savedMeta) router.push(`/lab/param/${encodeURIComponent(row.key)}` as never);
                    }}
                  />
                ))}
                {result.analysis ? (
                  <Markdown content={stripLabJson(result.analysis)} />
                ) : result.extract?.parameters.length ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA_CHAT.textSecondary }}>
                      {ka.lab.askMediHint}
                    </Text>
                    <Pressable
                      onPress={() => void askMedi()}
                      disabled={explaining}
                      style={{
                        backgroundColor: FIGMA_CHAT.brand,
                        borderRadius: 16,
                        minHeight: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        opacity: explaining ? 0.55 : 1,
                      }}
                    >
                      {explaining ? <ActivityIndicator color="#fff" /> : <Sparkles size={18} color="#fff" strokeWidth={2.2} />}
                      <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
                        {explaining ? ka.lab.askMediBusy : ka.lab.askMedi}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => router.push((savedMeta ? `/lab/${savedMeta.date}` : '/lab') as never)}
                  style={{
                    backgroundColor: result.analysis || !result.extract?.parameters.length ? FIGMA_CHAT.brand : FIGMA_CHAT.white,
                    borderRadius: 16,
                    minHeight: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: result.analysis || !result.extract?.parameters.length ? 0 : 1,
                    borderColor: FIGMA_CHAT.brand,
                  }}
                >
                  <Text
                    style={{
                      color: result.analysis || !result.extract?.parameters.length ? '#fff' : FIGMA_CHAT.brand,
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 15,
                    }}
                  >
                    {ka.lab.openLab}
                  </Text>
                </Pressable>
                <Pressable onPress={reset} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
                  <RefreshCw size={16} color={FIGMA_CHAT.brand} strokeWidth={2.2} />
                  <Text style={{ fontSize: 14, fontFamily: 'NotoSansGeorgian_600SemiBold', color: FIGMA_CHAT.brand }}>{ka.chat.newAnalysis}</Text>
                </Pressable>
              </View>
            ) : (
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
            )
          ) : null}

          {error ? (
            <View style={{ padding: 12, borderRadius: 16, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}>
              <Text style={{ fontSize: 14, color: '#DC2626' }}>{error}</Text>
            </View>
          ) : null}

          <Disclaimer />
      </ScrollView>

      <LabDateSheet
        visible={askDate}
        onClose={() => {
          if (pendingExtract) return;
          setAskDate(false);
        }}
        onConfirm={async (ymd) => {
          if (!pendingExtract) {
            setAskDate(false);
            return;
          }
          await persistLab(
            ymd,
            pendingExtract.extract,
            pendingExtract.analysis,
            pendingExtract.recordIds,
            pendingExtract.visionNotes,
          );
          setPendingExtract(null);
          setAskDate(false);
        }}
      />

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

function FilePreview({
  files,
  onRemove,
  onAddCamera,
  onAddGallery,
}: {
  files: Picked[];
  multi: boolean;
  onRemove: (index: number) => void;
  onAddCamera?: () => void;
  onAddGallery?: () => void;
}) {
  const FIGMA_CHAT = useFigmaChat();
  const picked = files[0];
  if (!picked) return null;
  return (
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
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          {onAddCamera ? (
            <Pressable onPress={onAddCamera} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Camera size={16} color={FIGMA_CHAT.brand} strokeWidth={2.4} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: FIGMA_CHAT.brand }}>{ka.upload.fromCamera}</Text>
            </Pressable>
          ) : null}
          {onAddGallery ? (
            <Pressable onPress={onAddGallery} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ImageIcon size={16} color={FIGMA_CHAT.brand} strokeWidth={2.4} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: FIGMA_CHAT.brand }}>{ka.upload.fromGallery}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onRemove(0)} hitSlop={8}>
            <X size={18} color={FIGMA_CHAT.textMuted} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>
  );
}

function SourceButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const FIGMA_CHAT = useFigmaChat();
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
