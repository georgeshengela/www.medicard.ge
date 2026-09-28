import React, { useCallback, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeftRight, Award, MapPin, Pencil, Share2, ShieldCheck } from 'lucide-react-native';
import { api } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { coachLink, type CoachCatalog, type OwnTrainerProfile } from '@/lib/coach';
import { CoachGate, CoachShell } from '@/components/coach/CoachShell';
import { Avatar, Badge, Button, Card, Chip, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { useAuth } from '@/store/AuthContext';
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

  const avatarId = (healthProfile?.extraAnswers as { avatarId?: string } | undefined)?.avatarId ?? null;
  const share = () => p?.code && void Share.share({ message: `ვარჯიშები, კვების გეგმა და პროგრესი ერთად — MEDICARD-ში. შემომიერთდი ჩემი კოდით ${p.code}: ${coachLink(p.code)}` });
  const label = (k: string) => cat?.specialties.find((s) => s.key === k)?.label ?? k;

  return (
    <CoachShell title="პროფილი" subtitle="ასე გხედავენ კლიენტები">
      <CoachGate error={error} />
      {!p && !error ? <Loading /> : null}
      {p ? (
        <>
          <Card style={{ marginTop: 16, gap: 12 }}>
            <View style={coachStyles.row}>
              <Avatar avatarId={avatarId} name={p.displayName} size={64} verified={p.status === 'VERIFIED'} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 19 }]}>{p.displayName}</Text>
                <View style={[coachStyles.row, { gap: 6, flexWrap: 'wrap' }]}>
                  {p.status === 'VERIFIED' ? <Badge label="დადასტურებული" tone="brand" /> : <Badge label="განიხილება" tone="warn" />}
                  {p.experienceYears ? <Badge label={`${p.experienceYears} წელი`} /> : null}
                </View>
              </View>
            </View>
            {p.bio ? <Text style={[hubText.body, { color: c.text200 }]}>{p.bio}</Text> : null}
            {p.specialties.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {p.specialties.map((k) => (
                  <Chip key={k} label={label(k)} />
                ))}
              </View>
            ) : null}
            {p.gyms.map((g) => (
              <View key={g.id} style={[coachStyles.row, { gap: 8 }]}>
                <MapPin size={15} color={c.text300} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  {g.brand} · {g.name}, {g.city}
                </Text>
              </View>
            ))}
            {p.certificates.map((ct) => (
              <View key={ct.id} style={[coachStyles.row, { gap: 8 }]}>
                <Award size={15} color={c.text300} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{[ct.title, ct.issuer, ct.year].filter(Boolean).join(' · ')}</Text>
              </View>
            ))}
            <Button label="რედაქტირება" icon={Pencil} kind="secondary" onPress={() => router.push('/trainer/apply' as never)} />
          </Card>

          {p.code ? (
            <Section title="მოწვევის კოდი">
              <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: 20, gap: 12, alignItems: 'center' }}>
                <Text selectable style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 38, letterSpacing: 10, color: '#FFFFFF' }}>{p.code}</Text>
                <Text selectable style={[hubText.caption, { color: '#C5DADA' }]}>{p.link}</Text>
                <Text style={[hubText.body, { color: '#C5DADA', textAlign: 'center' }]}>კლიენტი კოდს შეიყვანს „ჩემი ტრენერი“-ში, ან ბმულიდან პირდაპირ გაიხსნება აპი. თანხმობას თავად აირჩევს.</Text>
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
