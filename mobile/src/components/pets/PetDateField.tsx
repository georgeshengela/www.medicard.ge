import React, { useState } from 'react';
import { Keyboard, Pressable, ScrollView, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { PetInput as Input } from '@/components/pets/PetUi';
import { PetSheet } from './PetScreen';
import { PetButton, PetText } from './PetUi';
import { parsePetDate } from '@/lib/petsPresentation';
import { useThemeColors } from '@/theme/colors';

const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const digitsFor = (date: Date) => `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${date.getFullYear()}`;
export function PetDateField({ label, value, onChangeText, hint, error, allowFuture = false }: { label: string; value: string; onChangeText: (value: string) => void; hint?: string; error?: string | null; allowFuture?: boolean; showAge?: boolean; figma?: boolean; placeholder?: string }) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false), [yearPicker, setYearPicker] = useState(false);
  const [month, setMonth] = useState(new Date()), [selected, setSelected] = useState('');
  const year = month.getFullYear(), monthIndex = month.getMonth();
  const first = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const today = new Date();
  const mask = value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2}\.\d{2})(\d)/, '$1.$2');
  const launch = () => { Keyboard.dismiss(); const parsed = parsePetDate(value, { allowFuture }); const initial = parsed.ok ? new Date(`${parsed.iso}T12:00:00`) : today; setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1)); setSelected(parsed.ok ? value.replace(/\D/g, '') : ''); setYearPicker(false); setOpen(true); };
  const changeMonth = (delta: number) => { const next = new Date(year, monthIndex + delta, 1); if (next.getFullYear() < 1900 || next.getFullYear() > 2100 || (!allowFuture && next > today)) return; setMonth(next); };
  return <View style={{ gap: 8 }}>
    <PetText bold>{label}</PetText>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><View style={{ flex: 1 }}><Input figma accessibilityLabel={label} value={mask} onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 8))} placeholder="დდ.თთ.წწწწ" keyboardType="number-pad" maxLength={10} error={error} hint={hint} /></View><Pressable accessibilityRole="button" accessibilityLabel={`${label} — კალენდარი`} onPress={launch} style={{ height: 54, width: 52, borderRadius: 16, backgroundColor: c.accent100, alignItems: 'center', justifyContent: 'center' }}><CalendarDays size={22} color={c.primary100} /></Pressable></View>
    <PetSheet visible={open} title={label} subtitle="აირჩიე თარიღი ან შეიყვანე ხელით." onClose={() => setOpen(false)}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="წინა თვე" onPress={() => changeMonth(-1)} style={{ padding: 12 }}><ChevronLeft color={c.text100} size={22} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="წლის არჩევა" onPress={() => setYearPicker(!yearPicker)} style={{ padding: 12 }}><PetText bold>{MONTHS[monthIndex]} {year}</PetText></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="შემდეგი თვე" disabled={!allowFuture && year === today.getFullYear() && monthIndex === today.getMonth()} onPress={() => changeMonth(1)} style={{ padding: 12 }}><ChevronRight color={c.text100} size={22} /></Pressable>
        </View>
        {yearPicker ? <View style={{ gap: 12 }}><View style={{ flexDirection: 'row', gap: 8 }}><PetButton label="−12 წელი" size="sm" fullWidth={false} variant="secondary" onPress={() => setMonth(new Date(Math.max(1900, year - 12), monthIndex, 1))} /><PetButton label="+12 წელი" size="sm" fullWidth={false} variant="secondary" onPress={() => setMonth(new Date(Math.min(allowFuture ? 2100 : today.getFullYear(), year + 12), monthIndex, 1))} /></View><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: 12 }, (_, i) => year - 5 + i).filter(y => y >= 1900 && y <= (allowFuture ? 2100 : today.getFullYear())).map(y => <Pressable key={y} accessibilityRole="button" onPress={() => { setMonth(new Date(y, !allowFuture && y === today.getFullYear() ? Math.min(monthIndex, today.getMonth()) : monthIndex, 1)); setYearPicker(false); }} style={{ width: '25%', padding: 14, alignItems: 'center' }}><PetText bold>{y}</PetText></Pressable>)}</View></View> : <View>
          <View style={{ flexDirection: 'row' }}>{['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'].map(day => <View key={day} style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 6 }}><PetText size={11} muted>{day}</PetText></View>)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: first + count }, (_, i) => { const day = i - first + 1, date = new Date(year, monthIndex, day); const digits = digitsFor(date), disabled = day < 1 || !parsePetDate(digits, { allowFuture }).ok; return <Pressable key={i} accessibilityRole="button" accessibilityLabel={day > 0 ? `${day} ${MONTHS[monthIndex]} ${year}` : undefined} accessibilityState={{ selected: selected === digits, disabled }} disabled={disabled} onPress={() => setSelected(digits)} style={{ width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: selected === digits ? '#0D9488' : 'transparent', opacity: disabled ? .3 : 1 }}><PetText bold={selected === digits} color={selected === digits ? '#FFFFFF' : c.text100}>{day > 0 ? day : ''}</PetText></Pressable>; })}</View>
        </View>}
        <PetButton label="თარიღის არჩევა" disabled={!parsePetDate(selected, { allowFuture }).ok} onPress={() => { onChangeText(selected); setOpen(false); }} />
      </ScrollView>
    </PetSheet>
  </View>;
}
