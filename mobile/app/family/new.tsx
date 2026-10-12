import React, { useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Minus, Plus } from 'lucide-react-native';
import { ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { chooseChild } from '@/components/family/FamilyHubScreen';
import { AVATAR_KEYS, ChildAvatar, Chip, DatePickerInline, FamilyButton, FText, Field, avatarColor, daysBetweenYmd, errorText, formatYmd, todayYmd, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { familyApi, type Sex } from '@/lib/family/familyApi';
import { reconcileFamilyReminders } from '@/lib/family/familyReminders';
import { tx } from '@/i18n/locale';

type Step = 'name' | 'birth' | 'sex' | 'term' | 'size' | 'vaccines' | 'consent';

/**
 * Add a child: one question per step (≤ 60 s), the sign-in keyboard pattern, and the parent's consent last
 * (Georgian Law 3144 Art. 7(3): a parent's consent for a child's health data). Optional steps can be skipped.
 */
export default function AddChildScreen() {
  const router = useRouter();
  const { c, ink, dark } = useFamilyInk();
  const scrollRef = useRef<ScrollView | null>(null);
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [color, setColor] = useState('coral');
  const [birth, setBirth] = useState<string | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [preterm, setPreterm] = useState<boolean | null>(null);
  const [weeks, setWeeks] = useState(34);
  const [weightG, setWeightG] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [past, setPast] = useState<'ALL' | 'MANUAL' | 'NONE' | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayYmd();
  const minBirth = `${Number(today.slice(0, 4)) - 18}-${today.slice(5)}`;
  const ageDays = birth ? daysBetweenYmd(birth, today) : 0;
  const steps: Step[] = useMemo(() => {
    const all: Step[] = ['name', 'birth', 'sex', 'term', 'size', 'vaccines', 'consent'];
    return all.filter((s) => !(s === 'term' && ageDays > 3 * 365) && !(s === 'size' && ageDays > 365) && !(s === 'vaccines' && ageDays < 1));
  }, [ageDays]);
  const index = Math.max(0, steps.indexOf(step));
  const isLast = index === steps.length - 1;
  const canNext = step === 'name' ? name.trim().length >= 1 : step === 'birth' ? Boolean(birth) : step === 'sex' ? Boolean(sex)
    : step === 'term' ? preterm !== null : step === 'vaccines' ? Boolean(past) : step === 'consent' ? consent : true;

  const go = (delta: number) => {
    setError(null);
    const next = steps[index + delta];
    if (!next) return delta < 0 ? router.back() : undefined;
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const submit = async () => {
    if (!birth || !sex) return;
    setBusy(true); setError(null);
    try {
      const w = Number(weightG.replace(',', '.'));
      const l = Number(lengthCm.replace(',', '.'));
      const { member } = await familyApi.create({
        name: name.trim(), birthDate: birth, sex, color,
        gestationWeeks: preterm ? weeks : null,
        birthWeightG: Number.isFinite(w) && w > 0 ? Math.round(w < 20 ? w * 1000 : w) : null,
        birthLengthCm: Number.isFinite(l) && l > 0 ? l : null,
        consent: true,
        pastVaccines: past ?? 'NONE',
      });
      chooseChild(member.id);
      void reconcileFamilyReminders({ force: true });
      router.dismissTo('/family');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const title = {
    name: tx('რა ჰქვია შენს შვილს?', 'What is your child’s name?'),
    birth: tx(`როდის დაიბადა ${name.trim() || ''}?`, `When was ${name.trim() || 'they'} born?`),
    sex: tx('გოგოა თუ ბიჭი?', 'Girl or boy?'),
    term: tx('დროულად დაიბადა?', 'Born on time?'),
    size: tx('დაბადების წონა და სიგრძე', 'Birth weight and length'),
    vaccines: tx('აქამდე აცრები?', 'Vaccines so far?'),
    consent: tx('ერთი ბოლო რამ', 'One last thing'),
  }[step];
  const sub = {
    name: tx('სახელი მხოლოდ შენ და Medi-ს ჩანს.', 'Only you and Medi see the name.'),
    birth: tx('ასაკით ვითვლით აცრების ვადებს, ზრდას და რჩევებს.', 'Age drives the vaccine dates, growth and tips.'),
    sex: tx('ზრდის მრუდები გოგოებს და ბიჭებს განსხვავებული აქვთ.', 'Girls and boys have different growth curves.'),
    term: tx('ნაადრევად დაბადებულს ზრდას და განვითარებას 2 წლამდე კორექტირებული ასაკით ვაფასებთ. აცრები კალენდრით რჩება.', 'For babies born early we judge growth and development by corrected age until 2. Vaccines keep to the calendar.'),
    size: tx('სურვილისამებრ — ბავშვის ბარათიდან.', 'Optional — from the birth record.'),
    vaccines: tx('კალენდრის გაკეთებულ აცრებს მოვნიშნავთ, რომ ვადები სწორად დავითვალოთ.', 'We’ll mark the calendar vaccines already given so the dates come out right.'),
    consent: tx('ბავშვის ჯანმრთელობის მონაცემებზე თანხმობას მშობელი იძლევა.', 'A parent gives consent for a child’s health data.'),
  }[step];

  return (
    <KeyboardFormShell
      background={c.bg100}
      scrollRef={scrollRef}
      header={<ModuleStackHeader module="family" subtitle={tx(`შვილის დამატება · ${index + 1}/${steps.length}`, `Add a child · ${index + 1}/${steps.length}`)} onBack={() => go(-1)} fallbackHref="/family" />}
      contentStyle={{ paddingHorizontal: 20, paddingTop: 8, gap: 18 }}
      footer={
        <View style={{ gap: 8 }}>
          {error ? <FText size={13} color={toneColors('alert', dark).ink}>{error}</FText> : null}
          <FamilyButton label={isLast ? tx('დამატება', 'Add') : tx('გაგრძელება', 'Continue')} busy={busy} disabled={!canNext} onPress={() => (isLast ? void submit() : go(1))} />
          {step === 'size' ? <FamilyButton label={tx('გამოტოვება', 'Skip')} variant="ghost" size="sm" onPress={() => go(1)} /> : null}
        </View>
      }
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.bg200 }}>
        <View style={{ width: `${((index + 1) / steps.length) * 100}%`, height: 4, borderRadius: 2, backgroundColor: ink }} />
      </View>
      <View style={{ gap: 6 }}>
        <FText size={24} weight="bold" style={{ lineHeight: 32 }}>{title}</FText>
        <FText size={14} muted>{sub}</FText>
      </View>

      {step === 'name' ? (
        <View style={{ gap: 16 }}>
          <Field label={tx('სახელი', 'Name')} value={name} onChangeText={setName} autoFocus maxLength={40} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => name.trim() && go(1)} />
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {AVATAR_KEYS.map((key) => (
              <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: color === key }} accessibilityLabel={tx(`ფერი ${key}`, `Colour ${key}`)} onPress={() => setColor(key)}>
                <ChildAvatar name={name} color={key} size={44} ring={color === key ? avatarColor(key)[0] : undefined} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {step === 'birth' ? (
        <View style={{ gap: 10 }}>
          <DatePickerInline value={birth} min={minBirth} max={today} onChange={setBirth} />
          {birth ? <FText weight="semi" center>{formatYmd(birth)}</FText> : null}
        </View>
      ) : null}

      {step === 'sex' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Chip label={tx('გოგო', 'Girl')} on={sex === 'FEMALE'} onPress={() => setSex('FEMALE')} /></View>
          <View style={{ flex: 1 }}><Chip label={tx('ბიჭი', 'Boy')} on={sex === 'MALE'} onPress={() => setSex('MALE')} /></View>
        </View>
      ) : null}

      {step === 'term' ? (
        <View style={{ gap: 12 }}>
          <Chip label={tx('დროულად (37 კვირა ან მეტი)', 'On time (37 weeks or more)')} on={preterm === false} onPress={() => setPreterm(false)} />
          <Chip label={tx('ნაადრევად (37 კვირამდე)', 'Early (before 37 weeks)')} on={preterm === true} onPress={() => setPreterm(true)} />
          {preterm ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 8 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('ერთი კვირით ნაკლები', 'One week less')} onPress={() => setWeeks((w) => Math.max(23, w - 1))}
                style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Minus size={22} color={c.text100} /></Pressable>
              <View style={{ alignItems: 'center', minWidth: 110 }} accessible accessibilityLabel={tx(`${weeks} კვირა`, `${weeks} weeks`)}>
                <FText size={40} weight="semi" color={ink} style={{ lineHeight: 50 }}>{weeks}</FText>
                <FText size={13} muted>{tx('კვირაზე დაიბადა', 'weeks at birth')}</FText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={tx('ერთი კვირით მეტი', 'One week more')} onPress={() => setWeeks((w) => Math.min(36, w + 1))}
                style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Plus size={22} color={c.text100} /></Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 'size' ? (
        <View style={{ gap: 14 }}>
          <Field label={tx('წონა დაბადებისას (გრამი)', 'Birth weight (grams)')} value={weightG} onChangeText={setWeightG} keyboardType="decimal-pad" placeholder="3400" maxLength={6} />
          <Field label={tx('სიგრძე დაბადებისას (სმ)', 'Birth length (cm)')} value={lengthCm} onChangeText={setLengthCm} keyboardType="decimal-pad" placeholder="51" maxLength={5} />
        </View>
      ) : null}

      {step === 'vaccines' ? (
        <View style={{ gap: 10 }}>
          <Chip label={tx('კალენდრის ყველა აცრა გაკეთებულია', 'All calendar vaccines so far are done')} on={past === 'ALL'} onPress={() => setPast('ALL')} />
          <Chip label={tx('ბარათიდან თავად მოვნიშნავ', 'I’ll mark them from the card')} on={past === 'MANUAL'} onPress={() => setPast('MANUAL')} />
          <Chip label={tx('არ ვიცი / ჯერ არ გაკეთებულა', 'I don’t know / none yet')} on={past === 'NONE'} onPress={() => setPast('NONE')} />
          <FText size={12} muted>{tx('ნებისმიერ დროს შეგიძლია შეცვალო აცრების ბარათზე.', 'You can change this any time on the vaccine card.')}</FText>
        </View>
      ) : null}

      {step === 'consent' ? (
        <View style={{ gap: 14 }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: c.surface, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: consent ? ink : c.bg200 }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: consent ? ink : c.bg300, backgroundColor: consent ? ink : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              {consent ? <Check size={16} color={dark ? '#1F1208' : '#FFFFFF'} /> : null}
            </View>
            <FText style={{ flex: 1 }}>{tx(
              `ვარ ბავშვის მშობელი ან კანონიერი წარმომადგენელი და ვეთანხმები, რომ MEDICARD-მა შეინახოს და დაამუშაოს მისი ჯანმრთელობის მონაცემები ამ აპში — მხოლოდ ჩემთვის ჩვენებისა და ჩემი კითხვისას Medi-ს პასუხისთვის.`,
              `I am ${name.trim() ? `${name.trim()}’s` : 'the child’s'} parent or legal guardian, and I agree that MEDICARD stores and processes their health data in this app — only to show it to me and for Medi’s answers when I ask.`,
            )}</FText>
          </Pressable>
          <FText size={13} muted>{tx('ნებისმიერ დროს შეგიძლია ბავშვის პროფილი და ყველა ჩანაწერი სრულად წაშალო.', 'You can delete the child’s profile and every record completely at any time.')}</FText>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://medicard.ge/privacy')}>
            <FText size={13} weight="semi" color={ink}>{tx('კონფიდენციალურობის პოლიტიკა', 'Privacy policy')}</FText>
          </Pressable>
        </View>
      ) : null}
    </KeyboardFormShell>
  );
}
