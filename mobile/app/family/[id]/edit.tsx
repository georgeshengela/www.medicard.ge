import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { ModuleStackHeader } from '@/components/brand/ModuleHeader';
import { AVATAR_KEYS, ChildAvatar, Chip, DatePickerInline, FamilyButton, FamilyCard, FText, Field, avatarColor, errorText, formatYmd, todayYmd, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { KeyboardFormShell } from '@/components/ui/KeyboardFormShell';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi, type FamilyMember, type Sex } from '@/lib/family/familyApi';
import { FRESH } from '@/lib/queryClient';
import { reconcileFamilyReminders } from '@/lib/family/familyReminders';
import { tx } from '@/i18n/locale';

const BLOOD = ['0+', '0-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

/** Edit the child's profile; the permanent delete (every record, Law 3144 Art. 16) sits at the bottom. */
export default function EditChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = String(id);
  const router = useRouter();
  const { c, ink, dark } = useFamilyInk();
  const query = useAccountQuery({ key: ['family', 'member', memberId], fetch: () => familyApi.get(memberId), staleTime: FRESH.SHORT });
  const m = query.data?.member;
  const [name, setName] = useState('');
  const [color, setColor] = useState('coral');
  const [birth, setBirth] = useState<string | null>(null);
  const [sex, setSex] = useState<Sex>('FEMALE');
  const [weeks, setWeeks] = useState<number | null>(null);
  const [blood, setBlood] = useState<string | null>(null);
  const [feeding, setFeeding] = useState<FamilyMember['feedingMode']>(null);
  const [notes, setNotes] = useState('');
  const [pickBirth, setPickBirth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!m) return;
    setName(m.name); setColor(m.color || 'coral'); setBirth(m.birthDate); setSex(m.sex); setWeeks(m.gestationWeeks);
    setBlood(m.bloodGroup); setFeeding(m.feedingMode); setNotes(m.notes || '');
  }, [m?.id]);
  const ageDays = query.data?.age.days ?? 0;

  const save = async () => {
    if (!birth) return;
    setBusy(true); setError(null);
    try {
      await familyApi.update(memberId, { name: name.trim(), color, birthDate: birth, sex, gestationWeeks: weeks, bloodGroup: blood, feedingMode: feeding, notes: notes.trim() || null });
      void reconcileFamilyReminders({ force: true });
      router.back();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError(null);
    try {
      await familyApi.remove(memberId);
      void reconcileFamilyReminders({ force: true });
      setConfirm(false);
      router.dismissTo('/family');
    } catch (e) { setError(errorText(e)); setConfirm(false); } finally { setBusy(false); }
  };

  return (
    <KeyboardFormShell
      background={c.bg100}
      header={<ModuleStackHeader module="family" subtitle={tx('პროფილის რედაქტირება', 'Edit profile')} fallbackHref={`/family/${memberId}`} />}
      contentStyle={{ paddingHorizontal: 20, paddingTop: 8, gap: 18, paddingBottom: 24 }}
      footer={<View style={{ gap: 8 }}>
        {error ? <FText size={13} color={toneColors('alert', dark).ink}>{error}</FText> : null}
        <FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={!m || !name.trim() || !birth} onPress={() => void save()} />
      </View>}
    >
      {!m ? null : (
        <>
          <Field label={tx('სახელი', 'Name')} value={name} onChangeText={setName} maxLength={40} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {AVATAR_KEYS.map((key) => (
              <Pressable key={key} accessibilityRole="radio" accessibilityState={{ selected: color === key }} accessibilityLabel={tx(`ფერი ${key}`, `Colour ${key}`)} onPress={() => setColor(key)}>
                <ChildAvatar name={name} color={key} size={42} ring={color === key ? avatarColor(key)[0] : undefined} />
              </Pressable>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            <FText weight="semi" size={13} muted>{tx('დაბადების თარიღი', 'Birth date')}</FText>
            <Pressable accessibilityRole="button" onPress={() => setPickBirth(!pickBirth)} style={{ minHeight: 52, borderRadius: 16, backgroundColor: c.surface, paddingHorizontal: 16, justifyContent: 'center' }}>
              <FText>{formatYmd(birth)}</FText>
            </Pressable>
            {pickBirth ? <DatePickerInline value={birth} max={todayYmd()} min={`${Number(todayYmd().slice(0, 4)) - 18}-${todayYmd().slice(5)}`} onChange={(d) => { setBirth(d); setPickBirth(false); }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Chip label={tx('გოგო', 'Girl')} on={sex === 'FEMALE'} onPress={() => setSex('FEMALE')} /></View>
            <View style={{ flex: 1 }}><Chip label={tx('ბიჭი', 'Boy')} on={sex === 'MALE'} onPress={() => setSex('MALE')} /></View>
          </View>
          {ageDays < 3 * 365 ? (
            <View style={{ gap: 8 }}>
              <FText weight="semi" size={13} muted>{tx('დაიბადა', 'Born')}</FText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label={tx('დროულად', 'On time')} on={weeks == null} onPress={() => setWeeks(null)} />
                {[28, 30, 32, 34, 35, 36].map((w) => <Chip key={w} label={tx(`${w} კვ.`, `${w} wk`)} on={weeks === w} onPress={() => setWeeks(w)} />)}
              </View>
            </View>
          ) : null}
          {ageDays < 730 ? (
            <View style={{ gap: 8 }}>
              <FText weight="semi" size={13} muted>{tx('რძით კვება', 'Milk feeding')}</FText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([['BREAST', tx('დედის რძე', 'Breast milk')], ['FORMULA', tx('ნარევი', 'Formula')], ['MIXED', tx('შერეული', 'Mixed')]] as const).map(([k, l]) => <Chip key={k} label={l} on={feeding === k} onPress={() => setFeeding(feeding === k ? null : k)} />)}
              </View>
            </View>
          ) : null}
          <View style={{ gap: 8 }}>
            <FText weight="semi" size={13} muted>{tx('სისხლის ჯგუფი', 'Blood group')}</FText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {BLOOD.map((b) => <Chip key={b} label={b} on={blood === b} onPress={() => setBlood(blood === b ? null : b)} />)}
            </View>
          </View>
          <Field label={tx('შენიშვნა (Medi-ც ხედავს)', 'Note (Medi sees it too)')} value={notes} onChangeText={setNotes} maxLength={500} multiline style={{ minHeight: 90, paddingTop: 14, textAlignVertical: 'top' }} />

          <FamilyCard style={{ gap: 10, marginTop: 8 }}>
            <FText weight="semi">{tx('ბავშვის პროფილის წაშლა', 'Delete the child’s profile')}</FText>
            <FText size={13} muted>{tx('სამუდამოდ წაიშლება პროფილი და ყველა ჩანაწერი: აცრები, გაზომვები, დღიური, Medi-ს საუბრები.', 'The profile and every record are deleted for good: vaccines, measurements, diary, Medi conversations.')}</FText>
            <FamilyButton label={tx('წაშლა', 'Delete')} icon={Trash2} variant="danger" size="sm" onPress={() => setConfirm(true)} style={{ alignSelf: 'flex-start' }} />
          </FamilyCard>
        </>
      )}
      <Modal visible={confirm} {...APP_MODAL_PROPS} onRequestClose={() => setConfirm(false)}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={() => setConfirm(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} />
          <View style={{ width: '100%', maxWidth: 380, backgroundColor: c.bg100, borderRadius: 26, padding: 22, gap: 12 }}>
            <FText size={18} weight="bold">{tx(`წავშალოთ ${m?.name ?? ''}?`, `Delete ${m?.name ?? ''}?`)}</FText>
            <FText muted>{tx('ამის დაბრუნება შეუძლებელია.', 'This cannot be undone.')}</FText>
            <FamilyButton label={tx('სამუდამოდ წაშლა', 'Delete for good')} variant="danger" busy={busy} onPress={() => void remove()} />
            <FamilyButton label={tx('გაუქმება', 'Cancel')} variant="ghost" onPress={() => setConfirm(false)} />
          </View>
        </View>
      </Modal>
    </KeyboardFormShell>
  );
}
