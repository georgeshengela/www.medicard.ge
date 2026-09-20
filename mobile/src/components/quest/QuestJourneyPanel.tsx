import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Award, BadgeCheck, Check, Compass, Crown, Flag, Focus, Gift, Glasses, Lamp, Leaf, Library, Lock, Moon, Orbit, Palette, PanelsTopLeft, Ribbon, Telescope, Waves } from 'lucide-react-native';
import type { CompanionCosmetic, CompanionEquipment, CompanionOverview } from '@/lib/companion/api';
import { companionChapterTitle, companionCosmeticTitle, companionMilestoneTitle } from '@/lib/companion/copy';
import { accentColorForEquipment, visualKeyForCosmetic } from '@/lib/companion/cosmeticVisuals';
import { journeyPresentation, questCollection } from '@/lib/quest/hubPresentation';
import { QuestProgressBar } from './QuestProgressBar';
import { QButton, QCard, QHeading, QNotice, QText } from './QuestHubPrimitives';
import { useIsDark, useThemeColors } from '@/theme/colors';

const EMPTY: CompanionEquipment = { accent: null, accessory: null, background: null, decoration: null };
const SYMBOLS: Record<string, typeof Compass> = {
  'pose.wave': Waves, 'pose.focused': Focus, 'pose.proud': Crown, 'pose.resting': Moon, 'pose.curious': Telescope,
  'accessory.pin': Flag, 'accessory.visor': Glasses, 'accessory.scarf': Ribbon, 'accessory.orbit': Orbit, 'accessory.badge': BadgeCheck,
};
const SYMBOL_NAMES: Record<string, string> = {
  'pose.wave': 'პირველი ტალღა', 'pose.focused': 'ფოკუსი', 'pose.proud': 'გვირგვინი', 'pose.resting': 'მთვარე', 'pose.curious': 'აღმომჩენი',
  'accessory.pin': 'ჩემი დროშა', 'accessory.visor': 'ჰორიზონტი', 'accessory.scarf': 'ლენტი', 'accessory.orbit': 'ორბიტა', 'accessory.badge': 'გზის ნიშანი',
  'bg.teal_room': 'თეალის სიმშვიდე',
};
function styleTitle(item: CompanionCosmetic) {
  return SYMBOL_NAMES[visualKeyForCosmetic(item.key) ?? ''] ?? companionCosmeticTitle(item.titleKey, 'ka');
}
/** A personal achievement seal. All four owned style slots have a visible result. */
export function QuestEmblem({ equipment = EMPTY, size = 84 }: { equipment?: CompanionEquipment; size?: number }) {
  const c = useThemeColors(), dark = useIsDark();
  const ink = accentColorForEquipment(equipment.accent, '#14B8A6');
  const bg = visualKeyForCosmetic(equipment.background) ?? '';
  const fill = bg.includes('dawn') ? (dark ? '#292524' : '#FFFBEB') : bg.includes('garden') ? (dark ? '#142C23' : '#F0FDF4') : bg.includes('city') ? (dark ? '#172554' : '#EFF6FF') : bg.includes('summit') ? (dark ? '#2E1065' : '#F5F3FF') : bg.includes('teal_room') ? (dark ? '#042F2E' : '#CCFBF1') : c.surfaceRaised;
  const accessory = visualKeyForCosmetic(equipment.accessory) ?? '';
  const Mark = SYMBOLS[accessory] ?? Compass;
  const decor = visualKeyForCosmetic(equipment.decoration) ?? '';
  const Decoration = decor.includes('plant') ? Leaf : decor.includes('lamp') ? Lamp : decor.includes('frame') ? Award : decor.includes('window') ? PanelsTopLeft : decor.includes('shelf') ? Library : Gift;
  return <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
      <Circle cx="50" cy="50" r="46" fill={fill} stroke={ink} strokeWidth="1" strokeDasharray="2 6" />
      <Circle cx="50" cy="50" r="35" fill={c.surface} stroke={ink} strokeWidth="1.5" />
      <Path d="M50 4 L53 11 L50 18 L47 11 Z M50 82 L53 89 L50 96 L47 89 Z" fill={ink} />
    </Svg>
    <View style={{ zIndex: 1 }}><Mark size={size * .35} color={ink} strokeWidth={1.6} /></View>
    {equipment.decoration ? <View style={{ position: 'absolute', bottom: 1, right: 0, padding: 5, backgroundColor: c.surface, borderRadius: 12, borderColor: c.bg300, borderWidth: 1 }}><Decoration size={size * .18} color={ink} /></View> : null}
  </View>;
}

