import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Award, BadgeCheck, Building2, Clock3, FileCheck2, MapPin, Plus, Trash2, X } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { IMAGE_PICKER_OPTIONS, toUploadableImage } from '@/lib/imageUpload';
import { hasVerifiedPhone, isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { useAuth } from '@/store/AuthContext';
import type { CoachCatalog, Gym, GymBrand, OwnTrainerProfile } from '@/lib/coach';
import { Badge, Button, Card, Chip, CoachForm, Field, IconTile, Input, Loading, Section, coachStyles } from '@/components/coach/CoachUI';
import { hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

/**
 * Trainer registration: profile, specialties, gyms from the Georgian directory, certificates.
 * An admin verifies it (#/trainers); only then the workspace and client linking open.
 */
export default function TrainerApplyScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useAuth();
  const [profile, setProfile] = useState<OwnTrainerProfile | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<CoachCatalog | null>(null);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState('');
  const [instagram, setInstagram] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymQ, setGymQ] = useState('');
  const [brands, setBrands] = useState<GymBrand[]>([]);
  const [picking, setPicking] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [newGym, setNewGym] = useState({ brand: '', city: 'თბილისი', address: '' });
  const [cert, setCert] = useState({ title: '', issuer: '', year: '' });
  const [busy, setBusy] = useState<string | null>(null);

  const hydrate = (p: OwnTrainerProfile | null) => {
    setProfile(p);
    if (p) {
      setName(p.displayName);
      setBio(p.bio);
      setYears(p.experienceYears != null ? String(p.experienceYears) : '');
      setInstagram(p.instagram ? `@${p.instagram}` : '');
      setSpecialties(p.specialties);
      setGyms(p.gyms);
    } else {
      setName(user?.fullName ?? '');
    }
  };

  const load = useCallback(async () => {
    const owner = localAccountId();
    try {
      const [me, cat] = await Promise.all([api.coach.me(), api.coach.catalog()]);
      if (localAccountId() !== owner) return;
      setCatalog(cat);
      hydrate(me.trainerProfile);
    } catch {
      setProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  useEffect(() => {
    if (!picking) return;
    const t = setTimeout(() => void api.coach.gyms(gymQ.trim()).then((r) => setBrands(r.brands)).catch(() => setBrands([])), 200);
    return () => clearTimeout(t);
  }, [gymQ, picking]);

  const gymRows = useMemo(() => brands.flatMap((b) => b.branches).filter((g) => !gyms.some((x) => x.id === g.id)).slice(0, 40), [brands, gyms]);

  const submit = async () => {
    if (!hasVerifiedPhone(user)) {
      offerPhoneVerification(router, 'ტრენერის პროფილისთვის ტელეფონის დადასტურება საჭიროა — ასე კლიენტები დარწმუნებულები არიან, რომ რეალურ ადამიანთან აქვთ საქმე.');
      return;
    }
    if (name.trim().length < 2) return Alert.alert('სახელი', 'მიუთითე სახელი, რომლითაც კლიენტები გიცნობენ.');
    if (!gyms.length) return Alert.alert('დარბაზი', 'აირჩიე მინიმუმ ერთი დარბაზი, სადაც ვარჯიშებს ატარებ.');
    setBusy('submit');
    try {
      const res = await api.coach.apply({
        displayName: name.trim(),
        bio: bio.trim(),
        specialties,
        experienceYears: years ? Number(years) : null,
        instagram: instagram.trim(),
        gymIds: gyms.map((g) => g.id),
      });
      hydrate(res.trainerProfile);
      if (!profile) Alert.alert('განაცხადი მიღებულია ✅', 'ახლა დაამატე სერტიფიკატი — ეს დადასტურებას აჩქარებს. დადასტურებისას შეტყობინება მოგივა.');
    } catch (e) {
      if (isPhoneRequiredError(e)) offerPhoneVerification(router);
      else if (e instanceof ApiError && e.code === 'BIRTHDATE_REQUIRED') Alert.alert('დაბადების თარიღი', e.message);
      else Alert.alert('ვერ გაიგზავნა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const propose = async () => {
    if (newGym.brand.trim().length < 2) return;
    setBusy('gym');
    try {
      const res = await api.coach.proposeGym({ brand: newGym.brand.trim(), city: newGym.city.trim() || 'თბილისი', address: newGym.address.trim() });
      setGyms((g) => [...g, res.gym]);
      setProposing(false);
      setPicking(false);
      setNewGym({ brand: '', city: 'თბილისი', address: '' });
    } catch (e) {
      if (isPhoneRequiredError(e)) offerPhoneVerification(router);
      else Alert.alert('ვერ დაემატა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const addCert = async (camera: boolean) => {
    if (cert.title.trim().length < 2) return Alert.alert('სერტიფიკატი', 'ჯერ ჩაწერე სერტიფიკატის დასახელება.');
    setBusy('cert');
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert(ka.upload.permissionDenied);
      const result = camera ? await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);
      if (result.canceled || !result.assets[0]) return;
      const file = await toUploadableImage(result.assets[0], { maxEdge: 2200 });
      const res = await api.coach.addCertificate(file, { title: cert.title.trim(), issuer: cert.issuer.trim(), year: cert.year.trim() });
      setProfile(res.trainerProfile);
      setCert({ title: '', issuer: '', year: '' });
    } catch (e) {
      Alert.alert('ვერ აიტვირთა', e instanceof ApiError ? e.message : 'სცადე ხელახლა.');
    } finally {
      setBusy(null);
    }
  };

  const removeCert = (id: string, title: string) =>
    Alert.alert('სერტიფიკატის წაშლა', title, [
      { text: ka.common.cancel, style: 'cancel' },
      { text: 'წაშლა', style: 'destructive', onPress: () => void api.coach.removeCertificate(id).then((r) => setProfile(r.trainerProfile)).catch(() => undefined) },
    ]);

  const status = profile?.status;
  return (
    <CoachForm
      title="ტრენერის რეგისტრაცია"
      subtitle="MEDI COACH"
      fallback="/trainer"
      footer={
        status === 'VERIFIED' ? (
          <View style={[coachStyles.row, { gap: 10 }]}>
            <Button label="შენახვა" kind="secondary" style={{ flex: 1 }} busy={busy === 'submit'} onPress={() => void submit()} />
            <Button label="ტრენერის რეჟიმი" style={{ flex: 1 }} onPress={() => router.replace('/coach' as never)} />
          </View>
        ) : (
          <Button label={profile ? (status === 'REJECTED' ? 'ხელახლა გაგზავნა' : 'ცვლილებების შენახვა') : 'განაცხადის გაგზავნა'} busy={busy === 'submit'} disabled={status === 'SUSPENDED'} onPress={() => void submit()} />
        )
      }
    >
      {profile === undefined ? <Loading /> : null}
      {status ? (
        <Card style={{ marginTop: 8, gap: 8, backgroundColor: status === 'VERIFIED' ? c.successBg : status === 'PENDING' ? c.warningBg : c.dangerBg }}>
          <View style={coachStyles.row}>
            {status === 'VERIFIED' ? <BadgeCheck size={22} color={c.success} /> : status === 'PENDING' ? <Clock3 size={22} color={c.warning} /> : <X size={22} color={c.danger} />}
            <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>
              {status === 'VERIFIED' ? 'დადასტურებული ტრენერი ხარ' : status === 'PENDING' ? 'განაცხადი განიხილება' : status === 'REJECTED' ? 'განაცხადს დაზუსტება სჭირდება' : 'პროფილი შეჩერებულია'}
            </Text>
          </View>
          <Text style={[hubText.body, { color: c.text200 }]}>
            {status === 'VERIFIED'
              ? 'კლიენტებს მოიწვევ კოდით, ჩაწერ ვარჯიშებზე და ნახავ მათ პროგრესს — იმას, რასაც გაგიზიარებენ.'
              : status === 'PENDING'
                ? 'MEDICARD-ის გუნდი ამოწმებს პროფილს და სერტიფიკატებს. ჩვეულებრივ 1–2 სამუშაო დღე. დადასტურებისას შეტყობინება მოგივა.'
                : status === 'REJECTED'
                  ? profile?.reviewNote || 'გადახედე მონაცემებს და გაგზავნე ხელახლა.'
                  : 'დეტალებისთვის მოგვწერე support@medicard.ge'}
          </Text>
        </Card>
      ) : profile === null ? (
        <Card style={{ marginTop: 8, gap: 10 }}>
          <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17 }]}>ტრენერის სამუშაო სივრცე — უფასოდ</Text>
          <Text style={[hubText.body, { color: c.text200 }]}>
            კალენდარი და ჯავშნები შეხსენებებით, კლიენტების სია, კვების გეგმები და კლიენტის პროგრესი: კალორიები, წონა, ვარჯიშები საათიდან — მხოლოდ კლიენტის თანხმობით.
          </Text>
          <Text style={[hubText.small, { color: c.text300 }]}>საჭიროა: დადასტურებული ტელეფონი, 18+ და სერტიფიკატი ან სხვა დასტური. პროფილს MEDICARD-ის გუნდი ამოწმებს.</Text>
        </Card>
      ) : null}

      {profile !== undefined ? (
        <>
          <Field label="სახელი, რომლითაც კლიენტები გიცნობენ">
            <Input value={name} onChangeText={setName} maxLength={60} placeholder="მაგ. ნიკა ბერიძე" />
          </Field>
          <Field label="შენს შესახებ" hint="მიდგომა, გამოცდილება, რისი მიღწევა შეუძლია კლიენტს შენთან.">
            <Input value={bio} onChangeText={setBio} multiline maxLength={800} placeholder="მაგ. 6 წელია ვმუშაობ ძალოვან ვარჯიშსა და წონის კლებაზე…" />
          </Field>
          <View style={[coachStyles.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Field label="გამოცდილება (წელი)">
                <Input value={years} onChangeText={(t) => setYears(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="5" />
              </Field>
            </View>
            <View style={{ flex: 1.4 }}>
              <Field label="Instagram (არასავალდ.)">
                <Input value={instagram} onChangeText={setInstagram} autoCapitalize="none" autoCorrect={false} placeholder="@username" />
              </Field>
            </View>
          </View>

          <Section title="სპეციალიზაცია" style={{ marginTop: 22 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(catalog?.specialties ?? []).map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  selected={specialties.includes(s.key)}
                  onPress={() => setSpecialties((prev) => (prev.includes(s.key) ? prev.filter((k) => k !== s.key) : prev.length < 6 ? [...prev, s.key] : prev))}
                />
              ))}
            </View>
          </Section>

          <Section title="სად ვარჯიშებ" style={{ marginTop: 22 }}>
            {gyms.map((g) => (
              <Card key={g.id} style={{ marginBottom: 8, paddingVertical: 12 }}>
                <View style={coachStyles.row}>
                  <IconTile icon={Building2} ink="blue" size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                      {g.brand} · {g.name}
                    </Text>
                    <Text style={[hubText.caption, { color: c.text300 }]}>{[g.city, g.address].filter(Boolean).join(' · ')}</Text>
                    {g.status === 'PROPOSED' ? <Badge label="ახალი დარბაზი — გადამოწმდება" tone="warn" /> : null}
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${g.brand} წაშლა`} hitSlop={10} onPress={() => setGyms((list) => list.filter((x) => x.id !== g.id))}>
                    <X size={18} color={c.text300} />
                  </Pressable>
                </View>
              </Card>
            ))}
            {gyms.length < 5 && !picking ? <Button label="დარბაზის დამატება" icon={Plus} kind="secondary" onPress={() => setPicking(true)} /> : null}
            {picking ? (
              <Card style={{ gap: 6 }}>
                {!proposing ? (
                  <>
                    <Input inset value={gymQ} onChangeText={setGymQ} autoFocus placeholder="Oktopus, Aspria, Snap, ვაკე, ბათუმი…" />
                    {gymRows.map((g) => (
                      <Pressable
                        key={g.id}
                        accessibilityRole="button"
                        onPress={() => {
                          setGyms((list) => [...list, g]);
                          setPicking(false);
                          setGymQ('');
                        }}
                        style={[coachStyles.row, { paddingVertical: 10, borderBottomWidth: 0.5, borderColor: c.bg300 }]}
                      >
                        <MapPin size={15} color={c.primary100} />
                        <View style={{ flex: 1 }}>
                          <Text style={[hubText.cardTitle, { color: c.text100 }]}>
                            {g.brand} · {g.name}
                          </Text>
                          <Text style={[hubText.caption, { color: c.text300 }]}>{[g.city, g.district, g.address].filter(Boolean).join(' · ')}</Text>
                        </View>
                      </Pressable>
                    ))}
                    <Button label="ჩემი დარბაზი სიაში არ არის" kind="ghost" onPress={() => setProposing(true)} />
                    <Button label="დახურვა" kind="ghost" onPress={() => setPicking(false)} />
                  </>
                ) : (
                  <>
                    <Text style={[hubText.body, { color: c.text200 }]}>დაამატე დარბაზი — გუნდი გადაამოწმებს და ყველასთვის გამოჩნდება.</Text>
                    <Input inset value={newGym.brand} onChangeText={(t) => setNewGym((g) => ({ ...g, brand: t }))} placeholder="დარბაზის სახელი" />
                    <Input inset value={newGym.city} onChangeText={(t) => setNewGym((g) => ({ ...g, city: t }))} placeholder="ქალაქი" />
                    <Input inset value={newGym.address} onChangeText={(t) => setNewGym((g) => ({ ...g, address: t }))} placeholder="მისამართი (არასავალდ.)" />
                    <Button label="დამატება" busy={busy === 'gym'} onPress={() => void propose()} />
                    <Button label="უკან სიაზე" kind="ghost" onPress={() => setProposing(false)} />
                  </>
                )}
              </Card>
            ) : null}
          </Section>

          {profile ? (
            <Section title="სერტიფიკატები" style={{ marginTop: 22 }}>
              {profile.certificates.map((ct) => (
                <Card key={ct.id} style={{ marginBottom: 8, paddingVertical: 12 }}>
                  <View style={coachStyles.row}>
                    <IconTile icon={Award} ink="amber" size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.cardTitle, { color: c.text100 }]}>{ct.title}</Text>
                      <Text style={[hubText.caption, { color: c.text300 }]}>{[ct.issuer, ct.year].filter(Boolean).join(' · ') || 'ფოტო ატვირთულია'}</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel="სერტიფიკატის წაშლა" hitSlop={10} onPress={() => removeCert(ct.id, ct.title)}>
                      <Trash2 size={18} color={c.text300} />
                    </Pressable>
                  </View>
                </Card>
              ))}
              <Card style={{ gap: 8 }}>
                <View style={coachStyles.row}>
                  <FileCheck2 size={18} color={c.primary100} />
                  <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>ფოტო მხოლოდ MEDICARD-ის გუნდს უჩანს. კლიენტები ხედავენ დასახელებას, გამცემს და წელს.</Text>
                </View>
                <Input inset value={cert.title} onChangeText={(t) => setCert((x) => ({ ...x, title: t }))} placeholder="დასახელება (მაგ. NASM CPT, ფიზ. აღზრდის დიპლომი)" />
                <View style={[coachStyles.row, { gap: 8 }]}>
                  <Input inset style={{ flex: 1.5 }} value={cert.issuer} onChangeText={(t) => setCert((x) => ({ ...x, issuer: t }))} placeholder="გამცემი" />
                  <Input inset style={{ flex: 1 }} value={cert.year} onChangeText={(t) => setCert((x) => ({ ...x, year: t.replace(/\D/g, '').slice(0, 4) }))} keyboardType="number-pad" placeholder="წელი" />
                </View>
                <View style={[coachStyles.row, { gap: 8 }]}>
                  <Button label="კამერა" kind="secondary" style={{ flex: 1 }} busy={busy === 'cert'} onPress={() => void addCert(true)} />
                  <Button label="გალერეა" kind="secondary" style={{ flex: 1 }} busy={busy === 'cert'} onPress={() => void addCert(false)} />
                </View>
              </Card>
            </Section>
          ) : null}
          <View style={{ height: 12 }} />
        </>
      ) : null}
    </CoachForm>
  );
}
