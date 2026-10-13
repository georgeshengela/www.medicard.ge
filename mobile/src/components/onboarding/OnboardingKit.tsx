import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { tx } from '@/i18n/locale';
import { velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

/**
 * Registration and „დაასრულე პროფილი“ in the sign-in's velvet, kept moderate (owner 2026-10-11:
 * „ზომიერად“): one page colour, options rest lightly on it and sink in when chosen, one teal button.
 * Text keeps full-contrast ink — the material decorates, it never carries the copy.
 */

const GUTTER = 20;

function tick() {
  void Haptics.selectionAsync().catch(() => undefined);
}

/** The pressed-in look of a chosen option: a shallow well with a thin teal line around it. */
function chosenShadow(p: VelvetPalette) {
  return `${velvetField(p)}, 0px 0px 0px 1.5px ${p.pulse}`;
}

/** Light resting lift for small pills (lighter than `velvetLift`, which is button-sized). */
function pillLift(p: VelvetPalette) {
  return `-2px -2px 5px ${p.light}, 2px 3px 7px ${p.shade}`;
}

/** Back disc · progress grooves · „გამოტოვება“. */
export function StepHeader({
  palette: p,
  step,
  total,
  onBack,
  onSkip,
  skipLabel,
}: {
  palette: VelvetPalette;
  step: number;
  total: number;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: GUTTER, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('უკან', 'Back')}
          onPress={onBack}
          hitSlop={10}
          style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, boxShadow: velvetLift(p) }}
        >
          <ChevronLeft size={22} color={p.ink} strokeWidth={2.2} />
        </Pressable>
      ) : (
        <View style={{ width: 42, height: 42 }} />
      )}
      {total > 1 ? (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={tx(`ნაბიჯი ${step + 1} / ${total}`, `Step ${step + 1} of ${total}`)}
          style={{ flex: 1, flexDirection: 'row', gap: total > 8 ? 5 : 7 }}
        >
          {Array.from({ length: total }, (_, index) => (
            <View key={index} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: p.surface, boxShadow: velvetField(p), overflow: 'hidden' }}>
              {index <= step ? <View style={{ flex: 1, borderRadius: 3, backgroundColor: p.pulse, opacity: index === step ? 1 : 0.55 }} /> : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {onSkip ? (
        <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={10} style={{ minWidth: 42, minHeight: 42, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 20, color: p.ink }}>{skipLabel ?? tx('გამოტოვება', 'Skip')}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 42 }} />
      )}
    </View>
  );
}

type Primary = { label: string; onPress: () => void; disabled?: boolean; busy?: boolean };

/** One question page: header, title + line, the answer, a pinned teal button above the keyboard. */
export function QuestionPage({
  palette: p,
  header,
  title,
  body,
  primary,
  error,
  footerBelow,
  center = false,
  children,
}: {
  palette: VelvetPalette;
  /** One big control (a wheel, a ruler): it sits in the middle of the free space, not under the title. */
  center?: boolean;
  header: React.ReactNode;
  title: string;
  body?: string;
  primary?: Primary | null;
  error?: string | null;
  footerBelow?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <KeyboardFormShell
      background={p.surface}
      header={header}
      dismissOnTap={!center}
      contentStyle={{ paddingHorizontal: GUTTER, paddingTop: 14 }}
      footer={
        primary || footerBelow || error ? (
          <View style={{ gap: 4 }}>
            {/* Above the button, never under a wheel or ruler at the end of the scroll (small iPhones). */}
            {error ? (
              <View style={{ marginBottom: 8 }}>
                <VelvetNotice palette={p} text={error} />
              </View>
            ) : null}
            {primary ? (
              <VelvetButton palette={p} label={primary.label} onPress={primary.onPress} disabled={primary.disabled} busy={primary.busy} />
            ) : null}
            {footerBelow}
          </View>
        ) : undefined
      }
    >
      <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 35, color: p.text }}>
        {title}
      </Text>
      {body ? (
        <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 23, color: p.ink2 }}>{body}</Text>
      ) : null}
      <View style={center ? { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 } : { marginTop: 24 }}>{children}</View>
    </KeyboardFormShell>
  );
}

/** A small question inside a page (a second part of the same topic). */
export function GroupLabel({ palette: p, text, hint, first = false }: { palette: VelvetPalette; text: string; hint?: string; first?: boolean }) {
  return (
    <View style={{ marginTop: first ? 0 : 30, marginBottom: 12 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 23, color: p.text }}>{text}</Text>
      {hint ? <Text style={{ marginTop: 3, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: p.inkOff }}>{hint}</Text> : null}
    </View>
  );
}

export type ChoiceItem = { key: string; label: string; sub?: string; icon?: LucideIcon };

