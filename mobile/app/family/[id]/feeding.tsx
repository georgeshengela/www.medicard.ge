import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { ModuleHeader } from '@/components/brand/ModuleHeader';
import { FeedSheet } from '@/components/family/FamilySheets';
import { Chip, FamilyButton, FamilyCard, FamilySection, FamilySheet, Field, FText, clockOf, errorText, timeAgo, toneColors, useFamilyInk } from '@/components/family/FamilyUI';
import { SwipeDeleteRow, SwipeGroup } from '@/components/records/SwipeDeleteRow';
import { UndoToast } from '@/components/records/UndoToast';
import { useUndoDelete } from '@/components/records/useUndoDelete';
import { Bone } from '@/components/ui/Skeleton';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { familyApi, type FamilyLog, type FoodItem, type FoodStatus } from '@/lib/family/familyApi';
import { FRESH } from '@/lib/queryClient';
import { HUB } from '@/theme/hub';
import { tx } from '@/i18n/locale';

const STATUS_LABEL: Record<FoodStatus, string> = {
  TRIED: tx('გასინჯა', 'Tried'),
  LIKED: tx('მოეწონა', 'Liked'),
  REACTION: tx('რეაქცია', 'Reaction'),
  AVOID: tx('არ ვაძლევთ', 'Avoiding'),
};

