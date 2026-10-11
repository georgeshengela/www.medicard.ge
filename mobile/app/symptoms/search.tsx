import { tx } from '@/i18n/locale';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Plus, Search, X } from 'lucide-react-native';
import { ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { SymptomComposer } from '@/components/symptoms/SymptomComposer';
import { KEYBOARD_DONE_ACCESSORY_ID, KeyboardDoneAccessory } from '@/components/ui/KeyboardDoneAccessory';
import { POPULAR_SYMPTOMS } from '@/constants/symptomCatalog';
import { POPULAR_SYMPTOM_ICON_SVG } from '@/constants/symptomIconSvg';
import { useThemeColors } from '@/theme/colors';
import { useToneAccent } from '@/theme/homeAccent';
import { ka } from '@/i18n/ka';
import {
  addSymptom,
  getSymptomCheckerState,
  removeSymptom,
  resetSymptomChecker,
  toggleSymptom,
  updateSymptomChecker,
  useSymptomChecker,
} from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';
import { displayFirstName } from '@/lib/displayName';

export default function SymptomSearchScreen() {
  const c = useThemeColors();
  const accent = useToneAccent();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, healthProfile } = useAuth();
  const state = useSymptomChecker();
  const params = useLocalSearchParams<{ start?: string }>();
  // Entered from Home („აღწერე სიტყვებით“): a fresh check, not the last one still in memory.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (params.start === '1') {
      resetSymptomChecker(user?.gender);
      updateSymptomChecker({ method: 'manual' });
    }
  }, [params.start, user?.gender]);
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Never the server's placeholder name: without a real one the heading has no name.
  const firstName = displayFirstName(user, healthProfile?.extraAnswers);
  const typed = query.trim();

  const filtered = useMemo(() => {
    const q = typed.toLowerCase();
    if (!q) return [...POPULAR_SYMPTOMS];
    return POPULAR_SYMPTOMS.filter((s) => s.toLowerCase().includes(q));
  }, [typed]);

  const alreadyAdded = state.symptoms.some((s) => s.toLowerCase() === typed.toLowerCase());
  const showCustom = typed.length > 0 && !POPULAR_SYMPTOMS.some((s) => s.toLowerCase() === typed.toLowerCase());

  const commitTyped = () => {
    if (typed && !addSymptom(typed)) { setInputError(tx('ერთ შემოწმებაში მაქსიმუმ 16 სიმპტომი შეგიძლია დაამატო.', 'You can add up to 16 symptoms in one check.')); return false; }
    setInputError(null);
    setQuery('');
    return true;
  };

  const goDetails = () => {
    if (!commitTyped()) return;
    if (getSymptomCheckerState().symptoms.length === 0) {
      inputRef.current?.focus();
      return;
    }
    router.push('/symptoms/details' as never);
  };


  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={[s.top, { paddingTop: insets.top + 12 }]}>
          <ModuleHeaderButton label={tx('უკან', 'Back')} icon={ArrowLeft} onPress={() => router.back()} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[s.title, { color: c.text100 }]}>{ka.symptoms.askName(firstName)}</Text>
          <Text style={[s.lead, { color: c.text200 }]}>{ka.symptoms.methodManualHint}</Text>

          <View style={[s.search, { backgroundColor: c.surface, borderColor: typed || focused ? accent.ink : 'transparent' }]}>
            <View style={[s.searchIcon, { backgroundColor: accent.tint }]}>
              <Search size={18} color={accent.ink} strokeWidth={2.2} />
            </View>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              // The lead line above already says „ჩაწერე ან აირჩიე…“; the field keeps only the example, so it fits.
              placeholder={tx('მაგ. ღამის ოფლიანობა', 'e.g. night sweats')}
              placeholderTextColor={c.text300}
              returnKeyType="done"
              maxLength={80}
              inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              onSubmitEditing={() => {
                if (typed) commitTyped();
              }}
              style={[s.input, { color: c.text100 }]}
            />
            {typed ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ka.symptoms.addCustom}
                onPress={commitTyped}
                style={[s.add, { backgroundColor: accent.cta }]}
              >
                <Plus size={16} color={accent.onCta} strokeWidth={2.4} />
                <Text style={[s.addText, { color: accent.onCta }]}>{ka.symptoms.addCustom}</Text>
              </Pressable>
            ) : null}
          </View>

          {state.symptoms.length ? (
            <View style={s.group}>
              <Text style={[s.groupTitle, { color: c.text100 }]}>
                {ka.symptoms.mySymptoms} · {state.symptoms.length}
              </Text>
              <View style={s.wrap}>
                {state.symptoms.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityLabel={`${item} — ${tx('წაშლა', 'Remove')}`}
                    onPress={() => removeSymptom(item)}
                    style={[s.mine, { backgroundColor: accent.soft }]}
                  >
                    <Text numberOfLines={1} style={[s.chipText, { color: accent.ink }]}>
                      {item}
                    </Text>
                    <X size={15} color={accent.ink} strokeWidth={2.4} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {showCustom ? (
            <View style={s.group}>
              <View style={s.wrap}>
                <IconChip
                  label={typed}
                  icon={null}
                  selected={alreadyAdded}
                  onPress={() => (alreadyAdded ? removeSymptom(typed) : addSymptom(typed))}
                />
              </View>
            </View>
          ) : null}

          {filtered.length ? (
            <View style={s.group}>
              {typed ? null : <Text style={[s.groupTitle, { color: c.text100 }]}>{tx('ხშირი სიმპტომები', 'Common symptoms')}</Text>}
              <View style={s.wrap}>
                {filtered.map((item) => (
                  <IconChip
                    key={item}
                    label={item}
                    icon={POPULAR_SYMPTOM_ICON_SVG[POPULAR_SYMPTOMS.indexOf(item)] ?? null}
                    selected={state.symptoms.some((picked) => picked.toLowerCase() === item.toLowerCase())}
                    onPress={() => toggleSymptom(item)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>

        {inputError ? (
          <Text accessibilityRole="alert" style={{ color: c.danger, paddingHorizontal: 20, paddingVertical: 8 }}>
            {inputError}
          </Text>
        ) : null}
        <SymptomComposer
          count={state.symptoms.length + (typed && !alreadyAdded ? 1 : 0)}
          onFocusInput={() => inputRef.current?.focus()}
          onAnatomy={() => {
            updateSymptomChecker({ method: 'anatomy' });
            router.push('/symptoms/body' as never);
          }}
          onContinue={goDetails}
          disabled={state.symptoms.length === 0 && !typed}
        />
      </KeyboardAvoidingView>
      <KeyboardDoneAccessory />
      <View style={{ height: insets.bottom, backgroundColor: c.bg100 }} />
    </View>
  );
}

/** A common symptom: white chip, hairline edge, its Health Icon in the accent ink — the Home chips' look. */
function IconChip({ label, icon, selected, onPress }: { label: string; icon: string | null; selected: boolean; onPress: () => void }) {
  const c = useThemeColors();
  const accent = useToneAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.chip, { backgroundColor: selected ? accent.soft : c.surface, borderColor: selected ? accent.ink : c.bg200 }]}
    >
      {selected ? (
        <Check size={17} color={accent.ink} strokeWidth={2.6} />
      ) : icon ? (
        <SvgXml xml={icon} width={19} height={19} color={accent.ink} />
      ) : (
        <Plus size={17} color={accent.ink} strokeWidth={2.4} />
      )}
      <Text numberOfLines={1} style={[s.chipText, { color: selected ? accent.ink : c.text100 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row' },
  scroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24 },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 34, letterSpacing: -0.3 },
  lead: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, marginTop: 4 },
  search: {
    marginTop: 18,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 15,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  add: { minHeight: 38, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18 },
  group: { marginTop: 22, gap: 12 },
  groupTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingLeft: 11,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
  },
  mine: { minHeight: 38, borderRadius: 19, paddingLeft: 14, paddingRight: 11, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  chipText: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 19, flexShrink: 1 },
});
