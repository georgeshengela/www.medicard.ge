import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Keyboard, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldAlert, ShieldCheck, SquarePen } from 'lucide-react-native';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { ChatScreenShell } from '@/components/chat/ChatScreenShell';
import { LabDateSheet } from '@/components/lab/LabDateSheet';
import { AnswerTurn } from '@/components/medi/MediTurns';
import { QuotaSheet } from '@/components/QuotaSheet';
import { AiConsentDeclinedNote } from '@/components/ui/AiConsentDeclinedNote';
import { isAiConsentDeclined } from '@/lib/aiConsentDecline';
import { streamAiQuery } from '@/lib/aiQueryStream';
import { IncompleteAnalysisError, requireAnalysisText } from '@/lib/analysisFlow';
import { ApiError, api, type MedicalRecord } from '@/lib/api';
import { useFeatureState, isFeatureOn } from '@/lib/featureFlags';
import { IMAGE_PICKER_OPTIONS, prepareLabImage, toUploadableImage } from '@/lib/imageUpload';
import { mergeLabExtracts, parseLabExtract } from '@/lib/labExtract';
import { setLabPanelAnalysis, upsertLabPanel } from '@/lib/labStore';
import { requestPhotoLibraryAccess } from '@/lib/photoLibraryAccess';
import { usePlanUsage } from '@/lib/planUsage';
import { canAskAboutResult, labPagesNotice, latestResultContext, readLabPages, SCAN_FEATURE, SCAN_KINDS, scanTurnId, type ScanFile, type ScanKind, type ScanTurn } from '@/lib/scanThread';
import { useAnalysisTask } from '@/lib/useAnalysisTask';
import { useAuth } from '@/store/AuthContext';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ScanComposer } from './ScanComposer';
import { scanKindInfo } from './scanKinds';
import { LabTurn, ResultTurn, ScanProgress, UploadTurn } from './ScanTurns';
import { ScanLens } from './ScanLens';

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_LAB_FILES = 8;
type Declined = { what: 'read' } | { what: 'explain'; turnId: string } | { what: 'ask'; text: string };

/**
 * MEDISCAN (owner 2026-10-03): one chat that reads lab results, imaging and skin photos, with the
 * choice on the composer. A question typed after a result goes to Medi's clinical model with that
 * result as context. Rules in src/lib/scanThread.ts.
 */
