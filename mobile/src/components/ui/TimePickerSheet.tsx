import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Clock, Plus, X } from 'lucide-react-native';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ColumnWheel, WHEEL_ITEM_HEIGHT, WHEEL_PAD } from '@/components/assessment/DateWheelPicker';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { useIsDark, useThemeColors } from '@/theme/colors';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_STEP = 5;
const DEFAULT_QUICK = ['08:00', '09:00', '12:00', '18:00', '20:00'];

const pad = (n: number) => String(n).padStart(2, '0');

export function parseClock(value: string | null | undefined): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  const hour = m ? Math.min(23, Math.max(0, Number(m[1]))) : 9;
  const minute = m ? Math.min(59, Math.max(0, Number(m[2]))) : 0;
  return { hour, minute };
}

/**
 * Pick a time without the keyboard: the big time on top, two snapping wheels (hours · minutes in
 * 5-minute steps, plus the current minute if it is off-step) and a row of common times. Colours follow
 * the theme (and a module's tone); `fill` is the confirm button (white text — pass an AA-safe colour).
 */
export function TimePickerSheet({
  visible,
  title,
  subtitle,
  value,
  fill,
  quickTimes = DEFAULT_QUICK,
  onClose,
  onApply,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  value: string;
  fill?: string;
  quickTimes?: string[];
  onClose: () => void;
  onApply: (time: string) => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const [{ hour, minute }, setTime] = useState(() => parseClock(value));

  useEffect(() => {
    if (visible) setTime(parseClock(value));
  }, [visible, value]);

  const minutes = useMemo(() => {
    const list = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
    return list.includes(minute) ? list : [...list, minute].sort((a, b) => a - b);
  }, [minute]);

  const time = `${pad(hour)}:${pad(minute)}`;
  const ink = dark ? c.primary100 : c.primary200;
  const confirmFill = fill ?? c.primary100;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) + 4 }}
        >
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: c.bg300, alignSelf: 'center' }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25, color: c.text100 }}>{title}</Text>
              {subtitle ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: c.text200 }}>{subtitle}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={onClose} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.bg200, alignItems: 'center', justifyContent: 'center' }}>
              <X size={20} color={c.text100} />
            </Pressable>
          </View>

          {/* The chosen time, large — the wheels below change it. */}
          <Text accessibilityLiveRegion="polite" style={{ marginTop: 14, textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 44, lineHeight: 54, letterSpacing: -1, color: c.text100 }}>
            {time}
          </Text>

          <View style={{ height: WHEEL_ITEM_HEIGHT * 5, marginTop: 4 }}>
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: WHEEL_PAD, height: WHEEL_ITEM_HEIGHT, borderRadius: 16, backgroundColor: c.accent100 }} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 40 }}>
              <ColumnWheel
                flex={1}
                values={HOURS}
                selected={hour}
                onSelect={(v) => setTime((t) => ({ ...t, hour: Number(v) }))}
                format={(v) => pad(Number(v))}
                selectedColor={ink}
                fontSize={26}
              />
              <Text style={{ width: 24, textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, color: ink }}>:</Text>
              <ColumnWheel
                flex={1}
                values={minutes}
                selected={minute}
                onSelect={(v) => setTime((t) => ({ ...t, minute: Number(v) }))}
                format={(v) => pad(Number(v))}
                selectedColor={ink}
                fontSize={26}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {quickTimes.map((quick) => {
              const on = quick === time;
              return (
                <Pressable
                  key={quick}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={quick}
                  onPress={() => setTime(parseClock(quick))}
                  style={{ flex: 1, minHeight: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.accent100 : c.bg200 }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: on ? ink : c.text200 }}>{quick}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx(`შენახვა, ${time}`, `Save, ${time}`)}
            onPress={() => onApply(time)}
            style={{ marginTop: 18, minHeight: 52, borderRadius: 17, backgroundColor: confirmFill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Check size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF' }}>{tx(`შენახვა · ${time}`, `Save · ${time}`)}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Same chrome as `Input figma`: label above, the field below. `onPress` makes the main area a button;
 * `trailing` sits beside it (never inside — no button in a button).
 */
function FieldShell({ label, hint, children, onPress, trailing, accessibilityLabel }: {
  label?: string; hint?: string; children: React.ReactNode; onPress?: () => void; trailing?: React.ReactNode; accessibilityLabel: string;
}) {
  const c = useThemeColors();
  const auth = useFigmaAuth();
  const main = <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: auth.inputMinHeight - 2, paddingVertical: 6 }}>{children}</View>;
  return (
    <View style={{ width: '100%' }}>
      {label ? <Text style={{ marginBottom: 8, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: auth.labelSize, lineHeight: 20, color: auth.labelColor }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: auth.inputRadius, backgroundColor: auth.inputBg, borderWidth: 1, borderColor: auth.inputBorder, paddingHorizontal: auth.inputPaddingX, ...FIGMA_AUTH_SHADOW }}>
        {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={{ flex: 1 }}>{main}</Pressable> : main}
        {trailing}
      </View>
      {hint ? <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17, color: c.text300 }}>{hint}</Text> : null}
    </View>
  );
}

