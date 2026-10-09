import React, { useEffect, useRef, useState } from 'react';
import { useMedifood } from "./ProgramUI";
import { AccessibilityInfo, Animated, AppState, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, Focus, ImagePlus, MessageSquareText, ScanBarcode, ScanLine, ScanText, Search, ShieldCheck, Sun } from 'lucide-react-native';
import type { LogMethod } from './LogMethodSheet';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

type Props = {
  photoUri?: string;
  scanning: boolean;
  disabled: boolean;
  enabled: boolean;
  /** Nutrition-facts label mode: the photo is a printed table, not a dish. */
  label?: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onMore?: () => void;
  /** One tap per way to log (gallery is `onGallery`); without it the row falls back to `onMore`. */
  onMethod?: (method: LogMethod) => void;
};

/** „რას მიირთმევ?“ hero — the plate as a night diorama with a glowing route (owner pick 2026-10-09, brand/medifood/hero). */
const SCAN_HERO = require('../../../assets/art/medifood/scan-hero.jpg');

/** The beam shows activity only, never fabricated recognition/progress. */
export function NutritionScanner({ photoUri, scanning, disabled, enabled, label = false, onCamera, onGallery, onMore, onMethod }: Props) {
  const c = useThemeColors();
  const M = useMedifood();
  const { width } = useWindowDimensions();
  const height = Math.min(320, Math.max(230, width * 0.78));
  const breathe = useRef(new Animated.Value(0)).current;
  const motion = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const preference = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const app = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => { mounted = false; preference.remove(); app.remove(); };
  }, []);
  useEffect(() => {
    motion.setValue(0);
    if (!scanning || reduceMotion || !foreground) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(motion, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(motion, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scanning, reduceMotion, foreground, motion]);
  useEffect(() => {
    breathe.setValue(0);
    if (photoUri || scanning || reduceMotion || !foreground) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [photoUri, scanning, reduceMotion, foreground, breathe]);
  const txt = { color: c.text100, fontFamily: 'NotoSansGeorgian_400Regular' };
  const actionsDisabled = disabled || !enabled;
  return (
    <View style={{ gap: 16 }} testID="nutrition-scanner">
      <View style={s.intro}>
        <View style={[s.eyebrow, { backgroundColor: c.accent100 }]}>
          <ScanLine size={15} color={c.primary100} />
          <Text style={[s.brand, { color: c.primary100 }]}>{label ? tx('MEDIFOOD · ეტიკეტი', 'MEDIFOOD · label') : 'MEDIFOOD'}</Text>
        </View>
        <Text accessibilityRole="header" style={[txt, s.heading]}>{label ? (photoUri ? tx('ეტიკეტი შერჩეულია', 'Label selected') : tx('გადაიღე Nutrition Facts', 'Snap the Nutrition Facts')) : photoUri ? tx('შენი კერძი, უფრო გასაგებად', 'Your meal, made clearer') : tx('რას მიირთმევ?', 'What are you eating?')}</Text>
        <Text style={[txt, s.subtitle, { color: c.text200 }]}>
          {label
            ? tx('ცხრილიდან მნიშვნელობებს წავიკითხავთ და ულუფაზე გადავიყვანთ.', 'We read the values from the panel and convert them to a serving.')
            : photoUri ? tx('ფოტოს მიხედვით შევაფასებთ პორციასა და საკვებ ნივთიერებებს.', 'We estimate the portion and nutrients from the photo.') : tx('ერთი ფოტო — და კვების ჩანაწერის შევსება ბევრად მარტივია.', 'One photo makes logging a meal much easier.')}
        </Text>
      </View>

      <View style={[s.viewfinder, { height }]}>
        <LinearGradient colors={['#123F31', '#0A2A20', '#061A14']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {!photoUri && !label ? (
          <>
            <Image source={SCAN_HERO} resizeMode="cover" accessible={false} style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={['rgba(6,26,20,0)', 'rgba(6,26,20,0.75)']} style={[StyleSheet.absoluteFill, { top: '60%' }]} />
          </>
        ) : null}
        {photoUri ? (
          <Image source={{ uri: photoUri }} resizeMode="contain" accessibilityLabel={tx('შერჩეული საკვების ფოტო', 'Selected food photo')} style={StyleSheet.absoluteFill} />
        ) : label ? (
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.labelArt, { marginTop: -18 }]}>
            <Text style={s.labelArtTitle}>Nutrition Facts</Text>
            {[0.9, 0.7, 0.8, 0.55, 0.75].map((w, i) => <View key={i} style={[s.labelArtLine, { width: `${w * 100}%` }]} />)}
            <ScanText size={22} color="#0A2A20" strokeWidth={1.8} style={{ position: 'absolute', right: 12, top: 12 }} />
          </View>
        ) : null}
        <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
          {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
            <Animated.View key={corner} style={[s.corner, s[corner], { borderColor: '#6EE7B7', opacity: photoUri || scanning ? 1 : breathe.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }]} />
          ))}
          {scanning && !reduceMotion && foreground && (
            <Animated.View style={[s.scan, { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [26, height - 74] }) }] }]}>
              <LinearGradient colors={['transparent', 'rgba(110,231,183,0.22)']} style={{ height: 44 }} />
              <View style={{ height: 2, backgroundColor: '#6EE7B7' }} />
            </Animated.View>
          )}
        </View>
        <View style={s.finderLabel}>
          {photoUri ? <Check size={13} color="#A7F3D0" /> : <Focus size={13} color="#A7F3D0" />}
          <Text style={[txt, { fontSize: 11.5, color: '#E7FFF4' }]}>
            {scanning ? tx('ფოტო მუშავდება', 'Processing photo') : photoUri ? tx('ფოტო შერჩეულია', 'Photo selected') : label ? tx('ცხრილი მკაფიოდ და სწორად მოაქციე კადრში', 'Fit the panel in the frame, sharp and straight') : tx('თეფში სრულად მოაქციე კადრში', 'Fit the whole plate in the frame')}
          </Text>
        </View>
      </View>

      {scanning ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityLabel={tx('მიმდინარეობს ფოტოს შეფასება', 'Estimating the photo')} style={s.status}>
          <Text style={[txt, s.statusTitle]}>{tx('Medi აფასებს შენს კერძს', 'Medi is estimating your meal')}</Text>
          <Text style={[txt, s.small, { color: c.text200 }]}>{tx('პორციის შესწორებას შედეგის მიღების შემდეგ შეძლებ.', 'You can adjust the portion once the result is ready.')}</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={s.actions}>
            <Pressable testID="nutrition-camera" accessibilityRole="button" accessibilityLabel={photoUri ? tx('ფოტოს თავიდან გადაღება', 'Retake photo') : tx('კერძის გადაღება', 'Photograph meal')} disabled={actionsDisabled} onPress={onCamera} style={[s.action, s.primary, { backgroundColor: photoUri ? c.bg200 : M.ink, opacity: actionsDisabled ? 0.45 : 1 }]}>
              <Camera size={21} color={photoUri ? c.text100 : M.onInk} strokeWidth={2} />
              <Text style={[s.actionText, { color: photoUri ? c.text100 : M.onInk }]}>{photoUri ? tx('თავიდან გადაღება', 'Retake') : label ? tx('ეტიკეტის გადაღება', 'Snap the label') : tx('გადაიღე კერძი', 'Snap your meal')}</Text>
            </Pressable>
            {photoUri ? (
              <Pressable testID="nutrition-gallery" accessibilityRole="button" accessibilityLabel={tx('ფოტოს არჩევა გალერეიდან', 'Choose a photo from gallery')} disabled={actionsDisabled} onPress={onGallery} style={[s.action, { flex: 0, width: 56, backgroundColor: c.bg200, opacity: actionsDisabled ? 0.45 : 1 }]}>
                <ImagePlus size={20} color={c.text100} />
              </Pressable>
            ) : null}
          </View>
          {!photoUri && !label ? (
            <View style={s.methods}>
              {([
                ['gallery', tx('გალერეა', 'Gallery'), ImagePlus],
                ['barcode', tx('შტრიხკოდი', 'Barcode'), ScanBarcode],
                ['label', tx('ეტიკეტი', 'Label'), ScanText],
                ['search', tx('ძებნა', 'Search'), Search],
                ['describe', tx('აღწერა', 'Describe'), MessageSquareText],
              ] as const).map(([key, text, Icon]) => {
                const ai = key === 'gallery' || key === 'label' || key === 'describe';
                const off = disabled || (ai && !enabled);
                return (
                  <Pressable
                    key={key}
                    testID={key === 'gallery' ? 'nutrition-gallery' : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={text}
                    disabled={off}
                    onPress={() => (key === 'gallery' ? onGallery() : onMethod ? onMethod(key) : onMore?.())}
                    style={[s.method, { opacity: off ? 0.45 : 1 }]}
                  >
                    <View style={[s.methodDisc, { backgroundColor: M.inkSoft }]}><Icon size={21} color={M.ink} strokeWidth={1.9} /></View>
                    <Text numberOfLines={1} style={[s.methodText, { color: c.text200 }]}>{text}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      )}

      {!photoUri && enabled && (
        <View style={s.tips}>
          <Sun size={16} color={c.primary100} /><Text style={[txt, s.small, { color: c.text200, flex: 1 }]}>{label ? tx('ბრტყლად, ანარეკლის გარეშე — ციფრები ხელით აღარ დაგჭირდება.', "Flat, with no glare — you won't need to type the numbers.") : tx('კარგი განათება და ზემოდან გადაღებული კადრი შეფასებას ეხმარება.', 'Good light and a shot from above help the estimate.')}</Text>
        </View>
      )}
      {!photoUri && onMore && !onMethod && (
        <Pressable accessibilityRole="button" accessibilityLabel={tx('სხვა გზები: შტრიხკოდი, ეტიკეტი, ძებნა, აღწერა', 'Other ways: barcode, label, search, describe')} onPress={onMore} style={[s.more, { backgroundColor: c.bg200 }]}>
          <Text style={[txt, { fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx('შტრიხკოდი · ეტიკეტი · ძებნა · აღწერა', 'Barcode · Label · Search · Describe')}</Text>
        </Pressable>
      )}
      {!enabled && <Text style={[txt, s.small, { color: c.text200 }]}>{tx('ფოტოს შეფასება დროებით მიუწვდომელია. კვება შეგიძლია ხელით დაამატო.', "Photo estimates aren't available right now. You can add the meal manually.")}</Text>}
      {photoUri && (
        <View style={s.tips}>
          <ShieldCheck size={17} color={c.primary100} />
          <Text style={[txt, s.privacy, { color: c.text200 }]}>{tx('მხოლოდ ეს ფოტო და აღწერა გაზიარდება OpenRouter → Google Vertex AI-სთან. ფოტო მუდმივად არ ინახება.', 'Only this photo and description are shared with OpenRouter → Google Vertex AI. The photo is not stored permanently.')}</Text>
        </View>
      )}
    </View>
  );
}

export function NutritionScanSteps({ stage }: { stage: 0 | 1 | 2 }) {
  const c = useThemeColors();
  return <View style={s.steps} accessibilityLabel={tx(`ეტაპი ${stage + 1} სამიდან`, `Step ${stage + 1} of 3`)}>
    {tx(['ფოტო', 'გადამოწმება', 'შენახვა'], ['Photo', 'Review', 'Save']).map((label, index) => <View key={label} style={{ flex: 1, gap: 7 }}>
      <View style={{ height: 2, borderRadius: 2, backgroundColor: index <= stage ? c.primary100 : c.bg300 }} />
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', color: index === stage ? c.primary100 : c.text200, fontSize: 11 }}>{String(index + 1).padStart(2, '0')}  {label}</Text>
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  intro: { gap: 9 }, eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  brand: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  heading: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 36, letterSpacing: -0.3 }, subtitle: { fontSize: 13.5, lineHeight: 21 },
  viewfinder: { borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
 
 
  labelArt: { width: 170, padding: 14, paddingTop: 12, borderRadius: 14, backgroundColor: '#FFFFFF', gap: 7, transform: [{ rotate: '-4deg' }] },
  labelArtTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#0A2A20' },
  labelArtLine: { height: 5, borderRadius: 3, backgroundColor: '#D6E2DC' },
  primary: { minHeight: 56, borderRadius: 18 },
  methods: { flexDirection: 'row', justifyContent: 'space-between' },
  method: { flex: 1, alignItems: 'center', gap: 6, minHeight: 72 },
  methodDisc: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  methodText: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11 },
  leaf: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 7, left: 4, transform: [{ rotate: '-22deg' }] },
  corner: { position: 'absolute', width: 26, height: 26 },
  tl: { top: 19, left: 19, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 12 },
  tr: { top: 19, right: 19, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 12 },
  bl: { bottom: 19, left: 19, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 12 },
  br: { bottom: 19, right: 19, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 12 },
  scan: { position: 'absolute', top: 0, left: 22, right: 22 },
  finderLabel: { position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)' },
  actions: { flexDirection: 'row', gap: 10 }, action: { minHeight: 48, flex: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 10 }, actionText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15 },
  tips: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, small: { fontSize: 12, lineHeight: 20 }, privacy: { flex: 1, fontSize: 11, lineHeight: 18 },
  status: { gap: 6 }, statusTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15 },
  steps: { flexDirection: 'row', gap: 13 },
  more: { minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
});
