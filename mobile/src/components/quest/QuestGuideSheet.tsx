import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useThemeColors } from '@/theme/colors';
import { QCard, QText } from './QuestHubPrimitives';

const QUESTIONS = [
  ['რა განსხვავებაა XP-სა და მონეტებს შორის?', 'XP გამოცდილებაა და შენს დონეს ზრდის. Medi Coins ჯილდოების მაღაზიაში გამოიყენება. ორივეს იღებ მისიის ან მიღწევის ჯილდოს მიღებისას. მონეტების დახარჯვა XP-სა და დონეს არ ამცირებს; მონეტები ფული არ არის.'],
  ['როგორ ვითვლით პროგრესის ქულებს?', 'ყოველი შესრულებული დღიური მისია გაძლევს 1 პროგრესის ქულას, კვირის მისია — 3-ს. ქულები ავტომატურად ითვლება შესრულებისას, ჯილდოს მიღებამდეც. პროგრესის ქულებით ახალ ეტაპებსა და კოლექციის ნივთებს ხსნი. მიღწევები ამ ქულებს არ ამატებს. ეს არ არის ნაბიჯების რაოდენობა ან გავლილი კილომეტრები.'],
  ['როგორ მუშაობს სერია?', 'ერთ დღიურ მისიას მაინც თუ შეასრულებ, დღე სერიაში ჩაითვლება. ზედიზედ აქტიური დღეები სერიას ზრდის. გამოტოვებული დღე მიმდინარე სერიას წყვეტს; შენი საუკეთესო სერია, მიღებული XP და ჯილდოები რჩება. მხოლოდ აპის გახსნა ამ სერიას არ ზრდის.'],
  ['როდის განახლდება მისიები?', 'დღიური მისიები ახალი დღის დაწყებისას იცვლება, კვირის მისიები — ორშაბათს. დრო ანგარიშის დროის სარტყლის მიხედვით ითვლება. უკვე შესრულებული მისიის ჯილდო მოგვიანებითაც შეგიძლია მიიღო; შეუსრულებელი მისია ვადის გასვლის შემდეგ ისტორიაში გადადის.'],
  ['საიდან მოდის ნაბიჯები და წყლის პროგრესი?', 'ნაბიჯები ჯანმრთელობის აპთან კავშირით სინქრონდება. თუ მოძრაობის მისია არ ჩანს, შეამოწმე ნაბიჯებზე წვდომა ნებართვებში და განაახლე გვერდი. წყლის მისიისთვის საჭიროა ჰიდრატაციის დღიური მიზანი და დაფიქსირებული წყალი. პროგრესს სისტემა ითვლის; ამ გვერდზე ხელით ვერ მონიშნავ მისიას შესრულებულად.'],
  ['როგორ სრულდება Medi-ს მისია?', 'მისიის ბარათიდან გახსენი Medi და ესაუბრე მას. მისია შესრულდება წარმატებული საუბრის შემდეგ. ჩათის გამოყენებაზე შენი პაკეტის არსებული პირობები და ლიმიტები მოქმედებს.'],
  ['რა ხდება ინტერნეტის გარეშე?', 'ბოლო შენახულ მონაცემებს ოფლაინის ნიშნით ნახავ. ჯილდოს მიღებას და კოლექციის სტილის შენახვას ინტერნეტი სჭირდება. კავშირის აღდგენისას განაახლე გვერდი. ერთი მისიის ჯილდო ერთხელ ირიცხება.'],
  ['რატომ შეიცვალა ჩემი მიზანი?', 'მოძრაობის ახალი მიზანი შეიძლება ბოლო აქტივობას მოერგოს. მისიის ბარათზე „რატომ ეს მიზანი?“ ზუსტ მიზეზს გაჩვენებს. უკვე დანიშნული მისიის მიზანი ფიქსირებულია. ითამაშე შენი ტემპით — XP და დონე ჯანმრთელობის შეფასება არ არის.'],
];
export function QuestGuideSheet({ visible, onClose, timezone }: { visible: boolean; onClose: () => void; timezone?: string }) {
  const c = useThemeColors(), insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(null);
  return <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 20 }}>
      <Pressable accessibilityLabel="დახურვა" onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: APP_MODAL_OVERLAY }} />
      <View accessibilityViewIsModal style={{ maxHeight: '92%', backgroundColor: c.bg100, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}><QText size={20} bold>როგორ მუშაობს?</QText><QText size={12} muted>MEDI QUEST · შენი გზამკვლევი</QText></View>
          <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.surfaceRaised }}><X size={20} color={c.text100} /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 12 }}>
          <QCard>{['აირჩიე დღიური ან კვირის მისია.', 'შეასრულე — პროგრესი ავტომატურად განახლდება.', 'დააჭირე „ჯილდოს მიღება“ და მიიღე XP + მონეტები.'].map((text, i) => <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><QText bold color={c.primary200}>0{i + 1}</QText><View style={{ flex: 1 }}><QText>{text}</QText></View></View>)}</QCard>
          {QUESTIONS.map(([title, body], i) => <View key={title} style={{ borderBottomWidth: 1, borderBottomColor: c.bg300, paddingBottom: 10 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === i }} onPress={() => setOpen(open === i ? null : i)} style={{ minHeight: 52, flexDirection: 'row', gap: 10, alignItems: 'center' }}><View style={{ flex: 1 }}><QText bold>{title}</QText></View><ChevronDown size={18} color={c.text200} style={{ transform: [{ rotate: open === i ? '180deg' : '0deg' }] }} /></Pressable>
            {open === i ? <QText size={13} muted>{body}</QText> : null}
          </View>)}
          {timezone ? <QText size={12} muted>შენი დროის სარტყელი: {timezone}</QText> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Check size={16} color={c.primary200} /><QText size={12} muted>მისიები, პროგრესი და ჯილდოები ერთ სივრცეში.</QText></View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
