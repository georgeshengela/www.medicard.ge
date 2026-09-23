import React, { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { Heart, MessageCircle, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useThemeColors } from '@/theme/colors';
import { APP_MODAL_PROPS, APP_MODAL_OVERLAY } from '@/components/ui/appModal';

const reactions = [
  { key: 'like', label: 'მომწონს', image: require('../../../assets/community/reactions/like.png'), motion: require('../../../assets/community/reactions/like.json') },
  { key: 'love', label: 'მიყვარს', image: require('../../../assets/community/reactions/love.png'), motion: require('../../../assets/community/reactions/love.json') },
  { key: 'care', label: 'შენთან ვარ', image: require('../../../assets/community/reactions/care.png'), motion: require('../../../assets/community/reactions/care.json') },
  { key: 'haha', label: 'სიცილი', image: require('../../../assets/community/reactions/haha.png'), motion: require('../../../assets/community/reactions/haha.json') },
  { key: 'wow', label: 'გაოცება', image: require('../../../assets/community/reactions/wow.png'), motion: require('../../../assets/community/reactions/wow.json') },
  { key: 'sad', label: 'სევდა', image: require('../../../assets/community/reactions/sad.png'), motion: require('../../../assets/community/reactions/sad.json') },
  { key: 'angry', label: 'ბრაზი', image: require('../../../assets/community/reactions/angry.png'), motion: require('../../../assets/community/reactions/angry.json') },
  { key: 'dislike', label: 'არ ვეთანხმები', image: require('../../../assets/community/reactions/dislike.png'), motion: require('../../../assets/community/reactions/dislike.json') },
];

function ReactionArtwork({ item, animated = false, compact = false }: { item: typeof reactions[number]; animated?: boolean; compact?: boolean }) {
  const reduce = usePrefersReducedMotion();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const size = animated ? 46 : compact ? 17 : 20;
  return animated && !reduce && !failed
    ? <View style={{ width: size, height: size }}>{!loaded && <Image source={item.image} style={{ width: size, height: size, position: 'absolute' }} />}<LottieView onAnimationLoaded={() => setLoaded(true)} source={item.motion} autoPlay loop={false} onAnimationFailure={() => setFailed(true)} resizeMode="contain" style={{ width: size, height: size }} webStyle={{ width: size, height: size }} /></View>
    : <Image source={item.image} accessibilityIgnoresInvertColors style={{ width: size, height: size }} />;
}

export function CommunityReactions({ counts, selected, comments, disabled, onReact, onComment }: {
  counts: Record<string, number>;
  selected: string | null;
  comments: number;
  disabled: boolean;
  onReact: (emoji: string | null) => void;
  onComment: () => void;
}) {
  const c = useThemeColors(), safe = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const active = reactions.find(r => r.key === selected);
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value), 0);
  const common = reactions.filter(r => counts[r.key] > 0).sort((a, b) => counts[b.key] - counts[a.key]).slice(0, 3);
  const label = { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: c.text200 };
  const show = () => { setOpen(true); void Haptics.selectionAsync().catch(() => {}); };
  return <View>
    {(total > 0 || comments > 0) && <View style={{ minHeight: 26, paddingBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View accessible accessibilityLabel={`${total} რეაქცია`} style={{ flexDirection: 'row', alignItems: 'center' }}>{common.map((r,index) => <View key={r.key} style={{ marginLeft: index ? -4 : 0, borderRadius: 12, borderWidth: 2, borderColor: c.bg100, backgroundColor: c.bg100, zIndex: 3-index }}><ReactionArtwork item={r} compact /></View>)}{total > 0 && <Text style={{ ...label, fontFamily: 'NotoSansGeorgian_400Regular', marginLeft: 5 }}>{total}</Text>}</View>
      {comments > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`კომენტარები: ${comments}`} onPress={onComment} style={{minHeight:26,justifyContent:'center'}}><Text style={{ ...label, fontFamily: 'NotoSansGeorgian_400Regular' }}>{comments} კომენტარი</Text></Pressable>}
    </View>}
    <View style={{ flexDirection: 'row', borderTopWidth: total > 0 || comments > 0 ? 0.5 : 0, borderColor: c.bg300 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={active ? `შენი რეაქცია: ${active.label}. რეაქციის შეცვლა` : 'რეაქციის არჩევა'} accessibilityState={{selected:!!active,disabled}} disabled={disabled} onPress={show} onLongPress={show} style={{ flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', opacity:disabled?0.5:1 }}>
        {active ? <ReactionArtwork item={active} /> : <Heart size={18} strokeWidth={1.6} color={c.text200} />}<Text style={{ ...label, color: active ? c.primary100 : c.text200 }}>{active?.label || 'რეაქცია'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`კომენტარის დაწერა${comments ? ', '+comments+' კომენტარი' : ''}`} onPress={onComment} style={{ flex: 1, minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}><MessageCircle size={18} strokeWidth={1.6} color={c.text200} /><Text style={label}>კომენტარი</Text></Pressable>
    </View>
    <Modal visible={open} {...APP_MODAL_PROPS} onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="რეაქციების დახურვა" accessibilityRole="button" onPress={() => setOpen(false)} style={{ position: 'absolute', inset: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View accessibilityViewIsModal style={{ backgroundColor: c.surface, padding: 20, paddingBottom: safe.bottom + 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxWidth: 540, width: '100%', alignSelf: 'center', gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ ...label, fontSize: 18, color: c.text100 }}>როგორ გრძნობ თავს?</Text><Pressable accessibilityLabel="დახურვა" accessibilityRole="button" onPress={() => setOpen(false)} style={{ padding: 12 }}><X size={20} color={c.text200} /></Pressable></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{reactions.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: selected === item.key }} onPress={() => { setOpen(false); onReact(selected === item.key ? null : item.key); void Haptics.selectionAsync().catch(() => {}); }} style={{ width: '25%', minHeight: 92, borderRadius: 16, gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: selected === item.key ? c.accent100 : 'transparent' }}><ReactionArtwork item={item} animated /><Text style={{ ...label, fontSize: 10, textAlign: 'center' }}>{item.label}</Text></Pressable>)}</View>
          {active && <Pressable accessibilityRole="button" onPress={() => { setOpen(false); onReact(null); }} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: c.bg200 }}><Text style={label}>რეაქციის გაუქმება</Text></Pressable>}
          <Text style={{ ...label, fontSize: 9, textAlign: 'center' }}>Noto Emoji · Google · CC BY 4.0</Text>
        </View>
      </View>
    </Modal>
  </View>;
}
