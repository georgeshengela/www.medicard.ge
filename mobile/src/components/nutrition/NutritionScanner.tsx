import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, Focus, ImagePlus, Leaf, ScanLine, ShieldCheck, Sun, UtensilsCrossed } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

type Props = {
  photoUri?: string;
  scanning: boolean;
  disabled: boolean;
  enabled: boolean;
  onCamera: () => void;
  onGallery: () => void;
};

/** The beam shows activity only, never fabricated recognition/progress. */
export function NutritionScanner({ photoUri, scanning, disabled, enabled, onCamera, onGallery }: Props) {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const height = Math.min(280, Math.max(200, width * 0.64));
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
  const txt = { color: c.text100, fontFamily: 'NotoSansGeorgian_400Regular' };
  const actionsDisabled = disabled || !enabled;
  return (
    <View style={{ gap: 16 }} testID="nutrition-scanner">
      <View style={s.intro}>
        <View style={[s.eyebrow, { backgroundColor: c.accent100 }]}>
          <ScanLine size={15} color={c.primary100} />
          <Text style={[s.brand, { color: c.primary100 }]}>MEDI SCAN</Text>
        </View>
        <Text style={[txt, s.heading]}>{photoUri ? 'შენი კერძი, უფრო გასაგებად' : 'რას მიირთმევ?'}</Text>
        <Text style={[txt, s.subtitle, { color: c.text200 }]}>
          {photoUri ? 'ფოტოს მიხედვით შევაფასებთ პორციასა და საკვებ ნივთიერებებს.' : 'ერთი ფოტო — და კვების ჩანაწერის შევსება ბევრად მარტივია.'}
        </Text>
      </View>

      <View style={[s.viewfinder, { height, backgroundColor: c.surface, borderColor: c.bg300 }]}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} resizeMode="contain" accessibilityLabel="შერჩეული საკვების ფოტო" style={StyleSheet.absoluteFill} />
        ) : (
          <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.plateScene}>
            <View style={[s.outerPlate, { borderColor: c.bg300 }]}>
              <View style={[s.innerPlate, { borderColor: c.bg300, backgroundColor: c.bg100 }]}>
                <View style={[s.leaf, { backgroundColor: c.accent100 }]}><Leaf color={c.primary100} size={26} strokeWidth={1.5} /></View>
                <UtensilsCrossed color={c.text200} size={39} strokeWidth={1.25} />
              </View>
            </View>
            <View style={[s.plateDot, { backgroundColor: c.accent100, right: -6, top: 17 }]}><Focus size={18} color={c.primary100} strokeWidth={1.5} /></View>
          </View>
        )}
        <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no-hide-descendants">
          {(['tl', 'tr', 'bl', 'br'] as const).map(corner => (
            <View key={corner} style={[s.corner, s[corner], { borderColor: photoUri ? '#5EEAD4' : c.primary100 }]} />
          ))}
          {scanning && !reduceMotion && foreground && (
            <Animated.View style={[s.scan, { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [26, height - 74] }) }] }]}>
              <LinearGradient colors={['transparent', 'rgba(20,184,166,0.18)']} style={{ height: 44 }} />
              <View style={{ height: 2, backgroundColor: '#5EEAD4' }} />
            </Animated.View>
          )}
        </View>
        <View style={[s.finderLabel, { backgroundColor: photoUri ? '#111827' : c.bg100 }]}>
          {photoUri ? <Check size={13} color="#99F6E4" /> : <Focus size={13} color={c.text200} />}
          <Text style={[txt, { fontSize: 11, color: photoUri ? '#FFFFFF' : c.text200 }]}>
            {scanning ? 'ფოტო მუშავდება' : photoUri ? 'ფოტო შერჩეულია' : 'თეფში სრულად მოაქციე კადრში'}
          </Text>
        </View>
      </View>

      {scanning ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="progressbar" accessibilityLabel="მიმდინარეობს ფოტოს შეფასება" style={s.status}>
          <Text style={[txt, s.statusTitle]}>Medi აფასებს შენს კერძს</Text>
          <Text style={[txt, s.small, { color: c.text200 }]}>პორციის შესწორებას შედეგის მიღების შემდეგ შეძლებ.</Text>
        </View>
      ) : (
        <View style={s.actions}>
          <Pressable testID="nutrition-camera" accessibilityRole="button" accessibilityLabel={photoUri ? 'ფოტოს თავიდან გადაღება' : 'კერძის გადაღება'} disabled={actionsDisabled} onPress={onCamera} style={[s.action, { backgroundColor: photoUri ? c.bg200 : '#0F766E', opacity: actionsDisabled ? 0.45 : 1 }]}>
            <Camera size={20} color={photoUri ? c.text100 : '#FFFFFF'} />
            <Text style={[txt, s.actionText, { color: photoUri ? c.text100 : '#FFFFFF' }]}>{photoUri ? 'თავიდან' : 'გადაღება'}</Text>
          </Pressable>
          <Pressable testID="nutrition-gallery" accessibilityRole="button" accessibilityLabel="ფოტოს არჩევა გალერეიდან" disabled={actionsDisabled} onPress={onGallery} style={[s.action, { borderWidth: 1, borderColor: c.bg300, backgroundColor: c.surface, opacity: actionsDisabled ? 0.45 : 1 }]}>
            <ImagePlus size={19} color={c.text100} />
            <Text style={[txt, s.actionText]}>გალერეა</Text>
          </Pressable>
        </View>
      )}

      {!photoUri && enabled && (
        <View style={s.tips}>
          <Sun size={16} color={c.primary100} /><Text style={[txt, s.small, { color: c.text200, flex: 1 }]}>კარგი განათება და ზემოდან გადაღებული კადრი შეფასებას ეხმარება.</Text>
        </View>
      )}
      {!enabled && <Text style={[txt, s.small, { color: c.text200 }]}>ფოტოს შეფასება დროებით მიუწვდომელია. კვება შეგიძლია ხელით დაამატო.</Text>}
      {photoUri && (
        <View style={s.tips}>
          <ShieldCheck size={17} color={c.primary100} />
          <Text style={[txt, s.privacy, { color: c.text200 }]}>მხოლოდ ეს ფოტო და აღწერა გაზიარდება OpenRouter → Google Vertex AI-სთან. ფოტო მუდმივად არ ინახება.</Text>
        </View>
      )}
    </View>
  );
}

