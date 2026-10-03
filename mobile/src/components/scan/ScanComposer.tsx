import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowUp, Camera, FileText, ImageIcon, Sparkles, X } from 'lucide-react-native';
import { useChatKeyboardOpen } from '@/components/chat/ChatScreenShell';
import { ANALYSIS_CONTEXT_LIMIT, CHAT_MESSAGE_LIMIT } from '@/lib/analysisFlow';
import type { ScanFile, ScanKind } from '@/lib/scanThread';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { scanKindInfo } from './scanKinds';

type Region = { id: string; ka: string; en: string };

/**
 * One input for everything MEDISCAN reads. The choice (lab · imaging · skin) sits on top of the
 * capsule; attach a photo or PDF, add a note, read it. With nothing attached, the same field asks a
 * question about the latest result.
 */
export function ScanComposer({
  kinds, kind, onKind, files, onRemoveFile, onCamera, onGallery, onPdf, regions, regionId, onRegion,
  text, onText, onSubmit, canAsk, busy, preparing, showChoice,
}: {
  kinds: readonly ScanKind[]; kind: ScanKind; onKind: (kind: ScanKind) => void;
  files: ScanFile[]; onRemoveFile: (index: number) => void;
  onCamera: () => void; onGallery: () => void; onPdf: (() => void) | null;
  regions: Region[] | null; regionId: string | null; onRegion: (id: string) => void;
  text: string; onText: (text: string) => void; onSubmit: () => void;
  canAsk: boolean; busy: boolean; preparing: boolean;
  /** The welcome screen already shows the choice as cards; the composer shows it once the chat has started. */
  showChoice: boolean;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useChatKeyboardOpen();
  const ink = dark ? MODULE_BRANDS.scan.ink.dark : MODULE_BRANDS.scan.ink.light;
  const amber = '#D97706';
  const reading = files.length > 0;
  const needsRegion = reading && !!regions?.length && !regionId;
  const trimmed = text.trim();
  const canSend = !busy && !preparing && (reading ? !needsRegion : canAsk && trimmed.length >= 2 && trimmed.length <= CHAT_MESSAGE_LIMIT);
  const info = scanKindInfo(kind);
  const placeholder = reading ? tx('დაამატე შენიშვნა (არასავალდებულო)…', 'Add a note (optional)…')
    : canAsk ? tx('ჰკითხე ამ შედეგზე…', 'Ask about this result…') : info.note;

  const tool = (label: string, onPress: () => void, node: React.ReactNode) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={busy || preparing}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg200, opacity: busy || preparing ? 0.5 : 1 }}>
      {node}
    </Pressable>
  );

  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 10), backgroundColor: c.bg100 }}>
      <View style={{
        borderRadius: 26, backgroundColor: c.surface, borderWidth: 1, borderColor: reading ? `${ink}88` : c.bg300, padding: 6, gap: 6,
        shadowColor: reading ? amber : '#0F172A', shadowOpacity: reading ? 0.16 : 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3,
      }}>
        {showChoice && kinds.length > 1 ? (
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: c.bg200, borderRadius: 20, padding: 3 }}>
            {kinds.map(k => {
              const on = k === kind;
              const meta = scanKindInfo(k);
              return (
                <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: busy }} onPress={() => onKind(k)} disabled={busy || preparing}
                  style={{ flexGrow: 1, flexBasis: 'auto', paddingHorizontal: 8, height: 36, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? c.surface : 'transparent',
                    shadowColor: '#0F172A', shadowOpacity: on ? 0.08 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: on ? 1 : 0 }}>
                  <meta.icon size={14} color={on ? ink : c.text300} strokeWidth={2} />
                  <Text numberOfLines={1} style={{ color: on ? c.text100 : c.text200, fontSize: 12, fontFamily: on ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular' }}>{meta.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {reading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
            {files.map((file, index) => (
              <View key={`${file.uri}:${index}`} style={{ width: 64, height: 64 }}>
                {file.isPdf ? (
                  <View style={{ flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg200, padding: 4 }}>
                    <FileText size={20} color={ink} />
                    <Text numberOfLines={1} style={{ color: c.text200, fontSize: 9, marginTop: 2 }}>{file.name}</Text>
                  </View>
                ) : (
                  <Image source={{ uri: file.uri }} style={{ flex: 1, borderRadius: 14, backgroundColor: c.bg200 }} resizeMode="cover" />
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={tx('ფაილის წაშლა', 'Remove file')} onPress={() => onRemoveFile(index)} disabled={busy} hitSlop={8}
                  style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.text100 }}>
                  <X size={12} color={c.surface} strokeWidth={3} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {reading && regions?.length ? (
          <View style={{ gap: 6, paddingTop: 2 }}>
            <Text style={{ paddingHorizontal: 8, color: needsRegion ? ink : c.text200, fontSize: 12, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('რომელი ნაწილია გადაღებული?', 'Which part is shown?')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
              {regions.map(region => {
                const on = region.id === regionId;
                return (
                  <Pressable key={region.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onRegion(region.id)} disabled={busy}
                    style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? amber : c.bg200 }}>
                    <Text style={{ color: on ? '#FFFFFF' : c.text100, fontSize: 12.5, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx(region.ka, region.en)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <TextInput
          accessibilityLabel={placeholder}
          value={text}
          onChangeText={onText}
          editable={!busy}
          multiline
          maxLength={reading ? ANALYSIS_CONTEXT_LIMIT : CHAT_MESSAGE_LIMIT}
          placeholder={placeholder}
          placeholderTextColor={c.text300}
          style={{ minHeight: 42, maxHeight: 120, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, color: c.text100, fontSize: 15, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {tool(tx('ფოტოს გადაღება', 'Take a photo'), onCamera, <Camera size={18} color={c.text100} />)}
          {tool(tx('გალერეიდან', 'From gallery'), onGallery, <ImageIcon size={18} color={c.text100} />)}
          {onPdf ? tool(tx('PDF ფაილი', 'PDF file'), onPdf, <FileText size={18} color={c.text100} />) : null}
          <View style={{ flex: 1 }} />
          {preparing ? <ActivityIndicator size="small" color={amber} /> : null}
          {reading ? (
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSend, busy }} onPress={onSubmit} disabled={!canSend}
              style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: canSend || busy ? amber : c.bg200 }}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Sparkles size={16} color={canSend ? '#FFFFFF' : c.text300} />}
              <Text style={{ color: canSend || busy ? '#FFFFFF' : c.text300, fontSize: 13.5, fontFamily: 'NotoSansGeorgian_700Bold' }}>{tx('წაკითხვა', 'Read it')}</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={tx('გაგზავნა', 'Send')} accessibilityState={{ disabled: !canSend, busy }} onPress={onSubmit} disabled={!canSend}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend || busy ? '#0D9488' : c.bg200 }}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ArrowUp size={20} strokeWidth={2.4} color={canSend ? '#FFFFFF' : c.text300} />}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
