import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Award, BadgeCheck, Building2, Camera, Check, CircleAlert, Clock3, ImagePlus, MapPin, PartyPopper, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { api, ApiError } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { IMAGE_PICKER_OPTIONS, toUploadableImage, type UploadableImage } from '@/lib/imageUpload';
import { hasVerifiedPhone, isPhoneRequiredError, offerPhoneVerification } from '@/lib/phoneGate';
import { invalidateCoachEntry } from '@/components/coach/CoachEntry';
import { useAuth } from '@/store/AuthContext';
import type { CoachCatalog, Gym, GymBrand, OwnTrainerProfile } from '@/lib/coach';
import { Badge, Button, Card, Chip, CoachForm, CoachHeader, Field, IconTile, Input, Loading, Screen, Section, coachStyles } from '@/components/coach/CoachUI';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';

const STEPS = ['შენ შესახებ', 'სპეციალიზაცია და დარბაზი', 'სერტიფიკატები'];
type StagedCert = { key: string; title: string; issuer: string; year: string; file: UploadableImage };

/**
 * Trainer registration: three short steps, certificates can be added before sending, then a clear
 * status screen (sent → under review → approved). Opening it again shows the status, not the raw form.
 */
export default function TrainerApplyScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const { user } = useAuth();
  const [profile, setProfile] = useState<OwnTrainerProfile | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<CoachCatalog | null>(null);
  const [editing, setEditing] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [step, setStep] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
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
  const [staged, setStaged] = useState<StagedCert[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const hydrate = useCallback(
    (p: OwnTrainerProfile | null) => {
      setProfile(p);
      if (p) {
        setName(p.displayName);
        setBio(p.bio);
        setYears(p.experienceYears != null ? String(p.experienceYears) : '');
        setInstagram(p.instagram ? `@${p.instagram}` : '');
        setSpecialties(p.specialties);
        setGyms(p.gyms);
      } else {
        setName((n) => n || user?.fullName || '');
      }
    },
    [user?.fullName],
  );

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
  }, [hydrate]);
  useFocusEffect(useCallback(() => void load(), [load]));

  useEffect(() => {
    if (!picking || proposing) return;
    const t = setTimeout(() => void api.coach.gyms(gymQ.trim()).then((r) => setBrands(r.brands)).catch(() => setBrands([])), 200);
    return () => clearTimeout(t);
  }, [gymQ, picking, proposing]);
  const gymRows = useMemo(() => brands.flatMap((b) => b.branches).filter((g) => !gyms.some((x) => x.id === g.id)).slice(0, 30), [brands, gyms]);

  const validate = (s: number): string | null => {
    if (s === 0 && name.trim().length < 2) return 'მიუთითე სახელი, რომლითაც კლიენტები გიცნობენ.';
    if (s === 1 && !gyms.length) return 'აირჩიე მინიმუმ ერთი დარბაზი, სადაც ვარჯიშებს ატარებ.';
    return null;
  };
  const next = () => {
    const problem = validate(step);
    setHint(problem);
    if (!problem) setStep((v) => Math.min(STEPS.length - 1, v + 1));
  };

  const submit = async () => {
    for (const s of [0, 1]) {
      const problem = validate(s);
      if (problem) {
        setStep(s);
        setHint(problem);
        return;
      }
    }
    if (!hasVerifiedPhone(user)) {
      offerPhoneVerification(router, 'ტრენერის პროფილისთვის ტელეფონის დადასტურება საჭიროა — ასე კლიენტები დარწმუნებულები არიან, რომ რეალურ ადამიანთან აქვთ საქმე.');
      return;
    }
    setBusy('submit');
    try {
      const res = await api.coach.apply({ displayName: name.trim(), bio: bio.trim(), specialties, experienceYears: years ? Number(years) : null, instagram: instagram.trim(), gymIds: gyms.map((g) => g.id) });
      let latest = res.trainerProfile;
      const failed: string[] = [];
      for (const sc of staged) {
        try {
          latest = (await api.coach.addCertificate(sc.file, { title: sc.title, issuer: sc.issuer, year: sc.year })).trainerProfile;
        } catch {
          failed.push(sc.title);
        }
      }
      setStaged([]);
      hydrate(latest);
      invalidateCoachEntry();
      setEditing(false);
      setJustSent(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (failed.length) Alert.alert('სერტიფიკატი ვერ აიტვირთა', `${failed.join(', ')} — სცადე ხელახლა „რედაქტირებიდან“.`);
    } catch (e) {
      if (isPhoneRequiredError(e)) offerPhoneVerification(router);
      else setHint(e instanceof ApiError ? e.message : 'ვერ გაიგზავნა. შეამოწმე ინტერნეტი და სცადე ხელახლა.');
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
      setHint(null);
    } catch (e) {
      if (isPhoneRequiredError(e)) offerPhoneVerification(router);
      else setHint(e instanceof ApiError ? e.message : 'დარბაზი ვერ დაემატა.');
    } finally {
      setBusy(null);
    }
  };

  const pickCert = async (camera: boolean) => {
    if (cert.title.trim().length < 2) {
      setHint('ჯერ ჩაწერე სერტიფიკატის დასახელება.');
      return;
    }
    setBusy(camera ? 'camera' : 'gallery');
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert(ka.upload.permissionDenied);
      const result = camera ? await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS) : await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);
      if (result.canceled || !result.assets[0]) return;
      const file = await toUploadableImage(result.assets[0], { maxEdge: 2200 });
      const item = { key: `${Date.now()}`, title: cert.title.trim(), issuer: cert.issuer.trim(), year: cert.year.trim(), file };
      if (profile) {
        const res = await api.coach.addCertificate(file, { title: item.title, issuer: item.issuer, year: item.year });
        setProfile(res.trainerProfile);
      } else setStaged((list) => [...list, item]);
      setCert({ title: '', issuer: '', year: '' });
      setHint(null);
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

  if (profile === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        <CoachHeader title="ტრენერის რეგისტრაცია" fallback="/trainer" />
        <Loading />
      </View>
    );
  }
  if (profile && !editing) {
    return (
      <ApplicationStatus
        profile={profile}
        justSent={justSent}
        onEdit={(to = 0) => {
          setEditing(true);
          setStep(to);
          setHint(null);
        }}
        onDeleteCert={removeCert}
      />
    );
  }

  const last = step === STEPS.length - 1;
  const sendLabel = profile ? (profile.status === 'REJECTED' ? 'ხელახლა გაგზავნა' : 'ცვლილებების შენახვა') : 'განაცხადის გაგზავნა';
  return (
    <CoachForm
      title={profile ? 'განაცხადის რედაქტირება' : 'ტრენერის რეგისტრაცია'}
      subtitle={`ნაბიჯი ${step + 1} / ${STEPS.length} · ${STEPS[step]}`}
      fallback="/trainer"
      footer={
        <>
          {hint ? (
            <View accessibilityRole="alert" style={[coachStyles.row, { gap: 8 }]}>
              <CircleAlert size={16} color={c.warning} />
              <Text style={[hubText.caption, { color: c.text100, flex: 1 }]}>{hint}</Text>
            </View>
          ) : null}
          <View style={[coachStyles.row, { gap: 10 }]}>
            {step > 0 ? (
              <Button
                label="უკან"
                kind="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  setHint(null);
                  setStep((v) => v - 1);
                }}
              />
            ) : null}
            {last ? <Button label={sendLabel} busy={busy === 'submit'} style={{ flex: 2 }} onPress={() => void submit()} /> : <Button label="შემდეგი" style={{ flex: 2 }} onPress={next} />}
          </View>
        </>
      }
    >
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {STEPS.map((label, i) => (
          <View key={label} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? '#0D9488' : c.bg300 }} />
        ))}
      </View>

      {step === 0 ? (
        <>
          {!profile ? (
            <View style={{ backgroundColor: HUB.spotlightBg, borderRadius: HUB.cardRadius, padding: 18, gap: 10, marginTop: 16 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 25, color: '#FFFFFF' }}>ტრენერის სამუშაო სივრცე — უფასოდ</Text>
              {['კალენდარი და ჯავშნები შეხსენებებით', 'კლიენტები QR-ით, ერთი დასკანერებით', 'კვების გეგმა და კლიენტის პროგრესი'].map((line) => (
                <View key={line} style={[coachStyles.row, { gap: 8 }]}>
                  <Check size={16} color="#99F6E4" />
                  <Text style={[hubText.body, { color: '#FFFFFF', flex: 1 }]}>{line}</Text>
                </View>
              ))}
              <Text style={[hubText.small, { color: '#C5DADA' }]}>საჭიროა დადასტურებული ტელეფონი და 18+. პროფილს MEDICARD-ის გუნდი ამოწმებს 1–2 სამუშაო დღეში.</Text>
            </View>
          ) : null}
          <Field label="სახელი, რომლითაც კლიენტები გიცნობენ">
            <Input value={name} onChangeText={setName} maxLength={60} placeholder="მაგ. ნიკა ბერიძე" />
          </Field>
          <Field label="შენს შესახებ" hint="მიდგომა, გამოცდილება, რისი მიღწევა შეუძლია კლიენტს შენთან.">
            <Input value={bio} onChangeText={setBio} multiline maxLength={800} placeholder="მაგ. 6 წელია ვმუშაობ ძალოვან ვარჯიშსა და წონის კლებაზე…" />
          </Field>
          <View style={[coachStyles.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Field label="გამოცდილება, წელი">
                <Input value={years} onChangeText={(t) => setYears(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="5" />
              </Field>
            </View>
            <View style={{ flex: 1.4 }}>
              <Field label="Instagram">
                <Input value={instagram} onChangeText={setInstagram} autoCapitalize="none" autoCorrect={false} placeholder="@username" />
              </Field>
            </View>
          </View>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Section title="სპეციალიზაცია" style={{ marginTop: 20 }}>
            <Text style={[hubText.caption, { color: c.text300, marginTop: -6, marginBottom: 10 }]}>აირჩიე 6-მდე</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(catalog?.specialties ?? []).map((sp) => (
                <Chip
                  key={sp.key}
                  label={sp.label}
                  selected={specialties.includes(sp.key)}
                  onPress={() => setSpecialties((prev) => (prev.includes(sp.key) ? prev.filter((k) => k !== sp.key) : prev.length < 6 ? [...prev, sp.key] : prev))}
                />
              ))}
            </View>
          </Section>
          <Section title="სად ვარჯიშებ" style={{ marginTop: 24 }}>
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
            {gyms.length < 5 && !picking ? <Button label={gyms.length ? 'კიდევ ერთი დარბაზი' : 'დარბაზის არჩევა'} icon={Plus} kind="secondary" onPress={() => setPicking(true)} /> : null}
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
                          setHint(null);
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
        </>
      ) : null}

      {step === 2 ? (
        <Section title="სერტიფიკატები" style={{ marginTop: 20 }}>
          <Text style={[hubText.caption, { color: c.text300, marginTop: -6, marginBottom: 10 }]}>არასავალდებულოა, მაგრამ დადასტურებას მნიშვნელოვნად აჩქარებს. ფოტოს ხედავს მხოლოდ MEDICARD-ის გუნდი.</Text>
          {(profile?.certificates ?? []).map((ct) => (
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
          {staged.map((sc) => (
            <Card key={sc.key} style={{ marginBottom: 8, paddingVertical: 12 }}>
              <View style={coachStyles.row}>
                <Image source={{ uri: sc.file.uri }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>{sc.title}</Text>
                  <Text style={[hubText.caption, { color: c.text300 }]}>{[sc.issuer, sc.year].filter(Boolean).join(' · ') || 'აიტვირთება განაცხადთან ერთად'}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="წაშლა" hitSlop={10} onPress={() => setStaged((l) => l.filter((x) => x.key !== sc.key))}>
                  <X size={18} color={c.text300} />
                </Pressable>
              </View>
            </Card>
          ))}
          <Card style={{ gap: 8 }}>
            <Input inset value={cert.title} onChangeText={(t) => setCert((x) => ({ ...x, title: t }))} placeholder="დასახელება (მაგ. NASM CPT, დიპლომი)" />
            <View style={[coachStyles.row, { gap: 8 }]}>
              <Input inset style={{ flex: 1.5 }} value={cert.issuer} onChangeText={(t) => setCert((x) => ({ ...x, issuer: t }))} placeholder="გამცემი" />
              <Input inset style={{ flex: 1 }} value={cert.year} onChangeText={(t) => setCert((x) => ({ ...x, year: t.replace(/\D/g, '').slice(0, 4) }))} keyboardType="number-pad" placeholder="წელი" />
            </View>
            <View style={[coachStyles.row, { gap: 8 }]}>
              <Button label="კამერა" icon={Camera} kind="secondary" style={{ flex: 1 }} busy={busy === 'camera'} onPress={() => void pickCert(true)} />
              <Button label="გალერეა" icon={ImagePlus} kind="secondary" style={{ flex: 1 }} busy={busy === 'gallery'} onPress={() => void pickCert(false)} />
            </View>
          </Card>
          <Card style={{ marginTop: 14, gap: 6 }}>
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>შეჯამება</Text>
            <Text style={[hubText.body, { color: c.text200 }]}>
              {name || '—'}
              {years ? ` · ${years} წლის გამოცდილება` : ''}
            </Text>
            <Text style={[hubText.caption, { color: c.text300 }]}>{gyms.map((g) => `${g.brand} ${g.name}`).join(' · ') || 'დარბაზი არ არის არჩეული'}</Text>
            <Text style={[hubText.caption, { color: c.text300 }]}>
              {specialties.length} სპეციალიზაცია · {(profile?.certificates.length ?? 0) + staged.length} სერტიფიკატი
            </Text>
          </Card>
        </Section>
      ) : null}
      <View style={{ height: 12 }} />
    </CoachForm>
  );
}

/** After sending (and on every later visit): a clear status with a 3-step timeline. */
function ApplicationStatus({ profile, justSent, onEdit, onDeleteCert }: { profile: OwnTrainerProfile; justSent: boolean; onEdit: (step?: number) => void; onDeleteCert: (id: string, title: string) => void }) {
  const router = useRouter();
  const c = useThemeColors();
  const st = profile.status;
  const tone = st === 'VERIFIED' ? { bg: c.successBg, fg: c.success, Icon: BadgeCheck } : st === 'PENDING' ? { bg: c.warningBg, fg: c.warning, Icon: Clock3 } : { bg: c.dangerBg, fg: c.danger, Icon: CircleAlert };
  const submitted = profile.submittedAt;
  const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const sentDate = submitted ? new Date(new Date(submitted).getTime() + 4 * 3600000) : null;
  const sentAt = sentDate ? `${sentDate.getUTCDate()} ${MONTHS[sentDate.getUTCMonth()]}` : '';
  const steps = [
    { label: 'განაცხადი გაგზავნილია', detail: sentAt, done: true, current: false },
    { label: 'გუნდი ამოწმებს', detail: st === 'PENDING' ? 'ჩვეულებრივ 1–2 სამუშაო დღე' : st === 'REJECTED' ? 'დაზუსტება სჭირდება' : '', done: st === 'VERIFIED', current: st === 'PENDING' || st === 'REJECTED' },
    { label: 'დადასტურება და ტრენერის რეჟიმი', detail: st === 'VERIFIED' ? 'მზადაა — მოიწვიე კლიენტები' : 'შეტყობინება მოგივა', done: st === 'VERIFIED', current: false },
  ];
  const title =
    justSent && st === 'PENDING' ? 'განაცხადი გაიგზავნა!' : st === 'PENDING' ? 'განაცხადი განხილვაშია' : st === 'VERIFIED' ? 'დადასტურებული ტრენერი ხარ' : st === 'REJECTED' ? 'განაცხადს დაზუსტება სჭირდება' : 'პროფილი შეჩერებულია';
  const body =
    st === 'PENDING'
      ? 'MEDICARD-ის გუნდი ამოწმებს შენს პროფილს და სერტიფიკატებს. დადასტურებისას შეტყობინება მოგივა და ტრენერის რეჟიმი გაიხსნება.'
      : st === 'VERIFIED'
        ? 'კლიენტებს მოიწვევ QR-ით ან კოდით, ჩაწერ ვარჯიშებზე და ნახავ მათ პროგრესს — იმას, რასაც გაგიზიარებენ.'
        : st === 'REJECTED'
          ? profile.reviewNote || 'გადახედე მონაცემებს, გაასწორე და გაგზავნე ხელახლა.'
          : 'დეტალებისთვის მოგვწერე support@medicard.ge';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <CoachHeader title="ტრენერის განაცხადი" fallback="/trainer" />
      <Screen>
        <View style={{ alignItems: 'center', marginTop: 16, gap: 12 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
            {justSent && st === 'PENDING' ? <PartyPopper size={44} color={tone.fg} /> : <tone.Icon size={44} color={tone.fg} />}
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 32, color: c.text100, textAlign: 'center' }}>
            {title}
          </Text>
          <Text style={[hubText.body, { color: c.text200, textAlign: 'center', fontSize: 14, lineHeight: 22, paddingHorizontal: 8 }]}>{body}</Text>
        </View>

        <Card style={{ marginTop: 22 }}>
          {steps.map((s, i) => (
            <View key={s.label} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center', width: 28 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: s.done ? '#0D9488' : s.current ? tone.bg : c.bg200,
                    borderWidth: s.current && !s.done ? 2 : 0,
                    borderColor: tone.fg,
                  }}
                >
                  {s.done ? <Check size={16} color="#FFFFFF" /> : <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: s.current ? tone.fg : c.text300 }}>{i + 1}</Text>}
                </View>
                {i < steps.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: s.done ? '#0D9488' : c.bg300 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 16 : 0, paddingTop: 3 }}>
                <Text style={[hubText.cardTitle, { color: s.done || s.current ? c.text100 : c.text300 }]}>{s.label}</Text>
                {s.detail ? <Text style={[hubText.caption, { color: c.text300 }]}>{s.detail}</Text> : null}
              </View>
            </View>
          ))}
        </Card>

        <Section title="შენი განაცხადი">
          <Card style={{ gap: 8 }}>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 16 }]}>{profile.displayName}</Text>
            {profile.experienceYears ? <Text style={[hubText.caption, { color: c.text300 }]}>{profile.experienceYears} წლის გამოცდილება</Text> : null}
            {profile.gyms.map((g) => (
              <View key={g.id} style={[coachStyles.row, { gap: 8 }]}>
                <MapPin size={14} color={c.text300} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>
                  {g.brand} · {g.name}, {g.city}
                </Text>
              </View>
            ))}
            {profile.certificates.map((ct) => (
              <View key={ct.id} style={[coachStyles.row, { gap: 8 }]}>
                <Award size={14} color={c.text300} />
                <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{[ct.title, ct.issuer, ct.year].filter(Boolean).join(' · ')}</Text>
                {st !== 'VERIFIED' ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="სერტიფიკატის წაშლა" hitSlop={10} onPress={() => onDeleteCert(ct.id, ct.title)}>
                    <Trash2 size={15} color={c.text300} />
                  </Pressable>
                ) : null}
              </View>
            ))}
            {!profile.certificates.length ? <Text style={[hubText.caption, { color: c.warning }]}>სერტიფიკატი არ არის — დამატება დადასტურებას აჩქარებს.</Text> : null}
          </Card>
        </Section>

        <View style={{ gap: 10, marginTop: 20 }}>
          {st === 'VERIFIED' ? <Button label="ტრენერის რეჟიმის გახსნა" onPress={() => router.replace('/coach' as never)} /> : null}
          {st === 'REJECTED' ? <Button label="გასწორება და ხელახლა გაგზავნა" icon={Pencil} onPress={() => onEdit(0)} /> : null}
          {st === 'PENDING' || st === 'VERIFIED' ? <Button label={profile.certificates.length ? 'განაცხადის რედაქტირება' : 'სერტიფიკატის დამატება'} icon={Pencil} kind="secondary" onPress={() => onEdit(profile.certificates.length ? 0 : 2)} /> : null}
          <Button label="პროფილზე დაბრუნება" kind="ghost" onPress={() => router.replace('/(tabs)/profile' as never)} />
        </View>
      </Screen>
    </View>
  );
}