/** One optional time („09:00“, or empty = not known). Tap → wheels; the small × clears it again. */
export function TimeField({ label, value, onChange, placeholder = tx('არჩევა', 'Choose'), hint, sheetTitle, fill }: {
  label: string; value: string; onChange: (next: string) => void; placeholder?: string; hint?: string; sheetTitle?: string; fill?: string;
}) {
  const c = useThemeColors();
  const auth = useFigmaAuth();
  const [open, setOpen] = useState(false);
  const has = /^\d{1,2}:\d{2}$/.test(value.trim());
  return (
    <>
      <FieldShell
        label={label}
        hint={hint}
        onPress={() => setOpen(true)}
        accessibilityLabel={`${label}: ${has ? value : placeholder}`}
        trailing={has ? (
          <Pressable accessibilityRole="button" accessibilityLabel={tx('დროის მოხსნა', 'Clear time')} hitSlop={10} onPress={() => onChange('')} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg200 }}>
            <X size={14} color={c.text200} strokeWidth={2.4} />
          </Pressable>
        ) : undefined}
      >
        <Clock size={20} color={has ? c.primary200 : auth.iconMuted} strokeWidth={2} />
        <Text style={{ flex: 1, fontFamily: has ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_400Regular', fontSize: has ? 18 : 16, lineHeight: 24, color: has ? c.text100 : auth.placeholder }}>
          {has ? value : placeholder}
        </Text>
      </FieldShell>
      <TimePickerSheet
        visible={open}
        title={sheetTitle ?? label}
        value={has ? value : '09:00'}
        fill={fill}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          setOpen(false);
          onChange(next);
        }}
      />
    </>
  );
}

/** Several times a day („08:00,20:00“): one chip per time with ×, and „+ დრო“ that opens the wheels. */
export function TimesField({ label, value, onChange, hint, fill }: {
  label: string; value: string; onChange: (next: string) => void; hint?: string; fill?: string;
}) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  const list = value.split(',').map((t) => t.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t));
  const set = (next: string[]) => onChange([...new Set(next)].sort().join(','));
  return (
    <>
      <FieldShell label={label} hint={hint} accessibilityLabel={label}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 }}>
          {list.map((t) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 12, paddingRight: 6, borderRadius: 18, backgroundColor: c.accent100 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: c.primary100 }}>{t}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={tx(`${t} — მოხსნა`, `Remove ${t}`)} hitSlop={8} onPress={() => set(list.filter((x) => x !== t))} style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color={c.primary100} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel={tx('დროის დამატება', 'Add a time')} onPress={() => setOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: c.primary200 }}>
            <Plus size={15} color={c.primary100} strokeWidth={2.4} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: c.primary100 }}>{tx('დრო', 'Time')}</Text>
          </Pressable>
        </View>
      </FieldShell>
      <TimePickerSheet
        visible={open}
        title={label}
        value={list[list.length - 1] ?? '08:00'}
        fill={fill}
        onClose={() => setOpen(false)}
        onApply={(next) => {
          setOpen(false);
          set([...list, next]);
        }}
      />
    </>
  );
}