function Mark({ palette: p, on, multi }: { palette: VelvetPalette; on: boolean; multi: boolean }) {
  const r = multi ? 8 : 12;
  return on ? (
    <View style={{ width: 24, height: 24, borderRadius: r, backgroundColor: p.pulse, alignItems: 'center', justifyContent: 'center' }}>
      <Check size={15} color="#FFFFFF" strokeWidth={3} />
    </View>
  ) : (
    <View style={{ width: 24, height: 24, borderRadius: r, backgroundColor: p.field, boxShadow: velvetField(p) }} />
  );
}

/** Answers as full-width rows. Single choice reads as a radio group, several as checkboxes. */
export function ChoiceList({
  palette: p,
  items,
  selected,
  onPress,
  multi = false,
}: {
  palette: VelvetPalette;
  items: ChoiceItem[];
  selected: string[];
  onPress: (key: string) => void;
  multi?: boolean;
}) {
  return (
    <View accessibilityRole={multi ? undefined : 'radiogroup'} style={{ gap: 12 }}>
      {items.map((item) => {
        const on = selected.includes(item.key);
        const Icon = item.icon;
        return (
          <Pressable
            key={item.key}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            accessibilityLabel={item.sub ? `${item.label}. ${item.sub}` : item.label}
            onPress={() => {
              tick();
              onPress(item.key);
            }}
            style={{
              minHeight: 60,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 16,
              paddingVertical: 13,
              borderRadius: 20,
              backgroundColor: on ? p.field : p.surface,
              boxShadow: on ? chosenShadow(p) : velvetLift(p),
            }}
          >
            {Icon ? <Icon size={20} color={on ? p.pulse : p.inkOff} strokeWidth={2} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: on ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold', fontSize: 16, lineHeight: 22, color: on ? p.ink : p.text }}>
                {item.label}
              </Text>
              {item.sub ? (
                <Text style={{ marginTop: 2, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: p.ink2 }}>{item.sub}</Text>
              ) : null}
            </View>
            <Mark palette={p} on={on} multi={multi} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Short answers as pills that wrap (several at once, or one). */
export function ChipGroup({
  palette: p,
  items,
  selected,
  onPress,
  multi = true,
}: {
  palette: VelvetPalette;
  items: ChoiceItem[];
  selected: string[];
  onPress: (key: string) => void;
  multi?: boolean;
}) {
  return (
    <View accessibilityRole={multi ? undefined : 'radiogroup'} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((item) => {
        const on = selected.includes(item.key);
        return (
          <Pressable
            key={item.key}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={multi ? { checked: on } : { selected: on }}
            onPress={() => {
              tick();
              onPress(item.key);
            }}
            style={{
              minHeight: 42,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: on ? 13 : 16,
              borderRadius: 21,
              backgroundColor: on ? p.field : p.surface,
              boxShadow: on ? chosenShadow(p) : pillLift(p),
            }}
          >
            {on ? <Check size={15} color={p.pulse} strokeWidth={3} /> : null}
            <Text style={{ fontFamily: on ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_600SemiBold', fontSize: 14.5, lineHeight: 20, color: on ? p.ink : p.text }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Numbers as square keys in a row or grid (hours of sleep, portions, days). */
export function TileGrid({
  palette: p,
  items,
  selected,
  onPress,
  columns,
  unit,
}: {
  palette: VelvetPalette;
  items: ChoiceItem[];
  selected: string | null;
  onPress: (key: string) => void;
  columns: number;
  /** Small word under every number („საათი“). */
  unit?: string;
}) {
  const rows: ChoiceItem[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 12 }}>
          {row.map((item) => {
            const on = selected === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={unit ? `${item.label} ${unit}` : item.label}
                onPress={() => {
                  tick();
                  onPress(item.key);
                }}
                style={{
                  flex: 1,
                  height: 76,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? p.field : p.surface,
                  boxShadow: on ? chosenShadow(p) : velvetLift(p),
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 30, color: on ? p.ink : p.text }}>{item.label}</Text>
                {unit || item.sub ? (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: on ? p.ink : p.inkOff }}>{item.sub ?? unit}</Text>
                ) : null}
              </Pressable>
            );
          })}
          {row.length < columns ? Array.from({ length: columns - row.length }, (_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />) : null}
        </View>
      ))}
    </View>
  );
}

/** A quiet text action under the teal button („არ ვიცი“, „არა, არ მაქვს“, „გასვლა“). */
export function QuietAction({ palette: p, label, onPress, disabled = false }: { palette: VelvetPalette; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={6} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 20, color: disabled ? p.inkOff : p.ink }}>{label}</Text>
    </Pressable>
  );
}
