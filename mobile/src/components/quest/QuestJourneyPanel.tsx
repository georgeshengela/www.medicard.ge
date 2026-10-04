import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { hubInk } from '@/theme/hub';
import Svg, { Circle, Path } from 'react-native-svg';
import { Check, Flag, Gift, Lock, Palette } from 'lucide-react-native';
import { QuestArt } from './QuestIcon';
import { decorationArt, symbolArt } from './questArt';
import type { CompanionCosmetic, CompanionEquipment, CompanionOverview } from '@/lib/companion/api';
import { appLang, tx } from '@/i18n/locale';
import { companionChapterTitle, companionCosmeticTitle, companionMilestoneTitle } from '@/lib/companion/copy';
import { accentColorForEquipment, visualKeyForCosmetic } from '@/lib/companion/cosmeticVisuals';
import { journeyPresentation, questCollection } from '@/lib/quest/hubPresentation';
import { QuestProgressBar } from './QuestProgressBar';
import { QButton, QCard, QHeading, QNotice, QText } from './QuestHubPrimitives';
import { useIsDark, useThemeColors } from '@/theme/colors';

const EMPTY: CompanionEquipment = { accent: null, accessory: null, background: null, decoration: null };
const SYMBOL_NAMES: Record<string, string> = {
  'pose.wave': tx('პირველი ტალღა', 'First wave'), 'pose.focused': tx('ფოკუსი', 'Focus'), 'pose.proud': tx('გვირგვინი', 'Crown'), 'pose.resting': tx('მთვარე', 'Moon'), 'pose.curious': tx('აღმომჩენი', 'Explorer'),
  'accessory.pin': tx('ჩემი დროშა', 'My flag'), 'accessory.visor': tx('ჰორიზონტი', 'Horizon'), 'accessory.scarf': tx('ლენტი', 'Ribbon'), 'accessory.orbit': tx('ორბიტა', 'Orbit'), 'accessory.badge': tx('გზის ნიშანი', 'Path badge'),
  'bg.teal_room': tx('თეალის სიმშვიდე', 'Teal calm'),
};
function styleTitle(item: CompanionCosmetic) {
  return SYMBOL_NAMES[visualKeyForCosmetic(item.key) ?? ''] ?? companionCosmeticTitle(item.titleKey, appLang());
}
/** A personal achievement seal. All four owned style slots have a visible result. */
export function QuestEmblem({ equipment = EMPTY, size = 84 }: { equipment?: CompanionEquipment; size?: number }) {
  const c = useThemeColors(), dark = useIsDark();
  const ink = accentColorForEquipment(equipment.accent, '#14B8A6');
  const bg = visualKeyForCosmetic(equipment.background) ?? '';
  const fill = bg.includes('dawn') ? (dark ? '#292524' : '#FFFBEB') : bg.includes('garden') ? (dark ? '#142C23' : '#F0FDF4') : bg.includes('city') ? (dark ? '#172554' : '#EFF6FF') : bg.includes('summit') ? (dark ? '#2E1065' : '#F5F3FF') : bg.includes('teal_room') ? (dark ? '#042F2E' : '#CCFBF1') : c.surfaceRaised;
  const accessory = visualKeyForCosmetic(equipment.accessory) ?? '';
  const decor = visualKeyForCosmetic(equipment.decoration) ?? '';
  return <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
      <Circle cx="50" cy="50" r="46" fill={fill} stroke={ink} strokeWidth="1" strokeDasharray="2 6" />
      <Circle cx="50" cy="50" r="35" fill={c.surface} stroke={ink} strokeWidth="1.5" />
      <Path d="M50 4 L53 11 L50 18 L47 11 Z M50 82 L53 89 L50 96 L47 89 Z" fill={ink} />
    </Svg>
    <View style={{ zIndex: 1 }}><QuestArt source={symbolArt(accessory)} size={Math.round(size * .56)} /></View>
    {equipment.decoration ? <View style={{ position: 'absolute', bottom: 1, right: 0, padding: 3, backgroundColor: c.surface, borderRadius: 12, borderColor: c.bg300, borderWidth: 1 }}><QuestArt source={decorationArt(decor)} size={Math.round(size * .24)} /></View> : null}
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
        <View style={{ flex: 1 }}><QText size={12} muted>{tx('შენი პირადი გზა', 'Your personal path')}</QText><QText size={21} bold>{companionChapterTitle(journey.chapterKey, appLang())}</QText><QText size={12} muted>{tx(`${info.unlocked} / ${info.milestones.length} ეტაპი გახსნილია`, `${info.unlocked} / ${info.milestones.length} stages unlocked`)}</QText></View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7 }}><QText size={34} bold>{journey.units}</QText><QText size={13} muted>{tx('პროგრესის ქულა', 'progress points')}</QText></View>
      <QuestProgressBar percent={info.percent} height={8} />
      <QText size={13} muted>{info.next ? tx(`შემდეგი: ${companionMilestoneTitle(info.next.titleKey, appLang())} · დარჩა ${info.remaining} ქულა`, `Next: ${companionMilestoneTitle(info.next.titleKey, appLang())} · ${info.remaining} ${info.remaining === 1 ? 'point' : 'points'} to go`) : tx('ყველა ეტაპი გახსნილია. შენი მისიები და მიღწევები გრძელდება.', 'Every stage is unlocked. Your missions and achievements carry on.')}</QText>
    </QCard>
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <QCard style={{ flex: 1, padding: 14 }}><QText size={23} bold color={hubInk('teal', dark)}>+1</QText><QText size={12} muted>{tx('დღიური მისიის შესრულება', 'Daily mission completed')}</QText></QCard>
      <QCard style={{ flex: 1, padding: 14 }}><QText size={23} bold color={hubInk('teal', dark)}>+3</QText><QText size={12} muted>{tx('კვირის მისიის შესრულება', 'Weekly mission completed')}</QText></QCard>
    </View>
    <QText size={13} muted>{tx('ქულა ავტომატურად ემატება შესრულებისას. XP და მონეტები ცალკე ჯილდოა — მისიის ბარათიდან მიიღე.', 'Points are added automatically when you complete a mission. XP and coins are a separate reward — collect them from the mission card.')}</QText>
    <QHeading title={tx('შენი ეტაპები', 'Your stages')} meta={tx(`${chapters.length} თავი`, `${chapters.length} ${chapters.length === 1 ? 'chapter' : 'chapters'}`)} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {chapters.map((key, i) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === chapter }} onPress={() => setChapter(key)} style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 16, backgroundColor: key === chapter ? '#0D9488' : c.surfaceRaised }}><QText bold color={key === chapter ? '#FFFFFF' : c.text200}>{tx(`თავი ${i + 1}`, `Chapter ${i + 1}`)}</QText></Pressable>)}
    </ScrollView>
    <View><QText size={17} bold>{companionChapterTitle(chapter, appLang())}</QText></View>
    <QCard style={{ gap: 0 }}>
      {info.milestones.filter(m => m.chapterKey === chapter).map((m, i, all) => {
        const next = m.key === info.next?.key;
        const tone = m.unlocked ? (hubInk('teal', dark)) : c.text300;
        return <View key={m.key} style={{ flexDirection: 'row', gap: 14, minHeight: 98 }}>
          <View style={{ width: 36, alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 13, backgroundColor: m.unlocked ? c.accent100 : c.bg100, borderWidth: next ? 2 : 1, borderColor: next ? c.primary200 : c.bg300, alignItems: 'center', justifyContent: 'center' }}>
              {m.unlocked ? <Check size={17} color={tone} /> : next ? <Flag size={17} color={c.primary200} /> : <Lock size={15} color={tone} />}
            </View>
            {i < all.length - 1 ? <View style={{ width: 1, backgroundColor: c.bg300, flex: 1, marginVertical: 7 }} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: 20, gap: 4 }}>
            <QText bold>{companionMilestoneTitle(m.titleKey, appLang())}</QText>
            <QText size={12} muted>{tx(`${m.at} ქულა`, `${m.at} ${m.at === 1 ? 'point' : 'points'}`)} · {m.unlocked ? tx('გახსნილია', 'Unlocked') : next ? tx('შენი შემდეგი ეტაპი', 'Your next stage') : tx('გასახსნელია', 'Locked')}</QText>
            {m.cosmeticKey ? <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Gift size={12} color={tone} /><QText size={11} color={tone}>{tx('კოლექციის ნივთი', 'Collection item')}</QText></View> : null}
          </View>
        </View>;
      })}
    </QCard>
    <QButton secondary label={tx('როგორ ითვლება პროგრესი?', 'How is progress counted?')} onPress={onGuide} />
  </View>;
}

