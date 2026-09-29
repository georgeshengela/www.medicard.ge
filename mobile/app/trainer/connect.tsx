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
import { tx } from '@/i18n/locale';

/**
 * Connect to a trainer: by code (trainer's invitation → active at once) or from search (request).
 * The consent sheet names every data category; nothing is shared until switched on (Law 3144, App Review 5.1.1).
 */
export default function ConnectTrainerScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const params = useLocalSearchParams<{ code?: string; trainerId?: string; invite?: string }>();
  const [code, setCode] = useState(normalizeCoachCode(params.code) ?? '');
  const [trainer, setTrainer] = useState<TrainerCard | null>(null);
  const [consentVersion, setConsentVersion] = useState('');
  const [scopes, setScopes] = useState<CoachScopes>({ workouts: false, nutrition: false, weight: false, photos: false });
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viaSearch = Boolean(params.trainerId);
  const viaInvite = params.invite === '1';

  const lookup = async (raw: string) => {
    const normalized = normalizeCoachCode(raw);
    if (!normalized) {
      setError(tx('კოდი 6 სიმბოლოა (ასოები და ციფრები).', 'The code is 6 characters (letters and digits).'));
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
      setError(e instanceof ApiError ? e.message : tx('ტრენერი ვერ მოიძებნა.', 'Trainer not found.'));
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
          if (!ov.link || ov.link.initiator !== 'TRAINER' || ov.link.status !== 'REQUESTED') setError(tx('მოწვევა ვერ მოიძებნა ან უკვე დადასტურებულია.', 'Invite not found or already accepted.'));
        })
        .catch(() => setError(tx('მოწვევა ვერ ჩაიტვირთა.', 'Couldn’t load the invite.')))
        .finally(() => setLoading(false));
    } else if (params.trainerId) {
      setLoading(true);
      void api.coach
        .card(String(params.trainerId))
        .then((res) => {
          setTrainer(res.trainer);
          setConsentVersion(res.consentVersion);
        })
        .catch(() => setError(tx('ტრენერი ვერ ჩაიტვირთა.', 'Couldn’t load the trainer.')))
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
      Alert.alert(tx('ვერ დაკავშირდა', 'Couldn’t connect'), e instanceof ApiError ? e.message : tx('სცადე ხელახლა.', 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CoachForm
      title={viaInvite ? tx('ტრენერის მოწვევა', 'Trainer invite') : viaSearch ? tx('მოთხოვნა ტრენერთან', 'Request a trainer') : tx('ტრენერთან დაკავშირება', 'Connect with a trainer')}
      fallback="/trainer"
      footer={
        trainer ? (
          <>
            <Button label={viaSearch ? tx('მოთხოვნის გაგზავნა', 'Send request') : viaInvite ? tx('თანხმობა და მოწვევის მიღება', 'Agree and accept invite') : tx('თანხმობა და დაკავშირება', 'Agree and connect')} busy={busy} onPress={() => void submit()} />
            <Text style={[hubText.small, { color: c.text300, textAlign: 'center' }]}>{tx('გაზიარებას ნებისმიერ დროს შეცვლი ან შეწყვეტ „ჩემი ტრენერი“-დან.', 'You can change or stop sharing any time from “My trainer”.')}</Text>
          </>
        ) : (
          <Button label={tx('ტრენერის ნახვა', 'View trainer')} busy={loading} disabled={!normalizeCoachCode(code)} onPress={() => void lookup(code)} />
        )
      }
    >
      {!viaSearch && !viaInvite && !trainer ? (
        <Field label={tx('ტრენერის კოდი', 'Trainer code')} hint={tx('კოდს ტრენერი გაგიზიარებს — ის ჩანს მის ტრენერის პროფილში.', 'Your trainer shares the code — it’s on their trainer profile.')}>
          <Input
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            placeholder={tx('მაგ. K7M2QX', 'e.g. K7M2QX')}
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
                  {trainer.verified ? <Badge label={tx('დადასტურებული ტრენერი', 'Verified trainer')} tone="brand" /> : null}
                  {trainer.experienceYears ? <Badge label={tx(`${trainer.experienceYears} წლის გამოცდილება`, `${trainer.experienceYears} ${trainer.experienceYears === 1 ? 'year' : 'years'} of experience`)} /> : null}
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

          <Section title={tx('რას დაინახავს ტრენერი', 'What the trainer will see')}>
            <Card style={{ paddingVertical: 8 }}>
              <View style={[coachStyles.row, { paddingVertical: 10 }]}>
                <Lock size={16} color={c.primary100} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  {tx('ტრენერი ყოველთვის ხედავს: შენს სახელს, ფოტოს, ასაკს, სქესს, სიმაღლეს და ვარჯიშების განრიგს. ქვემოთ აირჩიე, კიდევ რა გაუზიარო — ყველაფერი გამორთულია, სანამ შენ არ ჩართავ. ჯანმრთელობის მონაცემი განსაკუთრებული კატეგორიაა: გაზიარება ნებაყოფლობითია და ნებისმიერ დროს შეწყდება.', 'A trainer always sees: your name, photo, age, sex, height and your session schedule. Below, choose what else to share — everything is off until you turn it on. Health data is a special category: sharing is voluntary and can be stopped at any time.')}
                </Text>
              </View>
              {COACH_SCOPES.map((k) => (
                <Toggle key={k} title={SCOPE_COPY[k].title} body={SCOPE_COPY[k].body} value={scopes[k]} onChange={(v) => setScopes((p) => ({ ...p, [k]: v }))} />
              ))}
            </Card>
            <Text style={[hubText.small, { color: c.text300, marginTop: 8 }]}>{tx('ტრენერი ვერ ხედავს: სამედიცინო ჩანაწერებს, ანალიზებს, წამლებს, ციკლს, Medi-სთან საუბრებს. ტრენერები დამოუკიდებელი პროფესიონალები არიან; MEDICARD მათ სერტიფიკატებს ამოწმებს.', 'A trainer can’t see: medical records, lab results, medications, your cycle, or your conversations with Medi. Trainers are independent professionals; MEDICARD checks their certificates.')}</Text>
          </Section>
          <Button
            label={tx('შეტყობინება დარღვევაზე', 'Report a problem')}
            kind="ghost"
            onPress={() => router.push({ pathname: '/trainer/report', params: { id: trainer.id, name: trainer.displayName, role: 'trainer' } } as never)}
          />

          {viaSearch ? (
            <Field label={tx('მოკლე მესიჯი ტრენერს (არასავალდებულო)', 'Short message to the trainer (optional)')}>
              <Input value={note} onChangeText={setNote} multiline maxLength={300} placeholder={tx('მაგ. მინდა 5 კგ-ის დაკლება და ძალის მომატება', 'e.g. I want to lose 5 kg and get stronger')} />
            </Field>
          ) : null}
        </>
      ) : null}
    </CoachForm>
  );
}