/** Feeding by age: the guide for this stage, the baby feed log, and first foods with the nine allergens. */
export default function FeedingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = String(id);
  const insets = useSafeAreaInsets();
  const { c, ink, fill, dark } = useFamilyInk();
  const member = useAccountQuery({ key: ['family', 'member', memberId], fetch: () => familyApi.get(memberId), staleTime: FRESH.SHORT });
  const query = useAccountQuery({ key: ['family', 'feeding', memberId], fetch: () => familyApi.feeding(memberId), staleTime: FRESH.LIVE });
  const data = query.data;
  const [feed, setFeed] = useState<null | 'BREAST' | 'BOTTLE' | 'SOLID'>(null);
  const [food, setFood] = useState<FoodItem | null>(null);
  const [allTips, setAllTips] = useState(false);
  const { held, remove, undo } = useUndoDelete<FamilyLog>((l) => { void familyApi.removeLog(memberId, l.id).then(() => query.refetch()); });
  const name = member.data?.member.name ?? '';
  const feeds = (data?.recent ?? []).filter((l) => l.kind === 'FEED' && l.id !== held?.id);
  const allergens = (data?.foods ?? []).filter((f) => f.allergen);
  const firsts = (data?.foods ?? []).filter((f) => !f.allergen);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + 80, gap: HUB.sectionGap }}>
        <ModuleHeader module="family" subtitle={name ? tx(`${name} · კვება`, `${name} · Feeding`) : tx('კვება', 'Feeding')} fallbackHref={`/family/${memberId}`} />
        {!data ? <View style={{ gap: 14 }}><Bone height={160} radius={HUB.cardRadius} /><Bone height={160} radius={HUB.cardRadius} /></View> : (
          <>

            {data.showLog ? (
              <FamilySection title={tx('დღეს', 'Today')}>
                <FamilyCard style={{ gap: 12 }}>
                  <FText weight="semi">{data.today.count ? tx(`${data.today.count} კვება${data.today.ml ? ` · ${data.today.ml} მლ` : ''}${data.today.breastMinutes ? ` · მკერდი ${data.today.breastMinutes} წთ` : ''}`, `${data.today.count} feeds${data.today.ml ? ` · ${data.today.ml} ml` : ''}${data.today.breastMinutes ? ` · breast ${data.today.breastMinutes} min` : ''}`) : tx('დღეს ჯერ არაფერი ჩაწერილა', 'Nothing logged today yet')}</FText>
                  {data.today.last ? <FText size={13} muted>{tx(`ბოლო კვება ${timeAgo(data.today.last.at)}`, `Last feed ${timeAgo(data.today.last.at)}`)}{data.today.lastSide ? tx(` · შემდეგი მკერდი: ${data.today.lastSide === 'L' ? 'მარჯვენა' : 'მარცხენა'}`, ` · next side: ${data.today.lastSide === 'L' ? 'right' : 'left'}`) : ''}</FText> : null}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <FamilyButton label={tx('მკერდი', 'Breast')} size="sm" variant="secondary" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setFeed('BREAST')} />
                    <FamilyButton label={tx('ბოთლი', 'Bottle')} size="sm" variant="secondary" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setFeed('BOTTLE')} />
                    {data.showFoods ? <FamilyButton label={tx('საკვები', 'Solids')} size="sm" variant="secondary" style={{ flex: 1, paddingHorizontal: 8 }} onPress={() => setFeed('SOLID')} /> : null}
                  </View>
                </FamilyCard>
                {feeds.length ? (
                  <SwipeGroup>
                    <FamilyCard style={{ paddingVertical: 2, overflow: 'hidden' }}>
                      {feeds.slice(0, 20).map((l, i, arr) => (
                        <SwipeDeleteRow key={l.id} onDelete={() => remove(l)}>
                          {(open, a11y) => (
                            <Pressable {...a11y} onLongPress={open} accessibilityLabel={feedText(l)}
                              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 11, backgroundColor: c.surface, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: c.bg200 }}>
                              <FText size={13} weight="semi" style={{ width: 44 }}>{clockOf(l.at)}</FText>
                              <FText size={14} style={{ flex: 1 }}>{feedText(l)}</FText>
                            </Pressable>
                          )}
                        </SwipeDeleteRow>
                      ))}
                    </FamilyCard>
                  </SwipeGroup>
                ) : null}
              </FamilySection>
            ) : null}

            <FamilySection title={data.guide.title}>
              <FamilyCard style={{ gap: 10 }}>
                {(allTips ? data.guide.points : data.guide.points.slice(0, 3)).map((p) => (
                  <View key={p} style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink, marginTop: 9 }} />
                    <FText size={14} style={{ flex: 1 }}>{p}</FText>
                  </View>
                ))}
                {data.guide.points.length > 3 ? (
                  <Pressable accessibilityRole="button" onPress={() => setAllTips(!allTips)} style={{ minHeight: 36, justifyContent: 'center' }}>
                    <FText weight="semi" color={ink}>{allTips ? tx('ნაკლები', 'Show less') : tx(`ყველა რჩევა (${data.guide.points.length})`, `All tips (${data.guide.points.length})`)}</FText>
                  </Pressable>
                ) : null}
              </FamilyCard>
            </FamilySection>

            {data.showFoods ? (
              <>
                <FamilySection title={tx('ალერგენები', 'Allergens')}>
                  <FText size={13} muted>{tx('~6 თვიდან (არა 4 თვემდე) — ადრე და რეგულარულად, კვირაში რამდენჯერმე. ახალს 2–3 დღე აკვირდი.', 'From ~6 months (never before 4) — early and regularly, a few times a week. Watch each new one for 2–3 days.')}</FText>
                  <FoodGrid items={allergens} onPick={setFood} />
                </FamilySection>
                <FamilySection title={tx('პირველი საკვები', 'First foods')}>
                  <FoodGrid items={firsts} onPick={setFood} />
                </FamilySection>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      {held ? <UndoToast title={tx('კვება წაიშალა', 'Feed deleted')} bottom={insets.bottom + 16} onUndo={undo} /> : null}
      <FeedSheet visible={Boolean(feed)} memberId={memberId} initialType={feed ?? 'BREAST'} onClose={() => setFeed(null)} onSaved={() => void query.refetch()} />
      <FoodSheet item={food} memberId={memberId} onClose={() => setFood(null)} onSaved={() => void query.refetch()} />
    </View>
  );
}