const SLOTS = [{ key: 'accent', label: tx('ფერი', 'Color') }, { key: 'background', label: tx('ფონი', 'Background') }, { key: 'accessory', label: tx('სიმბოლო', 'Symbol') }, { key: 'decoration', label: tx('დეკორი', 'Decor') }] as const;
export function QuestCollectionPanel({ overview, onEquip, busyKey, error, offline }: { overview: CompanionOverview; onEquip: (item: CompanionCosmetic, clear?: boolean) => void; busyKey: string | null; error?: string | null; offline: boolean }) {
  const c = useThemeColors();
  const [slot, setSlot] = useState<(typeof SLOTS)[number]['key']>('accent');
  const collection = questCollection(overview);
  const items = collection.filter(item => item.slot === slot);
  const unlocked = collection.filter(item => item.unlocked).length;
  return <View style={{ gap: 14 }}>
    <QHeading title={tx('ჩემი კოლექცია', 'My collection')} meta={`${unlocked} / ${collection.length}`} />
    <QCard>
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}><QuestEmblem equipment={overview.equipment} size={96} /><View style={{ flex: 1 }}><QText bold size={17}>{tx('შენი პროგრესის ნიშანი', 'Your progress badge')}</QText><QText size={13} muted>{tx('ეტაპებზე გახსნილი ფერით, ფონითა და სიმბოლოებით გააფორმე.', 'Style it with the colors, backgrounds and symbols you unlock along the way.')}</QText></View></View>
    </QCard>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {SLOTS.map(s => <Pressable key={s.key} accessibilityRole="tab" accessibilityState={{ selected: slot === s.key }} onPress={() => setSlot(s.key)} style={{ flex: 1, minHeight: 44, paddingHorizontal: 3, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: slot === s.key ? '#0D9488' : c.surfaceRaised }}><QText size={12} bold color={slot === s.key ? '#FFFFFF' : c.text200}>{s.label}</QText></Pressable>)}
    </View>
    {error ? <QNotice text={error} danger /> : null}
    {offline ? <QNotice text={tx('კოლექციის შეცვლას ინტერნეტი სჭირდება. ბოლო შენახულ სტილს ხედავ.', 'Changing your collection needs internet. You’re seeing your last saved style.')} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map(item => {
        const equipped = overview.equipment[slot] === item.key;
        const removable = equipped && (slot === 'accessory' || slot === 'decoration');
        const milestone = overview.journey.milestones.find(m => m.cosmeticKey === item.key);
        return <View key={item.key} style={{ width: '48%', flexGrow: 1, padding: 14, borderRadius: 22, borderWidth: equipped ? 2 : 1, borderColor: equipped ? c.primary200 : c.bg300, backgroundColor: c.surface, gap: 10 }}>
          <QuestEmblem size={62} equipment={{ ...overview.equipment, [slot]: item.key }} />
          <QText size={13} bold>{styleTitle(item)}</QText>
          <QText size={11} muted>{equipped ? tx('არჩეულია', 'Selected') : item.unlocked ? tx('გახსნილია', 'Unlocked') : milestone ? tx(`გაიხსნება ${milestone.at} ქულაზე`, `Unlocks at ${milestone.at} ${milestone.at === 1 ? 'point' : 'points'}`) : tx('ჯერ გასახსნელია', 'Not unlocked yet')}</QText>
          {item.unlocked ? <View style={{ marginTop: 'auto' }}><QButton secondary label={removable ? tx('მოხსნა', 'Remove') : equipped ? tx('არჩეულია', 'Selected') : tx('არჩევა', 'Select')} disabled={(equipped && !removable) || offline || Boolean(busyKey)} busy={busyKey === item.key} onPress={() => onEquip(item, removable)} /></View> : <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 5 }}><Lock size={14} color={c.text300} /><QText size={12} muted>{tx('გააგრძელე მისიები', 'Keep doing missions')}</QText></View>}
        </View>;
      })}
    </View>
    {!items.length ? <QNotice text={tx('ამ კატეგორიაში ნივთები ჯერ არ არის.', 'No items in this category yet.')} /> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Palette size={15} color={c.primary200} /><QText size={12} muted>{tx('სტილი ცვლის მხოლოდ ვიზუალს — ქულები და ჯილდოები იგივე რჩება.', 'Style only changes the look — points and rewards stay the same.')}</QText></View>
  </View>;
}
