import { assistantFieldChoices } from '@/lib/assistantOptions';
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Check, Circle, Clock3, Plus, X, ChevronDown } from 'lucide-react-native';
import { MedicationTimePickerSheet } from '@/components/medications/MedicationTimePickerSheet';
import { useThemeColors } from '@/theme/colors';
import { assistantDisplay, assistantFieldLabels, type AssistantSchema, type AssistantChoices } from '@/lib/assistant';

function BufferedField({ name, field, value, disabled, onChange, onFocus }: { name: string; field: AssistantSchema; value: unknown; disabled: boolean; onChange: (value: unknown) => void; onFocus?: () => void }) {
  const C = useThemeColors(), focused = useRef(false);
  const format = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '');
  const [raw, setRaw] = useState(format(value));
  useEffect(() => { if (!focused.current) setRaw(format(value)); }, [value]);
  return <TextInput accessibilityLabel={assistantFieldLabels[name] || name} editable={!disabled} value={raw}
    onFocus={() => { focused.current = true; onFocus?.(); }} onBlur={() => { focused.current = false; }}
    onChangeText={next => {
      setRaw(next);
      if (!next.trim()) onChange(undefined);
      else if (field.type === 'number' || field.type === 'integer') { const n = Number(next.replace(',', '.')); onChange(Number.isFinite(n) ? n : next); }
      else if (field.type === 'array') onChange(next.split(',').map(s => s.trim()).filter(Boolean));
      else onChange(next);
    }}
    keyboardType={field.type === 'number' || field.type === 'integer' ? 'decimal-pad' : 'default'}
    multiline={name === 'message' || name === 'notes'} maxLength={field.maxLength || 4000} autoCapitalize="none"
    placeholder={name === 'dosage' ? 'ზუსტად ისე, როგორც დანიშნული გაქვს' : /date|On|Ymd/i.test(name) ? 'YYYY-MM-DD' : field.type === 'array' ? 'გამოყავი მძიმით' : ''} placeholderTextColor={C.text200}
    style={{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.bg300, backgroundColor: C.bg100, padding: 13, color: C.text100, fontSize: 14, fontFamily: 'NotoSansGeorgian_400Regular', textAlignVertical: 'top' }} />;
}

