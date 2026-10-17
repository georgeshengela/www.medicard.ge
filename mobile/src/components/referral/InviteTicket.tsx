import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { CalendarClock, CircleCheck, Gift } from 'lucide-react-native';
import { COIN_ART } from '@/constants/appArt';
import { tx } from '@/i18n/locale';
import { velvetField, velvetLift, type VelvetPalette } from '@/theme/velvet';

const CODE_LENGTH = 6;

/** The ticket's own depth: a little more than a button, far less than the welcome disc (velvet „ზომიერად“). */
const ticketShadow = (p: VelvetPalette) => `10px 12px 24px ${p.shade}, -8px -8px 18px ${p.light}`;

export type TicketInviter = { name: string; kind: 'friend' | 'influencer'; at?: string | null; coins?: number; photoUri?: string | null };

type Props = {
  palette: VelvetPalette;
  mode: 'ask' | 'invited' | 'late';
  code: string;
  onChangeCode: (code: string) => void;
  onSubmit: () => void;
  error?: string | null;
  coins: number;
  /** Under the perforation: how long a code can still be entered, or why it can't. */
  footnote?: string | null;
  inviter?: TicketInviter | null;
  /** Just accepted in this visit: the seal reads „მიღებულია“. */
  fresh?: boolean;
  autoFocus?: boolean;
};

function CoinChip({ palette: p, label }: { palette: VelvetPalette; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 11, height: 30, borderRadius: 15, backgroundColor: p.surface, boxShadow: velvetLift(p) }}>
      <Image source={COIN_ART} style={{ width: 20, height: 20 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: p.ink }}>{label}</Text>
    </View>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] ?? '').join('').toUpperCase() || '?';
}

/**
 * „ვინ მოგიწვია?“ — the page's one bold element: a velvet ticket. Asking: six code wells (letters and 2–9, typed
 * through one hidden field), the coin reward and the time left. Answered: who invited you, when, what you got.
 * Too late: the wells under a quiet „ვადა გავიდა“ stamp.
 */
export function InviteTicket({ palette: p, mode, code, onChangeCode, onSubmit, error, coins, footnote, inviter, fresh = false, autoFocus = false }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  const inner = Math.min(width, 520) - 40 - 40;
  const gap = 8;
  const box = Math.max(36, Math.min(50, Math.floor((inner - gap * (CODE_LENGTH - 1)) / CODE_LENGTH)));
  const cells = code.padEnd(CODE_LENGTH, ' ').slice(0, CODE_LENGTH).split('');
  const late = mode === 'late';

  const top =
    mode === 'invited' && inviter ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, padding: 3, backgroundColor: p.surface, boxShadow: velvetLift(p) }}>
          {inviter.photoUri ? (
            <Image source={{ uri: inviter.photoUri }} style={{ width: 52, height: 52, borderRadius: 26 }} accessibilityIgnoresInvertColors />
          ) : (
            <View style={{ flex: 1, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: p.field, boxShadow: velvetField(p) }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: p.ink }}>{initials(inviter.name)}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: p.ink2 }}>{tx('შენი მომწვევი', 'Invited by')}</Text>
          <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 26, color: p.text }}>{inviter.name}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, color: p.inkOff }}>
            {inviter.kind === 'influencer' ? tx('ინფლუენსერი', 'Influencer') : tx('მეგობარი', 'Friend')}
          </Text>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <CircleCheck size={30} color={p.pulse} strokeWidth={2} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11, color: p.pulse }}>{fresh ? tx('მიღებულია', 'Accepted') : tx('შეყვანილია', 'Entered')}</Text>
        </View>
      </View>
    ) : (
      <Pressable
        accessibilityRole="none"
        onPress={() => (late ? undefined : inputRef.current?.focus())}
        style={{ position: 'relative' }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap, opacity: late ? 0.45 : 1 }} pointerEvents="none">
          {cells.map((ch, index) => {
            const next = !late && focused && index === Math.min(code.length, CODE_LENGTH - 1);
            const ring = error ? p.danger : next ? p.pulse : null;
            return (
              <View
                key={index}
                style={{
                  width: box,
                  height: box + 10,
                  borderRadius: 14,
                  backgroundColor: p.field,
                  boxShadow: ring ? `${velvetField(p)}, 0px 0px 0px 1.5px ${ring}` : velvetField(p),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: Math.round(box * 0.5), color: p.text }}>{ch.trim() ? ch : ''}</Text>
              </View>
            );
          })}
        </View>
        {late ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: '-7deg' }], paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, borderWidth: 2, borderColor: p.inkOff, backgroundColor: p.surface }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, letterSpacing: 0.5, color: p.ink2 }}>{tx('ვადა გავიდა', 'Expired')}</Text>
            </View>
          </View>
        ) : (
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(text) => onChangeCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
            onSubmitEditing={() => {
              if (code.length === CODE_LENGTH) onSubmit();
            }}
            autoFocus={autoFocus}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'visible-password'}
            returnKeyType="done"
            maxLength={CODE_LENGTH}
            caretHidden
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            accessibilityLabel={tx('მოწვევის კოდი, 6 ნიშანი', 'Invite code, 6 characters')}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: box + 10, opacity: 0.02, color: 'transparent', backgroundColor: 'transparent', borderWidth: 0, fontSize: 16, ...(Platform.OS === 'web' ? { outlineWidth: 0 } : null) }}
          />
        )}
      </Pressable>
    );

  return (
    <View style={{ borderRadius: 26, backgroundColor: p.surface, boxShadow: ticketShadow(p) }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20, gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: p.field, boxShadow: velvetField(p) }}>
            <Gift size={18} color={p.pulse} strokeWidth={2.1} />
          </View>
          <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: p.text }}>
            {tx('მოწვევის კოდი', 'Invite code')}
          </Text>
          {coins > 0 ? <CoinChip palette={p} label={`+${coins}`} /> : null}
        </View>
        {top}
      </View>

      {/* The tear line: two notches cut into the ticket's edges and a dashed perforation between them. */}
      <View style={{ height: 22, justifyContent: 'center' }}>
        <View style={{ marginHorizontal: 20, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: p.shade }} />
        <View style={{ position: 'absolute', left: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: p.surface, boxShadow: velvetField(p) }} />
        <View style={{ position: 'absolute', right: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: p.surface, boxShadow: velvetField(p) }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 }}>
        <CalendarClock size={18} color={late ? p.inkOff : p.pulse} strokeWidth={2.1} />
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13.5, lineHeight: 20, color: late ? p.ink2 : p.text }}>{footnote ?? ' '}</Text>
      </View>
    </View>
  );
}
