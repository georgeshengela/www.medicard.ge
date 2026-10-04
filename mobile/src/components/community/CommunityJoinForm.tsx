import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Switch } from '@/components/ui/AppSwitch';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ChevronDown, ChevronUp, ShieldCheck, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUTH_KEYBOARD_OPEN_PX, authFooterBottomPad } from '@/lib/authChrome';
import { useKeyboardMetrics } from '@/lib/useKeyboardHeight';
import { COMMUNITY_CTA, useCommunityColors as useThemeColors } from '@/components/community/communityPalette';
import { openEmail } from '@/lib/openEmail';
import { tx } from '@/i18n/locale';

type Props = {
  alias: string;
  onAliasChange: (value: string) => void;
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
  rules: string;
  busy: boolean;
  onJoin: () => void;
};

/** The same animated, pinned keyboard footer as sign-in; never nest it in keyboard avoidance. */
export function CommunityJoinForm({ alias, onAliasChange, accepted, onAcceptedChange, rules, busy, onJoin }: Props) {
  const c = useThemeColors();
  const safe = useSafeAreaInsets();
  const { height, durationMs } = useKeyboardMetrics();
  const [focused, setFocused] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const keyboardOpen = height > AUTH_KEYBOARD_OPEN_PX;
  const compact = keyboardOpen || focused;
  const bottom = useSharedValue(authFooterBottomPad(0, safe.bottom));
  const disabled = busy || !accepted || alias.trim().length < 2;

  useEffect(() => {
    bottom.value = withTiming(authFooterBottomPad(height, safe.bottom), {
      duration: durationMs,
      easing: Easing.bezier(0.17, 0.59, 0.4, 0.77),
    });
  }, [bottom, durationMs, height, safe.bottom]);
  const footerStyle = useAnimatedStyle(() => ({ paddingBottom: bottom.value }));
  const submit = () => {
    if (disabled) return;
    Keyboard.dismiss();
    onJoin();
  };
  const copy = { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 21, color: c.text200 };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: compact ? 4 : 16, paddingBottom: 20, gap: compact ? 14 : 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={false}
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessible={false} onPress={Keyboard.dismiss} style={{ gap: 10 }}>
          {!compact && <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><ShieldCheck size={26} color={c.primary100} /></View>}
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: compact ? 19 : 24, lineHeight: compact ? 28 : 34, color: c.text100 }}>{tx('სივრცე, სადაც მოგისმენენ', 'A space where you’re heard')}</Text>
          {!compact && <Text style={copy}>{tx('აირჩიე მეტსახელი. ანონიმურ პოსტებზე ის სხვა წევრებს არ გამოუჩნდება.', 'Choose a nickname. Other members won’t see it on anonymous posts.')}</Text>}
        </Pressable>

        <View style={{ gap: 8 }}>
          <Text style={{ ...copy, color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{tx('შენი საჯარო მეტსახელი', 'Your public nickname')}</Text>
          <TextInput
            accessibilityLabel={tx('საჯარო მეტსახელი', 'Public nickname')}
            placeholder={tx('როგორ მოგმართოთ?', 'What should we call you?')}
            placeholderTextColor={c.text200}
            value={alias}
            onChangeText={onAliasChange}
            onFocus={() => { setFocused(true); scroll.current?.scrollTo({ y: 0, animated: true }); }}
            onBlur={() => setFocused(false)}
            onSubmitEditing={Keyboard.dismiss}
            returnKeyType="done"
            autoCorrect={false}
            maxLength={40}
            editable={!busy}
            style={{ minHeight: 54, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: focused ? c.primary100 : c.bg300, backgroundColor: c.surface, color: c.text100, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15 }}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Switch accessibilityLabel={tx('ვეთანხმები სივრცის წესებს', 'I agree to the space rules')} value={accepted} disabled={busy} onValueChange={onAcceptedChange} trackColor={{ true: COMMUNITY_CTA, false: c.bg300 }} />
          <Text style={{ ...copy, flex: 1, color: c.text100 }}>{tx('გავეცანი წესებს და ანონიმურობის პირობებს', 'I’ve read the rules and anonymity terms')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('სივრცის წესები და ანონიმურობა', 'Space rules and anonymity')}
          accessibilityState={{ expanded: rulesExpanded && !compact }}
          onPress={() => { Keyboard.dismiss(); setFocused(false); setRulesExpanded(compact || !rulesExpanded); }}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <ShieldCheck size={18} color={c.primary100} />
          <Text style={{ ...copy, flex: 1, color: c.primary100 }}>{tx('სივრცის წესები და ანონიმურობა', 'Space rules and anonymity')}</Text>
          {rulesExpanded && !compact ? <ChevronUp size={18} color={c.primary100} /> : <ChevronDown size={18} color={c.primary100} />}
        </Pressable>
        {rulesExpanded && !compact && <Text style={copy}>{rules}</Text>}
        {!compact && <Pressable accessibilityRole="link" onPress={() => void openEmail('support@medicard.ge')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={copy}>{tx('დახმარება · support@medicard.ge', 'Help · support@medicard.ge')}</Text></Pressable>}
      </ScrollView>

      <Animated.View style={[{ paddingHorizontal: 22, paddingTop: 12, borderTopWidth: 1, borderColor: c.bg300, backgroundColor: c.surface }, footerStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('შემოუერთდი სივრცეს', 'Join the space')} accessibilityState={{ disabled, busy }} disabled={disabled} onPress={submit} style={{ minHeight: 50, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COMMUNITY_CTA, opacity: disabled ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Users size={20} color="#FFFFFF" />}
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#FFFFFF' }}>{tx('შემოუერთდი სივრცეს', 'Join the space')}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
