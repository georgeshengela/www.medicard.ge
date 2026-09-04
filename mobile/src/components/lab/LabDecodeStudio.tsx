import React, { useEffect } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, FileText, ImageIcon, Sparkles, X, type LucideIcon } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useFigmaChat } from '@/constants/figmaChatLayout';
import { ka } from '@/i18n/ka';
import { useIsDark } from '@/theme/colors';

export type LabStudioFile = { uri: string; name: string; mimeType: string; isPdf: boolean };

type Props = {
  files: LabStudioFile[];
  busy: boolean;
  waitIndex: number;
  stage: string;
  allowPdf?: boolean;
  context: string;
  contextLabel: string;
  contextPlaceholder: string;
  showAnotherShot: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onPdf?: () => void;
  onRemove: (index: number) => void;
  onContext: (value: string) => void;
  onAnotherShotYes: () => void;
  onAnotherShotNo: () => void;
};

export function LabDecodeStudio({
  files,
  busy,
  waitIndex,
  stage,
  allowPdf,
  context,
  contextLabel,
  contextPlaceholder,
  showAnotherShot,
  onCamera,
  onGallery,
  onPdf,
  onRemove,
  onContext,
  onAnotherShotYes,
  onAnotherShotNo,
}: Props) {
  const C = useFigmaChat();
  const dark = useIsDark();
  const cta = dark ? '#0D9488' : '#14B8A6';
  const current = files[Math.min(waitIndex, Math.max(files.length - 1, 0))];
  const progress = files.length ? (busy ? (waitIndex + 0.42) / files.length : files.length ? 0 : 0) : 0;

  return (
    <View
      style={{
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: busy ? C.brand : C.border,
        backgroundColor: C.white,
      }}
    >
      {busy && current ? (
        <ScanTheater file={current} stage={stage} index={waitIndex} total={files.length} progress={progress} />
      ) : files.length ? (
        <ReadyHeader count={files.length} />
      ) : (
        <EmptyHero />
      )}

      <View style={{ padding: 14, gap: 12 }}>
        {files.length ? (
          <PhotoRail files={files} busy={busy} waitIndex={waitIndex} onRemove={onRemove} />
        ) : null}
        {!busy && files.length < 8 ? (
          <SourceRow
            onCamera={onCamera}
            onGallery={onGallery}
            onPdf={allowPdf ? onPdf : undefined}
          />
        ) : null}

        {showAnotherShot && !busy ? (
          <View
            style={{
              borderRadius: 16,
              padding: 12,
              backgroundColor: C.brandQuaternary,
              borderWidth: 1,
              borderColor: C.brandBorderLight,
              gap: 10,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: C.textPrimary }}>
              {ka.lab.anotherShot}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={onAnotherShotYes}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 12,
                  backgroundColor: cta,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>{ka.lab.anotherShotYes}</Text>
              </Pressable>
              <Pressable
                onPress={onAnotherShotNo}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: C.textSecondary, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 }}>
                  {ka.lab.anotherShotNo}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!busy ? (
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: C.textPrimary }}>
              {contextLabel}{' '}
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', color: C.textMuted }}>({ka.common.optional})</Text>
            </Text>
            <TextInput
              value={context}
              onChangeText={onContext}
              placeholder={contextPlaceholder}
              placeholderTextColor={C.textMuted}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 64,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: C.border,
                backgroundColor: C.cardBg,
                padding: 12,
                fontSize: 14,
                lineHeight: 20,
                color: C.textPrimary,
                fontFamily: 'NotoSansGeorgian_400Regular',
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ReadyHeader({ count }: { count: number }) {
  const C = useFigmaChat();
  return (
    <LinearGradient colors={[C.brandQuaternary, C.white]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: C.textPrimary }}>{ka.lab.pagesReady(count)}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
        {ka.lab.studioReady}
      </Text>
    </LinearGradient>
  );
}

function EmptyHero() {
  const C = useFigmaChat();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);
  const frame = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.45, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.98, 1.02]) }],
  }));

  return (
    <LinearGradient colors={[C.brandQuaternary, C.white]} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, alignItems: 'center', gap: 12 }}>
      <Animated.View
        style={[
          {
            width: 88,
            height: 88,
            borderRadius: 28,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: C.brand,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: C.white,
          },
          frame,
        ]}
      >
        <Camera size={32} color={C.brand} strokeWidth={1.8} />
      </Animated.View>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: C.textPrimary, textAlign: 'center' }}>
        {ka.lab.studioEmpty}
      </Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: C.textSecondary, textAlign: 'center' }}>
        {ka.modules.lab.uploadHint}
      </Text>
    </LinearGradient>
  );
}

