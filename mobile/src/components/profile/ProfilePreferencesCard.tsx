import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { CalendarHeart, House, Languages, Moon, Palette, Smartphone, Sun, SunMoon, type LucideIcon } from 'lucide-react-native';
import { confirmLanguageSwitch } from '@/components/ui/LanguageSelect';
import { ka } from '@/i18n/ka';
import { appLang, setLanguageAndReload, tx, type AppLang } from '@/i18n/locale';
import { getHomeLanding, setCyclePromptSeen, setHomeLanding, type HomeLanding } from '@/lib/homeScreenPrefs';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useTheme, type ThemePreference } from '@/store/ThemeContext';

const SEG = 40;
const PAD = 3;
const CYCLE_ROSE = '#D4738A';

type SegOption<T extends string> = { value: T; label: string; icon?: LucideIcon; text?: string; tint?: string };

/** Small pill switch with a sliding thumb; icons or two-letter labels only, the row says the rest. */
function MiniSegment<T extends string>({ value, options, onChange, label }: { value: T; options: SegOption<T>[]; onChange: (next: T) => void; label: string }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const x = useRef(new Animated.Value(index * SEG)).current;

  useEffect(() => {
    Animated.spring(x, { toValue: index * SEG, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  }, [index, x]);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', padding: PAD, borderRadius: 999, backgroundColor: colors.bg200 }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: PAD,
          left: PAD,
          width: SEG,
          bottom: PAD,
          borderRadius: 999,
          backgroundColor: dark ? colors.bg300 : colors.surface,
          shadowColor: '#0F1A1C',
          shadowOpacity: dark ? 0 : 0.12,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: dark ? 0 : 2,
          transform: [{ translateX: x }],
        }}
      />
      {options.map((option) => {
        const on = option.value === value;
        const ink = on ? option.tint ?? colors.primary200 : colors.text300;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={{ width: SEG, height: 30, alignItems: 'center', justifyContent: 'center' }}
          >
            {Icon ? (
              <Icon size={16} color={ink} strokeWidth={on ? 2.3 : 2} />
            ) : (
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, lineHeight: 16, color: on ? colors.text100 : colors.text300 }}>
                {option.text}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function PrefRow({ icon: Icon, ink, title, value, children, divider }: { icon: LucideIcon; ink: HubInk; title: string; value: string; children: React.ReactNode; divider?: boolean }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const inkHex = hubInk(ink, dark);
  return (
    <>
      {divider ? <View style={{ height: 1, backgroundColor: colors.bg300, marginLeft: 66 }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 62 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hubTint(inkHex, dark) }}>
          <Icon size={18} color={inkHex} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[hubText.cardTitle, { fontSize: 14, lineHeight: 20, color: colors.text100 }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[hubText.small, { color: colors.text300 }]}>
            {value}
          </Text>
        </View>
        {children}
      </View>
    </>
  );
}

const THEME_OPTIONS: SegOption<ThemePreference>[] = [
  { value: 'light', label: ka.profile.themeLight, icon: Sun },
  { value: 'dark', label: ka.profile.themeDark, icon: Moon },
  { value: 'system', label: ka.profile.themeSystem, icon: SunMoon },
];

const LANG_OPTIONS: SegOption<AppLang>[] = [
  { value: 'ka', label: 'ქართული', text: 'ქა' },
  { value: 'en', label: 'English', text: 'EN' },
];

const LANDING_OPTIONS: SegOption<HomeLanding>[] = [
  { value: 'hub', label: ka.profile.homeLandingHub, icon: House },
  { value: 'cycle', label: ka.profile.homeLandingCycle, icon: CalendarHeart, tint: CYCLE_ROSE },
];

/** Profile → Settings: appearance, language and (for women) the opening screen in one compact card. */
export function ProfilePreferencesCard({ showLanding }: { showLanding: boolean }) {
  const colors = useThemeColors();
  const { preference, setPreference } = useTheme();
  const current = appLang();
  const [pendingLang, setPendingLang] = useState<AppLang | null>(null);
  const [landing, setLanding] = useState<HomeLanding | null>(null);

  useEffect(() => {
    if (showLanding) void getHomeLanding().then(setLanding);
  }, [showLanding]);

  const lang = pendingLang ?? current;
  const chooseLang = (next: AppLang) => {
    if (next === current || pendingLang) return;
    confirmLanguageSwitch(next, async () => {
      setPendingLang(next);
      await setLanguageAndReload(next).finally(() => setPendingLang(null));
    });
  };

  const chooseLanding = async (next: HomeLanding) => {
    setLanding(next);
    await setHomeLanding(next);
    await setCyclePromptSeen(true);
  };

  const themeLabel = THEME_OPTIONS.find((option) => option.value === preference)?.label ?? '';

  return (
    <View style={{ borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden' }}>
      <PrefRow icon={Palette} ink="violet" title={ka.profile.appearance} value={themeLabel}>
        <MiniSegment label={ka.profile.appearance} value={preference} options={THEME_OPTIONS} onChange={setPreference} />
      </PrefRow>
      <PrefRow icon={Languages} ink="sky" title={tx('ენა', 'Language')} value={lang === 'ka' ? 'ქართული' : 'English'} divider>
        <MiniSegment label={tx('ენა', 'Language')} value={lang} options={LANG_OPTIONS} onChange={chooseLang} />
      </PrefRow>
      {showLanding && landing ? (
        <PrefRow
          icon={Smartphone}
          ink="rose"
          title={ka.profile.homeLandingTitle}
          value={landing === 'cycle' ? tx('ციკლის ეკრანით', 'Opens on Cycle') : tx('მთავარი გვერდით', 'Opens on Home')}
          divider
        >
          <MiniSegment label={ka.profile.homeLandingTitle} value={landing} options={LANDING_OPTIONS} onChange={(next) => void chooseLanding(next)} />
        </PrefRow>
      ) : null}
    </View>
  );
}
