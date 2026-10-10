import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  ArrowUpRight, CalendarClock, Check, Droplet, Flower2, Footprints, PawPrint, Pill, Scale, Sparkles, ThumbsDown, ThumbsUp, Utensils, X, type LucideIcon,
} from 'lucide-react-native';
import { Markdown } from '@/components/ui/Markdown';
import type { ActionState, MediTurn } from '@/lib/mediThread';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { hubInk, hubTint, type HubInk } from '@/theme/hub';
import { tx } from '@/i18n/locale';
import { MediOrb } from './MediOrb';
import { MediMascot } from './mascot/MediMascot';
import { consiliumInk } from './mediTheme';

const body = { fontSize: 15, lineHeight: 24, fontFamily: 'NotoSansGeorgian_400Regular' } as const;

export const UserTurn = memo(function UserTurn({ text }: { text: string }) {
  const c = useThemeColors();
  const dark = useIsDark();
  return (
    <View style={{ alignItems: 'flex-end', paddingLeft: 48 }}>
      <View style={{ backgroundColor: dark ? '#134E4A' : '#DDF3EF', borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 15, paddingVertical: 10 }}>
        <Text selectable style={{ ...body, color: dark ? '#E6FFFA' : '#0B3B37' }}>{text}</Text>
      </View>
    </View>
  );
});

/** Medi's short planner replies: no bubble, just Medi speaking beside its orb. */
export const MediLine = memo(function MediLine({ text }: { text: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingRight: 24 }}>
      <View style={{ paddingTop: 2 }}><MediOrb size={24} /></View>
      <Text selectable style={{ ...body, flex: 1, color: c.text100 }}>{text}</Text>
    </View>
  );
});

