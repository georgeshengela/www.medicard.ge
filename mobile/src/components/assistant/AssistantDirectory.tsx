import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ArrowLeft, ArrowUpRight, ChevronRight, Flower2, Footprints, Heart, PawPrint, Pill, ScanLine, Search, Settings2, Sparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme/colors';
import type { AssistantFeature, AssistantGroup, AssistantTool } from '@/lib/assistant';

const icons = { heart: Heart, pill: Pill, flower: Flower2, scan: ScanLine, footprints: Footprints, paw: PawPrint, settings: Settings2 };
const normalize = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

/** Progressive disclosure: seven topic tiles, then only the selected topic or search results. */
export function AssistantDirectory({ tools, features, groups, busy, error, onClose, onTool, onFeature }: {
  tools: AssistantTool[]; features: AssistantFeature[]; groups: AssistantGroup[]; busy: boolean; error: string | null;
  onClose: () => void; onTool: (tool: AssistantTool) => void; onFeature: (feature: AssistantFeature) => void;
}) {
  const C = useThemeColors(), insets = useSafeAreaInsets();
  const [query, setQuery] = useState(''), [group, setGroup] = useState<string | null>(null);
  const q = normalize(query);
  const selectableTools = tools.filter(t => t.name !== 'open').sort((a,b) => Number(a.kind === 'handoff') - Number(b.kind === 'handoff'));
  const visibleGroups = groups.filter(g => features.some(f => f.group === g.id) || selectableTools.some(t => t.group === g.id));
  const matches = (item: { label: string; group?: string; description?: string }) => (!group || item.group === group) && (!q || normalize(item.label + ' ' + (item.description || '')).includes(q));
  const matchedTools = useMemo(() => selectableTools.filter(t => matches({ ...t, description: '' })), [tools, query, group]);
  const matchedFeatures = features.filter(matches);
  const selectedGroup = groups.find(g => g.id === group);
  const caption = (text: string) => <Text style={{ color: C.text200, fontSize: 12, lineHeight: 20, fontFamily: 'NotoSansGeorgian_500Medium', marginBottom: 4 }}>{text}</Text>;
  function row(key: string, label: string, direct: boolean, onPress: () => void) {
    const Icon = direct ? Sparkles : ArrowUpRight;
    return <Pressable key={key} accessibilityRole="button" disabled={busy} onPress={onPress}
      style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.bg300, opacity: busy ? .55 : 1 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: direct ? C.accent100 : C.bg200, alignItems: 'center', justifyContent: 'center' }}><Icon size={17} color={direct ? C.primary100 : C.text200} /></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: C.text100, fontSize: 13, lineHeight: 20, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{label}</Text><Text style={{ color: C.text200, fontSize: 11, fontFamily: 'NotoSansGeorgian_400Regular' }}>{direct ? 'შეავსე Medi-სთან' : 'გახსენი შესაბამისი გვერდი'}</Text></View>
      <ChevronRight size={16} color={C.text200} />
    </Pressable>;
  }
  return <View style={{ flex: 1, minHeight: 0, paddingHorizontal: 16, gap: 14, paddingTop: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {group ? <Pressable accessibilityRole="button" accessibilityLabel={group ? 'ყველა თემა' : 'საუბარზე დაბრუნება'} disabled={busy} onPress={() => group ? setGroup(null) : onClose()} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={20} color={C.text100} /></Pressable> : null}
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: C.text100, fontSize: 19, lineHeight: 27, fontFamily: 'NotoSansGeorgian_700Bold' }}>{selectedGroup?.label || 'რაში დაგეხმარო?'}</Text><Text style={{ color: C.text200, fontSize: 12, lineHeight: 19, fontFamily: 'NotoSansGeorgian_400Regular' }}>იპოვე საქმე ან მითხარი შენი სიტყვებით</Text></View>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, borderColor: C.bg300, paddingHorizontal: 12, backgroundColor: C.surface }}>
      <Search size={18} color={C.text200} /><TextInput value={query} onChangeText={setQuery} editable={!busy} placeholder="მოძებნე ფუნქცია…" accessibilityLabel="ფუნქციის ძებნა" placeholderTextColor={C.text200} returnKeyType="search" style={{ flex: 1, minHeight: 48, color: C.text100, fontSize: 14, fontFamily: 'NotoSansGeorgian_400Regular' }} />
      {query ? <Pressable accessibilityRole="button" accessibilityLabel="ძებნის გასუფთავება" onPress={() => setQuery('')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><X size={18} color={C.text200} /></Pressable> : null}
    </View>
    {busy ? <ActivityIndicator color={C.primary100} /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: C.danger, fontSize: 13, lineHeight: 21, fontFamily: 'NotoSansGeorgian_400Regular' }}>{error}</Text> : null}
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ gap: 9, paddingBottom: Math.max(insets.bottom + 12, 28) }}>
      {!q && !group ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{visibleGroups.map(g => {
        const Icon = icons[g.icon as keyof typeof icons] || Sparkles;
        return <Pressable key={g.id} accessibilityRole="button" onPress={() => setGroup(g.id)} style={{ width: '48%', flexGrow: 1, minHeight: 113, borderRadius: 20, padding: 15, gap: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.bg300 }}>
          <Icon size={22} color={C.primary100} strokeWidth={1.7} /><Text style={{ color: C.text100, fontSize: 13, lineHeight: 21, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{g.label}</Text>
        </Pressable>;
      })}</View> : <>
        {matchedTools.length ? caption('საუბარში შევავსოთ') : null}
        {matchedTools.map(t => row('tool:' + t.name, t.label, true, () => onTool(t)))}
        {matchedFeatures.length ? <View style={{ marginTop: matchedTools.length ? 16 : 0 }}>{caption('აპში გავაგრძელოთ')}</View> : null}
        {matchedFeatures.map(f => row('feature:' + f.id, f.label, false, () => onFeature(f)))}
        {!matchedTools.length && !matchedFeatures.length ? <View style={{ padding: 22, gap: 8, alignItems: 'center' }}><Search size={24} color={C.text200} /><Text style={{ color: C.text100, fontSize: 15, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>ამ სახელით ვერ ვიპოვე</Text><Text style={{ textAlign: 'center', color: C.text200, fontSize: 13, lineHeight: 22, fontFamily: 'NotoSansGeorgian_400Regular' }}>სხვა სიტყვა სცადე ან საუბარში მომიყევი, რისი გაკეთება გინდა.</Text></View> : null}
      </>}
    </ScrollView>
  </View>;
}