export function NutritionScanSteps({ stage }: { stage: 0 | 1 | 2 }) {
  const c = useThemeColors();
  return <View style={s.steps} accessibilityLabel={`ეტაპი ${stage + 1} სამიდან`}>
    {['ფოტო', 'გადამოწმება', 'შენახვა'].map((label, index) => <View key={label} style={{ flex: 1, gap: 7 }}>
      <View style={{ height: 2, borderRadius: 2, backgroundColor: index <= stage ? c.primary100 : c.bg300 }} />
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', color: index === stage ? c.primary100 : c.text200, fontSize: 11 }}>{String(index + 1).padStart(2, '0')}  {label}</Text>
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  intro: { gap: 9 }, eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  brand: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  heading: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 23, lineHeight: 34 }, subtitle: { fontSize: 13, lineHeight: 21 },
  viewfinder: { borderWidth: 1, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  plateScene: { width: 164, height: 164, marginBottom: 16 },
  outerPlate: { width: 164, height: 164, borderRadius: 82, borderWidth: 1, padding: 12 },
  innerPlate: { flex: 1, borderRadius: 70, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  leaf: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 7, left: 4, transform: [{ rotate: '-22deg' }] },
  plateDot: { position: 'absolute', width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 26, height: 26 },
  tl: { top: 19, left: 19, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 12 },
  tr: { top: 19, right: 19, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 12 },
  bl: { bottom: 19, left: 19, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 12 },
  br: { bottom: 19, right: 19, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 12 },
  scan: { position: 'absolute', top: 0, left: 22, right: 22 },
  finderLabel: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  actions: { flexDirection: 'row', gap: 10 }, action: { minHeight: 48, flex: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, padding: 10 }, actionText: { fontSize: 13 },
  tips: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, small: { fontSize: 12, lineHeight: 20 }, privacy: { flex: 1, fontSize: 11, lineHeight: 18 },
  status: { gap: 6 }, statusTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15 },
  steps: { flexDirection: 'row', gap: 13 },
});