function ScanTheater({
  file,
  stage,
  index,
  total,
  progress,
}: {
  file: LabStudioFile;
  stage: string;
  index: number;
  total: number;
  progress: number;
}) {
  const C = useFigmaChat();
  const scan = useSharedValue(0);
  const spin = useSharedValue(0);
  useEffect(() => {
    scan.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, false);
    spin.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1, false);
  }, [scan, spin]);
  const beam = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scan.value, [0, 1], [0, 196]) }],
    opacity: interpolate(scan.value, [0, 0.08, 0.85, 1], [0, 1, 1, 0]),
  }));
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const pct = Math.min(99, Math.round(progress * 100));

  return (
    <View style={{ backgroundColor: '#030712', padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#99F6E4', letterSpacing: 0.4 }}>
          {ka.lab.scanLive}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: '#FFFFFF' }}>{pct}%</Text>
      </View>
      <View style={{ height: 200, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111827' }}>
        {file.isPdf ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Animated.View style={ring}>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#14B8A6', borderTopColor: 'transparent' }} />
            </Animated.View>
            <FileText size={28} color="#14B8A6" />
          </View>
        ) : (
          <>
            <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <Animated.View style={[{ position: 'absolute', left: 0, right: 0, height: 28 }, beam]}>
              <LinearGradient colors={['transparent', 'rgba(20,184,166,0.85)', 'transparent']} style={{ flex: 1 }} />
            </Animated.View>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 2, borderColor: 'rgba(20,184,166,0.45)', borderRadius: 18 }} />
          </>
        )}
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: '#1F2937', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#14B8A6', borderRadius: 99 }} />
      </View>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF', textAlign: 'center' }}>
        {stage || ka.lab.uploadingNow}
      </Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: '#D1D5DB', textAlign: 'center' }}>
        {ka.lab.readingPage(index + 1, total)}
      </Text>
    </View>
  );
}

function PhotoRail({
  files,
  busy,
  waitIndex,
  onRemove,
}: {
  files: LabStudioFile[];
  busy: boolean;
  waitIndex: number;
  onRemove: (index: number) => void;
}) {
  const C = useFigmaChat();
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {files.map((file, index) => {
          const status = !busy ? 'idle' : index < waitIndex ? 'done' : index === waitIndex ? 'reading' : 'queued';
          return (
            <View
              key={`${file.uri}-${index}`}
              style={{
                width: '31%',
                aspectRatio: 1,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: C.cardBg,
                borderWidth: 2,
                borderColor: status === 'reading' ? C.brand : status === 'done' ? C.success : C.border,
              }}
            >
              {file.isPdf ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={22} color={C.brand} />
                </View>
              ) : (
                <Image source={{ uri: file.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              )}
              <View
                style={{
                  position: 'absolute',
                  left: 6,
                  top: 6,
                  backgroundColor: 'rgba(3,7,18,0.72)',
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'NotoSansGeorgian_700Bold' }}>{index + 1}</Text>
              </View>
              {status !== 'idle' ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    paddingVertical: 4,
                    backgroundColor: status === 'done' ? 'rgba(34,197,94,0.92)' : status === 'reading' ? 'rgba(20,184,166,0.92)' : 'rgba(17,24,39,0.72)',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                    {status === 'done' ? ka.lab.pageDone : status === 'reading' ? ka.lab.pageReading : ka.lab.pageQueued}
                  </Text>
                </View>
              ) : null}
              {!busy ? (
                <Pressable
                  onPress={() => onRemove(index)}
                  hitSlop={8}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: 'rgba(17,24,39,0.78)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={13} color="#fff" strokeWidth={2.6} />
                </Pressable>
              ) : status === 'done' ? (
                <View style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} color="#fff" strokeWidth={3} />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function SourceRow({
  onCamera,
  onGallery,
  onPdf,
}: {
  onCamera: () => void;
  onGallery: () => void;
  onPdf?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <SourceCard icon={Camera} label={ka.lab.addCamera} onPress={onCamera} tone="primary" />
      <SourceCard icon={ImageIcon} label={ka.lab.addGallery} onPress={onGallery} tone="mint" />
      {onPdf ? <SourceCard icon={FileText} label={ka.lab.addPdf} onPress={onPdf} tone="soft" /> : null}
    </View>
  );
}

function SourceCard({
  icon: Icon,
  label,
  onPress,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone: 'primary' | 'mint' | 'soft';
}) {
  const C = useFigmaChat();
  const dark = useIsDark();
  const filled = tone === 'primary';
  const bg = filled ? (dark ? '#0D9488' : '#14B8A6') : tone === 'mint' ? C.brandQuaternary : C.cardBg;
  const border = filled ? 'transparent' : tone === 'mint' ? C.brandBorderLight : C.border;
  const ink = filled ? '#FFFFFF' : C.brand;
  const well = filled ? 'rgba(255,255,255,0.18)' : C.white;

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 104,
        borderRadius: 18,
        borderWidth: filled ? 0 : 1,
        borderColor: border,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 6,
        ...C.shadowXs,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: well,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={ink} strokeWidth={2} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 12,
          lineHeight: 16,
          color: filled ? '#FFFFFF' : C.textPrimary,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function LabAnalyzeDock({
  busy,
  waitIndex,
  total,
  disabled,
  onPress,
}: {
  busy: boolean;
  waitIndex: number;
  total: number;
  disabled: boolean;
  onPress: () => void;
}) {
  const dark = useIsDark();
  const C = useFigmaChat();
  const insets = useSafeAreaInsets();
  const cta = dark ? '#0D9488' : '#14B8A6';
  const pct = total ? Math.min(99, Math.round(((waitIndex + (busy ? 0.42 : 0)) / total) * 100)) : 0;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: C.cardBg, borderTopWidth: 1, borderTopColor: C.border }}>
      {busy ? (
        <View style={{ height: 4, borderRadius: 99, backgroundColor: C.border, overflow: 'hidden', marginBottom: 10 }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.brand }} />
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled || busy}
        style={{
          backgroundColor: cta,
          borderRadius: 16,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          opacity: disabled || busy ? 0.55 : 1,
        }}
      >
        <Sparkles size={18} color="#fff" />
        <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
          {busy ? ka.lab.extractBusy(Math.max(total, 1)) : ka.lab.extractCta}
        </Text>
      </Pressable>
    </View>
  );
}
