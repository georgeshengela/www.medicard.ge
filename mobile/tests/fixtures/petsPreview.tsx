// Manual visual fixture only. Uses production components and local sample values, never API writes.
import React, { useState } from 'react';
import { registerRootComponent } from 'expo';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold } from '@expo-google-fonts/noto-sans-georgian';
import { ThemeProvider, useTheme } from '@/store/ThemeContext';
import { PetsHubView } from '@/components/pets/PetsHubView';
import { PetForm } from '@/components/pets/PetForm';
import { PetWeightForm, PetAllergyForm, PetConditionForm } from '@/components/pets/PetHealthForms';
import { PetWeightTrend } from '@/components/pets/PetWeightTrend';
import { PetDateField } from '@/components/pets/PetDateField';
import { PetProductForm } from '../../app/pets/[id]/care/products/new';
import { PetIntro, PetText } from '@/components/pets/PetUi';
import type { Pet, PetWeightLog } from '@/lib/api';
import '../../global.css';

const pets = [{ id: 'preview-luna', name: 'ლუნა', speciesId: 'cat', breedId: 'unknown', photoUrl: null, age: { kind: 'EXACT', years: 2, months: 4 } }, { id: 'preview-bobi', name: 'ბობი', speciesId: 'dog', breedId: 'mixed', photoUrl: null, age: { kind: 'APPROXIMATE', years: 4, months: 0 } }] as Pet[];
const weights = [4.4, 4.5, 4.3, 4.4].map((weight, index) => ({ id: String(index), recordedOn: ['2026-02-01', '2026-08-12', '2026-09-15', '2026-09-20'][index], weightKg: weight, createdAt: String(index), inputValue: weight, inputUnit: 'kg' })) as PetWeightLog[];
function Preview() {
  const theme = useTheme(), [page, setPage] = useState('Hub'), [date, setDate] = useState(''), [message, setMessage] = useState('');
  const [fonts] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_500Medium, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_700Bold });
  if (!fonts) return null;
  const submit = () => setMessage('საცდელი ფორმა სწორია · ბაზაში არაფერი შენახულა');
  return <View style={{ flex: 1, backgroundColor: theme.scheme === 'dark' ? '#030712' : '#F5F7F7' }}>
    <View style={{ height: 44, backgroundColor: '#1F2937' }}><ScrollView horizontal contentContainerStyle={{ alignItems: 'center', gap: 20, paddingHorizontal: 12 }}>{['Theme', 'Hub', 'Add', 'Empty', 'Error', 'Date', 'Weight', 'Weight form', 'Allergy', 'Condition', 'Product'].map(label => <Pressable key={label} accessibilityRole="button" onPress={() => { setMessage(''); label === 'Theme' ? theme.setPreference(theme.scheme === 'dark' ? 'light' : 'dark') : setPage(label); }}><Text style={{ color: '#FFFFFF', fontSize: 12 }}>{label}</Text></Pressable>)}</ScrollView></View>
    {message ? <Pressable onPress={() => setMessage('')}><Text style={{ backgroundColor: '#CCFBF1', padding: 12, color: '#0F766E' }}>{message}</Text></Pressable> : null}
    {page === 'Add' ? <PetForm key={page} wizard submitting={false} error={null} submitLabel="პროფილის შექმნა" onSubmit={submit} /> : page === 'Weight form' ? <PetWeightForm saving={false} error={null} onSubmit={submit} /> : page === 'Allergy' ? <PetAllergyForm saving={false} error={null} onSubmit={submit} /> : page === 'Product' ? <PetProductForm saving={false} error={null} onSubmit={submit} /> : page === 'Condition' ? <PetConditionForm saving={false} error={null} onSubmit={submit} /> : <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }}>
      {page === 'Date' ? <><PetIntro title="მოვლის გეგმა" body="მომავალი თარიღის არჩევის შემოწმება" /><PetDateField label="პირველი თარიღი" value={date} onChangeText={setDate} allowFuture /><PetText>{date}</PetText></> : page === 'Weight' ? <><PetIntro title="წონის ისტორია" body="მხოლოდ რეალური გაზომვები" /><PetWeightTrend items={weights} /><PetWeightTrend items={weights.slice(0, 1)} /></> : <PetsHubView pets={page === 'Empty' || page === 'Error' ? [] : pets} error={page === 'Error' ? 'ჩატვირთვა ვერ მოხერხდა. შეამოწმე კავშირი.' : null} onRetry={() => setPage('Hub')} onNavigate={path => path === '/pets/new' ? setPage('Add') : setMessage(path)} />}
    </ScrollView>}
  </View>;
}
registerRootComponent(() => <SafeAreaProvider><ThemeProvider><Preview /></ThemeProvider></SafeAreaProvider>);
