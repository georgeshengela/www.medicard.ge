import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';
import { QCard, QText } from './QuestHubPrimitives';

const QUESTIONS = tx([
  ['რა განსხვავებაა XP-სა და მონეტებს შორის?', 'XP გამოცდილებაა და შენს დონეს ზრდის. Medi Coins ჯილდოების მაღაზიაში გამოიყენება. ორივეს იღებ მისიის ან მიღწევის ჯილდოს მიღებისას. მონეტების დახარჯვა XP-სა და დონეს არ ამცირებს; მონეტები ფული არ არის.'],
  ['როგორ ვითვლით პროგრესის ქულებს?', 'ყოველი შესრულებული დღიური მისია გაძლევს 1 პროგრესის ქულას, კვირის მისია — 3-ს. ქულები ავტომატურად ითვლება შესრულებისას, ჯილდოს მიღებამდეც. პროგრესის ქულებით ახალ ეტაპებსა და კოლექციის ნივთებს ხსნი. მიღწევები ამ ქულებს არ ამატებს. ეს არ არის ნაბიჯების რაოდენობა ან გავლილი კილომეტრები.'],
  ['როგორ მუშაობს სერია?', 'ერთ დღიურ მისიას მაინც თუ შეასრულებ, დღე სერიაში ჩაითვლება. ზედიზედ აქტიური დღეები სერიას ზრდის. გამოტოვებული დღე მიმდინარე სერიას წყვეტს; შენი საუკეთესო სერია, მიღებული XP და ჯილდოები რჩება. მხოლოდ აპის გახსნა ამ სერიას არ ზრდის.'],
  ['როდის განახლდება მისიები?', 'დღიური მისიები ახალი დღის დაწყებისას იცვლება, კვირის მისიები — ორშაბათს. დრო ანგარიშის დროის სარტყლის მიხედვით ითვლება. უკვე შესრულებული მისიის ჯილდო მოგვიანებითაც შეგიძლია მიიღო; შეუსრულებელი მისია ვადის გასვლის შემდეგ ისტორიაში გადადის.'],
  ['საიდან მოდის ნაბიჯები და წყლის პროგრესი?', 'ნაბიჯები ჯანმრთელობის აპთან კავშირით სინქრონდება. თუ მოძრაობის მისია არ ჩანს, შეამოწმე ნაბიჯებზე წვდომა ნებართვებში და განაახლე გვერდი. წყლის მისიისთვის საჭიროა ჰიდრატაციის დღიური მიზანი და დაფიქსირებული წყალი. პროგრესს სისტემა ითვლის; ამ გვერდზე ხელით ვერ მონიშნავ მისიას შესრულებულად.'],
  ['როგორ სრულდება Medi-ს მისია?', 'მისიის ბარათიდან გახსენი Medi და ესაუბრე მას. მისია შესრულდება წარმატებული საუბრის შემდეგ. Medi-სთან საუბარი უფასოა. მონაცემების AI-სთან გაზიარებისთვის საჭიროა შენი თანხმობა.'],
  ['რა ხდება ინტერნეტის გარეშე?', 'ბოლო შენახულ მონაცემებს ოფლაინის ნიშნით ნახავ. ჯილდოს მიღებას და კოლექციის სტილის შენახვას ინტერნეტი სჭირდება. კავშირის აღდგენისას განაახლე გვერდი. ერთი მისიის ჯილდო ერთხელ ირიცხება.'],
  ['რატომ შეიცვალა ჩემი მიზანი?', 'მოძრაობის ახალი მიზანი შეიძლება ბოლო აქტივობას მოერგოს. მისიის ბარათზე „რატომ ეს მიზანი?“ ზუსტ მიზეზს გაჩვენებს. უკვე დანიშნული მისიის მიზანი ფიქსირებულია. ითამაშე შენი ტემპით — XP და დონე ჯანმრთელობის შეფასება არ არის.'],
], [
  ['What’s the difference between XP and coins?', 'XP is experience and raises your level. Medi Coins are spent in the rewards store. You get both when you collect a mission or achievement reward. Spending coins never lowers your XP or level; coins are not money.'],
  ['How do we count progress points?', 'Each completed daily mission gives you 1 progress point, a weekly mission gives 3. Points count automatically when you complete a mission, even before you collect the reward. Progress points unlock new stages and collection items. Achievements don’t add to these points. They aren’t a step count or kilometers walked.'],
  ['How do streaks work?', 'If you complete at least one daily mission, the day counts toward your streak. Active days in a row grow your streak. A missed day ends your current streak; your best streak, earned XP and rewards stay. Just opening the app doesn’t grow your streak.'],
  ['When do missions refresh?', 'Daily missions change when a new day starts, weekly missions on Monday. Time follows your account’s time zone. You can collect a completed mission’s reward later too; an unfinished mission moves to history once it expires.'],
  ['Where do steps and water progress come from?', 'Steps sync through your health app connection. If the movement mission doesn’t show up, check step access in permissions and refresh the page. The water mission needs a daily hydration goal and logged water. The system counts progress; you can’t mark a mission complete by hand on this page.'],
  ['How is the Medi mission completed?', 'Open Medi from the mission card and chat with it. The mission is completed after a successful conversation. Chatting with Medi is free. Sharing data with AI needs your consent.'],
  ['What happens without internet?', 'You’ll see your last saved data marked as offline. Collecting rewards and saving your collection style need internet. Refresh the page once you’re back online. Each mission’s reward is credited only once.'],
  ['Why did my goal change?', 'A new movement goal may adapt to your recent activity. “Why this goal?” on the mission card shows the exact reason. The goal of a mission already assigned is fixed. Play at your own pace — XP and levels are not a health assessment.'],
]);
export function QuestGuideSheet({ visible, onClose, timezone }: { visible: boolean; onClose: () => void; timezone?: string }) {
  const c = useThemeColors(), insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(null);
  return <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 20 }}>
      <Pressable accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: APP_MODAL_OVERLAY }} />
      <View accessibilityViewIsModal style={{ maxHeight: '92%', backgroundColor: c.bg100, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}><QText size={20} bold>{tx('როგორ მუშაობს?', 'How does it work?')}</QText><QText size={12} muted>{tx('MEDI QUEST · შენი გზამკვლევი', 'MEDI QUEST · your guide')}</QText></View>
          <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.surfaceRaised }}><X size={20} color={c.text100} /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 12 }}>
          <QCard>{tx(['აირჩიე დღიური ან კვირის მისია.', 'შეასრულე — პროგრესი ავტომატურად განახლდება.', 'დააჭირე „ჯილდოს მიღება“ და მიიღე XP + მონეტები.'], ['Pick a daily or weekly mission.', 'Complete it — progress updates automatically.', 'Tap “Collect reward” to get XP + coins.']).map((text, i) => <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><QText bold color={c.primary200}>0{i + 1}</QText><View style={{ flex: 1 }}><QText>{text}</QText></View></View>)}</QCard>
          {QUESTIONS.map(([title, body], i) => <View key={title} style={{ borderBottomWidth: 1, borderBottomColor: c.bg300, paddingBottom: 10 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)} style={{ minHeight: 52, flexDirection: 'row', gap: 10, alignItems: 'center' }}><View style={{ flex: 1 }}><QText bold>{title}</QText></View><ChevronDown size={18} color={c.text200} style={{ transform: [{ rotate: open === i ? '180deg' : '0deg' }] }} /></Pressable>
            {open === i ? <QText size={13} muted>{body}</QText> : null}
          </View>)}
          {timezone ? <QText size={12} muted>{tx('შენი დროის სარტყელი:', 'Your time zone:')} {timezone}</QText> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Check size={16} color={c.primary200} /><QText size={12} muted>{tx('მისიები, პროგრესი და ჯილდოები ერთ სივრცეში.', 'Missions, progress and rewards in one place.')}</QText></View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