function feedText(l: FamilyLog): string {
  const d = l.data;
  if (d.type === 'BREAST') return tx(`მკერდი · ${d.side === 'L' ? 'მარცხ.' : d.side === 'R' ? 'მარჯვ.' : 'ორივე'}${d.minutes ? ` · ${d.minutes} წთ` : ''}`, `Breast · ${d.side === 'L' ? 'left' : d.side === 'R' ? 'right' : 'both'}${d.minutes ? ` · ${d.minutes} min` : ''}`);
  if (d.type === 'BOTTLE') return tx(`ბოთლი · ${d.ml || 0} მლ${d.milk === 'BREASTMILK' ? ' · დედის რძე' : d.milk === 'FORMULA' ? ' · ნარევი' : ''}`, `Bottle · ${d.ml || 0} ml${d.milk === 'BREASTMILK' ? ' · breast milk' : d.milk === 'FORMULA' ? ' · formula' : ''}`);
  return tx(`საკვები · ${d.food || ''}`, `Solids · ${d.food || ''}`);
}

function FoodGrid({ items, onPick }: { items: FoodItem[]; onPick: (f: FoodItem) => void }) {
  const { c, fill, dark, tint } = useFamilyInk();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((f) => {
        const reaction = f.status === 'REACTION';
        const avoid = f.status === 'AVOID';
        const done = f.status === 'TRIED' || f.status === 'LIKED';
        const watch = toneColors('watch', dark);
        return (
          <Pressable key={f.key} accessibilityRole="button" accessibilityLabel={`${f.name}${f.status ? `, ${STATUS_LABEL[f.status]}` : ''}`} onPress={() => onPick(f)}
            style={{ minHeight: 44, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: reaction ? watch.bg : done ? tint : c.surface, borderWidth: 1.5, borderColor: reaction ? watch.ink : done ? fill : avoid ? c.bg300 : c.bg200, opacity: avoid ? 0.6 : 1 }}>
            {done ? <Check size={15} color={fill} /> : null}
            <FText size={14} weight={f.status ? 'semi' : 'medium'} color={reaction ? watch.ink : done ? fill : c.text100}>{f.name}</FText>
          </Pressable>
        );
      })}
    </View>
  );
}

function FoodSheet({ item, memberId, onClose, onSaved }: { item: FoodItem | null; memberId: string; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<FoodStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { dark } = useFamilyInk();
  React.useEffect(() => { if (item) { setStatus(item.status); setNote(item.note || ''); setError(null); } }, [item?.key]);
  if (!item) return null;
  const save = async (clear = false) => {
    setBusy(true); setError(null);
    try {
      if (clear) await familyApi.clearFood(memberId, item.key);
      else if (status) await familyApi.setFood(memberId, item.key, { status, note: note.trim() || null });
      onSaved(); onClose();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <FamilySheet visible={Boolean(item)} onClose={onClose} title={item.name} subtitle={item.how}
      footer={<>
        <FamilyButton label={tx('შენახვა', 'Save')} busy={busy} disabled={!status} onPress={() => void save()} />
        {item.status ? <FamilyButton label={tx('მონიშვნის მოხსნა', 'Clear')} variant="ghost" onPress={() => void save(true)} /> : null}
        {error ? <FText size={13} color={toneColors('alert', dark).ink}>{error}</FText> : null}
      </>}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(STATUS_LABEL) as FoodStatus[]).map((s) => <Chip key={s} label={STATUS_LABEL[s]} on={status === s} onPress={() => setStatus(s)} />)}
      </View>
      {status === 'REACTION' ? (
        <>
          <Field label={tx('რა მოხდა?', 'What happened?')} value={note} onChangeText={setNote} maxLength={200} placeholder={tx('მაგ.: გამონაყარი ტუჩებზე', 'e.g. rash around the lips')} />
          <View style={{ backgroundColor: toneColors('alert', dark).bg, borderRadius: 16, padding: 12 }}>
            <FText size={13} color={toneColors('alert', dark).ink}>{tx('სახის/ტუჩების შეშუპება, სუნთქვის გაძნელება ან მძიმე ღებინება — დარეკე 112-ზე ახლავე. სხვა რეაქციაზე — უთხარი პედიატრს, სანამ ისევ მისცემ.', 'Swelling of the face or lips, trouble breathing or heavy vomiting — call 112 now. For any other reaction — tell your pediatrician before giving it again.')}</FText>
          </View>
        </>
      ) : null}
    </FamilySheet>
  );
}