export function QuestJourneyPanel({ overview, onGuide }: { overview: CompanionOverview; onGuide: () => void }) {
  const c = useThemeColors(), dark = useIsDark();
  const { journey, equipment } = overview;
  const info = journeyPresentation(journey);
  const [chapter, setChapter] = useState(journey.chapterKey);
  useEffect(() => setChapter(journey.chapterKey), [journey.chapterKey]);
  const chapters = [...new Set(info.milestones.map(m => m.chapterKey))];
  return <View style={{ gap: 18 }}>
    <QCard>
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <QuestEmblem equipment={equipment} />
        <View style={{ flex: 1 }}><QText size={12} muted>შენი პირადი გზა</QText><QText size={21} bold>{companionChapterTitle(journey.chapterKey, 'ka')}</QText><QText size={12} muted>{info.unlocked} / {info.milestones.length} ეტაპი გახსნილია</QText></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}><QText size={34} bold>{journey.units}</QText><QText size={13} muted>პროგრესის ქულა</QText></View>
      <QuestProgressBar percent={info.percent} height={8} />
      <QText size={13} muted>{info.next ? `შემდეგი: ${companionMilestoneTitle(info.next.titleKey, 'ka')} · დარჩა ${info.remaining} ქულა` : 'ყველა ეტაპი გახსნილია. შენი მისიები და მიღწევები გრძელდება.'}</QText>
    </QCard>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <QCard style={{ flex: 1, padding: 14 }}><QText size={23} bold color={dark ? '#5EEAD4' : '#0F766E'}>+1</QText><QText size={12} muted>დღიური მისიის შესრულება</QText></QCard>
      <QCard style={{ flex: 1, padding: 14 }}><QText size={23} bold color={dark ? '#5EEAD4' : '#0F766E'}>+3</QText><QText size={12} muted>კვირის მისიის შესრულება</QText></QCard>
    </View>
    <QText size={13} muted>ქულა ავტომატურად ემატება შესრულებისას. XP და მონეტები ცალკე ჯილდოა — მისიის ბარათიდან მიიღე.</QText>
    <QHeading title="შენი ეტაპები" meta={`${chapters.length} თავი`} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {chapters.map((key, i) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === chapter }} onPress={() => setChapter(key)} style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 16, backgroundColor: key === chapter ? '#0D9488' : c.surfaceRaised }}><QText bold color={key === chapter ? '#FFFFFF' : c.text200}>თავი {i + 1}</QText></Pressable>)}
    </ScrollView>
    <View><QText size={17} bold>{companionChapterTitle(chapter, 'ka')}</QText></View>
    <QCard style={{ gap: 0 }}>
      {info.milestones.filter(m => m.chapterKey === chapter).map((m, i, all) => {
        const next = m.key === info.next?.key;
        const tone = m.unlocked ? (dark ? '#5EEAD4' : '#0F766E') : c.text300;
        return <View key={m.key} style={{ flexDirection: 'row', gap: 14, minHeight: 98 }}>
          <View style={{ width: 36, alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: m.unlocked ? c.accent100 : c.bg100, borderWidth: next ? 2 : 1, borderColor: next ? c.primary200 : c.bg300, alignItems: 'center', justifyContent: 'center' }}>
              {m.unlocked ? <Check size={17} color={tone} /> : next ? <Flag size={17} color={c.primary200} /> : <Lock size={15} color={tone} />}
            </View>
            {i < all.length - 1 ? <View style={{ width: 1, backgroundColor: c.bg300, flex: 1, marginVertical: 7 }} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: 20, gap: 4 }}>
            <QText bold>{companionMilestoneTitle(m.titleKey, 'ka')}</QText>
            <QText size={12} muted>{m.at} ქულა · {m.unlocked ? 'გახსნილია' : next ? 'შენი შემდეგი ეტაპი' : 'გასახსნელია'}</QText>
            {m.cosmeticKey ? <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Gift size={12} color={tone} /><QText size={11} color={tone}>კოლექციის ნივთი</QText></View> : null}
          </View>
        </View>;
      })}
    </QCard>
    <QButton secondary label="როგორ ითვლება პროგრესი?" onPress={onGuide} />
  </View>;
}

