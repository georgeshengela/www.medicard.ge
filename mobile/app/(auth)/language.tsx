import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { LANGUAGE_OPTIONS, LANGUAGE_PICKER_COPY } from '@/components/ui/LanguageSelect';
import { appLang, deviceLanguage, saveLanguage, setLanguageAndReload, type AppLang } from '@/i18n/locale';

const TEAL = '#0F766E';

/**
 * First launch: pick the app language before anything else is shown.
 * Every line on this screen is in both languages (or follows the highlighted choice),
 * because the person has not told us which one they read yet.
 */
export default function LanguageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<AppLang>(() => deviceLanguage());
  const [busy, setBusy] = useState(false);
  const copy = LANGUAGE_PICKER_COPY[selected];

  const rise = useRef(LANGUAGE_OPTIONS.map(() => new Animated.Value(0))).current;
  const head = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    RNStatusBar.setBarStyle('light-content', true);
    if (Platform.OS === 'android') RNStatusBar.setBackgroundColor('#14B8A6', true);
    Animated.stagger(90, [
      Animated.timing(head, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ...rise.map((value) =>
        Animated.timing(value, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ),
    ]).start();
  }, [head, rise]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    if (selected !== appLang()) {
      // Reload so the whole app (and every cached constant) starts in the chosen language.
      const reloaded = await setLanguageAndReload(selected);
      if (reloaded) return;
    }
    saveLanguage(selected);
    router.replace('/(auth)/welcome');
  };

  const lift = (value: Animated.Value) => ({
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#14B8A6' }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#2DD4BF', '#14B8A6', '#0F766E']}
        locations={[0, 0.42, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Soft light behind the headline */}
      <View pointerEvents="none" style={styles.glow} />

      <View style={{ flex: 1, paddingTop: insets.top + 28, paddingHorizontal: 24 }}>
        <Animated.View style={[{ alignItems: 'center' }, lift(head)]}>
          <MedicardLogoMark size={52} tone="inverse" />
          <Text style={styles.title} accessibilityRole="header">
            აირჩიე ენა
          </Text>
          <Text style={styles.subtitle}>Choose your language</Text>
        </Animated.View>

        <View accessibilityRole="radiogroup" style={{ gap: 12, marginTop: 36 }}>
          {LANGUAGE_OPTIONS.map((option, index) => {
            const active = option.value === selected;
            return (
              <Animated.View key={option.value} style={lift(rise[index])}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${option.native} · ${option.other}`}
                  onPress={() => setSelected(option.value)}
                  style={[styles.option, active ? styles.optionActive : styles.optionIdle]}
                >
                  <View style={[styles.badge, active ? { backgroundColor: '#CCFBF1' } : { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                    <Text style={[styles.badgeText, { color: active ? TEAL : '#FFFFFF' }]}>{option.badge}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.optionTitle, { color: active ? '#0F1A1C' : '#FFFFFF' }]}>{option.native}</Text>
                    <Text style={[styles.optionSub, { color: active ? '#4B5B5E' : 'rgba(255,255,255,0.78)' }]}>{option.other}</Text>
                  </View>
                  <View style={[styles.radio, active ? { backgroundColor: TEAL, borderColor: TEAL } : { borderColor: 'rgba(255,255,255,0.7)' }]}>
                    {active ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <Text style={styles.note}>{copy.note}</Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20, paddingTop: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy }}
          onPress={() => void confirm()}
          style={[styles.cta, busy ? { opacity: 0.7 } : null]}
        >
          <Text style={styles.ctaText}>{copy.continue}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  title: {
    marginTop: 22,
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 30,
    lineHeight: 40,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 17,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  optionIdle: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  optionActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#042F2E',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  badge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  optionTitle: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 18,
    lineHeight: 25,
  },
  optionSub: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    marginTop: 18,
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  cta: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 16,
    lineHeight: 22,
    color: TEAL,
  },
});