/** A clinical answer (doctor or consilium): full width, markdown, the voice that answered named once. */
export const AnswerTurn = memo(function AnswerTurn({ text, deep, streaming, interactionId, feedbackRating, onRate }: {
  text: string; deep: boolean; streaming?: boolean; interactionId?: string; feedbackRating?: 1 | -1; onRate: (rating: 1 | -1) => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = deep ? consiliumInk(dark) : c.text200;
  // Before the first words Medi thinks in the answer's place; the header and text take over once it writes.
  if (streaming && !text && !deep) {
    return (
      <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <MediMascot mood="think" size={52} crop="snug" />
        <Text style={{ ...body, color: c.text300 }}>{tx('პასუხს ვწერ…', 'Writing the answer…')}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <MediOrb size={24} deep={deep} breathing={streaming && !text} />
        <Text style={{ color: ink, fontSize: 12, lineHeight: 16, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
          {deep ? tx('კონსილიუმი · ერთობლივი პასუხი', 'Consilium · joint answer') : tx('Medi · ჯანმრთელობის პასუხი', 'Medi · health answer')}
        </Text>
      </View>
      <View style={deep ? { borderLeftWidth: 2, borderLeftColor: `${consiliumInk(dark)}55`, paddingLeft: 12 } : { paddingLeft: 2 }}>
        {text ? <Markdown content={text} /> : (
          <Text style={{ ...body, color: c.text300 }}>{deep ? tx('სპეციალისტები განიხილავენ…', 'The specialists are reviewing…') : tx('პასუხს ვწერ…', 'Writing the answer…')}</Text>
        )}
        {/* While the answer streams Medi talks at its end (consilium keeps the cursor); it leaves when the answer is done. */}
        {streaming && text ? deep
          ? <View style={{ width: 8, height: 16, borderRadius: 2, marginTop: 2, backgroundColor: consiliumInk(dark), opacity: 0.6 }} />
          : <MediMascot mood="talk" size={52} crop="snug" style={{ marginTop: 4 }} /> : null}
      </View>
      {interactionId && !streaming ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 2 }}>
          {feedbackRating ? (
            <Text style={{ color: c.text300, fontSize: 12, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tx('მადლობა შეფასებისთვის', 'Thanks for the feedback')}</Text>
          ) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('სასარგებლო პასუხია', 'Helpful answer')} onPress={() => onRate(1)} hitSlop={6}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <ThumbsUp size={16} color={c.text300} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('პასუხი არ დამეხმარა', 'Not helpful')} onPress={() => onRate(-1)} hitSlop={6}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <ThumbsDown size={16} color={c.text300} />
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
});

export function ThinkingTurn({ label, deep }: { label: string; deep: boolean }) {
  const c = useThemeColors();
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {deep ? <MediOrb size={24} deep breathing /> : <MediMascot mood="think" size={52} crop="snug" />}
      <Text style={{ color: c.text200, fontSize: 14, fontFamily: 'NotoSansGeorgian_400Regular' }}>{label}</Text>
    </View>
  );
}

/** After a saved action: Medi nods „yes“, winks, then steps away (`onDone`). Decoration only — the card says „შენახულია“. */
export function SavedNod({ onDone }: { onDone: () => void }) {
  const [mood, setMood] = useState<'yes' | 'wink'>('yes');
  useEffect(() => {
    const wink = setTimeout(() => setMood('wink'), 1300);
    const done = setTimeout(onDone, 3300);
    return () => { clearTimeout(wink); clearTimeout(done); };
  }, [onDone]);
  return <MediMascot mood={mood} size={56} crop="snug" />;
}

function actionLook(tool: string): { icon: LucideIcon; ink: HubInk } {
  if (tool.startsWith('medication_') || tool === 'dose_record') return { icon: Pill, ink: 'blue' };
  if (tool.startsWith('visit_')) return { icon: CalendarClock, ink: 'teal' };
  if (tool.startsWith('hydration_')) return { icon: Droplet, ink: 'sky' };
  if (tool.startsWith('nutrition_')) return { icon: Utensils, ink: 'green' };
  if (tool === 'weight_goal') return { icon: Scale, ink: 'green' };
  if (tool === 'steps_goal') return { icon: Footprints, ink: 'amber' };
  if (/^(period|cycle|pregnancy)_/.test(tool)) return { icon: Flower2, ink: 'rose' };
  if (tool.startsWith('pet_')) return { icon: PawPrint, ink: 'violet' };
  if (tool === 'open' || tool.endsWith('_open') || tool.endsWith('_consult')) return { icon: ArrowUpRight, ink: 'teal' };
  return { icon: Sparkles, ink: 'teal' };
}

/** What Medi is about to save or open, in the thread, with the decision right on it. */
export function ActionCard({ title, rows, handoff, state, busy, onConfirm, onEdit, onCancel, tool }: {
  title: string; tool: string; rows: { key: string; label: string; value: string }[]; handoff: boolean; state: ActionState; busy: boolean;
  onConfirm: () => void; onEdit: () => void; onCancel: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const look = actionLook(tool);
  const ink = hubInk(look.ink, dark);
  const Icon = look.icon;
  const done = state !== 'pending';
  return (
    <View style={{ marginLeft: 34, borderRadius: 22, backgroundColor: c.surface, padding: 16, gap: 14, opacity: state === 'cancelled' ? 0.55 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: hubTint(ink, dark) }}>
          <Icon size={20} color={ink} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: c.text100, fontSize: 15, lineHeight: 22, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{title}</Text>
          <Text style={{ color: c.text300, fontSize: 12, lineHeight: 17, fontFamily: 'NotoSansGeorgian_400Regular' }}>
            {state === 'saved' ? tx('შენახულია', 'Saved') : state === 'opened' ? tx('გაიხსნა', 'Opened') : state === 'cancelled' ? tx('გაუქმდა', 'Cancelled')
              : handoff ? tx('მზადაა გასახსნელად', 'Ready to open') : tx('შენახვამდე გადაამოწმე', 'Check before saving')}
          </Text>
        </View>
        {state === 'saved' || state === 'opened' ? (
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9488' }}>
            <Check size={16} strokeWidth={2.8} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      {rows.length && !(handoff && done) ? (
        <View style={{ gap: 8 }}>
          {rows.map(row => (
            <View key={row.key} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Text style={{ width: 104, color: c.text300, fontSize: 13, lineHeight: 20, fontFamily: 'NotoSansGeorgian_400Regular' }}>{row.label}</Text>
              <Text selectable style={{ flex: 1, color: c.text100, fontSize: 13, lineHeight: 20, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!done ? (
        <View style={{ gap: 6 }}>
          <Pressable accessibilityRole="button" onPress={onConfirm} disabled={busy}
            style={{ minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D9488', opacity: busy ? 0.6 : 1, flexDirection: 'row', gap: 8 }}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontFamily: 'NotoSansGeorgian_700Bold' }}>{handoff ? tx('გახსნა', 'Open') : tx('შენახვა', 'Save')}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            {!handoff ? (
              <Pressable accessibilityRole="button" onPress={onEdit} disabled={busy} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: c.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('შესწორება', 'Edit')}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onCancel} disabled={busy} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <X size={14} color={c.text300} />
              <Text style={{ color: c.text200, fontSize: 13, fontFamily: 'NotoSansGeorgian_400Regular' }}>{tx('გაუქმება', 'Cancel')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export type TurnRenderer = (turn: MediTurn) => React.ReactNode;
