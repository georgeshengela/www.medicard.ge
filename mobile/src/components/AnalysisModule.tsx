import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
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
import { ChatActionDock, ChatFormScroll, ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { ChatTopNav } from '@/components/chat/ChatTopNav';
import { Disclaimer } from '@/components/Disclaimer';
import { LabDateSheet } from '@/components/lab/LabDateSheet';
import { LabAnalyzeDock, LabDecodeStudio } from '@/components/lab/LabDecodeStudio';
import { LabLogRow } from '@/components/lab/LabLogRow';
import { Markdown } from '@/components/ui/Markdown';
import { QuotaSheet } from '@/components/QuotaSheet';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { KeyboardDoneAccessory, KEYBOARD_DONE_ACCESSORY_ID } from '@/components/ui/KeyboardDoneAccessory';
import { ANALYSIS_CONTEXT_LIMIT, requireAnalysisText, IncompleteAnalysisError } from '@/lib/analysisFlow';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { useThemeColors } from '@/theme/colors';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { ka } from '@/i18n/ka';
import { ApiError, api, ensureAiSharingConsentForRequest, type MedicalRecord } from '@/lib/api';
import { getAnalysisChatProfile, type AnalysisChatKind } from '@/lib/chatUiConfig';
import { IMAGE_PICKER_OPTIONS, prepareLabImage, toUploadableImage } from '@/lib/imageUpload';
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

export function AnalysisModule(props: Props) {
  const { user } = useAuth();
  return <AnalysisModuleContent key={`${user?.id ?? 'guest'}:${props.kind}`} {...props} />;
}

function AnalysisModuleContent({
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
  const { user, applyUsage } = useAuth();
  const task = useAnalysisTask(`${user?.id}:${kind}`);
  const colors = useThemeColors();
  const [preparing, setPreparing] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const labBatch = useRef<{ signature: string; next: number; record: MedicalRecord | null; extracts: LabExtract[]; notes: string } | null>(null);
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

  const pick = useCallback(async (source: 'camera' | 'gallery' | 'pdf') => {
    if (busy || explaining || savingDate || (isLab && files.length >= MAX_LAB_FILES)) return;
    const operation = task.begin();
    if (!operation) return;
    setPreparing(true);
    setError(null);
    type Asset = { uri: string; name?: string; fileName?: string | null; mimeType?: string | null; size?: number | null; fileSize?: number | null };
    try {
      let assets: Asset[] = [];
      if (source === 'pdf') {
        const selected = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: isLab });
        if (!operation.current() || selected.canceled) return;
        assets = selected.assets;
      } else {
        // The OS permission request starts directly in the button gesture.
        const permission = await (source === 'camera' ? ImagePicker.requestCameraPermissionsAsync() : ImagePicker.requestMediaLibraryPermissionsAsync());
        if (!operation.current()) return;
        if (!permission.granted) {
          Alert.alert('ფოტოზე წვდომა', ka.upload.permissionDenied, [
            { text: ka.common.cancel, style: 'cancel' },
            { text: 'პარამეტრები', onPress: () => { void Linking.openSettings().catch(() => setError(ka.upload.permissionDenied)); } },
          ]);
          return;
        }
        const selected = await (source === 'camera' ? ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS) : ImagePicker.launchImageLibraryAsync({
          ...IMAGE_PICKER_OPTIONS, allowsMultipleSelection: isLab, selectionLimit: isLab ? MAX_LAB_FILES - files.length : 1,
        }));
        if (!operation.current() || selected.canceled) return;
        assets = selected.assets ?? [];
      }
      const slots = isLab ? MAX_LAB_FILES - files.length : 1;
      const next: Picked[] = [];
      const issues: string[] = [];
      if (assets.length > slots) issues.push('ერთ ჯერზე მაქსიმუმ 8 გვერდი შეგიძლია დაამატო.');
      for (const asset of assets.slice(0, slots)) {
        if (!operation.current()) return;
        try {
          const file = isLab ? await prepareLabImage(asset) : await toUploadableImage(asset);
          if (!operation.current()) return;
          if (file.size != null && file.size > MAX_BYTES) { issues.push(ka.upload.fileTooLarge); continue; }
          if (file.mimeType === 'application/pdf' && !allowPdf) { issues.push('ამ სექციაში ატვირთე ფოტო. PDF გამოიყენე ანალიზების სექციაში.'); continue; }
          next.push({ uri: file.uri, name: file.name, mimeType: file.mimeType, isPdf: file.mimeType === 'application/pdf' });
        } catch { issues.push(ka.upload.prepareFailed); }
      }
      if (!operation.current()) return;
      if (next.length) {
        setFiles(prev => isLab ? [...prev, ...next] : next);
        setResult(null); setSubmitted(false); setSavedMeta(null); setPendingExtract(null);
        setShowAnotherShot(source === 'camera' && isLab);
        labBatch.current = null;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      setError(issues.length ? [...new Set(issues)].join(' ') : null);
    } catch {
      if (operation.current()) setError(ka.upload.prepareFailed);
    } finally {
      if (operation.current()) setPreparing(false);
      operation.finish();
    }
  }, [allowPdf, busy, explaining, files.length, isLab, savingDate, task]);
  const pickFromCamera = () => { void pick('camera'); };
  const pickFromGallery = () => { void pick('gallery'); };
  const pickPdf = () => { void pick('pdf'); };

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

    const operation = task.begin();
    if (!operation) return;
    Keyboard.dismiss();
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
        const signature = JSON.stringify([files.map(file => file.uri), combinedContext]);
        if (labBatch.current?.signature !== signature) labBatch.current = { signature, next: 0, record: null, extracts: [], notes: '' };
        const batch = labBatch.current;
        const extracts = batch.extracts;
        let notes = batch.notes;
        let record = batch.record;
        for (let i = batch.next; i < files.length; i += 1) {
          if (!operation.current()) return;
          const file = files[i];
          setWaitIndex(i);
          setStage(ka.lab.readingPage(i + 1, files.length));
          const response = await api.ai.extractLab({
            files: [{ uri: file.uri, name: file.name, mimeType: file.mimeType }],
            context: combinedContext,
            recordId: record?.id,
            append: i > 0,
          });
          if (!operation.current()) return;
          applyUsage(response.usage);
          record = response.record;
          notes = response.notes;
          if (response.labExtract) extracts.push(response.labExtract);
          extracts.push(parseLabExtract(response.notes));
          batch.next = i + 1; batch.record = record; batch.notes = notes;
        }
        const merged = mergeLabExtracts(extracts);
        const saved = record ?? {
          id: '',
          type: 'LAB' as const,
          imageUrl: null,
          aiAnalysis: notes,
          createdAt: new Date().toISOString(),
        };
        setResult({
          analysis: '',
          record: saved,
          extract: merged,
          visionNotes: notes,
        });
        if (merged.parameters.length) {
          if (merged.date) {
            setPendingExtract({ extract: merged, analysis: '', recordIds: saved.id ? [saved.id] : [], visionNotes: notes });
            await persistLab(merged.date, merged, '', saved.id ? [saved.id] : [], notes);
            if (operation.current()) setPendingExtract(null);
          } else {
            setPendingExtract({
              extract: merged,
              analysis: '',
              recordIds: saved.id ? [saved.id] : [],
              visionNotes: notes,
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
      if (!operation.current()) return;
      const analysis = requireAnalysisText(response.analysis);
      applyUsage(response.usage);
      setResult({ analysis, record: response.record });
    } catch (err) {
      if (!operation.current()) return;
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        const message = (err instanceof ApiError || err instanceof IncompleteAnalysisError) ? err.message : ka.common.error;
        setError(message);
      }
      setSubmitted(false);
    } finally {
      if (operation.current()) { setBusy(false); setStage(''); }
      operation.finish();
    }
  }, [files, context, kind, bodyRegions, regionId, regionRequired, applyUsage, isLab, persistLab, plan, task]);

  const askMedi = useCallback(async () => {
    const extract = result?.extract ?? pendingExtract?.extract;
    if (!extract?.parameters.length || !result) return;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < 1) {
      setQuotaBlock(plan.usage?.resetsInMs);
      return;
    }

    const operation = task.begin();
    if (!operation) return;
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
      if (!operation.current()) return;
      requireAnalysisText(response.analysis);
      applyUsage(response.usage);
      setResult({ ...result, analysis: response.analysis });
      if (pendingExtract) {
        setPendingExtract({ ...pendingExtract, analysis: response.analysis });
      }
      if (savedMeta?.date) {
        await setLabPanelAnalysis(savedMeta.date, response.analysis);
      }
    } catch (err) {
      if (!operation.current()) return;
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs);
        if (err.usage) applyUsage(err.usage);
      } else {
        setError((err instanceof ApiError || err instanceof IncompleteAnalysisError) ? err.message : ka.common.error);
      }
    } finally {
      if (operation.current()) setExplaining(false);
      operation.finish();
    }
  }, [applyUsage, context, pendingExtract, plan, result, savedMeta, task]);

  const reset = useCallback(() => {
    if (busy || explaining || preparing || savingDate) return;
    labBatch.current = null;
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
  }, [busy, explaining, preparing, savingDate]);

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
          onBack={() => router.back()}
          onSettings={() => { void ensureAiSharingConsentForRequest('', 'GET', undefined, true).catch(() => undefined); }}
        />
      }
      footer={
        !result ? isLab ? (
          <LabAnalyzeDock
            busy={busy}
            waitIndex={waitIndex}
            total={files.length}
            disabled={busy || preparing || !files.length}
            onPress={analyze}
          />
        ) : (
          <ChatActionDock>
            <AuthPrimaryButton label={busy ? stage || ka.common.analyzing : ka.common.analyze}
              loading={busy || preparing} disabled={!files.length || Boolean(bodyRegions?.length && !regionId)}
              onPress={() => void analyze()} />
          </ChatActionDock>
        ) : undefined
      }
    >
      <ChatFormScroll
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: FIGMA_CHAT.cardBg }}
        contentContainerStyle={{ padding: 16, gap: FIGMA_CHAT.messageGap, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
          {isLab && !result ? (
            <LabDecodeStudio
              files={files}
              busy={busy || preparing}
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
          ) : !result ? (
          <View style={{ borderRadius: 24, padding: 18, gap: 12, borderWidth: 1, borderColor: FIGMA_CHAT.border, backgroundColor: FIGMA_CHAT.white }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: FIGMA_CHAT.brandQuaternary, alignItems: 'center', justifyContent: 'center' }}>{React.createElement(icon, { size: 24, color: FIGMA_CHAT.brand })}</View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, color: FIGMA_CHAT.textPrimary }}>{uploadTitle}</Text>
            <Text style={{ fontSize: 14, lineHeight: 20, color: FIGMA_CHAT.textSecondary }}>{uploadHint}</Text>
            <View pointerEvents={busy || preparing ? 'none' : 'auto'} style={{ gap: 18, opacity: busy || preparing ? 0.6 : 1 }}>
              {files.length ? (
                <FilePreview
                  files={files}
                  multi={false}
                  onRemove={(index) => { if (!busy && !preparing) setFiles((prev) => prev.filter((_, i) => i !== index)); }}
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
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: FIGMA_CHAT.textPrimary }}>{regionLabel}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {bodyRegions.map((item) => {
                      const selected = regionId === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="radio"
                          disabled={busy || preparing}
                          accessibilityState={{ checked: selected }}
                          onPress={() => {
                            setRegionId(item.id);
                            setError(null);
                          }}
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            borderWidth: 1,
                            borderColor: selected ? FIGMA_CHAT.brand : FIGMA_CHAT.border,
                            backgroundColor: selected ? '#0D9488' : FIGMA_CHAT.cardBg,
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
                  accessibilityLabel={contextLabel}
                  editable={!busy && !preparing}
                  maxLength={ANALYSIS_CONTEXT_LIMIT}
                  inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                  value={context}
                  onChangeText={setContext}
                  placeholder={contextPlaceholder}
                  placeholderTextColor={FIGMA_CHAT.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    minHeight: 88,
                    maxHeight: 132,
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

            </View>
          </View>
          ) : null}

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
                {pendingExtract && !askDate ? <AuthPrimaryButton label="ანალიზის თარიღის არჩევა" onPress={() => { setDateError(null); setAskDate(true); }} /> : null}
                {savedMeta ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: FIGMA_CHAT.textPrimary }}>
                    {ka.lab.savedOn(formatLabDateKa(savedMeta.date), savedMeta.count)}
                  </Text>
                ) : result.extract?.parameters.length ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: FIGMA_CHAT.textPrimary }}>
                    ამოკითხული მაჩვენებლები
                  </Text>
                ) : (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: FIGMA_CHAT.textSecondary }}>{ka.lab.noParams}</Text>
                )}
                {(result.extract?.parameters ?? []).map((row) => (
                  <LabLogRow
                    key={row.key}
                    title={`${row.nameKa || row.nameEn}  ${row.display} ${row.unit}`.trim()}
                    subtitle={row.nameEn}
                    flag={row.flag}
                    onPress={() => {
                      if (savedMeta) router.push(`/lab/param/${encodeURIComponent(row.key)}` as never);
                      else if (pendingExtract) setAskDate(true);
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
                      accessibilityRole="button"
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
                  accessibilityRole="button"
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
                <Pressable disabled={explaining || savingDate} onPress={reset} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
                  <RefreshCw size={16} color={FIGMA_CHAT.brand} strokeWidth={2.2} />
                  <Text style={{ fontSize: 14, fontFamily: 'NotoSansGeorgian_600SemiBold', color: FIGMA_CHAT.brand }}>{ka.chat.newAnalysis}</Text>
                </Pressable>
              </View>
            ) : (
            <ChatBubbleAssistant icon={icon} timestamp={new Date().toISOString()}>
              <View style={{ paddingVertical: 6 }}><Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: FIGMA_CHAT.textPrimary }}>შენი შედეგი</Text></View>
              <Markdown content={result.analysis} />
              <AuthPrimaryButton label="შენახული ჩანაწერის ნახვა" onPress={() => router.push(`/record/${result.record.id}` as never)} />
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
            <View accessibilityLiveRegion="polite" style={{ padding: 14, borderRadius: 16, backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: colors.danger }}>{error}</Text>
            </View>
          ) : null}

          <Disclaimer />
      </ChatFormScroll>
      <KeyboardDoneAccessory />

      <LabDateSheet
        visible={askDate}
        saving={savingDate}
        error={dateError}
        onClose={() => {
          if (savingDate) return;
          setAskDate(false);
        }}
        onConfirm={async (ymd) => {
          if (!pendingExtract || savingDate) return;
          const operation = task.begin();
          if (!operation) return;
          setSavingDate(true); setDateError(null);
          try {
            await persistLab(ymd, pendingExtract.extract, pendingExtract.analysis, pendingExtract.recordIds, pendingExtract.visionNotes);
            if (!operation.current()) return;
            setPendingExtract(null); setAskDate(false);
          } catch {
            if (operation.current()) setDateError('თარიღი ვერ შეინახა. შედეგი შენარჩუნებულია — სცადე ხელახლა.');
          } finally {
            if (operation.current()) setSavingDate(false);
            operation.finish();
          }
        }}
      />

      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
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
          <Image source={{ uri: picked.uri }} style={{ width: '100%', height: 180, borderRadius: 8 }} resizeMode="contain" />
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
          <Pressable accessibilityRole="button" accessibilityLabel="ფოტოს წაშლა" onPress={() => onRemove(0)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
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
      accessibilityRole="button"
      accessibilityLabel={label}
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
