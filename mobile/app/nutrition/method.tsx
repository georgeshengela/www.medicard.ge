import React from "react";
import { Linking, Pressable, StyleSheet } from "react-native";
import { BookOpen, ExternalLink, ListChecks, Stethoscope } from "lucide-react-native";
import { NScreen, NText, NCard, NCardTitle, useMedifood, withMedifood } from "@/components/nutrition/ProgramUI";
import { HubSection } from "@/components/nutrition/NutritionUi";
import { tx } from "@/i18n/locale";

/** MEDIFOOD · how the plan is calculated, where the limits are and which sources it rests on. */
export default withMedifood(function Method() {
  const M = useMedifood();
  return (
    <NScreen title={tx("როგორ ითვლება", "How it is calculated")}>
      <NCard>
        <NCardTitle icon={BookOpen} title={tx("შეფასება, რომელსაც შენ აკონტროლებ", "An estimate you control")} />
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "დღის ენერგიის საწყისი შეფასება ითვალისწინებს ასაკს, წონას, სიმაღლეს, ფორმულის სქესობრივ კოეფიციენტსა და არჩეულ აქტივობას. ვიყენებთ Mifflin–St Jeor-ის ფორმულას. აქტივობის გამრავლება და ქვემოთ მოცემული საზღვრები ჩვენი პროდუქტის კონსერვატიული არჩევანია, არა ინდივიდუალური სამედიცინო დანიშნულება.",
            "The starting estimate of your daily energy takes into account your age, weight, height, the formula's sex coefficient and the activity level you choose. We use the Mifflin–St Jeor formula. The activity multiplier and the limits below are our product's conservative choices, not an individual medical prescription.",
          )}
        </NText>
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "დაკლება: შენარჩუნების შეფასებას აკლდება 250 ან 400 კკალ; მომატება: ემატება 200; შენარჩუნება: ცვლილების გარეშე. სამიზნე ყოველ აწონვაზე ავტომატურად არ მცირდება. ვარჯიშის კალორიები არ ემატება.",
            "Lose: 250 or 400 kcal is taken off the maintenance estimate; gain: 200 is added; maintain: no change. The target doesn't drop automatically every time you weigh in. Exercise calories aren't added.",
          )}
        </NText>
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "საწყისი განაწილება: ცილა 20%, ნახშირწყალი 50%, ცხიმი 30%. რაციონის კერძების განაწილება შეიძლება განსხვავდებოდეს — მათი ჯამები ცალკე ჩანს. ეს მიკრონუტრიენტების ან სამკურნალო დიეტის სრული შეფასება არ არის.",
            "Starting split: protein 20%, carbs 50%, fat 30%. The split in meal-plan dishes can differ — their totals are shown separately. This isn't a full assessment of micronutrients or a therapeutic diet.",
          )}
        </NText>
      </NCard>
      <NCard>
        <NCardTitle icon={Stethoscope} title={tx("როდის გვჭირდება სპეციალისტი?", "When do you need a specialist?")} />
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "ავტომატური გეგმა განკუთვნილია 19–78 წლის ზრდასრულისთვის. ორსულობის, ძუძუთი კვების, კვებითი აშლილობის, ქრონიკული დაავადების, სამკურნალო დიეტის ან აპის საზღვრებს გარეთ გამოთვლილი საჭიროებისას კალორიულ სამიზნეს არ ვადგენთ. დღის ავტომატური დიაპაზონია 1500–3500 კკალ; ეს ყველა ადამიანის უსაფრთხო ნორმას არ ნიშნავს.",
            "The automatic plan is meant for adults aged 19–78. We don't set a calorie target during pregnancy or breastfeeding, with an eating disorder, a chronic illness or a therapeutic diet, or when the calculated need falls outside the app's limits. The automatic daily range is 1500–3500 kcal; that doesn't mean it's a safe norm for everyone.",
          )}
        </NText>
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "დღიური გამოიყენება გეგმის გარეშეც. თუ სიმპტომები, ძლიერი შიმშილი ან სისუსტე გაქვს, გეგმა სპეციალისტთან განიხილე. აპი ექიმს ან დიეტოლოგს არ ცვლის.",
            "You can use the diary without a plan too. If you have symptoms, strong hunger or weakness, discuss the plan with a specialist. The app doesn't replace a doctor or a dietitian.",
          )}
        </NText>
      </NCard>
      <NCard>
        <NCardTitle icon={ListChecks} title={tx("რაციონის წესები", "Meal plan rules")} />
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "რაციონის დამატება საკვების მიღებას არ ნიშნავს. „მივირთვი“ ერთხელ გადააქვს კერძი დღიურში; რეალური პორცია დღიურში შეცვალე. ფოტოთი უკვე ჩაწერილ იმავე კვებას მეორედ ნუ მონიშნავ.",
            "Adding a meal plan doesn't mean you ate it. “I ate this” moves the dish to your diary once; adjust the real portion in the diary. Don't mark a meal you've already logged with a photo a second time.",
          )}
        </NText>
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "შეამოწმე ალერგენები შეფუთვაზეც — ბაზა ჯვარედინი დაბინძურების გარანტიას ვერ იძლევა. წონა ეხება საკვებ ნაწილს; სახელში წერია მშრალია, უმია თუ მომზადებული. საყიდლების სია ამავე წონებს აჯამებს და მშრალ/უმ შესაძენ რაოდენობად არ გარდაქმნის.",
            "Check allergens on the packaging too — the database can't guarantee against cross-contamination. Weights refer to the edible part; the name says whether it's dry, raw or cooked. The shopping list adds up these same weights and doesn't convert them into dry/raw amounts to buy.",
          )}
        </NText>
        <NText style={{ color: M.c.text200, fontSize: 13.5, lineHeight: 21 }}>
          {tx(
            "კატალოგის მაჩვენებლები USDA SR Legacy-ს ცნობარზეა დაფუძნებული. მომზადება, ბრენდი და პორცია შედეგს ცვლის; ფოტოს შეფასებაც მიახლოებითია.",
            "Catalog values are based on the USDA SR Legacy reference. Cooking, brand and portion change the result; photo estimates are approximate too.",
          )}
        </NText>
      </NCard>
      <HubSection title={tx("წყაროები", "Sources")}>
        <NCard style={{ gap: 0, paddingVertical: 4 }}>
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
          ].map(([label, url], index) => (
            <Pressable
              key={url}
              accessibilityRole="link"
              accessibilityLabel={label}
              onPress={() => void Linking.openURL(url)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 50, borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderColor: M.c.bg300 }}
            >
              <NText style={{ flex: 1, fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14 }}>{label}</NText>
              <ExternalLink size={16} color={M.ink} />
            </Pressable>
          ))}
        </NCard>
      </HubSection>
    </NScreen>
  );
});
