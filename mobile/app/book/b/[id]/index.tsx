import React, { useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AtSign, BadgeCheck, ChevronDown, ChevronRight, ChevronUp, Clock, Globe, Heart, MapPin, Navigation, Percent, Phone, Share2, Store } from 'lucide-react-native';
import { ModuleHeader, ModuleHeaderButton } from '@/components/brand/ModuleHeader';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { FlatCard, Stars, imageUri } from '@/components/book/BookUI';
import { RecordsPageSkeleton } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { tx } from '@/i18n/locale';
import { api } from '@/lib/api';
import { bookCategory } from '@/lib/book/categories';
import { directionsUrl, distanceLabel, durationLabel, priceLabel, ratingLabel, todayHoursLine, weekHours } from '@/lib/book/bookFormat';
import type { BookBusinessDetail, BookService } from '@/lib/book/bookTypes';
import { FRESH, invalidate } from '@/lib/queryClient';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * One place: pictures, who they are, call / route / site / share, live discounts, every service with price and
 * duration and „ჩაწერა“ (claimed places), the people, the hours, the reviews. An unclaimed listing shows the
 * public facts and invites a call; its owner is pointed to medicard.ge/business.
 */
export default function BusinessScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = String(id ?? '');
  const query = useAccountQuery<BookBusinessDetail>({ key: ['book', 'business', key], fetch: async () => (await api.book.business(key)).business, staleTime: FRESH.SHORT, enabled: Boolean(key) });
  const b = query.data;
  const [hoursOpen, setHoursOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [fav, setFav] = useState<boolean | null>(null);
  const favorite = fav ?? b?.favorite ?? false;

  const groups = useMemo(() => {
    const map = new Map<string, BookService[]>();
    for (const s of b?.services ?? []) {
      const g = s.group ?? '';
      map.set(g, [...(map.get(g) ?? []), s]);
    }
    return [...map.entries()];
  }, [b?.services]);

  const toggleFavorite = async () => {
    if (!b) return;
    const next = !favorite;
    setFav(next);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    try {
      await api.book.setFavorite(b.id, next);
      void invalidate('book');
    } catch {
      setFav(!next);
    }
  };
  const call = () => {
    if (!b?.phone) return;
    void api.book.event(b.id, 'CALL').catch(() => undefined);
    void Linking.openURL(`tel:${b.phone.replace(/[^\d+]/g, '')}`);
  };
  const route = () => {
    if (!b || b.lat == null || b.lng == null) return;
    void api.book.event(b.id, 'ROUTE').catch(() => undefined);
    const url = Platform.OS === 'ios' ? `maps:?daddr=${b.lat},${b.lng}&q=${encodeURIComponent(b.name)}` : `geo:${b.lat},${b.lng}?q=${b.lat},${b.lng}(${encodeURIComponent(b.name)})`;
    Linking.openURL(url).catch(() => Linking.openURL(directionsUrl(b.lat!, b.lng!, b.name)));
  };
  const site = () => {
    if (!b?.website) return;
    void api.book.event(b.id, 'WEBSITE').catch(() => undefined);
    void Linking.openURL(b.website);
  };
  const share = async () => {
    if (!b) return;
    void api.book.event(b.id, 'SHARE').catch(() => undefined);
    await Share.share({ message: tx(`${b.name} — ${b.categoryLabel}${b.address ? `, ${b.address}` : ''}. MEDICARD-ში: https://medicard.ge/app/book/${b.slug}`, `${b.name} — ${b.categoryLabel}${b.address ? `, ${b.address}` : ''}. In MEDICARD: https://medicard.ge/app/book/${b.slug}`) }).catch(() => undefined);
  };
  const book = (service?: BookService) => {
    if (!b) return;
    void api.book.event(b.id, 'BOOK_START').catch(() => undefined);
    router.push(`/book/b/${b.id}/book${service ? `?serviceId=${service.id}` : ''}` as never);
  };

  const cat = bookCategory(b?.category);
  const Icon = cat.icon;
  const todayLine = b ? todayHoursLine(b.hours) : null;
  const gallery = (b?.gallery ?? []).map(imageUri).filter(Boolean) as string[];
  const ink = dark ? '#F0ABFC' : '#A21CAF';

  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, paddingHorizontal: HUB.gutter }} showsVerticalScrollIndicator={false}>
      <ModuleHeader
        module="book"
        subtitle={b?.categoryLabel ?? tx('ბიზნესის გვერდი', 'Business page')}
        fallbackHref="/book"
        right={b ? <ModuleHeaderButton label={favorite ? tx('რჩეულებიდან მოხსნა', 'Remove from saved') : tx('რჩეულებში შენახვა', 'Save')} icon={Heart} color={favorite ? '#E11D48' : undefined} onPress={() => void toggleFavorite()} /> : undefined}
      />

      {!b ? (
        <View style={{ marginTop: 20 }}>
          {query.isError ? <Text style={[hubText.body, { color: c.text200 }]}>{tx('ბიზნესი ვერ მოიძებნა.', 'Business not found.')}</Text> : <RecordsPageSkeleton />}
        </View>
      ) : (
        <>
          {gallery.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 20, marginHorizontal: -HUB.gutter }} contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 10 }}>
              {gallery.map((uri) => <Image key={uri} source={{ uri }} style={[s.photo, { backgroundColor: c.bg200 }]} />)}
            </ScrollView>
          ) : null}

          <FlatCard style={{ marginTop: gallery.length ? 14 : 20, padding: 18, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {b.logoUrl ? <Image source={{ uri: imageUri(b.logoUrl)! }} style={[s.logo, { backgroundColor: c.bg200 }]} /> : (
                <View style={[s.logo, { backgroundColor: `${cat.color}${dark ? '33' : '1F'}`, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon size={24} color={cat.color} strokeWidth={1.9} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[hubText.sectionTitle, { color: c.text100, flexShrink: 1 }]}>{b.name}</Text>
                  {b.claimed ? <BadgeCheck size={18} color={ink} strokeWidth={2.2} /> : null}
                </View>
                <Text style={[hubText.caption, { color: c.text200 }]}>{[b.categoryLabel, b.district ?? b.city, distanceLabel(b.distanceKm)].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {b.rating != null ? <Stars value={b.rating} /> : null}
              <Text style={[hubText.caption, { color: c.text200 }]}>{ratingLabel(b.rating, b.ratingCount)}</Text>
            </View>
            {todayLine ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color={b.openNow ? c.success : c.text300} />
                <Text style={[hubText.caption, { color: b.openNow ? c.success : c.text200 }]}>
                  {b.openNow ? tx(`ღიაა · ${todayLine}`, `Open · ${todayLine}`) : todayLine}
                </Text>
              </View>
            ) : null}
            {b.address ? (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/book/map?focus=${b.id}&lat=${b.lat}&lng=${b.lng}` as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} color={c.text300} />
                <Text style={[hubText.caption, { color: c.text100, flex: 1 }]}>{b.address}</Text>
                <ChevronRight size={14} color={c.text300} />
              </Pressable>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Action icon={Phone} label={tx('დარეკვა', 'Call')} onPress={call} disabled={!b.phone} />
              <Action icon={Navigation} label={tx('მარშრუტი', 'Route')} onPress={route} disabled={b.lat == null} />
              <Action icon={b.website ? Globe : AtSign} label={b.website ? tx('საიტი', 'Site') : 'Instagram'} onPress={b.website ? site : () => b.instagram && Linking.openURL(`https://instagram.com/${b.instagram}`)} disabled={!b.website && !b.instagram} />
              <Action icon={Share2} label={tx('გაზიარება', 'Share')} onPress={() => void share()} />
            </View>
          </FlatCard>

          {b.discounts.length ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('ფასდაკლებები', 'Discounts')} />
              <FlatCard>
                {b.discounts.map((d, i) => (
                  <View key={d.id} style={[s.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
                    <View style={[s.tile, { backgroundColor: `${ink}${dark ? '26' : '14'}` }]}>
                      <Percent size={18} color={ink} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{d.title}</Text>
                      <Text style={[hubText.caption, { color: c.text200 }]}>
                        {d.kind === 'PERCENT' ? tx(`−${d.value}%`, `−${d.value}%`) : tx(`−${d.value} ₾`, `−${d.value} ₾`)}
                        {d.hoursFrom && d.hoursTo ? ` · ${d.hoursFrom}–${d.hoursTo}` : ''}
                        {d.endsOn ? tx(` · ${d.endsOn}-მდე`, ` · until ${d.endsOn}`) : ''}
                        {d.code ? tx(` · კოდი ${d.code}`, ` · code ${d.code}`) : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </FlatCard>
            </View>
          ) : null}

          {b.claimed && b.services.length ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('სერვისები', 'Services')} />
              {groups.map(([group, list]) => (
                <View key={group || '_'} style={{ marginBottom: 12 }}>
                  {group ? <Text style={[hubText.caption, { color: c.text300, marginBottom: 6, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.6 }]}>{group}</Text> : null}
                  <FlatCard>
                    {list.map((svc, i) => (
                      <Pressable key={svc.id} accessibilityRole="button" onPress={() => (b.bookable && svc.online ? book(svc) : undefined)} style={[s.row, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[hubText.cardTitle, { color: c.text100 }]}>{svc.name}</Text>
                          <Text style={[hubText.caption, { color: c.text200 }]}>{[durationLabel(svc.durationMin), svc.description].filter(Boolean).join(' · ')}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={[hubText.value, { color: c.text100 }]}>{priceLabel(svc.price, svc.priceTo, svc.currency)}</Text>
                          {b.bookable && svc.online ? (
                            <View style={[s.bookPill, { backgroundColor: ink }]}>
                              <Text style={[hubText.small, { color: '#fff', fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{tx('ჩაწერა', 'Book')}</Text>
                            </View>
                          ) : null}
                        </View>
                      </Pressable>
                    ))}
                  </FlatCard>
                </View>
              ))}
            </View>
          ) : null}

          {!b.claimed ? (
            <FlatCard style={{ marginTop: HUB.sectionGap, padding: 18, gap: 8 }}>
              <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('ეს ადგილი ჯერ არ იღებს ონლაინ ჯავშნებს', 'This place does not take online bookings yet')}</Text>
              <Text style={[hubText.body, { color: c.text200 }]}>{tx('დარეკე და ჩაეწერე ტელეფონით, ან ჩაწერე ვიზიტი ხელით — შეხსენებას MEDICARD მოგცემს.', 'Call to book by phone, or add the visit by hand — MEDICARD will remind you.')}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/visits/editor', params: { address: b.address ?? '', lat: b.lat != null ? String(b.lat) : '', lng: b.lng != null ? String(b.lng) : '' } } as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Text style={[hubText.link, { color: c.primary100 }]}>{tx('ვიზიტის ჩაწერა ხელით', 'Add the visit by hand')}</Text>
                <ChevronRight size={15} color={c.primary100} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => router.push('/book/business' as never)} style={[s.ownerRow, { backgroundColor: c.bg100 }]}>
                <Store size={16} color={c.text200} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{tx('შენი ბიზნესია? დაადასტურე და ჩართე ონლაინ ჯავშნა', 'Is this your business? Claim it and turn on online booking')}</Text>
                <ChevronRight size={14} color={c.text300} />
              </Pressable>
            </FlatCard>
          ) : null}

          {b.staff.length ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('გუნდი', 'The team')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -HUB.gutter }} contentContainerStyle={{ paddingHorizontal: HUB.gutter, gap: 10 }}>
                {b.staff.map((p) => (
                  <View key={p.id} style={[s.person, { backgroundColor: c.surface }]}>
                    {p.imageUrl ? <Image source={{ uri: imageUri(p.imageUrl)! }} style={[s.avatar, { backgroundColor: c.bg200 }]} /> : (
                      <View style={[s.avatar, { backgroundColor: p.color ?? c.accent100, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={[hubText.value, { color: p.color ? '#fff' : c.primary100 }]}>{p.name.trim().slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{p.name}</Text>
                    {p.title ? <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{p.title}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {Object.values(b.hours).some((l) => l.length) ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('სამუშაო საათები', 'Opening hours')} />
              <FlatCard>
                <Pressable accessibilityRole="button" onPress={() => setHoursOpen((v) => !v)} style={[s.row, { paddingVertical: 14 }]}>
                  <Clock size={18} color={c.text200} />
                  <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>{todayLine}</Text>
                  {hoursOpen ? <ChevronUp size={17} color={c.text300} /> : <ChevronDown size={17} color={c.text300} />}
                </Pressable>
                {hoursOpen ? weekHours(b.hours).map((row) => (
                  <View key={row.day} style={[s.row, { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 }]}>
                    <Text style={[hubText.body, { color: row.today ? c.text100 : c.text200, flex: 1, fontFamily: row.today ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular' }]}>{row.day}</Text>
                    <Text style={[hubText.body, { color: row.today ? c.text100 : c.text200 }]}>{row.ranges}</Text>
                  </View>
                )) : null}
              </FlatCard>
            </View>
          ) : null}

          {b.description ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('შესახებ', 'About')} />
              <FlatCard style={{ padding: 18 }}>
                <Text numberOfLines={aboutOpen ? undefined : 4} style={[hubText.body, { color: c.text100 }]}>{b.description}</Text>
                {b.description.length > 220 ? (
                  <Pressable accessibilityRole="button" onPress={() => setAboutOpen((v) => !v)} style={{ marginTop: 6 }}>
                    <Text style={[hubText.link, { color: c.primary100 }]}>{aboutOpen ? tx('ნაკლები', 'Less') : tx('მეტი', 'More')}</Text>
                  </Pressable>
                ) : null}
              </FlatCard>
            </View>
          ) : null}

          {b.reviews.length ? (
            <View style={{ marginTop: HUB.sectionGap }}>
              <HomeSectionHeading title={tx('შეფასებები', 'Reviews')} />
              <FlatCard>
                {b.reviews.map((r, i) => (
                  <View key={r.id} style={[{ padding: 14, gap: 6 }, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg200 } : null]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Stars value={r.rating} size={12} />
                      <Text style={[hubText.small, { color: c.text200 }]}>{r.author}</Text>
                    </View>
                    {r.text ? <Text style={[hubText.body, { color: c.text100 }]}>{r.text}</Text> : null}
                    {r.reply ? <Text style={[hubText.caption, { color: c.text200, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: c.bg300 }]}>{tx('პასუხი: ', 'Reply: ')}{r.reply}</Text> : null}
                  </View>
                ))}
              </FlatCard>
            </View>
          ) : null}
        </>
      )}

      {b?.bookable ? (
        <View style={[s.footer, { bottom: insets.bottom + 16, left: HUB.gutter, right: HUB.gutter }]} pointerEvents="box-none">
          <Pressable accessibilityRole="button" onPress={() => book()} style={[s.cta, { backgroundColor: ink }]}>
            <Text style={[hubText.link, { color: '#fff', fontSize: 15 }]}>{tx('ჩაწერა', 'Book an appointment')}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Action({ icon: Icon, label, onPress, disabled }: { icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>; label: string; onPress: () => void; disabled?: boolean }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={[s.action, { backgroundColor: c.bg100, opacity: disabled ? 0.4 : 1 }]}>
      <Icon size={18} color={c.primary100} strokeWidth={2} />
      <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  photo: { width: 220, height: 150, borderRadius: 18 },
  logo: { width: 56, height: 56, borderRadius: 16 },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  person: { width: 120, borderRadius: 18, padding: 12, gap: 6 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, marginTop: 6 },
  footer: { position: 'absolute' },
  cta: { alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
});
