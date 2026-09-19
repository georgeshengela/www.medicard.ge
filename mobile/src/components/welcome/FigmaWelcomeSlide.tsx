import React, { useEffect } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { WelcomeCircleField } from '@/components/welcome/WelcomeCircleField';
import {
  FIGMA_FRAME,
  FIGMA_HERO_TOP,
  FIGMA_PROGRESS_GAP,
  FIGMA_PROGRESS_HEIGHT,
  FIGMA_SHEET_RATIO,
  FIGMA_SHEET_RADIUS,
  FIGMA_SHEET_TOP,
  LANDING_BRAND_FROM,
  LANDING_GRADIENT,
  LANDING_LOGO_SIZE,
  WELCOME_HERO_BG,
  WELCOME_HERO_BG_DARK,
  WELCOME_PROGRESS_SEGMENTS,
  welcomeTopInset,
  type WelcomeProgressState,
} from '@/constants/figmaWelcomeLayout';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors } from '@/theme/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FRAME_H = (FIGMA_FRAME.height / FIGMA_FRAME.width) * SCREEN_W;
const NAV_DARK = '#0F172A';

type Props = {
  frame: ImageSourcePropType;
  kind: 'landing' | 'carousel';
  title: string;
  body: string;
  progress: WelcomeProgressState;
  onPrimary?: () => void;
  onSignIn?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev: boolean;
};

export function FigmaWelcomeSlide({
  frame,
  kind,
  title,
  body,
  progress,
  onPrimary,
  onSignIn,
  onPrev,
  onNext,
  canPrev,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const heroBg = dark ? WELCOME_HERO_BG_DARK : WELCOME_HERO_BG;
  const canvas = kind === 'landing' ? LANDING_BRAND_FROM : heroBg;
  const topInset = welcomeTopInset(insets.top);
  const sheetH = Math.round(SCREEN_H * FIGMA_SHEET_RATIO);
  const progressTop = topInset;
  const progressBlockH = FIGMA_PROGRESS_HEIGHT + 12;
  const heroTop = progress.visible ? progressTop + progressBlockH : topInset;
  const heroH = SCREEN_H - sheetH - heroTop;

  return (
    <View style={{ width: SCREEN_W, height: SCREEN_H, backgroundColor: canvas, overflow: 'hidden' }}>
      {kind === 'landing' ? (
        <LandingHero />
      ) : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: heroTop,
            left: 0,
            right: 0,
            height: heroH,
            backgroundColor: heroBg,
            overflow: 'hidden',
          }}
        >
          <CroppedFigmaArt
            frame={frame}
            cropTop={FIGMA_HERO_TOP}
            cropBottom={FIGMA_SHEET_TOP}
            height={heroH}
          />
        </View>
      )}

      {progress.visible ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: progressTop,
            left: 24,
            right: 24,
            zIndex: 30,
          }}
        >
          <SplitProgressBar
            total={WELCOME_PROGRESS_SEGMENTS}
            activeSegment={progress.activeSegment}
            activeFill={progress.activeFill}
            trackColor={colors.bg300}
          />
        </View>
      ) : null}

      {kind === 'landing' ? (
        <LandingFooter
          body={body}
          bottomInset={insets.bottom}
          onPrimary={onPrimary}
          onSignIn={onSignIn}
        />
      ) : (
        <CarouselFooter
          title={title}
          body={body}
          sheetH={sheetH}
          bottomInset={insets.bottom}
          sheetColor={colors.surface}
          onPrev={onPrev}
          onNext={onNext}
          canPrev={canPrev}
        />
      )}
    </View>
  );
}

/** Landing — Figma 8846:211832 rings + white Medicard mark. */
function LandingHero() {
  const reduceMotion = usePrefersReducedMotion();
  const enter = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    enter.value = withDelay(180, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [enter]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.88, 1]) }],
  }));

  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={[...LANDING_GRADIENT.colors]}
        locations={[...LANDING_GRADIENT.locations]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <WelcomeCircleField />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(20,184,166,0)', LANDING_BRAND_FROM]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: SCREEN_H * 0.28 }}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: SCREEN_H,
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 80,
          },
          markStyle,
        ]}
      >
        <View
          style={{
            width: 148,
            height: 148,
            borderRadius: 74,
            backgroundColor: 'rgba(255,255,255,0.10)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <BrandLogo size={LANDING_LOGO_SIZE} variant="plain" inverse />
        </View>
        <BrandWordmark size={34} color="#FFFFFF" style={{ marginTop: 18 }} />
      </Animated.View>
    </>
  );
}

