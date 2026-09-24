import React from "react";
import { Pressable, View } from "react-native";
import { Check, Leaf } from "lucide-react-native";
import { useThemeColors } from "@/theme/colors";
import {
  allergenLabels,
  type AllergyClarification,
} from "@/lib/nutritionProgram";
import { NCard, NText } from "./ProgramUI";

export function AllergyReview({
  labels,
  value,
  onChange,
}: {
  labels: string[];
  value: AllergyClarification[];
  onChange: (value: AllergyClarification[]) => void;
}) {
  const c = useThemeColors();
  if (!labels.length) return null;
  const set = (answer: AllergyClarification) =>
    onChange([...value.filter((v) => v.label !== answer.label), answer]);
  return (
    <NCard>
      <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
        <Leaf size={20} color={c.primary100} />
        <NText style={{ flex: 1, fontFamily: "NotoSansGeorgian_600SemiBold" }}>
          პროფილის ალერგიები დავაზუსტოთ
        </NText>
      </View>
      <NText style={{ fontSize: 12, color: c.text200 }}>
        პროფილში საკვების გარდა სხვა ალერგიაც შეიძლება გქონდეს. თითოეულ
        ჩანაწერზე აირჩიე შესაბამისი პასუხი. პროფილის ჩანაწერს არ შევცვლით.
      </NText>
      {labels.map((label) => {
        const answer = value.find((v) => v.label === label);
        return (
          <View
            key={label}
            style={{
              gap: 9,
              paddingTop: 10,
              borderTopWidth: 1,
              borderColor: c.bg300,
            }}
          >
            <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
              „{label}“
            </NText>
            {(
              [
                ["non_food", "საკვებს არ უკავშირდება"],
                ["food", "საკვებსაც უკავშირდება"],
                ["unsure", "ჯერ არ ვიცი"],
              ] as const
            ).map(([kind, text]) => (
              <Pressable
                key={kind}
                accessibilityRole="radio"
                accessibilityLabel={`${label}: ${text}`}
                accessibilityState={{ checked: answer?.kind === kind }}
                onPress={() =>
                  set({
                    label,
                    kind,
                    allergens: kind === "food" ? answer?.allergens || [] : [],
                  })
                }
                style={{
                  minHeight: 46,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: answer?.kind === kind ? c.primary100 : c.bg300,
                  backgroundColor:
                    answer?.kind === kind ? c.accent100 : c.bg100,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View style={{ width: 18 }}>
                  {answer?.kind === kind && (
                    <Check size={17} color={c.primary100} />
                  )}
                </View>
                <NText style={{ fontSize: 13, flex: 1 }}>{text}</NText>
              </Pressable>
            ))}
            {answer?.kind === "food" && (
              <>
                <NText style={{ fontSize: 12 }}>
                  რომელი ალერგენები შეესაბამება ამ ჩანაწერს?
                </NText>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}
                >
                  {Object.entries(allergenLabels).map(([key, text]) => (
                    <Pressable
                      key={key}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`${label}: ${text}`}
                      accessibilityState={{
                        checked: answer.allergens.includes(key),
                      }}
                      onPress={() =>
                        set({
                          ...answer,
                          allergens: answer.allergens.includes(key)
                            ? answer.allergens.filter((a) => a !== key)
                            : [...answer.allergens, key],
                        })
                      }
                      style={{
                        minHeight: 44,
                        padding: 11,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: answer.allergens.includes(key)
                          ? c.primary100
                          : c.bg300,
                        backgroundColor: answer.allergens.includes(key)
                          ? c.accent100
                          : c.bg100,
                      }}
                    >
                      <NText style={{ fontSize: 12 }}>
                        {answer.allergens.includes(key) ? "✓ " : ""}
                        {text}
                      </NText>
                    </Pressable>
                  ))}
                </View>
                <NText style={{ fontSize: 12, color: c.text200 }}>
                  თუ შესაბამისი საკვები სიაში არ არის, არჩევანი ცარიელი დატოვე.
                  ავტომატურ რაციონს ვერ შევადგენთ, მაგრამ დღის სამიზნესა და
                  დღიურს გამოიყენებ.
                </NText>
              </>
            )}
          </View>
        );
      })}
      <NText style={{ fontSize: 12, color: c.text200 }}>
        თუ დარწმუნებული არ ხარ, აირჩიე „ჯერ არ ვიცი“. საკვებთან კავშირს ალერგიის
        სახელიდან არ ვივარაუდებთ.
      </NText>
    </NCard>
  );
}
