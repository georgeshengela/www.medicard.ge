import React from "react";
import { Linking } from "react-native";
import {
  NScreen,
  NText,
  NCard,
  NButton,
} from "@/components/nutrition/ProgramUI";
import { tx } from "@/i18n/locale";
export default function Method() {
  return (
    <NScreen
      title={tx("როგორ მუშაობს კვება?", "How does nutrition work?")}
      subtitle={tx("გასაგები რიცხვები · გამჭვირვალე მეთოდი", "Clear numbers · a transparent method")}
    >
      <NCard>
        <NText
          style={{ fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold" }}
        >
          {tx("შეფასება, რომელსაც შენ აკონტროლებ", "An estimate you control")}
        </NText>
        <NText>
          {tx(
            "დღის ენერგიის საწყისი შეფასება ითვალისწინებს ასაკს, წონას, სიმაღლეს, ფორმულის სქესობრივ კოეფიციენტსა და არჩეულ აქტივობას. ვიყენებთ Mifflin–St Jeor-ის ფორმულას. აქტივობის გამრავლება და ქვემოთ მოცემული საზღვრები ჩვენი პროდუქტის კონსერვატიული არჩევანია, არა ინდივიდუალური სამედიცინო დანიშნულება.",
            "The starting estimate of your daily energy takes into account your age, weight, height, the formula's sex coefficient and the activity level you choose. We use the Mifflin–St Jeor formula. The activity multiplier and the limits below are our product's conservative choices, not an individual medical prescription.",
          )}
        </NText>
        <NText>
          {tx(
            "დაკლება: შენარჩუნების შეფასებას აკლდება 250 ან 400 კკალ; მომატება: ემატება 200; შენარჩუნება: ცვლილების გარეშე. სამიზნე ყოველ აწონვაზე ავტომატურად არ მცირდება. ვარჯიშის კალორიები არ ემატება.",
            "Lose: 250 or 400 kcal is taken off the maintenance estimate; gain: 200 is added; maintain: no change. The target doesn't drop automatically every time you weigh in. Exercise calories aren't added.",
          )}
        </NText>
        <NText>
          {tx(
            "საწყისი განაწილება: ცილა 20%, ნახშირწყალი 50%, ცხიმი 30%. რაციონის კერძების განაწილება შეიძლება განსხვავდებოდეს — მათი ჯამები ცალკე ჩანს. ეს მიკრონუტრიენტების ან სამკურნალო დიეტის სრული შეფასება არ არის.",
            "Starting split: protein 20%, carbs 50%, fat 30%. The split in meal-plan dishes can differ — their totals are shown separately. This isn't a full assessment of micronutrients or a therapeutic diet.",
          )}
        </NText>
      </NCard>
      <NCard>
        <NText
          style={{ fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold" }}
        >
          {tx("როდის გვჭირდება სპეციალისტი?", "When do you need a specialist?")}
        </NText>
        <NText>
          {tx(
            "ავტომატური გეგმა განკუთვნილია 19–78 წლის ზრდასრულისთვის. ორსულობის, ძუძუთი კვების, კვებითი აშლილობის, ქრონიკული დაავადების, სამკურნალო დიეტის ან აპის საზღვრებს გარეთ გამოთვლილი საჭიროებისას კალორიულ სამიზნეს არ ვადგენთ. დღის ავტომატური დიაპაზონია 1500–3500 კკალ; ეს ყველა ადამიანის უსაფრთხო ნორმას არ ნიშნავს.",
            "The automatic plan is meant for adults aged 19–78. We don't set a calorie target during pregnancy or breastfeeding, with an eating disorder, a chronic illness or a therapeutic diet, or when the calculated need falls outside the app's limits. The automatic daily range is 1500–3500 kcal; that doesn't mean it's a safe norm for everyone.",
          )}
        </NText>
        <NText>
          {tx(
            "დღიური გამოიყენება გეგმის გარეშეც. თუ სიმპტომები, ძლიერი შიმშილი ან სისუსტე გაქვს, გეგმა სპეციალისტთან განიხილე. აპი ექიმს ან დიეტოლოგს არ ცვლის.",
            "You can use the diary without a plan too. If you have symptoms, strong hunger or weakness, discuss the plan with a specialist. The app doesn't replace a doctor or a dietitian.",
          )}
        </NText>
      </NCard>
      <NCard>
        <NText
          style={{ fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold" }}
        >
          {tx("რაციონის წესები", "Meal plan rules")}
        </NText>
        <NText>
          {tx(
            "რაციონის დამატება საკვების მიღებას არ ნიშნავს. „მივირთვი“ ერთხელ გადააქვს კერძი დღიურში; რეალური პორცია დღიურში შეცვალე. ფოტოთი უკვე ჩაწერილ იმავე კვებას მეორედ ნუ მონიშნავ.",
            "Adding a meal plan doesn't mean you ate it. “I ate this” moves the dish to your diary once; adjust the real portion in the diary. Don't mark a meal you've already logged with a photo a second time.",
          )}
        </NText>
        <NText>
          {tx(
            "შეამოწმე ალერგენები შეფუთვაზეც — ბაზა ჯვარედინი დაბინძურების გარანტიას ვერ იძლევა. წონა ეხება საკვებ ნაწილს; სახელში წერია მშრალია, უმია თუ მომზადებული. საყიდლების სია ამავე წონებს აჯამებს და მშრალ/უმ შესაძენ რაოდენობად არ გარდაქმნის.",
            "Check allergens on the packaging too — the database can't guarantee against cross-contamination. Weights refer to the edible part; the name says whether it's dry, raw or cooked. The shopping list adds up these same weights and doesn't convert them into dry/raw amounts to buy.",
          )}
        </NText>
        <NText>
          {tx(
            "კატალოგის მაჩვენებლები USDA SR Legacy-ს ცნობარზეა დაფუძნებული. მომზადება, ბრენდი და პორცია შედეგს ცვლის; ფოტოს შეფასებაც მიახლოებითია.",
            "Catalog values are based on the USDA SR Legacy reference. Cooking, brand and portion change the result; photo estimates are approximate too.",
          )}
        </NText>
      </NCard>
      {[
        [
          tx("ფორმულის თავდაპირველი კვლევა", "Original formula study"),
          "https://pubmed.ncbi.nlm.nih.gov/2305711/",
        ],
        [
          tx("NIDDK · წონის დაგეგმვა", "NIDDK · Body Weight Planner"),
          "https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner",
        ],
        [
          tx("Health Canada · მაკრონუტრიენტები", "Health Canada · Macronutrients"),
          "https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/reference-values-macronutrients.html",
        ],
        [
          tx("USDA · საკვების ცნობარი", "USDA · Food reference"),
          "https://fdc.nal.usda.gov/data-documentation/",
        ],
      ].map(([label, url]) => (
        <NButton
          secondary
          key={url}
          label={label}
          onPress={() => void Linking.openURL(url)}
        />
      ))}
    </NScreen>
  );
}
