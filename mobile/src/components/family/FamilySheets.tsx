/**
 * MEDIFAMILY quick-log sheets. Each one saves in a couple of taps (research: too many taps is a top reason
 * parents leave trackers), defaults to „now“, and repeats the safety rules where they matter (fever under
 * three months, trouble breathing) — the same rules Medi's triage uses on the server.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { AlertTriangle, Minus, Phone, Plus } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { familyApi, newFamilyRequestId, type HealthItem, type VaccineItem, type ExtraDose } from '@/lib/family/familyApi';
import { Chip, DatePickerInline, Field, FamilyButton, FamilySheet, FText, Segmented, errorText, formatYmd, todayYmd, toneColors, useFamilyInk } from './FamilyUI';

const AGO = [
  { value: '0', label: tx('ახლა', 'Now') },
  { value: '30', label: tx('30 წთ წინ', '30 min ago') },
  { value: '60', label: tx('1 სთ წინ', '1 h ago') },
  { value: '120', label: tx('2 სთ წინ', '2 h ago') },
];
const atFrom = (minutesAgo: string) => new Date(Date.now() - Number(minutesAgo) * 60000).toISOString();

function SafetyNote({ title, body, call }: { title: string; body: string; call?: boolean }) {
  const { dark } = useFamilyInk();
  const t = toneColors('alert', dark);
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: t.bg, borderRadius: 18, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <AlertTriangle size={18} color={t.ink} />
        <FText weight="bold" color={t.ink} style={{ flex: 1 }}>{title}</FText>
      </View>
      <FText size={13} color={t.ink}>{body}</FText>
      {call ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tx('დარეკე 112-ზე', 'Call 112')} onPress={() => void Linking.openURL('tel:112')}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 12, paddingHorizontal: 14, height: 40 }}>
          <Phone size={16} color="#FFFFFF" />
          <FText weight="semi" color="#FFFFFF">{tx('დარეკე 112', 'Call 112')}</FText>
        </Pressable>
      ) : null}
    </View>
  );
}

function useSave(onSaved: () => void, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await work(); onSaved(); onClose(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return { busy, error, run, setError };
}

const num = (text: string) => {
  const v = Number(String(text).replace(',', '.').trim());
  return Number.isFinite(v) && v > 0 ? v : null;
};

// ── Measurement ──────────────────────────────────────────────────────────────────────────────
export function MeasureSheet({ visible, memberId, birthDate, ageDays, onClose, onSaved }: {
  visible: boolean; memberId: string; birthDate: string; ageDays: number; onClose: () => void; onSaved: () => void;
}) {
  const [on, setOn] = useState(todayYmd());
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead] = useState('');
  const [position, setPosition] = useState<'LYING' | 'STANDING'>(ageDays < 731 ? 'LYING' : 'STANDING');
  const [pickDate, setPickDate] = useState(false);
  const { ink } = useFamilyInk();
  const { busy, error, run } = useSave(onSaved, onClose);
  useEffect(() => { if (visible) { setOn(todayYmd()); setWeight(''); setHeight(''); setHead(''); setPickDate(false); } }, [visible]);
  const w = num(weight), h = num(height), hc = num(head);
  const ready = Boolean(w || h || hc);
  return (
    <FamilySheet visible={visible} onClose={onClose} title={tx('გაზომვა', 'Measurement')} subtitle={tx('ჩაწერე, რაც გაზომე — ერთი მნიშვნელობაც საკმარისია.', 'Log what you measured — one value is enough.')}
      footer={<><FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={!ready} onPress={() => run(() => familyApi.addMeasurement(memberId, { measuredOn: on, weightKg: w, heightCm: h, headCm: hc, position: h ? position : null, note: null }))} />{error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}</>}>
      <Field label={tx('წონა, კგ', 'Weight, kg')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder={ageDays < 365 ? '7.4' : '18.2'} />
      <Field label={ageDays < 731 ? tx('სიგრძე, სმ', 'Length, cm') : tx('სიმაღლე, სმ', 'Height, cm')} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder={ageDays < 365 ? '68' : '104'} />
      {height ? (
        <Segmented value={position} onChange={setPosition} options={[{ value: 'LYING', label: tx('წოლით', 'Lying') }, { value: 'STANDING', label: tx('ფეხზე', 'Standing') }]} />
      ) : null}
      {ageDays < 3 * 365 ? <Field label={tx('თავის გარშემოწერილობა, სმ', 'Head circumference, cm')} value={head} onChangeText={setHead} keyboardType="decimal-pad" placeholder="44" /> : null}
      <Pressable accessibilityRole="button" onPress={() => setPickDate(!pickDate)}>
        <FText size={13} muted>{tx('თარიღი', 'Date')}: <FText size={13} weight="semi">{on === todayYmd() ? tx('დღეს', 'Today') : formatYmd(on)}</FText> · <FText size={13} weight="semi" color={ink}>{tx('შეცვლა', 'Change')}</FText></FText>
      </Pressable>
      {pickDate ? <DatePickerInline value={on} min={birthDate} max={todayYmd()} onChange={(d) => { setOn(d); setPickDate(false); }} /> : null}
    </FamilySheet>
  );
}

// ── Temperature ──────────────────────────────────────────────────────────────────────────────
export function TempSheet({ visible, memberId, ageDays, onClose, onSaved }: { visible: boolean; memberId: string; ageDays: number; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(37.5);
  const [site, setSite] = useState<'ARMPIT' | 'EAR' | 'FOREHEAD' | 'RECTAL'>('ARMPIT');
  const [ago, setAgo] = useState('0');
  const { busy, error, run } = useSave(onSaved, onClose);
  const { c, ink } = useFamilyInk();
  useEffect(() => { if (visible) { setValue(37.5); setAgo('0'); } }, [visible]);
  const step = (d: number) => setValue((v) => Math.min(42.5, Math.max(34.5, Math.round((v + d) * 10) / 10)));
  const fever = value >= 38;
  return (
    <FamilySheet visible={visible} onClose={onClose} title={tx('ტემპერატურა', 'Temperature')}
      footer={<><FamilyButton label={tx('შენახვა', 'Save')} busy={busy} onPress={() => run(() => familyApi.addLog(memberId, { kind: 'TEMP', at: atFrom(ago), data: { c: value, site }, clientRequestId: newFamilyRequestId() }))} />{error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}</>}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('0.1 გრადუსით ნაკლები', '0.1 degree less')} onPress={() => step(-0.1)} onLongPress={() => step(-0.5)}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Minus size={24} color={c.text100} /></Pressable>
        <View accessible accessibilityLabel={`${value.toFixed(1)} °C`} style={{ alignItems: 'center', minWidth: 130 }}>
          <FText size={52} weight="semi" color={fever ? toneColors(value >= 39 ? 'alert' : 'watch', false).ink : ink} style={{ lineHeight: 62 }}>{value.toFixed(1)}</FText>
          <FText size={13} muted>°C</FText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('0.1 გრადუსით მეტი', '0.1 degree more')} onPress={() => step(0.1)} onLongPress={() => step(0.5)}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><Plus size={24} color={c.text100} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {([['ARMPIT', tx('იღლია', 'Armpit')], ['EAR', tx('ყური', 'Ear')], ['FOREHEAD', tx('შუბლი', 'Forehead')], ['RECTAL', tx('რექტალური', 'Rectal')]] as const).map(([k, label]) => (
          <Chip key={k} label={label} on={site === k} onPress={() => setSite(k)} />
        ))}
      </View>
      <Segmented value={ago} onChange={setAgo} options={AGO} />
      {fever && ageDays < 90 ? (
        <SafetyNote call title={tx('3 თვემდე სიცხე — ახლავე ექიმთან', 'Fever under 3 months — see a doctor now')}
          body={tx('38 °C და მეტი 3 თვემდე ბავშვთან ყოველთვის სასწრაფო შემთხვევაა: დარეკე 112-ზე ან წადი სასწრაფო განყოფილებაში.', '38 °C or more under 3 months is always urgent: call 112 or go to the emergency department.')} />
      ) : fever && ageDays < 183 && value >= 39 ? (
        <SafetyNote title={tx('დღესვე აჩვენე ექიმს', 'See a doctor today')} body={tx('3–6 თვის ბავშვთან 39 °C და მეტი — ექიმი დღესვე უნდა ნახოს.', '39 °C or more at 3–6 months — a doctor should see them today.')} />
      ) : value >= 40 ? (
        <SafetyNote title={tx('40 °C და მეტი', '40 °C or more')} body={tx('დღესვე აჩვენე ექიმს. თუ სუნთქვა უჭირს, ძალიან მოდუნებულია ან გამონაყარი ჭიქით არ ქრება — 112.', 'See a doctor today. If breathing is hard, they are very floppy or a rash does not fade under a glass — call 112.')} call />
      ) : null}
    </FamilySheet>
  );
}

// ── Symptoms ─────────────────────────────────────────────────────────────────────────────────
export const SYMPTOMS: { id: string; label: string }[] = [
  { id: 'fever', label: tx('სიცხე', 'Fever') },
  { id: 'cough', label: tx('ხველა', 'Cough') },
  { id: 'runny_nose', label: tx('სურდო', 'Runny nose') },
  { id: 'sore_throat', label: tx('ყელის ტკივილი', 'Sore throat') },
  { id: 'ear_pain', label: tx('ყურის ტკივილი', 'Ear pain') },
  { id: 'vomiting', label: tx('ღებინება', 'Vomiting') },
  { id: 'diarrhea', label: tx('დიარეა', 'Diarrhoea') },
  { id: 'tummy_pain', label: tx('მუცლის ტკივილი', 'Tummy pain') },
  { id: 'rash', label: tx('გამონაყარი', 'Rash') },
  { id: 'poor_feeding', label: tx('ცუდად ჭამს / სვამს', 'Eating or drinking poorly') },
  { id: 'sleepy', label: tx('მოთენთილია', 'Unusually sleepy') },
  { id: 'irritable', label: tx('ძალიან ტირის', 'Crying a lot') },
  { id: 'teething', label: tx('კბილები ამოსდის', 'Teething') },
  { id: 'breathing', label: tx('სუნთქვა უჭირს', 'Trouble breathing') },
];

export function SymptomSheet({ visible, memberId, onClose, onSaved }: { visible: boolean; memberId: string; onClose: () => void; onSaved: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const { busy, error, run } = useSave(onSaved, onClose);
  useEffect(() => { if (visible) { setIds([]); setNote(''); } }, [visible]);
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  return (
    <FamilySheet visible={visible} onClose={onClose} title={tx('სიმპტომები', 'Symptoms')} subtitle={tx('მონიშნე ყველა, რაც ახლა აქვს.', 'Tick everything they have now.')}
      footer={<><FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={!ids.length && !note.trim()} onPress={() => run(() => familyApi.addLog(memberId, { kind: 'SYMPTOM', at: new Date().toISOString(), data: { ids, labels: ids.map((id) => SYMPTOMS.find((s) => s.id === id)?.label || id), ...(note.trim() ? { note: note.trim() } : {}) }, clientRequestId: newFamilyRequestId() }))} />{error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}</>}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SYMPTOMS.map((s) => <Chip key={s.id} label={s.label} on={ids.includes(s.id)} onPress={() => toggle(s.id)} />)}
      </View>
      {ids.includes('breathing') ? (
        <SafetyNote call title={tx('სუნთქვის გაძნელება', 'Trouble breathing')} body={tx('თუ ნეკნები ეწევა, ხრიალებს, სუნთქვისას ჩერდება ან ტუჩები ულურჯდება — დარეკე 112-ზე ახლავე.', 'If the ribs pull in, they grunt, pause while breathing or the lips turn blue — call 112 now.')} />
      ) : null}
      <Field label={tx('შენიშვნა (სურვილისამებრ)', 'Note (optional)')} value={note} onChangeText={setNote} placeholder={tx('მაგ.: დილიდან ცუდად ჭამს', 'e.g. not eating well since morning')} maxLength={300} />
    </FamilySheet>
  );
}

// ── Medicine given ───────────────────────────────────────────────────────────────────────────
export function MedSheet({ visible, memberId, onClose, onSaved }: { visible: boolean; memberId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [ago, setAgo] = useState('0');
  const { busy, error, run } = useSave(onSaved, onClose);
  useEffect(() => { if (visible) { setName(''); setAmount(''); setAgo('0'); } }, [visible]);
  const quick = [tx('პარაცეტამოლი', 'Paracetamol'), tx('იბუპროფენი', 'Ibuprofen')];
  return (
    <FamilySheet visible={visible} onClose={onClose} title={tx('მიცემული წამალი', 'Medicine given')} subtitle={tx('ჩაწერე, რა და როდის მიეცი — დოზა შეფუთვიდან, როგორც მიეცი.', 'Log what you gave and when — the amount as you gave it, from the box.')}
      footer={<><FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={!name.trim()} onPress={() => run(() => familyApi.addLog(memberId, { kind: 'MED', at: atFrom(ago), data: { name: name.trim(), ...(amount.trim() ? { amount: amount.trim() } : {}) }, clientRequestId: newFamilyRequestId() }))} />{error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}</>}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {quick.map((q) => <Chip key={q} label={q} on={name === q} onPress={() => setName(q)} />)}
      </View>
      <Field label={tx('წამალი', 'Medicine')} value={name} onChangeText={setName} placeholder={tx('სახელი', 'Name')} maxLength={80} />
      <Field label={tx('რამდენი (როგორც მიეცი)', 'How much (as given)')} value={amount} onChangeText={setAmount} placeholder={tx('მაგ.: 5 მლ', 'e.g. 5 ml')} maxLength={40}
        hint={tx('ბავშვის დოზა — მხოლოდ შეფუთვის ცხრილით მისი ახლანდელი წონით, ან ფარმაცევტის/პედიატრის რჩევით.', 'Children’s doses — only from the box chart with their current weight, or as a pharmacist/pediatrician says.')} />
      <Segmented value={ago} onChange={setAgo} options={AGO} />
    </FamilySheet>
  );
}

// ── Feeding (babies) ─────────────────────────────────────────────────────────────────────────
export function FeedSheet({ visible, memberId, initialType = 'BREAST', onClose, onSaved }: {
  visible: boolean; memberId: string; initialType?: 'BREAST' | 'BOTTLE' | 'SOLID'; onClose: () => void; onSaved: () => void;
}) {
  const [type, setType] = useState<'BREAST' | 'BOTTLE' | 'SOLID'>(initialType);
  const [side, setSide] = useState<'L' | 'R' | 'BOTH'>('L');
  const [minutes, setMinutes] = useState(15);
  const [ml, setMl] = useState(120);
  const [milk, setMilk] = useState<'BREASTMILK' | 'FORMULA'>('FORMULA');
  const [food, setFood] = useState('');
  const [ago, setAgo] = useState('0');
  const { busy, error, run } = useSave(onSaved, onClose);
  useEffect(() => { if (visible) { setType(initialType); setAgo('0'); setFood(''); } }, [visible, initialType]);
  const data = type === 'BREAST' ? { type, side, minutes } : type === 'BOTTLE' ? { type, ml, milk } : { type, food: food.trim() || undefined };
  return (
    <FamilySheet visible={visible} onClose={onClose} title={tx('კვება', 'Feed')}
      footer={<><FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={type === 'SOLID' && !food.trim()} onPress={() => run(() => familyApi.addLog(memberId, { kind: 'FEED', at: atFrom(ago), data, clientRequestId: newFamilyRequestId() }))} />{error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}</>}>
      <Segmented value={type} onChange={setType} options={[{ value: 'BREAST', label: tx('მკერდი', 'Breast') }, { value: 'BOTTLE', label: tx('ბოთლი', 'Bottle') }, { value: 'SOLID', label: tx('საკვები', 'Solids') }]} />
      {type === 'BREAST' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {([['L', tx('მარცხენა', 'Left')], ['R', tx('მარჯვენა', 'Right')], ['BOTH', tx('ორივე', 'Both')]] as const).map(([k, l]) => <Chip key={k} label={l} on={side === k} onPress={() => setSide(k)} />)}
          </View>
          <FText weight="semi" size={13} muted>{tx('ხანგრძლივობა', 'Duration')}</FText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[5, 10, 15, 20, 30].map((m) => <Chip key={m} label={tx(`${m} წთ`, `${m} min`)} on={minutes === m} onPress={() => setMinutes(m)} />)}
          </View>
        </>
      ) : type === 'BOTTLE' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label={tx('ნარევი', 'Formula')} on={milk === 'FORMULA'} onPress={() => setMilk('FORMULA')} />
            <Chip label={tx('დედის რძე', 'Breast milk')} on={milk === 'BREASTMILK'} onPress={() => setMilk('BREASTMILK')} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[30, 60, 90, 120, 150, 180, 210].map((v) => <Chip key={v} label={tx(`${v} მლ`, `${v} ml`)} on={ml === v} onPress={() => setMl(v)} />)}
          </View>
        </>
      ) : (
        <Field label={tx('რა შეჭამა', 'What they ate')} value={food} onChangeText={setFood} placeholder={tx('მაგ.: გოგრის პიურე', 'e.g. pumpkin purée')} maxLength={80} />
      )}
      <Segmented value={ago} onChange={setAgo} options={AGO} />
    </FamilySheet>
  );
}

// ── Vaccine dose ─────────────────────────────────────────────────────────────────────────────
export function DoseSheet({ visible, memberId, birthDate, item, onClose, onSaved }: {
  visible: boolean; memberId: string; birthDate: string; item: VaccineItem | null; onClose: () => void; onSaved: () => void;
}) {
  const rec = item?.record;
  const [mode, setMode] = useState<'GIVEN' | 'GIVEN_UNKNOWN_DATE' | 'SKIPPED'>('GIVEN');
  const [on, setOn] = useState(todayYmd());
  const [place, setPlace] = useState('');
  const [lot, setLot] = useState('');
  const [reaction, setReaction] = useState('');
  const [more, setMore] = useState(false);
  const { ink } = useFamilyInk();
  const { busy, error, run } = useSave(onSaved, onClose);
  useEffect(() => {
    if (!visible) return;
    setMode(rec?.status || 'GIVEN');
    setOn(rec?.givenOn || (item && item.dueOn <= todayYmd() ? todayYmd() : todayYmd()));
    setPlace(rec?.place || ''); setLot(rec?.lot || ''); setReaction(rec?.reaction || '');
    setMore(Boolean(rec?.place || rec?.lot || rec?.reaction));
  }, [visible, item?.id]);
  if (!item) return null;
  const save = () => run(() => familyApi.setDose(memberId, item.id, { status: mode, givenOn: mode === 'GIVEN' ? on : null, place: place.trim() || null, lot: lot.trim() || null, reaction: reaction.trim() || null }));
  return (
    <FamilySheet visible={visible} onClose={onClose} title={`${item.abbr} · ${tx(`${item.dose} დოზა`, `dose ${item.dose}`)}`} subtitle={item.protects}
      footer={<>
        <FamilyButton label={tx('შენახვა', 'Save')} busy={busy} onPress={save} />
        {rec ? <FamilyButton label={tx('ჩანაწერის მოხსნა', 'Clear this record')} variant="ghost" onPress={() => run(() => familyApi.clearDose(memberId, item.id))} /> : null}
        {error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}
      </>}>
      <View style={{ gap: 8 }}>
        <Chip label={tx('გაკეთდა', 'Given')} on={mode === 'GIVEN'} onPress={() => setMode('GIVEN')} />
        <Chip label={tx('გაკეთდა, თარიღი არ მახსოვს', 'Given, date unknown')} on={mode === 'GIVEN_UNKNOWN_DATE'} onPress={() => setMode('GIVEN_UNKNOWN_DATE')} />
        <Chip label={tx('არ გაკეთდება (ექიმის გადაწყვეტილებით)', 'Won’t be given (doctor’s decision)')} on={mode === 'SKIPPED'} onPress={() => setMode('SKIPPED')} />
      </View>
      {mode === 'GIVEN' ? <DatePickerInline value={on} min={birthDate} max={todayYmd()} onChange={setOn} /> : null}
      {mode !== 'SKIPPED' ? (
        more ? (
          <>
            <Field label={tx('სად (კლინიკა)', 'Where (clinic)')} value={place} onChangeText={setPlace} maxLength={120} />
            <Field label={tx('სერია (ბარათიდან)', 'Lot (from the card)')} value={lot} onChangeText={setLot} maxLength={60} />
            <Field label={tx('რეაქცია, თუ იყო', 'Reaction, if any')} value={reaction} onChangeText={setReaction} maxLength={300} placeholder={tx('მაგ.: სიცხე 1 დღე', 'e.g. fever for a day')} />
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setMore(true)}><FText weight="semi" color={ink}>{tx('+ კლინიკა, სერია, რეაქცია', '+ Clinic, lot, reaction')}</FText></Pressable>
        )
      ) : null}
    </FamilySheet>
  );
}

export function ExtraVaccineSheet({ visible, memberId, birthDate, catalog, onClose, onSaved }: {
  visible: boolean; memberId: string; birthDate: string; catalog: { code: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const [code, setCode] = useState('flu');
  const [on, setOn] = useState(todayYmd());
  const [nextOn, setNextOn] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pickNext, setPickNext] = useState(false);
  const { ink } = useFamilyInk();
  const { busy, error, run } = useSave(onSaved, onClose);
  useEffect(() => { if (visible) { setCode('flu'); setOn(todayYmd()); setNextOn(null); setName(''); setPickNext(false); } }, [visible]);
  const nextMax = useMemo(() => `${Number(todayYmd().slice(0, 4)) + 3}-12-31`, []);
  return (
    <FamilySheet visible={visible} onClose={onClose} title={tx('სხვა ვაქცინა', 'Other vaccine')} subtitle={tx('ვაქცინები, რომლებიც სახელმწიფო კალენდარში არ შედის — პედიატრთან ერთად გადაწყვეტილი.', 'Vaccines outside the state calendar — chosen with your pediatrician.')}
      footer={<><FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={code === 'other' && !name.trim()} onPress={() => run(() => familyApi.addExtra(memberId, { code, givenOn: on, nextOn, note: code === 'other' ? name.trim() : null }))} />{error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}</>}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {catalog.map((v) => <Chip key={v.code} label={v.name} on={code === v.code} onPress={() => setCode(v.code)} />)}
      </View>
      {code === 'other' ? <Field label={tx('ვაქცინის სახელი', 'Vaccine name')} value={name} onChangeText={setName} maxLength={120} /> : null}
      <FText weight="semi" size={13} muted>{tx('როდის გაკეთდა', 'When it was given')}</FText>
      <DatePickerInline value={on} min={birthDate} max={todayYmd()} onChange={setOn} />
      <Pressable accessibilityRole="button" onPress={() => setPickNext(!pickNext)}>
        <FText weight="semi" color={ink}>{nextOn ? tx(`შემდეგი დოზა: ${formatYmd(nextOn)} · შეცვლა`, `Next dose: ${formatYmd(nextOn)} · change`) : tx('+ შემდეგი დოზის შეხსენება', '+ Remind me of the next dose')}</FText>
      </Pressable>
      {pickNext ? <DatePickerInline value={nextOn} min={todayYmd()} max={nextMax} onChange={(d) => { setNextOn(d); setPickNext(false); }} /> : null}
    </FamilySheet>
  );
}

// ── Allergies, conditions, regular medicines ───────────────────────────────────────────────
export function HealthItemSheet({ visible, memberId, kind, onClose, onSaved }: { visible: boolean; memberId: string; kind: HealthItem['kind']; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [severity, setSeverity] = useState<HealthItem['severity']>(null);
  const { busy, error, run } = useSave(onSaved, onClose);
  useEffect(() => { if (visible) { setName(''); setDetail(''); setSeverity(null); } }, [visible]);
  const title = kind === 'ALLERGY' ? tx('ალერგია', 'Allergy') : kind === 'CONDITION' ? tx('ქრონიკული მდგომარეობა', 'Long-term condition') : tx('მუდმივი წამალი', 'Regular medicine');
  const quick = kind === 'ALLERGY'
    ? [tx('არაქისი', 'Peanut'), tx('კვერცხი', 'Egg'), tx('ძროხის რძე', 'Cow’s milk'), tx('პენიცილინი', 'Penicillin'), tx('მტვერი', 'Dust'), tx('ყვავილის მტვერი', 'Pollen')]
    : kind === 'CONDITION' ? [tx('ასთმა', 'Asthma'), tx('ატოპიური დერმატიტი', 'Eczema'), tx('ცელიაკია', 'Coeliac disease'), tx('დიაბეტი', 'Diabetes')] : [];
  return (
    <FamilySheet visible={visible} onClose={onClose} title={title}
      footer={<><FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={!name.trim()} onPress={() => run(() => familyApi.addHealth(memberId, { kind, name: name.trim(), detail: detail.trim() || null, severity }))} />{error ? <FText size={13} color={toneColors('alert', false).ink}>{error}</FText> : null}</>}>
      {quick.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{quick.map((q) => <Chip key={q} label={q} on={name === q} onPress={() => setName(q)} />)}</View> : null}
      <Field label={tx('სახელი', 'Name')} value={name} onChangeText={setName} maxLength={80} />
      {kind === 'ALLERGY' ? (
        <Segmented value={(severity || 'MILD') as 'MILD' | 'MODERATE' | 'SEVERE'} onChange={setSeverity} options={[{ value: 'MILD', label: tx('მსუბუქი', 'Mild') }, { value: 'MODERATE', label: tx('საშუალო', 'Moderate') }, { value: 'SEVERE', label: tx('მძიმე', 'Severe') }]} />
      ) : null}
      <Field label={kind === 'MEDICATION' ? tx('როგორ იღებს (ექიმის დანიშნულებით)', 'How it’s taken (as prescribed)') : tx('დეტალი (სურვილისამებრ)', 'Detail (optional)')} value={detail} onChangeText={setDetail} maxLength={200} />
    </FamilySheet>
  );
}

export type ExtraRow = ExtraDose;
