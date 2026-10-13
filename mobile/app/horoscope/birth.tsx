import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { MapPin, X } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { GLASS, GLASS_LINE, HORO_INK, HoroButton, HoroCard, HText } from '@/components/horoscope/HoroUI';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { horoscopeApi, type ChartResponse, type Place } from '@/lib/horoscope/horoscopeApi';
import { FRESH, accountKey } from '@/lib/queryClient';
import { useThemeColors } from '@/theme/colors';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Formats typed digits as HH:MM while typing („1430“ → „14:30“). */
function asTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/**
 * Birth time and place for the full chart (ascendant, houses). Optional: without them the module still works from
 * the profile birth date. The place is searched by name (Open-Meteo); only the name typed leaves the phone.
 */
export default function BirthScreen() {
  const c = useThemeColors();
  const qc = useQueryClient();
  const current = useAccountQuery<ChartResponse>({ key: ['horoscope', 'chart'], fetch: () => horoscopeApi.chart(), staleTime: FRESH.SHORT });
  const [time, setTime] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [showOnHome, setShowOnHome] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    const p = current.data?.profile;
    if (!p || seeded.current) return;
    seeded.current = true;
    if (p.birthTime) setTime(p.birthTime);
    if (p.placeName) setPlace({ id: 'saved', name: p.placeName, detail: p.placeDetail || '', lat: 0, lon: 0, tz: '' });
    setShowOnHome(p.showOnHome);
  }, [current.data]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return undefined; }
    let alive = true;
    setSearching(true);
    const t = setTimeout(() => {
      horoscopeApi.places(q).then((r) => { if (alive) setResults(r.places); }).catch(() => { if (alive) setResults([]); }).finally(() => { if (alive) setSearching(false); });
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const save = async () => {
    setError(null);
    if (!unknown && time && !TIME_RE.test(time)) { setError(tx('დრო ჩაწერე ასე: 14:30', 'Write the time like 14:30')); return; }
    setSaving(true);
    try {
      const body: Parameters<typeof horoscopeApi.saveProfile>[0] = { birthTime: unknown || !time ? null : time, showOnHome };
      if (place && place.id !== 'saved') body.place = { name: place.name, detail: place.detail, lat: place.lat, lon: place.lon, tz: place.tz };
      if (!place) body.place = null;
      await horoscopeApi.saveProfile(body);
      await qc.invalidateQueries({ queryKey: accountKey('horoscope') });
      router.back();
    } catch (e) {
      setError((e as { message?: string })?.message || tx('ვერ შეინახა — სცადე თავიდან.', 'Could not save — try again.'));
    } finally {
      setSaving(false);
    }
  };

  const field = { backgroundColor: GLASS, borderRadius: 16, borderWidth: 1, borderColor: GLASS_LINE, paddingHorizontal: 14, minHeight: 50, color: c.text100, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16 } as const;

  return (
    <KeyboardFormShell
      background={c.bg100}
      header={<ModuleStackHeader module="horo" subtitle={tx('დაბადების დრო და ადგილი', 'Birth time and place')} fallbackHref="/horoscope/chart" />}
      footer={<View style={{ paddingHorizontal: 20, paddingTop: 8 }}><HoroButton label={saving ? tx('ინახება…', 'Saving…') : tx('შენახვა', 'Save')} onPress={() => void save()} disabled={saving} /></View>}
      contentStyle={{ paddingHorizontal: 20, gap: 22, paddingTop: 8 }}
    >
      <HText size={14} muted>{tx('დაბადების თარიღი პროფილიდან მოდის. დრო და ადგილი რუკას ასრულებს: ასცენდენტი, სახლები და მთვარის ზუსტი ნიშანი.', 'Your birth date comes from your profile. Time and place complete the chart: the ascendant, houses and the Moon’s exact sign.')}</HText>

      <View style={{ gap: 8 }}>
        <HText size={14} weight="semibold">{tx('დაბადების დრო', 'Birth time')}</HText>
        <TextInput value={unknown ? '' : time} editable={!unknown} onChangeText={(v) => setTime(asTime(v))} placeholder="14:30" placeholderTextColor={c.text300}
          keyboardType="number-pad" maxLength={5} style={[field, { opacity: unknown ? 0.5 : 1 }]} accessibilityLabel={tx('დაბადების დრო', 'Birth time')} />
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: unknown }} onPress={() => setUnknown(!unknown)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
          <HText size={14} muted>{tx('დრო არ ვიცი', 'I don’t know the time')}</HText>
          <Switch value={unknown} onValueChange={setUnknown} trackColor={{ true: HORO_INK, false: 'rgba(255,255,255,0.2)' }} />
        </Pressable>
        <HText size={12} muted>{tx('დაბადების მოწმობაში ან მშობლების მეხსიერებაში — ნახევარსაათიანი სიზუსტეც კარგია.', 'From a birth certificate or your parents’ memory — within half an hour is fine.')}</HText>
      </View>

      <View style={{ gap: 8 }}>
        <HText size={14} weight="semibold">{tx('დაბადების ადგილი', 'Birthplace')}</HText>
        {place ? (
          <HoroCard style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
            <MapPin size={18} color={HORO_INK} />
            <View style={{ flex: 1 }}>
              <HText size={15} weight="semibold">{place.name}</HText>
              {place.detail ? <HText size={12} muted>{place.detail}</HText> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('ადგილის წაშლა', 'Remove place')} onPress={() => { setPlace(null); setQuery(''); }} hitSlop={10}>
              <X size={18} color={c.text200} />
            </Pressable>
          </HoroCard>
        ) : (
          <>
            <TextInput value={query} onChangeText={setQuery} placeholder={tx('ქალაქი ან სოფელი', 'City or town')} placeholderTextColor={c.text300}
              style={field} accessibilityLabel={tx('დაბადების ადგილის ძებნა', 'Search birthplace')} autoCorrect={false} />
            {searching ? <ActivityIndicator color={HORO_INK} /> : null}
            {results.length ? (
              <HoroCard style={{ paddingVertical: 2 }}>
                {results.map((p, i) => (
                  <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.detail}`} onPress={() => { setPlace(p); setResults([]); }}
                    style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: GLASS_LINE }}>
                    <HText size={15}>{p.name}</HText>
                    <HText size={12} muted>{p.detail}</HText>
                  </Pressable>
                ))}
              </HoroCard>
            ) : null}
          </>
        )}
      </View>

      <Pressable accessibilityRole="switch" accessibilityState={{ checked: showOnHome }} onPress={() => setShowOnHome(!showOnHome)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
        <View style={{ flex: 1 }}>
          <HText size={14} weight="semibold">{tx('დღის ჰოროსკოპი მთავარ გვერდზე', 'Daily horoscope on Home')}</HText>
          <HText size={12} muted>{tx('პატარა ბარათი Home-ზე შენი ნიშნით.', 'A small card on Home with your sign.')}</HText>
        </View>
        <Switch value={showOnHome} onValueChange={setShowOnHome} trackColor={{ true: HORO_INK, false: 'rgba(255,255,255,0.2)' }} />
      </Pressable>

      {error ? <HText size={13} color="#F0A3B0">{error}</HText> : null}
    </KeyboardFormShell>
  );
}