export function ScanChat({ owner, initialKind }: { owner: string; initialKind: ScanKind | null }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flags = useFeatureState();
  const { applyUsage } = useAuth();
  const plan = usePlanUsage();
  const task = useAnalysisTask(`${owner}:scan`);
  const recordsOn = isFeatureOn('records', flags);
  const kinds = SCAN_KINDS.filter(k => isFeatureOn(SCAN_FEATURE[k], flags));

  const [kind, setKind] = useState<ScanKind>(initialKind && kinds.includes(initialKind) ? initialKind : kinds[0] ?? 'LAB');
  const [turns, setTurns] = useState<ScanTurn[]>([]);
  const [files, setFiles] = useState<ScanFile[]>([]);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [explaining, setExplaining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState<Declined | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);
  const [dateFor, setDateFor] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState(false), [dateError, setDateError] = useState<string | null>(null);

  const turnsRef = useRef<ScanTurn[]>([]); turnsRef.current = turns;
  const doctorSession = useRef<string | undefined>(undefined);
  const list = useRef<FlatList<ScanTurn>>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // A choice the admin paused while the screen was open falls back to one that is on.
  useEffect(() => { if (kinds.length && !kinds.includes(kind)) setKind(kinds[0]); }, [kinds, kind]);

  const info = scanKindInfo(kind);
  const isLab = kind === 'LAB';
  const regions = kind === 'IMAGING' ? [...ka.modules.imaging.regions] : null;
  const ink = dark ? MODULE_BRANDS.scan.ink.dark : MODULE_BRANDS.scan.ink.light;
  const scrollToEnd = () => requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
  const patch = (id: string, next: Partial<ScanTurn>) => setTurns(t => t.map(turn => (turn.id === id ? ({ ...turn, ...next } as ScanTurn) : turn)));

  function chooseKind(next: ScanKind) {
    if (next === kind) return;
    setKind(next); setFiles([]); setRegionId(null); setError(null); setDeclined(null);
    void Haptics.selectionAsync().catch(() => undefined);
  }

  const pick = useCallback(async (source: 'camera' | 'gallery' | 'pdf') => {
    if (busy || preparing || (isLab && files.length >= MAX_LAB_FILES)) return;
    const operation = task.begin();
    if (!operation) return;
    setPreparing(true); setError(null); setDeclined(null);
    type Asset = { uri: string; name?: string; fileName?: string | null; mimeType?: string | null; size?: number | null; fileSize?: number | null };
    try {
      let assets: Asset[] = [];
      if (source === 'pdf') {
        const selected = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: true });
        if (!operation.current() || selected.canceled) return;
        assets = selected.assets;
      } else {
        // The OS permission request starts directly in the button gesture.
        const permission = await (source === 'camera' ? ImagePicker.requestCameraPermissionsAsync() : requestPhotoLibraryAccess());
        if (!operation.current()) return;
        if (!permission.granted) {
          Alert.alert(tx('ფოტოზე წვდომა', 'Photo access'), ka.upload.permissionDenied, [
            { text: ka.common.cancel, style: 'cancel' },
            { text: tx('პარამეტრები', 'Settings'), onPress: () => { void Linking.openSettings().catch(() => setError(ka.upload.permissionDenied)); } },
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
      const next: ScanFile[] = [];
      const issues: string[] = [];
      if (assets.length > slots) issues.push(tx('ერთ ჯერზე მაქსიმუმ 8 გვერდი შეგიძლია დაამატო.', 'You can add up to 8 pages at a time.'));
      for (const asset of assets.slice(0, slots)) {
        if (!operation.current()) return;
        try {
          // Lab sheets and imaging are read by the AI (2400 px); skin photos cap at 1600 px.
          const file = isLab || kind === 'IMAGING' ? await prepareLabImage(asset) : await toUploadableImage(asset);
          if (!operation.current()) return;
          if (file.size != null && file.size > MAX_BYTES) { issues.push(ka.upload.fileTooLarge); continue; }
          if (file.mimeType === 'application/pdf' && !isLab) { issues.push(tx('PDF მხოლოდ ანალიზებისთვისაა. აქ ფოტო ატვირთე.', 'PDFs are for lab results only. Upload a photo here.')); continue; }
          next.push({ uri: file.uri, name: file.name, mimeType: file.mimeType, isPdf: file.mimeType === 'application/pdf' });
        } catch { issues.push(ka.upload.prepareFailed); }
      }
      if (!operation.current()) return;
      if (next.length) {
        setFiles(prev => (isLab ? [...prev, ...next] : next));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      setError(issues.length ? [...new Set(issues)].join(' ') : null);
    } catch {
      if (operation.current()) setError(ka.upload.prepareFailed);
    } finally {
      if (operation.current()) setPreparing(false);
      operation.finish();
    }
  }, [busy, preparing, files.length, isLab, kind, task]);

  async function persistLab(date: string, turn: Extract<ScanTurn, { kind: 'lab' }>) {
    await upsertLabPanel({
      id: `lab-${date}-${Date.now()}`, date, createdAt: new Date().toISOString(), recordIds: turn.recordId ? [turn.recordId] : [],
      analysis: turn.analysis ?? '', visionNotes: turn.visionNotes, parameters: turn.extract.parameters,
    });
    patch(turn.id, { savedDate: date });
  }

  /** Read the attached files with the chosen kind. Nothing is sent before this tap. */
  async function read() {
    if (!files.length || busy) return;
    const region = regions?.find(r => r.id === regionId);
    if (regions?.length && !region) { setError(ka.modules.imaging.regionRequired); return; }
    const cost = isLab ? 1 : files.length;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < cost) { setQuotaBlock(plan.usage?.resetsInMs); return; }
    const operation = task.begin();
    if (!operation) return;
    Keyboard.dismiss(); setError(null); setDeclined(null);
    const note = text.trim();
    const sent = files, scan = kind;
    const upload: ScanTurn = { id: scanTurnId(), kind: 'upload', scan, files: sent, note, region: region ? tx(region.ka, region.en) : undefined };
    setTurns(t => [...t, upload]); setFiles([]); setText(''); setRegionId(null); scrollToEnd();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    const regionContext = region ? `AUTHORITATIVE BODY REGION (stated by the patient; do not override with chest/spine unless landmarks clearly contradict): ${region.en} (${region.ka}).` : '';
    const context = [regionContext, note].filter(Boolean).join('\n') || undefined;
    try {
      if (scan === 'LAB') {
        // An unreadable first page no longer fails the read: the next readable page starts the record.
        const read = await readLabPages(sent.length, async (i, recordId) => {
          setBusy(sent.length > 1 ? ka.lab.readingPage(i + 1, sent.length) : ka.lab.extractBusy(1));
          const response = await api.ai.extractLab({ files: [{ uri: sent[i].uri, name: sent[i].name, mimeType: sent[i].mimeType }], context, recordId, append: !!recordId });
          if (operation.current()) applyUsage(response.usage);
          return response;
        }, operation.current);
        if (!read || !operation.current()) return;
        const last = read.answers[read.answers.length - 1];
        const record: MedicalRecord = last.record;
        const notes = last.notes;
        const extracts = read.answers.flatMap(response => [...(response.labExtract ? [response.labExtract] : []), parseLabExtract(response.notes)]);
        const merged = mergeLabExtracts(extracts);
        const labTurn: Extract<ScanTurn, { kind: 'lab' }> = { id: scanTurnId(), kind: 'lab', extract: merged, recordId: record.id, visionNotes: notes, note };
        setTurns(t => [...t, labTurn]);
        if (merged.parameters.length && merged.date) await persistLab(merged.date, labTurn).catch(() => undefined);
        else if (merged.parameters.length) setDateFor(labTurn.id);
        // Pages the reader could not look at right now wait in the composer for the same photo again.
        if (read.laterPages.length && operation.current()) setFiles(sent.filter((_, i) => read.laterPages.includes(i + 1)));
        const pagesNotice = labPagesNotice(read.unreadPages, read.laterPages);
        if (pagesNotice && operation.current()) setError(pagesNotice);
      } else {
        setBusy(scan === 'SKIN' ? tx('ფოტოს ვაკვირდები…', 'Looking at the photo…') : tx('გამოსახულებას ვკითხულობ…', 'Reading the image…'));
        const file = sent[0];
        const response = await api.ai.analyzeImage({ uri: file.uri, name: file.name, mimeType: file.mimeType, kind: scan, context });
        if (!operation.current()) return;
        const analysis = requireAnalysisText(response.analysis);
        applyUsage(response.usage);
        setTurns(t => [...t, { id: scanTurnId(), kind: 'result', scan, text: analysis, recordId: response.record.id, region: upload.kind === 'upload' ? upload.region : undefined }]);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      scrollToEnd();
    } catch (err) {
      if (!operation.current()) return;
      // Nothing is lost: the files, note and region go back to the composer for another try.
      setTurns(t => t.filter(turn => turn.id !== upload.id));
      setFiles(sent); setText(note); setKind(scan); if (region) setRegionId(region.id);
      if (isAiConsentDeclined(err)) setDeclined({ what: 'read' });
      else if (err instanceof ApiError && err.isQuotaExceeded) { setQuotaBlock(err.usage?.resetsInMs); if (err.usage) applyUsage(err.usage); }
      else setError(err instanceof ApiError || err instanceof IncompleteAnalysisError ? err.message : ka.common.error);
    } finally {
      if (operation.current()) setBusy(null);
      operation.finish();
    }
  }

  async function explain(turnId: string) {
    const turn = turnsRef.current.find(t => t.id === turnId);
    if (!turn || turn.kind !== 'lab' || !turn.extract.parameters.length || explaining) return;
    if (!plan.unlimited && plan.remaining != null && plan.remaining < 1) { setQuotaBlock(plan.usage?.resetsInMs); return; }
    const operation = task.begin();
    if (!operation) return;
    setExplaining(turnId); setError(null); setDeclined(null);
    try {
      const response = await api.ai.explainLab({ parameters: turn.extract.parameters, visionNotes: turn.visionNotes, date: turn.savedDate ?? turn.extract.date ?? undefined, context: turn.note || undefined, recordId: turn.recordId || undefined });
      if (!operation.current()) return;
      requireAnalysisText(response.analysis);
      applyUsage(response.usage);
      patch(turnId, { analysis: response.analysis });
      if (turn.savedDate) await setLabPanelAnalysis(turn.savedDate, response.analysis).catch(() => undefined);
      scrollToEnd();
    } catch (err) {
      if (!operation.current()) return;
      if (isAiConsentDeclined(err)) setDeclined({ what: 'explain', turnId });
      else if (err instanceof ApiError && err.isQuotaExceeded) { setQuotaBlock(err.usage?.resetsInMs); if (err.usage) applyUsage(err.usage); }
      else setError(err instanceof ApiError || err instanceof IncompleteAnalysisError ? err.message : ka.common.error);
    } finally {
      if (operation.current()) setExplaining(null);
      operation.finish();
    }
  }

  /** A question about the latest result: Medi's clinical model answers with that result as context. */
  async function ask(value = text) {
    const question = value.trim();
    const context = latestResultContext(turnsRef.current);
    if (question.length < 2 || !context || busy) return;
    const operation = task.begin();
    if (!operation) return;
    Keyboard.dismiss(); setError(null); setDeclined(null); setText('');
    const q: ScanTurn = { id: scanTurnId(), kind: 'question', text: question };
    const slot: ScanTurn = { id: scanTurnId(), kind: 'answer', text: '', streaming: true };
    setTurns(t => [...t, q, slot]); setBusy(tx('პასუხს ვწერ…', 'Writing the answer…')); scrollToEnd();
    let buffer = '', timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => { timer = null; const extra = buffer; buffer = ''; if (extra && operation.current()) setTurns(t => t.map(turn => (turn.id === slot.id && turn.kind === 'answer' ? { ...turn, text: turn.text + extra } : turn))); };
    try {
      const response = await streamAiQuery({ message: question, mode: 'DOCTOR', sessionId: doctorSession.current, context },
        { onDelta: (chunk: string) => { if (!operation.current()) return; buffer += chunk; if (!timer) timer = setTimeout(flush, 40); } });
      if (!operation.current()) return;
      if (timer) clearTimeout(timer);
      requireAnalysisText(response.answer);
      doctorSession.current = response.sessionId;
      patch(slot.id, { text: response.answer, streaming: false, interactionId: response.interactionId } as Partial<ScanTurn>);
      if (response.usage) applyUsage(response.usage);
      // A health answer counts for the weekly Medi mission, which the server does not announce on the socket.
      void import('@/lib/quest/cache').then(({ requestQuestRefresh }) => requestQuestRefresh()).catch(() => undefined);
      scrollToEnd();
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (!operation.current()) return;
      setTurns(t => t.filter(turn => turn.id !== q.id && turn.id !== slot.id));
      setText(current => (current.trim() ? current : question));
      if (isAiConsentDeclined(err)) setDeclined({ what: 'ask', text: question });
      else if (err instanceof ApiError && err.isQuotaExceeded) { setQuotaBlock(err.usage?.resetsInMs); if (err.usage) applyUsage(err.usage); }
      else setError(err instanceof ApiError || err instanceof IncompleteAnalysisError ? err.message : ka.common.error);
    } finally {
      if (operation.current()) setBusy(null);
      operation.finish();
    }
  }

  async function rate(id: string, interactionId: string | undefined, rating: 1 | -1) {
    if (!interactionId) return;
    patch(id, { feedbackRating: rating } as Partial<ScanTurn>);
    try { await api.ai.feedback({ interactionId, rating }); }
    catch { if (alive.current) patch(id, { feedbackRating: undefined } as Partial<ScanTurn>); }
  }

  function reset() {
    if (busy || explaining) return;
    setTurns([]); setFiles([]); setText(''); setRegionId(null); setError(null); setDeclined(null); doctorSession.current = undefined;
  }

  const canAsk = canAskAboutResult(turns);
  const renderTurn = ({ item }: { item: ScanTurn }) => {
    if (item.kind === 'upload') return <UploadTurn scan={item.scan} files={item.files} note={item.note} region={item.region} />;
    if (item.kind === 'result') return <ResultTurn scan={item.scan} text={item.text} onOpenRecord={recordsOn && item.recordId ? () => router.push(`/record/${item.recordId}` as never) : null} />;
    if (item.kind === 'lab') {
      return <LabTurn parameters={item.extract.parameters} savedDate={item.savedDate} analysis={item.analysis} explaining={explaining === item.id}
        onChooseDate={() => { setDateError(null); setDateFor(item.id); }} onExplain={() => void explain(item.id)}
        onOpenParam={item.savedDate ? key => router.push(`/lab/param/${encodeURIComponent(key)}` as never) : null}
        onOpenLab={() => router.push((item.savedDate ? `/lab/${item.savedDate}` : '/lab') as never)} />;
    }
    if (item.kind === 'question') {
      return (
        <View style={{ alignItems: 'flex-end', paddingLeft: 48 }}>
          <View style={{ backgroundColor: dark ? '#134E4A' : '#DDF3EF', borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 15, paddingVertical: 10 }}>
            <Text selectable style={{ color: dark ? '#E6FFFA' : '#0B3B37', fontSize: 15, lineHeight: 24, fontFamily: 'NotoSansGeorgian_400Regular' }}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return <AnswerTurn text={item.text} deep={false} streaming={item.streaming} interactionId={item.interactionId} feedbackRating={item.feedbackRating} onRate={r => void rate(item.id, item.interactionId, r)} />;
  };

  const header = (
    <View style={{ paddingTop: insets.top, backgroundColor: c.bg100 }}>
      <View style={{ height: 60, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('უკან დაბრუნება', 'Go back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home' as never))}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={c.text100} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
          <ModuleWordmark module="scan" size={25} />
          <Text numberOfLines={1} style={{ marginTop: -2, color: c.text200, fontSize: 11, lineHeight: 15, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tx('ანალიზები, გამოსახულება და კანი', 'Lab tests, imaging and skin')}</Text>
        </View>
        {turns.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tx('ახალი შემოწმება', 'New check')} onPress={reset} disabled={!!busy}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><SquarePen size={20} color={c.text200} /></Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={tx('AI და კონფიდენციალურობა', 'AI and privacy')} onPress={() => router.push('/profile/ai-data' as never)}
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={20} color={c.text200} /></Pressable>
      </View>
    </View>
  );

  const welcome = (
    <View style={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 12, gap: 22 }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <ScanLens scanning={!!busy || preparing} />
        <View style={{ alignItems: 'center', gap: 6, paddingHorizontal: 12 }}>
          <Text style={{ color: c.text100, fontSize: 23, lineHeight: 32, textAlign: 'center', fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('რა წავიკითხოთ?', 'What shall we read?')}</Text>
          <Text style={{ color: c.text200, fontSize: 14, lineHeight: 22, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular', maxWidth: 310 }}>
            {tx('აირჩიე, გადაიღე ან ატვირთე — წაგიკითხავ და აგიხსნი. მერე შეგიძლია შეკითხვაც დამისვა.', 'Choose, take a photo or upload — I read it and explain. Then ask me anything about it.')}
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {kinds.map(k => {
          const meta = scanKindInfo(k);
          const on = k === kind;
          return (
            <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => chooseKind(k)}
              style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1.5, borderColor: on ? ink : 'transparent' }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${ink}${dark ? '26' : '17'}` }}>
                <meta.icon size={20} color={ink} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: c.text100, fontSize: 15, lineHeight: 22, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{meta.label}</Text>
                <Text style={{ color: c.text300, fontSize: 12.5, lineHeight: 18, fontFamily: 'NotoSansGeorgian_400Regular' }}>{meta.hint}</Text>
              </View>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? ink : c.bg300, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ink }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const footer = (
    <View style={{ gap: 14, paddingTop: turns.length ? 18 : 0 }}>
      {busy && turns.at(-1)?.kind !== 'answer' ? <ScanProgress label={busy} /> : null}
      {declined && !error ? (
        <AiConsentDeclinedNote busy={!!busy} onRetry={() => void (declined.what === 'explain' ? explain(declined.turnId) : declined.what === 'ask' ? ask(declined.text) : read())} />
      ) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 13, lineHeight: 21, fontFamily: 'NotoSansGeorgian_400Regular' }}>{error}</Text> : null}
      {turns.some(t => t.kind !== 'upload') ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingLeft: 2 }}>
          <ShieldAlert size={14} color={c.text300} style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, color: c.text300, fontSize: 12, lineHeight: 18, fontFamily: 'NotoSansGeorgian_400Regular' }}>{ka.app.disclaimer}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!kinds.length) {
    return (
      <ChatScreenShell style={{ backgroundColor: c.bg100 }} header={header}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: c.text200, fontSize: 14, lineHeight: 22, textAlign: 'center', fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {tx('MEDISCAN დროებით შეჩერებულია.', 'MEDISCAN is paused for now.')}
          </Text>
        </View>
      </ChatScreenShell>
    );
  }

  return (
    <>
      <ChatScreenShell style={{ backgroundColor: c.bg100 }} header={header}
        footer={<ScanComposer kinds={kinds} kind={kind} onKind={chooseKind} files={files} onRemoveFile={i => setFiles(prev => prev.filter((_, j) => j !== i))}
          onCamera={() => void pick('camera')} onGallery={() => void pick('gallery')} onPdf={isLab ? () => void pick('pdf') : null}
          regions={regions} regionId={regionId} onRegion={id => { setRegionId(id); setError(null); }}
          text={text} onText={setText} onSubmit={() => void (files.length ? read() : ask())} canAsk={canAsk} busy={!!busy} preparing={preparing} showChoice={turns.length > 0} />}>
        <FlatList
          ref={list}
          data={turns}
          keyExtractor={item => item.id}
          renderItem={renderTurn}
          style={{ flex: 1, backgroundColor: c.bg100 }}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
          ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={false}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={welcome}
          ListFooterComponent={turns.length ? footer : error || declined ? <View style={{ paddingTop: 8 }}>{footer}</View> : null}
        />
      </ChatScreenShell>
      <LabDateSheet
        visible={dateFor !== null}
        saving={savingDate}
        error={dateError}
        onClose={() => { if (!savingDate) setDateFor(null); }}
        onConfirm={async ymd => {
          const turn = turnsRef.current.find(t => t.id === dateFor);
          if (!turn || turn.kind !== 'lab' || savingDate) return;
          setSavingDate(true); setDateError(null);
          try { await persistLab(ymd, turn); setDateFor(null); }
          catch { setDateError(tx('თარიღი ვერ შეინახა. შედეგი შენარჩუნებულია — სცადე ხელახლა.', 'Couldn’t save the date. Your result is kept — please try again.')); }
          finally { setSavingDate(false); }
        }}
      />
      <QuotaSheet visible={quotaBlock !== undefined} resetsInMs={quotaBlock} onClose={() => setQuotaBlock(undefined)} />
    </>
  );
}
