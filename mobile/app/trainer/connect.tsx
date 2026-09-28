import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, Lock, MapPin } from 'lucide-react-native';
import { api, ApiError } from '@/lib/api';
import { invalidateCoachEntry } from '@/components/coach/CoachEntry';
import { localAccountId } from '@/lib/localAccount';
import { COACH_SCOPES, SCOPE_COPY, normalizeCoachCode, type CoachScopes, type TrainerCard } from '@/lib/coach';
import { Avatar, Badge, Button, Card, Chip, CoachForm, Field, Input, Loading, Section, Toggle, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/**
 * Connect to a trainer: by code (trainer's invitation → active at once) or from search (request).
 * The consent sheet names every data category; photos are off by default (Law 3144: voluntary, scoped).
 */
export default function ConnectTrainerScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ code?: string; trainerId?: string; invite?: string }>();
  const [code, setCode] = useState(normalizeCoachCode(params.code) ?? '');
  const [trainer, setTrainer] = useState<TrainerCard | null>(null);
  const [consentVersion, setConsentVersion] = useState('');
  const [scopes, setScopes] = useState<CoachScopes>({ workouts: true, nutrition: true, weight: true, photos: false });
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viaSearch = Boolean(params.trainerId);
  const viaInvite = params.invite === '1';

  const lookup = async (raw: string) => {
    const normalized = normalizeCoachCode(raw);
    if (!normalized) {
      setError('კოდი 6 სიმბოლოა (ასოები და ციფრები).');
      return;
    }
    setLoading(true);
    setError(null);
    const owner = localAccountId();
    try {
      const res = await api.coach.byCode(normalized);
      if (localAccountId() !== owner) return;
      setTrainer(res.trainer);
      setConsentVersion(res.consentVersion);
    } catch (e) {
      setTrainer(null);
      setError(e instanceof ApiError ? e.message : 'ტრენერი ვერ მოიძებნა.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viaInvite) {
      setLoading(true);
      void api.coach
        .overview()
        .then((ov) => {
          setTrainer(ov.trainer ?? null);
          setConsentVersion(ov.consentVersion ?? '');
          if (!ov.link || ov.link.initiator !== 'TRAINER' || ov.link.status !== 'REQUESTED') setError('მოწვევა ვერ მოიძებნა ან უკვე დადასტურებულია.');
        })
        .catch(() => setError('მოწვევა ვერ ჩაიტვირთა.'))
        .finally(() => setLoading(false));
    } else if (params.trainerId) {
      setLoading(true);
      void api.coach
        .card(String(params.trainerId))
        .then((res) => {
          setTrainer(res.trainer);
          setConsentVersion(res.consentVersion);
        })
        .catch(() => setError('ტრენერი ვერ ჩაიტვირთა.'))
        .finally(() => setLoading(false));
    } else if (normalizeCoachCode(params.code)) {
      void lookup(String(params.code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.trainerId, params.code, params.invite]);

  const submit = async () => {
    if (!trainer) return;
    setBusy(true);
    try {
      if (viaInvite) await api.coach.acceptInvite(scopes, consentVersion);
      else await api.coach.link({ ...(viaSearch ? { trainerId: trainer.id } : { code }), scopes, consentVersion, note: note.trim() });
      invalidateCoachEntry();
      router.replace('/trainer' as never);
    } catch (e) {
      Alert.alert('ვერ დაკავშირდა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm
      title={viaInvite ? 'ტრენერის მოწვევა' : viaSearch ? 'მოთხოვნა ტრენერთან' : 'ტრენერთან დაკავშირება'}
      fallback="/trainer"
      footer={
        trainer ? (
          <>
            <Button label={viaSearch ? 'მოთხოვნის გაგზავნა' : viaInvite ? 'თანხმობა და მოწვევის მიღება' : 'თანხმობა და დაკავშირება'} busy={busy} onPress={() => void submit()} />
            <Text style={[hubText.small, { color: c.text300, textAlign: 'center' }]}>გაზიარებას ნებისმიერ დროს შეცვლი ან შეწყვეტ „ჩემი ტრენერი“-დან.</Text>
          </>
        ) : (
          <Button label="ტრენერის ნახვა" busy={loading} disabled={!normalizeCoachCode(code)} onPress={() => void lookup(code)} />
        )
      }
    >
      {!viaSearch && !viaInvite && !trainer ? (
        <Field label="ტრენერის კოდი" hint="კოდს ტრენერი გაგიზიარებს — ის ჩანს მის ტრენერის პროფილში.">
          <Input
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            placeholder="მაგ. K7M2QX"
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={() => void lookup(code)}
            style={{ fontSize: 26, letterSpacing: 8, textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', minHeight: 64 }}
          />
        </Field>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={[hubText.body, { color: c.danger, marginTop: 10 }]}>{error}</Text> : null}
      {loading && !trainer ? <Loading /> : null}

      {trainer ? (
        <>
          <Card style={{ marginTop: 12, gap: 12 }}>
            <View style={coachStyles.row}>
              <Avatar avatarId={trainer.avatarId} photoUrl={trainer.avatarUrl} name={trainer.displayName} size={60} verified={trainer.verified} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 18 }]}>{trainer.displayName}</Text>
                <View style={[coachStyles.row, { gap: 6, flexWrap: 'wrap' }]}>
                  {trainer.verified ? <Badge label="დადასტურებული ტრენერი" tone="brand" /> : null}
                  {trainer.experienceYears ? <Badge label={`${trainer.experienceYears} წლის გამოცდილება`} /> : null}
                </View>
              </View>
            </View>
            {trainer.bio ? <Text style={[hubText.body, { color: c.text200 }]}>{trainer.bio}</Text> : null}
            {trainer.specialties.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {trainer.specialties.map((s) => (
                  <Chip key={s.key} label={s.label} />
                ))}
              </View>
            ) : null}
            {trainer.gyms.map((g) => (
              <View key={g.id} style={[coachStyles.row, { gap: 8 }]}>
                <MapPin size={15} color={c.text300} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  {g.brand} · {g.name}, {g.city}
                </Text>
              </View>
            ))}
            {trainer.certificates.map((cert) => (
              <View key={`${cert.title}${cert.year}`} style={[coachStyles.row, { gap: 8 }]}>
                <Award size={15} color={c.text300} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  {cert.title}
                  {cert.issuer ? ` · ${cert.issuer}` : ''}
                  {cert.year ? ` · ${cert.year}` : ''}
                </Text>
              </View>
            ))}
          </Card>

          <Section title="რას დაინახავს ტრენერი">
            <Card style={{ paddingVertical: 8 }}>
              <View style={[coachStyles.row, { paddingVertical: 10 }]}>
                <Lock size={16} color={c.primary100} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  ვარჯიშების განრიგი ორივე მხარეს ჩანს. ქვემოთ აირჩიე, კიდევ რა გაუზიარო. ჯანმრთელობის მონაცემი განსაკუთრებული კატეგორიაა — გაზიარება ნებაყოფლობითია და ნებისმიერ დროს შეწყდება.
                </Text>
              </View>
              {COACH_SCOPES.map((k) => (
                <Toggle key={k} title={SCOPE_COPY[k].title} body={SCOPE_COPY[k].body} value={scopes[k]} onChange={(v) => setScopes((p) => ({ ...p, [k]: v }))} />
              ))}
            </Card>
            <Text style={[hubText.small, { color: c.text300, marginTop: 8 }]}>ტრენერი ვერ ხედავს: სამედიცინო ჩანაწერებს, ანალიზებს, წამლებს, ციკლს, Medi-სთან საუბრებს.</Text>
          </Section>

          {viaSearch ? (
            <Field label="მოკლე მესიჯი ტრენერს (არასავალდებულო)">
              <Input value={note} onChangeText={setNote} multiline maxLength={300} placeholder="მაგ. მინდა 5 კგ-ის დაკლება და ძალის მომატება" />
            </Field>
          ) : null}
        </>
      ) : null}
    </CoachForm>
  );
}
