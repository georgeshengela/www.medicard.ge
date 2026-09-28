import React, { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeftRight, Award, Camera, MapPin, Pencil, Share2, ShieldCheck } from 'lucide-react-native';
import { api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { coachLink, type CoachCatalog, type OwnTrainerProfile } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { StyledQr } from '@/components/coach/StyledQr';
import { Avatar, Button, Card, IconTile, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { FadeIn, Ring, StatusPill } from '@/components/coach/CoachKit';
import { useAuth } from '@/store/AuthContext';
import { useMyAvatarUrl } from '@/lib/myAvatar';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

export default function CoachProfileScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { healthProfile } = useAuth();
  const [p, setP] = useState<OwnTrainerProfile | null>(null);
  const [cat, setCat] = useState<CoachCatalog | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const [me, catalog] = await Promise.all([api.coach.me(), api.coach.catalog()]);
      if (localAccountId() !== owner) return;
      setP(me.trainerProfile);
      setCat(catalog);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const myPhoto = useMyAvatarUrl();
  const avatarId = (healthProfile?.extraAnswers as { avatarId?: string } | undefined)?.avatarId ?? null;
  const share = () => p?.code && void Share.share({ message: `ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${p.code}: ${coachLink(p.code)}` });
  const label = (k: string) => cat?.specialties.find((s) => s.key === k)?.label ?? k;

  return (
    <CoachShell title="პროფილი" subtitle="ასე გხედავენ კლიენტები">
      <CoachGate error={error} />
      {!p && !error ? <Loading /> : null}
      {p ? (
        <>
          <FadeIn>
            <Card style={{ marginTop: 16, gap: 16, alignItems: 'center', paddingTop: 24 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="ფოტოს შეცვლა" onPress={() => router.push('/profile/avatar' as never)} style={{ alignItems: 'center' }}>
                <Ring value={1} size={104} stroke={3} color={p.status === 'VERIFIED' ? '#14B8A6' : '#F59E0B'}>
                  <Avatar avatarId={avatarId} photoUrl={myPhoto} name={p.displayName} size={90} verified={p.status === 'VERIFIED'} />
                </Ring>
                <View style={[st.camera, { borderColor: c.surface }]}>
                  <Camera size={13} color="#FFFFFF" />
                </View>
              </Pressable>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={[hubText.sectionTitle, { color: c.text100, fontSize: 21, lineHeight: 28 }]}>{p.displayName}</Text>
                <View style={[coachStyles.row, { gap: 6, flexWrap: 'wrap', justifyContent: 'center' }]}>
                  <StatusPill label={p.status === 'VERIFIED' ? 'დადასტურებული ტრენერი' : 'განაცხადი განიხილება'} tone={p.status === 'VERIFIED' ? 'brand' : 'warn'} />
                  {p.experienceYears ? <StatusPill label={`${p.experienceYears} წლის გამოცდილება`} tone="neutral" /> : null}
                </View>
              </View>
              {p.bio ? <Text style={[hubText.body, { color: c.text200, textAlign: 'center' }]}>{p.bio}</Text> : null}
              {p.specialties.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {p.specialties.map((k) => (
                    <View key={k} style={{ backgroundColor: c.bg200, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={[hubText.small, { color: c.text100, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label(k)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Button label="პროფილის რედაქტირება" icon={Pencil} kind="secondary" style={{ alignSelf: 'stretch' }} onPress={() => router.push('/trainer/apply' as never)} />
            </Card>
          </FadeIn>

          {p.gyms.length || p.certificates.length ? (
            <Section title="დარბაზები და სერტიფიკატები">
              <Card style={{ paddingVertical: 6 }}>
                {[...p.gyms.map((g) => ({ key: g.id, icon: MapPin, ink: 'teal' as const, title: `${g.brand} · ${g.name}`, body: g.city })), ...p.certificates.map((ct) => ({ key: ct.id, icon: Award, ink: 'amber' as const, title: ct.title, body: [ct.issuer, ct.year].filter(Boolean).join(' · ') }))].map((row, i, all) => (
                  <View key={row.key} style={[coachStyles.row, { paddingVertical: 10, borderBottomWidth: i < all.length - 1 ? StyleSheet.hairlineWidth : 0, borderColor: c.bg300 }]}>
                    <IconTile icon={row.icon} ink={row.ink} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100 }]}>{row.title}</Text>
                      {row.body ? <Text numberOfLines={1} style={[hubText.caption, { color: c.text300 }]}>{row.body}</Text> : null}
                    </View>
                  </View>
                ))}
              </Card>
            </Section>
          ) : null}

          {p.code ? (
            <Section title="ჩემი QR და კოდი">
              <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: 20, gap: 12, alignItems: 'center' }}>
                {p.link ? (
                  <View style={{ padding: 10, backgroundColor: '#FFFFFF', borderRadius: 24 }}>
                    <StyledQr value={p.link} size={210} />
                  </View>
                ) : null}
                <Text selectable style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 34, letterSpacing: 10, color: '#FFFFFF' }}>{p.code}</Text>
                <Text selectable style={[hubText.caption, { color: '#C5DADA' }]}>{p.link}</Text>
                <Text style={[hubText.body, { color: '#C5DADA', textAlign: 'center' }]}>კლიენტი QR-ს დაასკანერებს „ჩემი ტრენერი“-დან (ან ტელეფონის კამერით), ან კოდს შეიყვანს. რას გაგიზიაროს, თავად აირჩევს.</Text>
                <Button label="გაზიარება" icon={Share2} onPress={share} style={{ alignSelf: 'stretch' }} />
              </View>
            </Section>
          ) : null}

          <Section title="კონფიდენციალობა">
            <Card style={{ gap: 8 }}>
              <View style={coachStyles.row}>
                <ShieldCheck size={18} color={c.primary100} />
                <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>
                  კლიენტის მონაცემს ხედავ მხოლოდ მისი თანხმობით და მხოლოდ კავშირის განმავლობაში. გაზიარება კლიენტს ნებისმიერ წამს შეუძლია შეწყვიტოს. მონაცემის აპის გარეთ გადაღება/გადაგზავნა კლიენტის ნებართვის გარეშე არ შეიძლება.
                </Text>
              </View>
            </Card>
          </Section>

          <Section title="რეჟიმი">
            <Button label="პირად რეჟიმზე გადასვლა" icon={ArrowLeftRight} kind="secondary" onPress={() => router.replace('/(tabs)/home' as never)} />
          </Section>
        </>
      ) : null}
    </CoachShell>
  );
}

const st = StyleSheet.create({
  camera: { position: 'absolute', right: 4, bottom: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#0D9488', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
