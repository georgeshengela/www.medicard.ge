import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Info,
  Leaf,
  Trash2,
  Utensils,
  X,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { IMAGE_PICKER_OPTIONS } from "@/lib/imageUpload";
import { prepareNutritionImage } from "@/lib/nutritionImage";
import { NutritionScanner, NutritionScanSteps } from "@/components/nutrition/NutritionScanner";
import {
  foodTotals,
  localDay,
  mealLabels,
  shiftDay,
  scaleFood,
  type FoodItem,
  type Meal,
} from "@/lib/nutrition";
import { useThemeColors } from "@/theme/colors";
import { APP_MODAL_PROPS, APP_MODAL_OVERLAY } from "@/components/ui/appModal";
import { useAuth } from "@/store/AuthContext";

export default function Nutrition() {
  const { user } = useAuth();
  return <NutritionScreen key={user?.id || "guest"} />;
}
function NutritionScreen() {
  const c = useThemeColors(),
    safe = useSafeAreaInsets(),
    router = useRouter();
  const [day, setDay] = useState(localDay()),
    [meals, setMeals] = useState<Meal[]>([]),
    [draft, setDraft] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<{
      uri: string;
      name: string;
      mimeType: string;
    } | null>(null),
    [enabled, setEnabled] = useState(false),
    [explanation, setExplanation] = useState("");
  const [editing, setEditing] = useState<number | null>(null),
    [fields, setFields] = useState({
      name: "",
      grams: "100",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    });
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    action: () => void;
  } | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uncertainty, setUncertainty] = useState<"low" | "medium" | "high" | null>(null);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const alive = useRef(true),
    lock = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  const load = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    setMeals([]);
    setError("");
    try {
      const [data, config] = await Promise.all([
        api.nutrition.list(day),
        api.nutrition.settings().catch(() => ({ photoEnabled: false })),
      ]);
      if (!alive.current || gen !== generation.current) return;
      setMeals(data.meals);
      setEnabled(config.photoEnabled);
      if (data.truncated) setError("დღის ჩანაწერების ნაწილი ვერ გამოიტანა.");
    } catch (e) {
      if (alive.current && gen === generation.current)
        setError((e as Error).message);
    } finally {
      if (alive.current && gen === generation.current) setLoading(false);
    }
  }, [day]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const newMeal = () => {
    setDraft({
      id: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const n = Math.floor(Math.random() * 16);
        return (c === "x" ? n : (n & 3) | 8).toString(16);
      }),
      date: day,
      type: "lunch",
      items: [],
      note: "",
      source: "manual",
    });
    setPhoto(null);
    setExplanation("");
    setUncertainty(null);
    scroll.current?.scrollTo({y:0, animated:false});
    setMessage("");
    setError("");
    setEditing(null);
  };
  const close = () => {
    if (busy) return;
    const leave = () => {
      setDraft(null);
      setPhoto(null);
      setEditing(null);
      setError("");
    };
    if (draft) {
      Keyboard.dismiss();
      setConfirmation({
        title: "გამოსვლა?",
        message: "შეუნახავი ცვლილებები დაიკარგება.",
        action: leave,
      });
    } else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };
  useFocusEffect(
    useCallback(() => {
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy) return true;
        if (draft) {
          close();
          return true;
        }
        return false;
      });
      return () => back.remove();
    }, [busy, draft]),
  );
  const pick = (camera: boolean) =>
    run(async () => {
      const permission = await (camera
        ? ImagePicker.requestCameraPermissionsAsync()
        : ImagePicker.requestMediaLibraryPermissionsAsync());
      if (!permission.granted) {
        Alert.alert(
          "ფოტოზე წვდომა",
          "ფოტოს ასარჩევად ჩართე ნებართვა პარამეტრებში.",
          [
            { text: "დახურვა" },
            { text: "პარამეტრები", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
      const result = await (camera
        ? ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS)
        : ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS));
      if (result.canceled || !alive.current) return;
      const file = await prepareNutritionImage(result.assets[0]);
      if (file.size && file.size > 12 * 1024 * 1024)
        throw new Error("ფოტო 12 MB-ზე ნაკლები უნდა იყოს.");
      if (alive.current) {
        setPhoto(file);
        scroll.current?.scrollTo({y:0, animated:true});
        void Haptics.selectionAsync().catch(() => {});
      }
    });
  const analyze = () =>
    run(async () => {
      if (!photo || !draft) return;
      if (!alive.current) return;
      Keyboard.dismiss();
      scroll.current?.scrollTo({y:0, animated:true});
      setScanning(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try {
        const result = await api.nutrition.estimate(photo, draft.note);
        if (!alive.current) return;
        if (!result.foodDetected) throw new Error("საკვები მკაფიოდ ვერ ამოვიცანი. გადაიღე სხვა ფოტო ან დაამატე ხელით.");
        setDraft({ ...draft, source: "photo", items: result.items });
        setExplanation(result.explanation);
        setUncertainty(result.uncertainty);
        scroll.current?.scrollTo({y:0, animated:true});
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        throw e;
      } finally {
        if (alive.current) setScanning(false);
      }
    });
  const editItem = (index: number) => {
    const i = draft?.items[index];
    setEditing(index);
    setFields(
      i
        ? (Object.fromEntries(
            Object.entries(i).map(([k, v]) => [k, String(v)]),
          ) as typeof fields)
        : {
            name: "",
            grams: "100",
            calories: "",
            protein: "",
            carbs: "",
            fat: "",
          },
    );
    setError("");
    scroll.current?.scrollTo({y:0, animated:false});
  };
  const applyItem = () => {
    if (!draft || editing === null) return;
    const number = (key: keyof typeof fields) =>
      Number(fields[key].replace(",", "."));
    const item: FoodItem = {
      name: fields.name.trim(),
      grams: number("grams"),
      calories: number("calories"),
      protein: number("protein"),
      carbs: number("carbs"),
      fat: number("fat"),
    };
    if (
      !item.name ||
      item.name.length > 120 ||
      Object.keys(item).some(
        (k) =>
          k !== "name" &&
          (!fields[k as keyof typeof fields].trim() ||
            !Number.isFinite(item[k as keyof FoodItem]) ||
            Number(item[k as keyof FoodItem]) < 0 ||
            Number(item[k as keyof FoodItem]) > 10000),
      ) ||
      item.grams <= 0
    ) {
      setError(
        "შეავსე სახელი და ყველა რიცხვი. უცნობი მონაცემის ნაცვლად ვარაუდი არ შეინახო.",
      );
      return;
    }
    const items = [...draft.items];
    items[editing] = item;
    setDraft({ ...draft, items });
    Keyboard.dismiss();
    setEditing(null);
    setError("");
    scroll.current?.scrollTo({y:0, animated:false});
  };
  const save = () =>
    run(async () => {
      if (!draft || !draft.items.length) return;
      await api.nutrition.save(draft);
      if (!alive.current) return;
      setDraft(null);
      setPhoto(null);
      setMessage("კვება შენახულია");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await load();
    });
  const remove = (meal: Meal) =>
    setConfirmation({
      title: "ჩანაწერის წაშლა?",
      message: "ეს კვება დღიურიდან წაიშლება.",
      action: () =>
        void run(async () => {
          await api.nutrition.remove(meal.id);
          if (alive.current) await load();
        }),
    });
  const sum = foodTotals(draft?.items || meals.flatMap((m) => m.items));
  const txt = { color: c.text100, fontFamily: "NotoSansGeorgian_400Regular" };
  const button = (
    label: string,
    action: () => void,
    primary = false,
    disabled = false,
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={action}
      style={[
        s.button,
        {
          backgroundColor: primary ? "#0F766E" : c.bg200,
          opacity: busy || disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={[
          txt,
          { color: primary ? "#fff" : c.text100, fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const inputStyle = [
    s.input,
    { backgroundColor: c.bg200, color: c.text100, borderColor: c.bg300 },
  ];
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: c.bg100, paddingTop: safe.top }}
    >
      <View style={s.header}>
        <Pressable
          accessibilityLabel="უკან"
          onPress={close}
          disabled={busy}
          style={s.icon}
        >
          <ArrowLeft color={c.text100} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[txt, s.title]}>კვების დღიური</Text>
          <Text style={[txt, { fontSize: 12, color: c.text200 }]}>
            {draft ? draft.items.length ? "გადაამოწმე და შეინახე" : "გადაიღე, გადაამოწმე, შეინახე" : "შენი კვება, უკეთ გასაგებად"}
          </Text>
        </View>
        <Leaf size={25} color={c.primary100} />
      </View>
      <ScrollView
        ref={scroll}
        pointerEvents={busy ? "none" : "auto"}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 18, gap: 18, paddingBottom: 24, width:"100%", maxWidth:640, alignSelf:"center" }}
      >
        {!!error && (
          <View
            accessibilityRole="alert"
            style={[s.card, { backgroundColor: c.dangerBg }]}
          >
            <Text style={[txt, { color: c.danger }]}>{error}</Text>
            {!draft && button("ხელახლა ცდა", () => void load())}
          </View>
        )}
        {!!message && !draft && (
          <Text
            accessibilityLiveRegion="polite"
            style={[txt, { color: c.success }]}
          >
            {message}
          </Text>
        )}
        {!draft && (
          <View style={s.row}>
            <Pressable
              accessibilityLabel="წინა დღე"
              onPress={() => setDay(shiftDay(day, -1))}
              style={s.icon}
            >
              <ChevronLeft color={c.text100} />
            </Pressable>
            <Text
              style={[txt, { flex: 1, textAlign: "center", fontWeight: "600" }]}
            >
              {day === localDay()
                ? "დღეს"
                : new Date(day + "T12:00:00").toLocaleDateString("ka-GE", {
                    day: "numeric",
                    month: "long",
                  })}
            </Text>
            <Pressable
              accessibilityLabel="შემდეგი დღე"
              disabled={day >= localDay()}
              onPress={() => setDay(shiftDay(day, 1))}
              style={[s.icon, { opacity: day >= localDay() ? 0.3 : 1 }]}
            >
              <ChevronRight color={c.text100} />
            </Pressable>
          </View>
        )}
        {draft && editing === null && <NutritionScanSteps stage={draft.items.length ? 1 : 0} />}
        {draft && draft.items.length > 0 && editing === null && !!explanation && (
          <View style={[s.row, {alignItems:"flex-start"}]}>
            {photo && <Image source={{uri:photo.uri}} style={{width:56,height:56,borderRadius:14,backgroundColor:c.bg200}} />}
            <View style={{flex:1,gap:4}}>
              <View style={s.row}><CircleCheck size={17} color={c.primary100} /><Text style={[txt,{fontFamily:"NotoSansGeorgian_600SemiBold",fontSize:16}]}>შეფასება მზადაა</Text></View>
              <Text style={[txt,{fontSize:12,lineHeight:20,color:c.text200}]}>გადაამოწმე საკვები და პორცია, შემდეგ შეინახე.</Text>
            </View>
          </View>
        )}
        {editing === null && (!draft || draft.items.length > 0) && (
          <View
            style={[
              s.card,
              {
                backgroundColor: c.surface,
                borderColor: c.bg300,
                borderWidth: 1,
              },
            ]}
          >
            <View style={s.row}>
              <Utensils color={c.primary100} size={21} />
              <Text style={[txt, { color: c.text200 }]}>
                {draft ? "არჩეული პორცია" : "აღრიცხული ენერგია"}
              </Text>
            </View>
            <Text
              style={[
                txt,
                { fontSize: 40, fontWeight: "700", marginVertical: 8 },
              ]}
            >
              {sum.calories}
              <Text style={{ fontSize: 16, fontWeight: "400" }}> კკალ</Text>
            </Text>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              {[
                ["ცილა", sum.protein],
                ["ნახშირწყლები", sum.carbs],
                ["ცხიმი", sum.fat],
              ].map(([label, value]) => (
                <View key={label}>
                  <Text style={[txt, { fontSize: 12, color: c.text200 }]}>
                    {label}
                  </Text>
                  <Text style={[txt, { fontWeight: "600", marginTop: 4 }]}>
                    {value} გ
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {loading && !draft ? <ActivityIndicator color={c.primary200} /> : null}
        {!draft && !loading && (
          <>
            {meals.length === 0 && !error && (
              <View
                style={{ alignItems: "center", gap: 12, paddingVertical: 22 }}
              >
                <Camera size={38} color={c.primary100} />
                <Text style={[txt, { fontSize: 19, fontWeight: "600" }]}>
                  რას მიირთმევ დღეს?
                </Text>
                <Text
                  style={[
                    txt,
                    { textAlign: "center", color: c.text200, lineHeight: 22 },
                  ]}
                >
                  გადაიღე კერძი ან შეავსე ხელით. ფოტოს შეფასებას შენახვამდე
                  გადაამოწმებ.
                </Text>
              </View>
            )}
            {meals.map((meal) => (
              <View
                key={meal.id}
                style={[s.card, { backgroundColor: c.surface }]}
              >
                <View style={s.row}>
                  <Utensils color={c.primary100} size={18} />
                  <Text style={[txt, { flex: 1, fontWeight: "600" }]}>
                    {mealLabels[meal.type]}
                  </Text>
                  <Pressable
                    accessibilityLabel="კვების წაშლა"
                    onPress={() => remove(meal)}
                    disabled={busy}
                    style={s.icon}
                  >
                    <Trash2 size={18} color={c.text200} />
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDraft(meal);
                    setEditing(null);
                    setExplanation("");
                    setPhoto(null);
                  }}
                >
                  <Text style={[txt, { fontSize: 17, marginVertical: 8 }]}>
                    {meal.items.map((i) => i.name).join(" · ")}
                  </Text>
                  <Text style={[txt, { color: c.text200 }]}>
                    {foodTotals(meal.items).calories} კკალ ·{" "}
                    {meal.source === "photo"
                      ? "ფოტოდან შეფასებული"
                      : meal.source === "plan" ? "რაციონის მიხედვით" : "ხელით დამატებული"}{" "}
                    · რედაქტირება
                  </Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
        {draft && editing === null && (
          <>
            {draft.items.length === 0 && (
              <NutritionScanner photoUri={photo?.uri} scanning={scanning} disabled={busy} enabled={enabled} onCamera={() => void pick(true)} onGallery={() => void pick(false)} />
            )}
            <View style={s.row}>
              {Object.entries(mealLabels).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.type === key }}
                  accessibilityLabel={label}
                  onPress={() =>
                    setDraft({ ...draft, type: key as Meal["type"] })
                  }
                  style={[
                    s.chip,
                    {
                      backgroundColor:
                        draft.type === key ? c.accent100 : c.bg200,
                      borderColor: draft.type === key ? c.primary100 : c.bg300,
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={[txt, { fontSize: 12 }]}>{key === "snack" ? "ხემსი" : label}</Text>
                </Pressable>
              ))}
            </View>
            {!!explanation && (
              <View style={[s.row,{alignItems:"flex-start",padding:14,borderRadius:16,backgroundColor:c.bg200}]}>
                <Info size={18} color={c.primary100} />
                <View style={{flex:1,gap:5}}>
                  <Text style={[txt,{fontSize:12,fontFamily:"NotoSansGeorgian_600SemiBold"}]}>{uncertainty === "high" ? "პორცია განსაკუთრებით ყურადღებით გადაამოწმე" : "ფოტოს შეფასება მიახლოებითია"}</Text>
                  <Text style={[txt,{color:c.text200,lineHeight:20,fontSize:12}]}>{explanation}</Text>
                </View>
              </View>
            )}
            {draft.items.map((item, index) => (
              <View
                key={index}
                style={[s.card, { backgroundColor: c.surface, gap: 12 }]}
              >
                <View style={s.row}>
                  <Text
                    style={[txt, { flex: 1, fontWeight: "600", fontSize: 17 }]}
                  >
                    {item.name}
                  </Text>
                  <Pressable
                    accessibilityLabel="საკვების ამოშლა"
                    onPress={() =>
                      setDraft({
                        ...draft,
                        items: draft.items.filter((_, n) => n !== index),
                      })
                    }
                    style={s.icon}
                  >
                    <X color={c.text200} size={18} />
                  </Pressable>
                </View>
                <Text style={[txt, { color: c.text200 }]}>
                  {item.grams} გ · {Math.round(item.calories)} კკალ
                </Text>
                <View style={s.row}>
                  {button("½", () =>
                    setDraft({
                      ...draft,
                      items: draft.items.map((v, n) =>
                        n === index
                          ? scaleFood(v, Math.max(0.1, v.grams / 2))
                          : v,
                      ),
                    }),
                  )}
                  {button("×2", () => {
                    if (item.grams * 2 > 10000) {
                      setError("პორცია ზედმეტად დიდია.");
                      return;
                    }
                    setDraft({
                      ...draft,
                      items: draft.items.map((v, n) =>
                        n === index ? scaleFood(v, v.grams * 2) : v,
                      ),
                    });
                  })}
                  {button("შესწორება", () => editItem(index))}
                </View>
              </View>
            ))}
            {draft.items.length > 0 && draft.items.length < 25 &&
              button("+ საკვების ხელით დამატება", () =>
                editItem(draft.items.length),
              )}
            <Text style={[txt, { fontWeight: "600", fontSize:13 }]}>
              {draft.items.length ? "შენიშვნა" : "რა დაგვეხმარება შეფასებაში? (არასავალდებულო)"}
            </Text>
            <TextInput
              accessibilityLabel="პორციის აღწერა"
              placeholder="მაგ. ორი ნაჭერი, სოუსის გარეშე"
              placeholderTextColor={c.text200}
              value={draft.note}
              onChangeText={(note) => setDraft({ ...draft, note })}
              maxLength={500}
              multiline
              style={[inputStyle, { minHeight: 62, fontSize:14 }]}
            />
          </>
        )}
        {draft && editing !== null && (
          <View style={{ gap: 12 }}>
            <Text style={[txt, { fontSize: 20, fontWeight: "600" }]}>
              საკვების მონაცემები
            </Text>
            <Text style={[txt, { color: c.text200 }]}>
              მიუთითე მთლიანი პორციის მნიშვნელობები, არა 100 გრამის. ეტიკეტიდან
              შეგიძლია გადაიტანო.
            </Text>
            {Object.entries({
              name: "საკვების სახელი",
              grams: "პორცია · გრამი",
              calories: "ენერგია · კკალ",
              protein: "ცილა · გ",
              carbs: "ნახშირწყლები · გ",
              fat: "ცხიმი · გ",
            }).map(([key, label]) => (
              <View key={key} style={{ gap: 6 }}>
                <Text numberOfLines={1} style={[txt, { fontSize: 12 }]}>{key === "snack" ? "ხემსი" : label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  testID={`nutrition-field-${key}`}
                  value={fields[key as keyof typeof fields]}
                  maxLength={key === "name" ? 120 : 8}
                  onChangeText={(value) =>
                    setFields({ ...fields, [key]: value })
                  }
                  keyboardType={key === "name" ? "default" : "decimal-pad"}
                  style={inputStyle}
                />
              </View>
            ))}
            {button("გაუქმება", () => {
              setEditing(null);
              setError("");
            })}
          </View>
        )}
        <Text style={[txt, { fontSize: 12, color: c.text200, lineHeight: 19 }]}>
          ფოტოს მიხედვით კალორიები და საკვები ნივთიერებები სავარაუდოა. ეს არ
          არის სამედიცინო ან დიეტოლოგიური დანიშნულება.
        </Text>
      </ScrollView>
      <View
        style={{
          padding: 16,
          paddingBottom: keyboardOpen ? 10 : Math.max(safe.bottom, 12),
          borderTopWidth: 1,
          borderColor: c.bg300,
          backgroundColor: c.surface,
        }}
      >
        {busy ? (
          <View style={s.row}>
            <ActivityIndicator color={c.primary200} />
            <Text style={[txt,{fontSize:13}]}>{scanning ? "მიმდინარეობს ფოტოს შეფასება…" : "მიმდინარეობს…"}</Text>
          </View>
        ) : editing !== null ? (
          button("საკვების დადასტურება", applyItem, true)
        ) : draft && !draft.items.length ? (
          <View style={{gap:8}}>
            {photo && enabled && button(error ? "შეფასების ხელახლა ცდა" : "შეფასების დაწყება", () => void analyze(), true)}
            {button("საკვების ხელით დამატება", () => editItem(0))}
          </View>
        ) : draft ? (
          button(
            "დღიურში შენახვა",
            () => void save(),
            true,
            !draft.items.length,
          )
        ) : (
          button("კვების დამატება", newMeal, true, loading)
        )}
      </View>
      <Stack.Screen options={{ gestureEnabled: !draft && !busy }} />
      <Modal
        visible={!!confirmation}
        {...APP_MODAL_PROPS}
        onRequestClose={() => setConfirmation(null)}
      >
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: APP_MODAL_OVERLAY },
            ]}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: c.surface,
              borderRadius: 24,
              padding: 24,
              gap: 16,
            }}
          >
            <Text style={[txt, { fontSize: 20, fontWeight: "700" }]}>
              {confirmation?.title}
            </Text>
            <Text style={[txt, { color: c.text200, lineHeight: 22 }]}>
              {confirmation?.message}
            </Text>
            {button("გაუქმება", () => setConfirmation(null))}
            {button(
              "დადასტურება",
              () => {
                const action = confirmation?.action;
                setConfirmation(null);
                action?.();
              },
              true,
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  card: { padding: 18, borderRadius: 22 },
  button: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 10,
    minHeight:44,
    borderRadius: 14,
    borderWidth: 1,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    minHeight: 48,
  },
});
