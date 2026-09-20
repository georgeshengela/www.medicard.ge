import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useThemeColors } from '@/theme/colors';
import { assistantDisplay, assistantFieldLabels, type AssistantSchema, type AssistantChoices } from '@/lib/assistant';

function BufferedField({ name, field, value, disabled, onChange }: { name: string; field: AssistantSchema; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const C = useThemeColors(), focused = useRef(false);
  const format = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '');
  const [raw, setRaw] = useState(format(value));
  useEffect(() => { if (!focused.current) setRaw(format(value)); }, [value]);
  return <TextInput accessibilityLabel={assistantFieldLabels[name] || name} editable={!disabled} value={raw}
    onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
    onChangeText={next => {
      setRaw(next);
      if (!next.trim()) onChange(undefined);
      else if (field.type === 'number' || field.type === 'integer') { const n = Number(next.replace(',', '.')); onChange(Number.isFinite(n) ? n : next); }
      else if (field.type === 'array') onChange(next.split(',').map(s => s.trim()).filter(Boolean));
      else onChange(next);
    }}
    keyboardType={field.type === 'number' || field.type === 'integer' ? 'decimal-pad' : 'default'}
    multiline={name === 'message' || name === 'notes'} maxLength={field.maxLength || 4000} autoCapitalize="none"
    placeholder={/date|On|Ymd/i.test(name) ? 'YYYY-MM-DD' : field.type === 'array' ? 'გამოყავი მძიმით' : ''} placeholderTextColor={C.text300}
    style={{ minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.bg300, backgroundColor: C.surface, padding: 12, color: C.text100, fontSize: 14, fontFamily: 'NotoSansGeorgian_400Regular', textAlignVertical: 'top' }} />;
}

export function AssistantForm({ schema, values, onChange, disabled = false, choices = {} }: {
  schema: AssistantSchema; values: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void; disabled?: boolean; choices?: AssistantChoices;
}) {
  const C = useThemeColors();
  const set = (key: string, value: unknown) => { const next = { ...values }; if (value === undefined) delete next[key]; else next[key] = value; onChange(next); };
  return <View style={{ gap: 14 }}>{Object.entries(schema.properties || {}).map(([key, field]) => {
    if (field.type === 'object') return <AssistantForm key={key} schema={field} values={(values[key] || {}) as Record<string, unknown>} disabled={disabled} choices={choices} onChange={value => set(key, value)} />;
    const required = schema.required?.includes(key);
    const refs = choices[key === 'breedId' ? `breedId:${values.speciesId || 'dog'}` : key];
    const multiple = field.type === 'array' && !!field.items?.enum;
    const options = refs?.map(r => r.value) || field.enum || (multiple ? field.items?.enum : null) || (field.const !== undefined ? [field.const] : field.type === 'boolean' ? [true, false] : null);
    return <View key={key} style={{ gap: 7 }}>
      <Text style={{ color: C.text200, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12 }}>{assistantFieldLabels[key] || key}{required ? ' *' : ' · სურვილისამებრ'}</Text>
      {options ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{options.map(option => <Pressable key={String(option)} accessibilityRole="radio" accessibilityState={{ selected: values[key] === option, disabled }} disabled={disabled}
        onPress={() => {
          if (multiple) { const current = Array.isArray(values[key]) ? values[key] as unknown[] : []; set(key, current.includes(option) ? current.filter(v => v !== option) : [...current, option]); }
          else if (key === 'speciesId') { const next: Record<string, unknown> = { ...values, speciesId: option }; delete next.breedId; onChange(next); }
          else set(key, values[key] === option && !required ? undefined : option);
        }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: values[key] === option || (multiple && (values[key] as unknown[] | undefined)?.includes(option)) ? C.primary100 : C.bg300, backgroundColor: values[key] === option || (multiple && (values[key] as unknown[] | undefined)?.includes(option)) ? C.accent100 : C.surface }}>
        <Text style={{ color: C.text100, fontSize: 13, fontFamily: 'NotoSansGeorgian_400Regular' }}>{refs?.find(r => r.value === option)?.label || assistantDisplay(option)}</Text>
      </Pressable>)}</View> : <BufferedField name={key} field={field} value={values[key]} disabled={disabled} onChange={value => set(key, value)} />}
    </View>;
  })}</View>;
}