/** Shows only a vertical slice of the Figma PNG — hides status bar, English copy, and sheet. */
function CroppedFigmaArt({
  frame,
  cropTop,
  height,
  style,
}: {
  frame: ImageSourcePropType;
  cropTop: number;
  cropBottom?: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const cropTopPx = (cropTop / FIGMA_FRAME.height) * FRAME_H;

  return (
    <View style={[{ height, overflow: 'hidden' }, style]}>
      <Image
        source={frame}
        style={{
          width: SCREEN_W,
          height: Math.max(FRAME_H, SCREEN_H),
          marginTop: -cropTopPx,
        }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function LandingFooter({
  body,
  bottomInset,
  onPrimary,
  onSignIn,
}: {
  body: string;
  bottomInset: number;
  onPrimary?: () => void;
  onSignIn?: () => void;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 24,
        right: 24,
        bottom: bottomInset + 16,
        zIndex: 20,
      }}
    >
      <Text
        style={{
          textAlign: 'center',
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 16,
          lineHeight: 24,
          color: 'rgba(255,255,255,0.88)',
        }}
      >
        {body}
      </Text>
      <View style={{ marginTop: 32 }}>
        <AuthPrimaryButton tone="inverse" label={ka.onboarding.getStarted} onPress={onPrimary} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onSignIn}
        hitSlop={12}
        style={{ marginTop: 20, alignItems: 'center', paddingVertical: 8 }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 15,
            color: 'rgba(255,255,255,0.86)',
          }}
        >
          {ka.onboarding.alreadyHaveAccount}{' '}
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', color: '#FFFFFF' }}>{ka.auth.signIn}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

function CarouselFooter({
  title,
  body,
  sheetH,
  bottomInset,
  sheetColor,
  onPrev,
  onNext,
  canPrev,
}: {
  title: string;
  body: string;
  sheetH: number;
  bottomInset: number;
  sheetColor: string;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev: boolean;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
      }}
    >
      <View
        style={{
          height: sheetH,
          backgroundColor: sheetColor,
          borderTopLeftRadius: FIGMA_SHEET_RADIUS,
          borderTopRightRadius: FIGMA_SHEET_RADIUS,
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 16,
        }}
      >
        <View className="flex-1 justify-between">
          <View>
            <Text className="text-center font-sans-bold text-[24px] leading-8 text-text-100">{title}</Text>
            <Text className="mt-2 text-center font-sans text-[15px] leading-[22px] text-text-200">{body}</Text>
          </View>
          <View className="flex-row items-center justify-center gap-5 pb-2">
            <NavCircle onPress={onPrev} disabled={!canPrev} accessibilityLabel={ka.common.back}>
              <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.4} />
            </NavCircle>
            <NavCircle onPress={onNext} accessibilityLabel={ka.onboarding.next}>
              <ChevronRight size={22} color="#FFFFFF" strokeWidth={2.4} />
            </NavCircle>
          </View>
        </View>
      </View>
      {bottomInset > 0 ? <View style={{ height: bottomInset, backgroundColor: sheetColor }} /> : null}
    </View>
  );
}

function SplitProgressBar({
  total,
  activeSegment,
  activeFill,
  trackColor,
}: {
  total: number;
  activeSegment: number;
  activeFill: number;
  trackColor: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: FIGMA_PROGRESS_GAP }}>
      {Array.from({ length: total }).map((_, i) => {
        let fill = 0;
        if (i < activeSegment) fill = 1;
        else if (i === activeSegment) fill = activeFill;

        return (
          <View
            key={i}
            style={{
              height: FIGMA_PROGRESS_HEIGHT,
              flex: 1,
              overflow: 'hidden',
              borderRadius: FIGMA_PROGRESS_HEIGHT / 2,
              backgroundColor: trackColor,
            }}
          >
            <View
              className="bg-primary-200"
              style={{
                height: '100%',
                borderRadius: FIGMA_PROGRESS_HEIGHT / 2,
                width: `${fill * 100}%`,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

function NavCircle({
  children,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      hitSlop={16}
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: NAV_DARK,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
      className="active:opacity-85"
    >
      {children}
    </Pressable>
  );
}
