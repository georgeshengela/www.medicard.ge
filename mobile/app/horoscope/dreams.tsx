import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Search } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { GLASS, GLASS_LINE, HORO_INK, HoroButton, HoroCard, HoroNote, HoroPage, HText } from '@/components/horoscope/HoroUI';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type Dream, type DreamSymbol } from '@/lib/horoscope/horoscopeApi';
import { FRESH } from '@/lib/queryClient';
import { useThemeColors } from '@/theme/colors';

/** A dictionary of dream symbols (search or browse), and the Oracle for a whole dream told in words. */
export default function DreamsScreen() {
  const c = useThemeColors();
  const list = useAccountQuery<{ symbols?: DreamSymbol[] }>({ key: ['horoscope', 'dreams'], fetch: () => horoscopeApi.dreams(), staleTime: FRESH.LONG });
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Dream[] | null>(null);
  const [open, setOpen] = useState<Dream | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return undefined; }
    let alive = true;
    const t = setTimeout(() => { horoscopeApi.dreams(term).then((r) => { if (alive) setResults(r.results ?? []); }).catch(() => { if (alive) setResults([]); }); }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  const show = async (id: string) => {
    try { setOpen(await horoscopeApi.dream(id)); } catch { setOpen(null); }
  };
  const symbols = (list.data?.symbols ?? []).filter((s) => s.ready);
  return (
    <HoroPage header={<ModuleHeader module="horo" subtitle={tx('სიზმრების ახსნა', 'Dream meanings')} fallbackHref="/horoscope" />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: GLASS, borderRadius: 16, borderWidth: 1, borderColor: GLASS_LINE, paddingHorizontal: 14 }}>
        <Search size={18} color={c.text200} />
        <TextInput value={q} onChangeText={setQ} placeholder={tx('რა ნახე სიზმარში? მაგ. წყალი, კბილები', 'What did you dream of? e.g. water, teeth')} placeholderTextColor={c.text300}
          style={{ flex: 1, minHeight: 50, color: c.text100, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15 }} accessibilityLabel={tx('სიზმრის სიმბოლოს ძებნა', 'Search a dream symbol')} />
      </View>

      {open ? (
        <Animated.View entering={FadeIn.duration(350)}>
          <HoroCard style={{ gap: 10, borderColor: 'rgba(233,199,126,0.35)' }}>
            <HText size={22} weight="serif" color="#FBF3E0">{open.word}</HText>
            <HText size={15} lineHeight={25}>{open.text || tx('განმარტება მალე დაემატება.', 'The meaning will be added soon.')}</HText>
            {open.variants?.map((v) => <HText key={v} size={14} muted>{`· ${v}`}</HText>)}
            <Pressable accessibilityRole="button" onPress={() => setOpen(null)} hitSlop={8}><HText size={13} color={HORO_INK}>{tx('დახურვა', 'Close')}</HText></Pressable>
          </HoroCard>
        </Animated.View>
      ) : null}

      <HoroCard style={{ gap: 10, borderColor: 'rgba(185,166,255,0.28)' }}>
        <HText size={15} weight="semibold">{tx('მთელი სიზმარი მოუყევი ორაკულს', 'Tell the whole dream to the Oracle')}</HText>
        <HText size={13} muted>{tx('ლექსიკონი ცალკეულ სიმბოლოს ხსნის; ორაკული მთელ ამბავს ერთად წაიკითხავს.', 'The dictionary explains one symbol; the Oracle reads the whole story together.')}</HText>
        <HoroButton quiet label={tx('სიზმრის მოყოლა', 'Tell my dream')} onPress={() => router.push({ pathname: '/horoscope/oracle', params: { ask: tx('ვნახე სიზმარი: ', 'I dreamt that ') } })} />
      </HoroCard>

      {results ? (
        <HoroCard style={{ paddingVertical: 2 }}>
          {results.length ? results.map((r, i) => (
            <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={r.word} onPress={() => setOpen(r)} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: GLASS_LINE, gap: 2 }}>
              <HText size={15} weight="semibold">{r.word}</HText>
              {r.text ? <HText size={13} muted lines={2}>{r.text}</HText> : null}
            </Pressable>
          )) : <View style={{ paddingVertical: 14 }}><HText muted>{tx('ეს სიმბოლო ლექსიკონში ჯერ არ არის — ჰკითხე ორაკულს.', 'This symbol isn’t in the dictionary yet — ask the Oracle.')}</HText></View>}
        </HoroCard>
      ) : list.isLoading ? <ActivityIndicator color={HORO_INK} /> : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {symbols.map((s) => (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={s.word} onPress={() => void show(s.id)}
              style={{ borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_LINE }}>
              <HText size={13.5}>{s.word}</HText>
            </Pressable>
          ))}
          {!symbols.length ? <HText muted>{tx('ლექსიკონი ივსება — ცოტა ხანში დაბრუნდი.', 'The dictionary is being filled — check back soon.')}</HText> : null}
        </View>
      )}
      <HoroNote text={tx('სიზმრების ახსნა ხალხური და თანამედროვე ხედვაა — გასართობად და დასაფიქრებლად.', 'Dream meanings blend folk and modern views — for fun and reflection.')} />
    </HoroPage>
  );
}