function TimeChoices({ value, disabled, onChange }: { value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const C = useThemeColors();
  const [editing, setEditing] = useState<number | null>(null);
  const times = Array.isArray(value) ? value as string[] : [];
  return <View style={{ gap: 8 }}>
    {times.map((time, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.bg300 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`დროის შეცვლა: ${time}`} disabled={disabled} onPress={() => { Keyboard.dismiss(); setEditing(index); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 50 }}><Clock3 size={18} color={C.primary100} /><Text style={{ color: C.text100, fontSize: 17, fontFamily: 'NotoSansGeorgian_700Bold' }}>{time}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`დროის წაშლა: ${time}`} disabled={disabled} onPress={() => onChange(times.filter((_, i) => i !== index))} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={C.text200} /></Pressable>
    </View>)}
    {times.length < 8 ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { Keyboard.dismiss(); setEditing(times.length); }} style={{ minHeight: 50, borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg200 }}><Plus size={19} color={C.primary100} /><Text style={{ color: C.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' }}>{times.length ? 'კიდევ ერთი დრო' : 'მიღების დროის არჩევა'}</Text></Pressable> : null}
    <MedicationTimePickerSheet visible={editing !== null} value={editing !== null ? times[editing] || '' : ''} onClose={() => setEditing(null)} onApply={time => {
      if (editing === null || disabled) return;
      const next = [...times]; next[editing] = time; onChange([...new Set(next)].sort()); setEditing(null);
    }} />
  </View>;
}

function Options({ options, selected, multiple, disabled, onSelect }: { options: { value: string | number | boolean; label: string }[]; selected: unknown; multiple: boolean; disabled: boolean; onSelect: (value: string | number | boolean) => void }) {
  const C = useThemeColors(); const [query, setQuery] = useState('');
  const visible = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  return <View style={{ gap: 8 }}>
    {options.length > 10 ? <TextInput accessibilityLabel="არჩევანის ძებნა" placeholder="მოძებნე…" value={query} onChangeText={setQuery} editable={!disabled} placeholderTextColor={C.text200} style={{ minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.bg300, color: C.text100, fontFamily: 'NotoSansGeorgian_400Regular' }} /> : null}
    {visible.slice(0, 12).map(option => {
      const checked = multiple ? Array.isArray(selected) && selected.includes(option.value) : selected === option.value;
      return <Pressable key={String(option.value)} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onSelect(option.value)}
        style={{ minHeight: 52, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: checked ? C.primary100 : C.bg300, backgroundColor: checked ? C.accent100 : C.bg100 }}>
        {checked ? <Check size={19} color={C.primary100} /> : <Circle size={19} color={C.text200} />}<Text style={{ flex: 1, color: C.text100, fontSize: 14, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>{option.label}</Text>
      </Pressable>;
    })}
    {visible.length > 12 ? <Text style={{ color: C.text200, fontSize: 12, fontFamily: 'NotoSansGeorgian_400Regular' }}>სხვა არჩევანისთვის ჩაწერე სახელის ნაწილი.</Text> : null}
    {!visible.length ? <Text style={{ color: C.text200, fontFamily: 'NotoSansGeorgian_400Regular' }}>{query ? 'ვერ მოიძებნა.' : 'ჯერ ჩანაწერი არ არის. დაამატე შესაბამის გვერდზე და დაბრუნდი.'}</Text> : null}
  </View>;
}

export function AssistantForm({ schema, values, onChange, disabled = false, choices = {}, focusFields, onFieldFocus }: {
  schema: AssistantSchema; values: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; disabled?: boolean; choices?: AssistantChoices; focusFields?: string[]; onFieldFocus?: () => void;
}) {
  const C = useThemeColors(); const [extras, setExtras] = useState(false);
  const set = (key: string, value: unknown) => { const next = { ...values }; if (value === undefined) delete next[key]; else next[key] = value; onChange(next); };
  const entries = Object.entries(schema.properties || {});
  const shown = (key: string) => extras || (focusFields ? focusFields.includes(key) : schema.required?.includes(key) || values[key] !== undefined || (!schema.required?.length && entries.slice(0, 4).some(([fieldKey]) => fieldKey === key)));
  return <View style={{ gap: 16 }}>{entries.filter(([key]) => shown(key)).map(([key, field]) => {
    if (field.type === 'object') return <AssistantForm onFieldFocus={onFieldFocus} key={key} schema={field} values={(values[key] || {}) as Record<string, unknown>} disabled={disabled} choices={choices} onChange={value => set(key, value)} />;
    const required = schema.required?.includes(key) || focusFields?.includes(key);
    const { refs, options } = assistantFieldChoices(key, field, values, choices);
    const multiple = field.type === 'array' && !!field.items?.enum;
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    return <View key={key} style={{ gap: 8 }}>
      <Text style={{ color: C.text100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>{assistantFieldLabels[key] || key}{required ? '' : ' · სურვილისამებრ'}</Text>
      {key === 'frequency' && field.type === 'array' ? <TimeChoices value={values[key]} disabled={disabled} onChange={value => set(key, value)} />
      : options ? <Options options={options.map(value => ({ value, label: refs?.find(r => r.value === value)?.label || assistantDisplay(value) }))} selected={values[key]} multiple={multiple} disabled={disabled} onSelect={option => {
          if (multiple) { const current = Array.isArray(values[key]) ? values[key] as unknown[] : []; set(key, current.includes(option) ? current.filter(v => v !== option) : [...current, option]); }
          else if (key === 'speciesId') { const next: Record<string, unknown> = { ...values, speciesId: option }; delete next.breedId; onChange(next); }
          else if (key === 'petId') { const next = { ...values, petId: option }; delete (next as Record<string, unknown>).productId; onChange(next); }
          else set(key, values[key] === option && !required ? undefined : option);
        }} /> : <>
        {key === 'startDate' ? <View style={{ flexDirection: 'row', gap: 8 }}>{['დღეს', 'ხვალ'].map((label, index) => <Pressable key={label} accessibilityRole="button" disabled={disabled} onPress={() => { const d = new Date(`${today()}T12:00:00`); d.setDate(d.getDate() + index); set(key, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); }} style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg200, borderRadius: 12 }}><Text style={{ color: C.primary100, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>{label}</Text></Pressable>)}</View> : null}
        <BufferedField onFocus={onFieldFocus} name={key} field={field} value={values[key]} disabled={disabled} onChange={value => set(key, value)} />
      </>}
    </View>;
  })}
  {entries.some(([key]) => !shown(key)) ? <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setExtras(true)} style={{ minHeight: 44, alignItems: 'center', flexDirection: 'row', gap: 8 }}><ChevronDown size={17} color={C.text200} /><Text style={{ color: C.text200, fontSize: 12, fontFamily: 'NotoSansGeorgian_400Regular' }}>ყველა ველი და დამატებითი დეტალები</Text></Pressable> : null}
  </View>;
}
