import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ArrowUpRight, RotateCw, Target } from 'lucide-react-native';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import type { useNutritionDashboard } from '@/components/nutrition/ProgramUI';
import { GOAL_ART } from '@/constants/appArt';
import { energyView, groupDigits, type EnergyView, type MacroKey } from '@/lib/home/energySummary';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { tx } from '@/i18n/locale';

/** The shared `['nutrition','dashboard']` query, owned by the Home root and passed down. */
export type HomeNutritionState = ReturnType<typeof useNutritionDashboard>;

/**
 * The layout's one spotlight: a dark forest card in both themes (owner-approved mockup). These are
 * spotlight-only tints (ring, muted text, link), not the page accent — every other accent colour on
 * the page comes from `useHomeAccent()`.
 */
const SPOT = {
  bg: '#15290E',
  ring: '#A3E635',
  track: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  muted: '#CFE3BC',
  link: '#D9F99D',
  hairline: 'rgba(255,255,255,0.14)',
  button: '#A3E635',
  onButton: '#1A2E05',
  skeleton: 'rgba(255,255,255,0.10)',
} as const;
/** The dark macro inks the hub uses on dark surfaces (protein / carbs / fat). */
const MACRO_INK: Record<MacroKey, string> = { protein: '#FDA4AF', carbs: '#FCD34D', fat: '#7DD3FC' };
const MACRO_LABEL: Record<MacroKey, string> = {
  protein: tx('ცილა', 'Protein'),
  carbs: tx('ნახშ.', 'Carbs'),
  fat: tx('ცხიმი', 'Fat'),
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const sectionTop = (first: boolean) => (first ? 22 : HUB.sectionGap);
const mealsLabel = (n: number) => tx(`${n} კვება`, `${n} ${n === 1 ? 'meal' : 'meals'}`);

/**
 * Eaten against the budget, filling once on mount. Reanimated's `useReducedMotion` is read
 * synchronously; `usePrefersReducedMotion` starts as `true` until the OS answers, so a mount-time fill
 * keyed on it would never play (or would jump). Reduced motion → the final ring, no animation.
 */
function BudgetRing({ size, progress }: { size: number; progress: number }) {
  const reduce = useReducedMotion();
  const stroke = 11;
  const r = size / 2 - stroke / 2;
  const circumference = 2 * Math.PI * r;
  const shown = useSharedValue(reduce ? progress : 0);
  useEffect(() => {
    shown.value = reduce ? progress : withDelay(200, withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [progress, reduce, shown]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.value) }));
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={SPOT.track} strokeWidth={stroke} fill="none" />
      {progress > 0 ? (
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={SPOT.ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}

function CtaRow({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={s.ctaRow}>
      <Text style={[hubText.link, { color: SPOT.link, flex: 1 }]}>{label}</Text>
      <ArrowUpRight size={18} color={SPOT.link} strokeWidth={2} />
    </Pressable>
  );
}

function copyFor(view: EnergyView) {
  const target = view.target != null ? groupDigits(view.target) : '';
  const headline = view.logged
    ? tx(`${groupDigits(view.eaten)} კკალ ჩაწერილი`, `${groupDigits(view.eaten)} kcal logged`)
    : tx('დღეს ჯერ არაფერი ჩაწერილა', 'Nothing logged today yet');
  let caption: string;
  if (view.kind === 'budget') {
    caption = view.logged
      ? tx(`ბიუჯეტი ${target} კკალ · ${mealsLabel(view.mealCount)}`, `Budget ${target} kcal · ${mealsLabel(view.mealCount)}`)
      : tx(`ბიუჯეტი ${target} კკალ`, `Budget ${target} kcal`);
    // Over the budget is never red and never a reproach — the hub's own softener.
    if (view.over) caption += tx(' · ხვალ ახალი დღეა', ' · tomorrow is a new day');
  } else if (view.kind === 'review') {
    caption = `${mealsLabel(view.mealCount)} · ${tx('გეგმა გადასამოწმებელია — ერთ წუთში განაახლებ.', 'Your plan needs a quick review.')}`;
  } else {
    caption = `${mealsLabel(view.mealCount)} · ${tx('გეგმას თუ შექმნი, ბიუჯეტიც გამოჩნდება', 'create a plan to see your budget')}`;
  }
  const centreUnit =
    view.centre?.unit === 'left' ? tx('კკალ დარჩა', 'kcal left') : view.centre?.unit === 'over' ? tx('კკალ ზევით', 'kcal over') : tx('კკალ', 'kcal');
  return { headline, caption, centreUnit };
}

function Skeleton({ ring }: { ring: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={tx('იტვირთება', 'Loading')} style={[s.spot, { minHeight: ring + 164 }]}>
      <View style={s.top}>
        <View style={{ width: ring, height: ring, borderRadius: ring / 2, borderWidth: 11, borderColor: SPOT.skeleton }} />
        <View style={{ flex: 1, gap: 10 }}>
          <View style={[s.bone, { width: '80%', height: 18 }]} />
          <View style={[s.bone, { width: '60%', height: 12 }]} />
        </View>
      </View>
      <View style={s.macros}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[s.bone, { flex: 1, height: 36 }]} />
        ))}
      </View>
      <View style={[s.bone, { height: 14, width: '40%', marginTop: 14 }]} />
    </View>
  );
}