const SLOTS = [{ key: 'accent', label: 'ფერი' }, { key: 'background', label: 'ფონი' }, { key: 'accessory', label: 'სიმბოლო' }, { key: 'decoration', label: 'დეკორი' }] as const;
export function QuestCollectionPanel({ overview, onEquip, busyKey, error, offline }: { overview: CompanionOverview; onEquip: (item: CompanionCosmetic, clear?: boolean) => void; busyKey: string | null; error?: string | null; offline: boolean }) {
  const c = useThemeColors();
  const [slot, setSlot] = useState<(typeof SLOTS)[number]['key']>('accent');
  const collection = questCollection(overview);
  const items = collection.filter(item => item.slot === slot);
  const unlocked = collection.filter(item => item.unlocked).length;
  return <View style={{ gap: 14 }}>
    <QHeading title="ჩემი კოლექცია" meta={`${unlocked} / ${collection.length}`} />
    <QCard>
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}><QuestEmblem equipment={overview.equipment} size={96} /><View style={{ flex: 1 }}><QText bold size={17}>შენი პროგრესის ნიშანი</QText><QText size={13} muted>ეტაპებზე გახსნილი ფერით, ფონითა და სიმბოლოებით გააფორმე.</QText></View></View>
    </QCard>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {SLOTS.map(s => <Pressable key={s.key} accessibilityRole="tab" accessibilityState={{ selected: slot === s.key }} onPress={() => setSlot(s.key)} style={{ flex: 1, minHeight: 44, paddingHorizontal: 3, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: slot === s.key ? '#0D9488' : c.surfaceRaised }}><QText size={12} bold color={slot === s.key ? '#FFFFFF' : c.text200}>{s.label}</QText></Pressable>)}
    </View>
    {error ? <QNotice text={error} danger /> : null}
    {offline ? <QNotice text="კოლექციის შეცვლას ინტერნეტი სჭირდება. ბოლო შენახულ სტილს ხედავ." /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map(item => {
        const equipped = overview.equipment[slot] === item.key;
        const removable = equipped && (slot === 'accessory' || slot === 'decoration');
        const milestone = overview.journey.milestones.find(m => m.cosmeticKey === item.key);
        return <View key={item.key} style={{ width: '48%', flexGrow: 1, padding: 14, borderRadius: 22, borderWidth: equipped ? 2 : 1, borderColor: equipped ? c.primary200 : c.bg300, backgroundColor: c.surface, gap: 10 }}>
          <QuestEmblem size={62} equipment={{ ...overview.equipment, [slot]: item.key }} />
          <QText size={13} bold>{styleTitle(item)}</QText>
          <QText size={11} muted>{equipped ? 'არჩეულია' : item.unlocked ? 'გახსნილია' : milestone ? `გაიხსნება ${milestone.at} ქულაზე` : 'ჯერ გასახსნელია'}</QText>
          {item.unlocked ? <View style={{ marginTop: 'auto' }}><QButton secondary label={removable ? 'მოხსნა' : equipped ? 'არჩეულია' : 'არჩევა'} disabled={(equipped && !removable) || offline || Boolean(busyKey)} busy={busyKey === item.key} onPress={() => onEquip(item, removable)} /></View> : <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 5 }}><Lock size={14} color={c.text300} /><QText size={12} muted>გააგრძელე მისიები</QText></View>}
        </View>;
      })}
    </View>
    {!items.length ? <QNotice text="ამ კატეგორიაში ნივთები ჯერ არ არის." /> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Palette size={15} color={c.primary200} /><QText size={12} muted>სტილი ცვლის მხოლოდ ვიზუალს — ქულები და ჯილდოები იგივე რჩება.</QText></View>
  </View>;
}