/**
 * „დღის ბიუჯეტი“ — what was eaten against the server's budget, with the macros (layout „კვება და წონა“).
 * Budget = `budget ?? targets.calories`, exactly as `HomeNutritionCard`; Home never computes a target
 * and never shows the server's review reasons (Georgian-only strings). With no plan and nothing logged
 * it is the page's only goal CTA.
 */
export function HomeEnergyCard({ nutrition, first = false }: { nutrition: HomeNutritionState; first?: boolean }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const ring = width < 360 ? 88 : 116;
  const { data, error, loading, load } = nutrition;

  const openDiary = () => router.push('/nutrition/diary' as never);
  const openGoal = () => router.push('/nutrition/goal' as never);
  const heading = (
    <HomeSectionHeading title={tx('დღის ბიუჯეტი', "Today's budget")} linkLabel={tx('კვების ჰაბი', 'Nutrition hub')} onLink={() => router.push('/nutrition' as never)} />
  );

  if (!data) {
    if (loading) {
      return (
        <View style={{ paddingHorizontal: HUB.gutter, marginTop: sectionTop(first) }}>
          {heading}
          <Skeleton ring={ring} />
        </View>
      );
    }
    if (!error) return null;
    return (
      <View style={{ paddingHorizontal: HUB.gutter, marginTop: sectionTop(first) }}>
        {heading}
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <Text style={[hubText.body, { color: c.text200 }]}>{tx('კვების მონაცემები ახლა ვერ ჩაიტვირთა.', "Couldn't load your nutrition right now.")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('ხელახლა ცდა', 'Try again')}
            onPress={() => void load()}
            style={[s.tonal, { backgroundColor: accent.soft }]}
          >
            <RotateCw size={16} color={accent.ink} strokeWidth={2} />
            <Text style={[hubText.link, { color: accent.ink }]}>{tx('ხელახლა ცდა', 'Try again')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const view = energyView(data);
  const goalCta = view.kind === 'review' ? tx('გეგმის გადამოწმება', 'Review plan') : tx('ჩემი გეგმის შექმნა', 'Create my plan');

  if (view.empty) {
    const title = view.kind === 'review' ? tx('გეგმა შენთან ერთად იცვლება', 'Your plan changes with you') : tx('შენი მიზანი, შენი ტემპით', 'Your goal, your pace');
    const body =
      view.kind === 'review'
        ? tx('გეგმა გადასამოწმებელია — ერთ წუთში განაახლებ.', 'Your plan needs a quick review.')
        : tx('დაკლება, შენარჩუნება თუ მომატება — დღის ბიუჯეტი და მაკროები ერთ გეგმაში.', 'Lose, maintain or gain — a daily budget and macros in one plan.');
    return (
      <View style={{ paddingHorizontal: HUB.gutter, marginTop: sectionTop(first) }}>
        {heading}
        <View style={s.spot}>
          <View style={s.top}>
            <Image source={GOAL_ART.nutrition} style={s.art} accessibilityIgnoresInvertColors />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text accessibilityRole="header" style={[hubText.cardTitle, s.headline]}>
                {title}
              </Text>
              <Text style={[hubText.caption, { color: SPOT.muted }]}>{body}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={goalCta} onPress={openGoal} style={s.button}>
            <Target size={18} color={SPOT.onButton} strokeWidth={2.2} />
            <Text style={[hubText.link, { color: SPOT.onButton, fontSize: 14 }]}>{goalCta}</Text>
          </Pressable>
          <Text style={[hubText.small, { color: SPOT.muted }]}>{tx('ეს ორიენტირია, არა ექიმის დანიშნულება.', "This is a guide, not a doctor's prescription.")}</Text>
        </View>
      </View>
    );
  }

  const { headline, caption, centreUnit } = copyFor(view);
  const b = view.breakdown;
  const breakdown = b
    ? `${tx('სამიზნე', 'Target')} ${groupDigits(b.target)}` +
      (b.burned > 0 ? tx(` + დამწვარი ${groupDigits(b.burned)}`, ` + burned ${groupDigits(b.burned)}`) : '') +
      (b.rollover > 0 ? tx(` + გუშინდელი ${groupDigits(b.rollover)}`, ` + yesterday ${groupDigits(b.rollover)}`) : '') +
      ` = ${groupDigits(b.budget)} ${tx('კკალ', 'kcal')}`
    : null;

  return (
    <View style={{ paddingHorizontal: HUB.gutter, marginTop: sectionTop(first) }}>
      {heading}
      <View style={s.spot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx(`${headline}. ${caption}. კვების დღიურის გახსნა`, `${headline}. ${caption}. Open food diary`)}
          onPress={openDiary}
          style={s.top}
        >
          <View style={{ width: ring, height: ring }}>
            <BudgetRing size={ring} progress={view.progress} />
            <View style={[StyleSheet.absoluteFill, s.centre]} pointerEvents="none">
              <Text style={[s.centreValue, ring < 100 && { fontSize: 20, lineHeight: 26 }]}>{groupDigits(view.centre?.value ?? 0)}</Text>
              <Text style={[hubText.small, { color: SPOT.muted, fontSize: 11, lineHeight: 15 }]}>{centreUnit}</Text>
            </View>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text numberOfLines={2} style={[hubText.cardTitle, s.headline]}>
              {headline}
            </Text>
            <Text numberOfLines={3} style={[hubText.caption, { color: SPOT.muted }]}>
              {caption}
            </Text>
          </View>
        </Pressable>

        {breakdown ? <Text style={[hubText.small, { color: SPOT.muted, marginTop: -6 }]}>{breakdown}</Text> : null}

        {view.logged ? (
          <View style={s.macros}>
            {view.macros.map((m) => (
              <View key={m.key} style={s.macro}>
                <Text numberOfLines={1} style={[hubText.small, { color: SPOT.muted, fontSize: 11, lineHeight: 15 }]}>
                  {MACRO_LABEL[m.key]}
                </Text>
                <Text numberOfLines={1} style={s.macroValue}>
                  {groupDigits(m.value)}
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', color: SPOT.muted }}>
                    {m.target ? tx(` / ${groupDigits(m.target)} გ`, ` / ${groupDigits(m.target)} g`) : tx(' გ', ' g')}
                  </Text>
                </Text>
                {m.target ? (
                  <View style={s.macroTrack}>
                    <View style={[s.macroFill, { width: `${Math.round(m.ratio * 100)}%`, backgroundColor: MACRO_INK[m.key] }]} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.ctaBlock}>
          <CtaRow label={tx('კვების დღიური', 'Food diary')} a11y={tx('კვების დღიურის გახსნა', 'Open food diary')} onPress={openDiary} />
          {view.kind !== 'budget' ? <CtaRow label={goalCta} a11y={goalCta} onPress={openGoal} /> : null}
        </View>
      </View>
      {view.kind === 'budget' ? <MedicalSourcesLink sourceIds={['energyTarget', 'macroRanges']} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  spot: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 16, backgroundColor: SPOT.bg },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  centreValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 30, color: SPOT.text },
  headline: { color: SPOT.text, fontSize: 17, lineHeight: 24 },
  art: { width: 64, height: 64 },
  macros: { flexDirection: 'row', gap: 14 },
  macro: { flex: 1, minWidth: 0, gap: 5 },
  macroValue: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: SPOT.text },
  macroTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: SPOT.hairline },
  macroFill: { height: 4, borderRadius: 2 },
  ctaBlock: { borderTopWidth: 1, borderTopColor: SPOT.hairline, paddingTop: 4 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  button: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SPOT.button,
  },
  tonal: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'flex-start' },
  bone: { borderRadius: 8, backgroundColor: SPOT.skeleton },
});
