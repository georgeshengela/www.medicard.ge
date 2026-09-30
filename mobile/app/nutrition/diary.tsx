import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  CopyPlus,
  Info,
  Leaf,
  Plus,
  Sparkles,
  Trash2,
  Utensils,
  Wand2,
  X,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { EMPTY_ART } from "@/constants/appArt";
import { dateLocale, tx } from "@/i18n/locale";
import { IMAGE_PICKER_OPTIONS } from "@/lib/imageUpload";
import { prepareNutritionImage } from "@/lib/nutritionImage";
import { NutritionScanner, NutritionScanSteps } from "@/components/nutrition/NutritionScanner";
import { LogMethodSheet, type LogMethod } from "@/components/nutrition/LogMethodSheet";
import { BarcodeScannerModal } from "@/components/nutrition/BarcodeScannerModal";
import { FoodSearchModal, type FoodPick } from "@/components/nutrition/FoodSearchModal";
import { DescribeMealModal } from "@/components/nutrition/DescribeMealModal";
import { PortionSheet } from "@/components/nutrition/PortionSheet";
import { MacroLine, QuickLogTiles, ScoreBadge } from "@/components/nutrition/NutritionUi";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { CopyMealsSheet } from "@/components/nutrition/CopyMealsSheet";
import { removeMealFromHealth, syncMealsToHealth } from "@/lib/nutritionHealth";
import {
  foodTotals,
  localDay,
  mealLabels,
  mealTypeForHour,
  shiftDay,
  scaleFood,
  mealEditSnapshot,
  foodEditSnapshot,
  foodFields,
  itemFromFields,
  healthScore,
  newUuid,
  sourceLabels,
  upsertDayMeals,
  withoutMeal,
  type FoodItem,
  type Meal,
  type MealSource,
  type SavedFood,
} from "@/lib/nutrition";
import { useThemeColors } from "@/theme/colors";
import { hubText } from "@/theme/hub";
import { APP_MODAL_PROPS, APP_MODAL_OVERLAY, Modal } from "@/components/ui/appModal";
import { useAuth } from "@/store/AuthContext";
import { useAccountQuery } from "@/hooks/useAccountQuery";
import { accountKey, FRESH, queryClient } from "@/lib/queryClient";

type DayMeals = { meals: Meal[]; truncated: boolean };
const EMPTY_MEALS: Meal[] = [];
const mealsKey = (date: string) => ["nutrition", "meals", date];
const fetchDayMeals = (date: string): Promise<DayMeals> => api.nutrition.list(date);
/** Put a change into the cached day list at once (the write's invalidation then confirms it from the server). */
function patchDayMeals(date: string, patch: (list: Meal[]) => Meal[]) {
  queryClient.setQueryData<DayMeals>(accountKey(...mealsKey(date)), (old) => (old ? { ...old, meals: patch(old.meals) } : old));
}
/** Home's nutrition card is not on screen while the diary is; re-read its totals now so they are ready on return. */
function refreshNutritionDashboard() {
  void queryClient.refetchQueries({ queryKey: accountKey("nutrition", "dashboard"), type: "all" }).catch(() => undefined);
}

type Photo = { uri: string; name: string; mimeType: string; size?: number };
type Sheet = null | "methods" | "barcode" | "search" | "saved" | "describe";

export default function Nutrition() {
  const { user } = useAuth();
  return <NutritionScreen key={user?.id || "guest"} owner={user?.id || ""} />;
}
function NutritionScreen({ owner }: { owner: string }) {
  const c = useThemeColors(),
    safe = useSafeAreaInsets(),
    router = useRouter();
  const params = useLocalSearchParams<{ method?: string }>();
  const [day, setDay] = useState(localDay()),
    [draft, setDraft] = useState<Meal | null>(null);
  const [busy, setBusy] = useState(false),
    [actionError, setError] = useState(""),
    [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null),
    [photoMode, setPhotoMode] = useState<"photo" | "label">("photo"),
    [explanation, setExplanation] = useState("");
  // Day list and photo setting from the shared cache: a revisit shows them at once and re-reads only when stale.
  const mealsQuery = useAccountQuery<DayMeals>({
    key: mealsKey(day),
    fetch: () => fetchDayMeals(day),
    staleTime: FRESH.SHORT,
    enabled: Boolean(owner),
  });
  const settingsQuery = useAccountQuery<{ photoEnabled: boolean }>({
    key: ["nutrition", "settings"],
    fetch: () => api.nutrition.settings().catch(() => ({ photoEnabled: false })),
    staleTime: FRESH.LONG,
    enabled: Boolean(owner),
  });
  const meals = mealsQuery.data?.meals ?? EMPTY_MEALS;
  const enabled = settingsQuery.data?.photoEnabled ?? false;
  const loading = mealsQuery.isPending && mealsQuery.fetchStatus !== "idle";
  const loadError = mealsQuery.data
    ? mealsQuery.data.truncated
      ? tx("დღის ჩანაწერების ნაწილი ვერ გამოიტანა.", "Some of this day's entries couldn't be loaded.")
      : ""
    : mealsQuery.error
      ? (mealsQuery.error as Error).message
      : "";
  const error = actionError || loadError;
  const [editing, setEditing] = useState<number | null>(null),
    [fields, setFields] = useState(foodFields());
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uncertainty, setUncertainty] = useState<"low" | "medium" | "high" | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sheetError, setSheetError] = useState("");
  const [product, setProduct] = useState<SavedFood | null>(null);
  const [correction, setCorrection] = useState("");
  const [savedItems, setSavedItems] = useState<Record<string, boolean>>({});
  const [copying, setCopying] = useState<Meal[] | null>(null);
  const [copyError, setCopyError] = useState("");
  const scroll = useRef<ScrollView>(null);
  const mealBaseline = useRef("");
  const itemBaseline = useRef("");
  const openMeal = (meal: Meal) => {
    mealBaseline.current = mealEditSnapshot(meal);
    setDraft(meal);
  };
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const alive = useRef(true),
    lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  /** Explicit reload (retry, after a change here): always re-reads the day. */
  const { refetch: refetchMeals } = mealsQuery;
  const load = useCallback(async () => {
    setError("");
    await refetchMeals();
  }, [refetchMeals]);
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
  const resetResult = () => {
    setPhoto(null);
    setPhotoMode("photo");
    setExplanation("");
    setUncertainty(null);
    setCorrection("");
    setSavedItems({});
  };
  const newMeal = (openMethods = true) => {
    openMeal({
      id: newUuid(),
      date: day,
      type: day === localDay() ? mealTypeForHour(new Date().getHours()) : "lunch",
      items: [],
      note: "",
      title: "",
      source: "manual",
    });
    resetResult();
    scroll.current?.scrollTo({ y: 0, animated: false });
    setMessage("");
    setError("");
    setEditing(null);
    if (openMethods) setSheet("methods");
  };
  const close = () => {
    if (lock.current) return;
    Keyboard.dismiss();
    if (editing !== null) {
      const leaveItem = () => {
        setEditing(null);
        setError("");
      };
      if (foodEditSnapshot(fields) !== itemBaseline.current)
        setConfirmation({ title: tx("შესწორების გაუქმება?", "Discard your edits?"), message: tx("საკვების შეუნახავი ცვლილებები დაიკარგება.", "Unsaved changes to this food will be lost."), action: leaveItem });
      else leaveItem();
      return;
    }
    const leave = () => {
      setDraft(null);
      resetResult();
      setEditing(null);
      setError("");
    };
    if (draft) {
      if (mealEditSnapshot(draft) !== mealBaseline.current || photo)
        setConfirmation({ title: tx("გამოსვლა?", "Leave?"), message: tx("შეუნახავი ცვლილებები დაიკარგება.", "Unsaved changes will be lost."), action: leave });
      else leave();
    } else if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };
  useFocusEffect(
    useCallback(() => {
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy) return true;
        if (sheet) {
          setSheet(null);
          return true;
        }
        if (draft) {
          close();
          return true;
        }
        return false;
      });
      return () => back.remove();
    }, [busy, draft, editing, fields, photo, sheet]),
  );
  /** Merge items into the draft: appended when reviewing, replacing an empty draft. */
  const addItems = (items: FoodItem[], source: MealSource, title?: string) => {
    setDraft((current) => {
      if (!current) return current;
      const merged = [...current.items, ...items].slice(0, 25);
      return {
        ...current,
        items: merged,
        source: current.items.length ? current.source : source,
        title: current.title || title || "",
      };
    });
    setMessage("");
    scroll.current?.scrollTo({ y: 0, animated: true });
    void Haptics.selectionAsync().catch(() => {});
  };
  const pick = (camera: boolean, mode: "photo" | "label") =>
    run(async () => {
      const permission = await (camera ? ImagePicker.requestCameraPermissionsAsync() : ImagePicker.requestMediaLibraryPermissionsAsync());
      if (!permission.granted) {
        Alert.alert(tx("ფოტოზე წვდომა", "Photo access"), tx("ფოტოს ასარჩევად ჩართე ნებართვა პარამეტრებში.", "To choose a photo, allow access in Settings."), [
          { text: tx("დახურვა", "Close") },
          { text: tx("პარამეტრები", "Settings"), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      const result = await (camera ? ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS) : ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS));
      if (result.canceled || !alive.current) return;
      const file = await prepareNutritionImage(result.assets[0]);
      if (file.size && file.size > 12 * 1024 * 1024) throw new Error(tx("ფოტო 12 MB-ზე ნაკლები უნდა იყოს.", "The photo must be under 12 MB."));
      if (alive.current) {
        setPhoto(file);
        setPhotoMode(mode);
        scroll.current?.scrollTo({ y: 0, animated: true });
        void Haptics.selectionAsync().catch(() => {});
      }
    });
  const applyEstimate = (result: Awaited<ReturnType<typeof api.nutrition.estimate>>, source: MealSource, replace: boolean) => {
    if (!result.foodDetected || !result.items.length)
      throw new Error(source === "label" ? tx("ეტიკეტი მკაფიოდ ვერ წავიკითხე. სცადე უფრო ახლოდან ან შეიყვანე ხელით.", "I couldn't read the label clearly. Try closer up or enter it by hand.") : source === "text" || source === "voice" ? tx("აღწერიდან საკვები ვერ ამოვიცანი. სცადე უფრო კონკრეტულად.", "I couldn't recognize the food from your description. Try being more specific.") : tx("საკვები მკაფიოდ ვერ ამოვიცანი. გადაიღე სხვა ფოტო ან დაამატე ხელით.", "I couldn't clearly recognize the food. Take another photo or add it by hand."));
    setDraft((current) =>
      current
        ? {
            ...current,
            source: replace ? source : current.items.length ? current.source : source,
            items: replace ? result.items : [...current.items, ...result.items].slice(0, 25),
            title: replace ? result.dishName || current.title || "" : current.title || result.dishName || "",
          }
        : current,
    );
    setExplanation(result.explanation);
    setUncertainty(result.uncertainty);
    setSavedItems({});
    scroll.current?.scrollTo({ y: 0, animated: true });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const analyze = () =>
    run(async () => {
      if (!photo || !draft || !alive.current) return;
      Keyboard.dismiss();
      scroll.current?.scrollTo({ y: 0, animated: true });
      setScanning(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      try {
        const result = await api.nutrition.estimate(photo, { mode: photoMode, description: draft.note });
        if (!alive.current) return;
        applyEstimate(result, photoMode === "label" ? "label" : "photo", !draft.items.length);
      } catch (e) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        throw e;
      } finally {
        if (alive.current) setScanning(false);
      }
    });
  const describe = (text: string, voice: boolean) =>
    run(async () => {
      if (!draft) return;
      setSheetError("");
      try {
        const result = await api.nutrition.estimate(null, { mode: "text", description: text });
        if (!alive.current) return;
        applyEstimate(result, voice ? "voice" : "text", !draft.items.length);
        setDraft((current) => (current ? { ...current, note: current.note || text } : current));
        setSheet(null);
      } catch (e) {
        setSheetError((e as Error).message);
        throw e;
      }
    });
  const fix = () =>
    run(async () => {
      const text = correction.trim();
      if (!draft || !draft.items.length || text.length < 2) return;
      Keyboard.dismiss();
      setScanning(true);
      try {
        const result = await api.nutrition.estimate(photo, { mode: "fix", correction: text, description: draft.note, previous: draft.items });
        if (!alive.current) return;
        applyEstimate(result, draft.source, true);
        setCorrection("");
      } finally {
        if (alive.current) setScanning(false);
      }
    });
  const lookupBarcode = (code: string) =>
    run(async () => {
      setSheetError("");
      try {
        const { product: found } = await api.nutrition.barcode(code);
        if (!alive.current) return;
        setProduct(found);
      } catch (e) {
        setSheetError((e as Error).message);
      }
    });
  const pickMethod = (method: LogMethod) => {
    setSheet(null);
    setSheetError("");
    if (method === "camera") void pick(true, "photo");
    else if (method === "gallery") void pick(false, "photo");
    else if (method === "label") void pick(true, "label");
    else if (method === "barcode") setTimeout(() => setSheet("barcode"), 250);
    else if (method === "describe") setTimeout(() => setSheet("describe"), 250);
    else if (method === "search") setTimeout(() => setSheet("search"), 250);
    else if (method === "saved") setTimeout(() => setSheet("saved"), 250);
    else editItem(draft?.items.length || 0);
  };
  /** One tap from Home or the hub: a fresh meal with that method already running. */
  const startWith = (method: LogMethod) => {
    if (busy) return;
    newMeal(false);
    setTimeout(() => pickMethod(method), 50);
  };
  const handledMethod = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const method = typeof params.method === "string" ? params.method : "";
      if (!method || handledMethod.current === method) return;
      handledMethod.current = method;
      if (!draft) startWith(method as LogMethod);
      router.setParams({ method: "" });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.method]),
  );
  const onFoodPick = (pickResult: FoodPick) => {
    setSheet(null);
    addItems(pickResult.items, pickResult.source, pickResult.title);
    if (pickResult.foodIds.length) void api.nutrition.foods.used(pickResult.foodIds).catch(() => {});
  };
  const editItem = (index: number) => {
    const i = draft?.items[index];
    setEditing(index);
    const nextFields = foodFields(i);
    itemBaseline.current = foodEditSnapshot(nextFields);
    setFields(nextFields);
    setError("");
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const applyItem = () => {
    if (!draft || editing === null) return;
    const { item, error: problem } = itemFromFields(fields);
    if (!item) {
      setError(problem);
      return;
    }
    const items = [...draft.items];
    items[editing] = item;
    setDraft({ ...draft, items });
    Keyboard.dismiss();
    setEditing(null);
    setError("");
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const save = () =>
    run(async () => {
      if (!draft || !draft.items.length) return;
      const { meal: saved } = await api.nutrition.save(draft);
      void import('@/lib/funnel').then(({ trackFirstHealthAction }) => trackFirstHealthAction('meal')).catch(() => undefined);
      void syncMealsToHealth([saved]);
      if (!alive.current) return;
      patchDayMeals(saved.date, (list) => upsertDayMeals(list, [saved], saved.date));
      refreshNutritionDashboard();
      setDraft(null);
      resetResult();
      setMessage(tx("კვება შენახულია", "Meal saved"));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
  const saveItemAsFood = (item: FoodItem, index: number) =>
    run(async () => {
      await api.nutrition.foods.fromItem(item, true);
      if (alive.current) setSavedItems((s) => ({ ...s, [index]: true }));
      void Haptics.selectionAsync().catch(() => {});
    });
  const remove = (meal: Meal) =>
    setConfirmation({
      title: tx("ჩანაწერის წაშლა?", "Delete this entry?"),
      message: tx("ეს კვება დღიურიდან წაიშლება.", "This meal will be removed from your diary."),
      action: () =>
        void run(async () => {
          await api.nutrition.remove(meal.id);
          void removeMealFromHealth(meal.id);
          patchDayMeals(meal.date, (list) => withoutMeal(list, meal.id));
          refreshNutritionDashboard();
        }),
    });
  /** Copy the chosen meals with fresh ids; a retry after a network error reuses them. */
  const copyIds = useRef<Record<string, string>>({});
  const copyMeals = (date: string, type?: Meal["type"]) =>
    run(async () => {
      if (!copying?.length) return;
      setCopyError("");
      try {
        const copies = copying.map((m) => {
          const key = `${m.id}:${date}:${type || ""}`;
          copyIds.current[key] = copyIds.current[key] || newUuid();
          return { fromId: m.id, id: copyIds.current[key] };
        });
        const { meals: created } = await api.nutrition.copy({ date, type, copies });
        copyIds.current = {};
        void syncMealsToHealth(created);
        patchDayMeals(date, (list) => upsertDayMeals(list, created, date));
        refreshNutritionDashboard();
        if (!alive.current) return;
        setCopying(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setMessage(created.length === 1 ? tx("კვება დაკოპირდა", "Meal copied") : tx(`${created.length} კვება დაკოპირდა`, `${created.length} meals copied`));
        if (date !== day) setDay(date);
      } catch (e) {
        setCopyError((e as Error).message);
      }
    });
  /** Today is empty: offer yesterday's meals in one step. */
  const repeatYesterday = () =>
    run(async () => {
      const yesterday = shiftDay(localDay(), -1);
      const { meals: previous } = await queryClient.fetchQuery({
        queryKey: accountKey(...mealsKey(yesterday)),
        queryFn: () => fetchDayMeals(yesterday),
        staleTime: FRESH.SHORT,
      });
      if (!alive.current) return;
      if (!previous.length) {
        setMessage(tx("გუშინ ჩანაწერი არ არის.", "Nothing was logged yesterday."));
        return;
      }
      setCopyError("");
      setCopying(previous);
    });
  const sum = foodTotals(draft?.items || meals.flatMap((m) => m.items));
  const score = draft?.items.length ? healthScore(draft.items) : null;
  const txt = { color: c.text100, fontFamily: "NotoSansGeorgian_400Regular" };
  const button = (label: string, action: () => void, primary = false, disabled = false, icon?: React.ReactNode) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={action}
      style={[s.button, { backgroundColor: primary ? "#0F766E" : c.bg200, opacity: busy || disabled ? 0.5 : 1 }]}
    >
      {icon}
      <Text style={[txt, { color: primary ? "#fff" : c.text100, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{label}</Text>
    </Pressable>
  );
  const inputStyle = [s.input, { backgroundColor: c.bg200, color: c.text100, borderColor: c.bg300 }];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: c.bg100, paddingTop: safe.top }}>
      <View style={s.header}>
        <Pressable accessibilityLabel={tx("უკან", "Back")} onPress={close} disabled={busy} style={s.icon}>
          <ArrowLeft color={c.text100} size={22} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[txt, s.title]}>{tx("კვების დღიური", "Food diary")}</Text>
          <Text style={[txt, { fontSize: 12, color: c.text200 }]}>
            {draft ? (draft.items.length ? tx("გადაამოწმე და შეინახე", "Review and save") : tx("აირჩიე გზა, გადაამოწმე, შეინახე", "Pick a way, review, save")) : tx("შენი კვება, უკეთ გასაგებად", "Understand your eating better")}
          </Text>
        </View>
        <Leaf size={25} color={c.primary100} />
      </View>
      <ScrollView
        ref={scroll}
        pointerEvents={busy ? "none" : "auto"}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 18, gap: 18, paddingBottom: 24, width: "100%", maxWidth: 640, alignSelf: "center" }}
      >
        {!!error && (
          <View accessibilityRole="alert" style={[s.card, { backgroundColor: c.dangerBg }]}>
            <Text style={[txt, { color: c.danger }]}>{error}</Text>
            {!draft && button(tx("ხელახლა ცდა", "Try again"), () => void load())}
          </View>
        )}
        {!!message && !draft && (
          <Text accessibilityLiveRegion="polite" style={[txt, { color: c.success }]}>{message}</Text>
        )}
        {!draft && (
          <View style={s.row}>
            <Pressable accessibilityLabel={tx("წინა დღე", "Previous day")} onPress={() => setDay(shiftDay(day, -1))} style={s.icon}>
              <ChevronLeft color={c.text100} />
            </Pressable>
            <Text style={[txt, { flex: 1, textAlign: "center", fontFamily: "NotoSansGeorgian_600SemiBold" }]}>
              {day === localDay() ? tx("დღეს", "Today") : new Date(day + "T12:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "long" })}
            </Text>
            <Pressable accessibilityLabel={tx("შემდეგი დღე", "Next day")} disabled={day >= localDay()} onPress={() => setDay(shiftDay(day, 1))} style={[s.icon, { opacity: day >= localDay() ? 0.3 : 1 }]}>
              <ChevronRight color={c.text100} />
            </Pressable>
          </View>
        )}
        {draft && editing === null && <NutritionScanSteps stage={draft.items.length ? 1 : 0} />}
        {draft && draft.items.length > 0 && editing === null && !!explanation && (
          <View style={[s.row, { alignItems: "flex-start" }]}>
            {photo && <Image source={{ uri: photo.uri }} style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: c.bg200 }} />}
            <View style={{ flex: 1, gap: 4 }}>
              <View style={s.row}>
                <CircleCheck size={17} color={c.primary100} />
                <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 16 }]}>{tx("შეფასება მზადაა", "Estimate ready")}</Text>
              </View>
              <Text style={[txt, { fontSize: 12, lineHeight: 20, color: c.text200 }]}>{tx("გადაამოწმე საკვები და პორცია, შემდეგ შეინახე.", "Check the food and portion, then save.")}</Text>
            </View>
          </View>
        )}
        {editing === null && (!draft || draft.items.length > 0) && (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.bg300, borderWidth: 1, gap: 6 }]}>
            <View style={s.row}>
              <Utensils color={c.primary100} size={21} />
              <Text style={[txt, { color: c.text200, flex: 1 }]}>{draft ? tx("არჩეული პორცია", "Selected portion") : tx("აღრიცხული ენერგია", "Energy logged")}</Text>
              <ScoreBadge score={score} />
            </View>
            {draft && (
              <TextInput
                accessibilityLabel={tx("კერძის სახელი", "Dish name")}
                placeholder={tx("კერძის სახელი (არასავალდებულო)", "Dish name (optional)")}
                placeholderTextColor={c.text300}
                value={draft.title || ""}
                onChangeText={(title) => setDraft({ ...draft, title })}
                maxLength={120}
                style={[txt, { fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold", paddingVertical: 4 }]}
              />
            )}
            <Text style={[txt, { fontSize: 40, fontFamily: "NotoSansGeorgian_700Bold", marginVertical: 4 }]}>
              {sum.calories}
              <Text style={{ fontSize: 16, fontFamily: "NotoSansGeorgian_400Regular" }}>{tx(" კკალ", " kcal")}</Text>
            </Text>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              {[
                [tx("ცილა", "Protein"), sum.protein],
                [tx("ნახშირწყლები", "Carbs"), sum.carbs],
                [tx("ცხიმი", "Fat"), sum.fat],
              ].map(([label, value]) => (
                <View key={label}>
                  <Text style={[txt, { fontSize: 12, color: c.text200 }]}>{label}</Text>
                  <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", marginTop: 4 }]}>{value} {tx("გ", "g")}</Text>
                </View>
              ))}
            </View>
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
              {[
                [tx("ბოჭკო", "Fiber"), sum.fiber, tx("გ", "g")],
                [tx("შაქარი", "Sugar"), sum.sugar, tx("გ", "g")],
                [tx("ნატრიუმი", "Sodium"), sum.sodium != null ? Math.round(sum.sodium) : null, tx("მგ", "mg")],
              ].map(([label, value, unit]) => (
                <View key={String(label)}>
                  <Text style={[txt, { fontSize: 11, color: c.text300 }]}>{label}</Text>
                  <Text style={[txt, { fontSize: 13, color: value == null ? c.text300 : c.text200, marginTop: 2 }]}>{value == null ? "—" : `${value} ${unit}`}</Text>
                </View>
              ))}
            </View>
            {score != null && (
              <>
                <Text style={[txt, { fontSize: 11, lineHeight: 17, color: c.text300, marginTop: 4 }]}>{tx("ქულა 1–10 MEDICARD-ის საკუთარი მიახლოებითი შეფასებაა, არა სამედიცინო დასკვნა.", "The 1–10 score is MEDICARD's own approximate rating, not a medical assessment.")}</Text>
                <MedicalSourcesLink sourceIds={["mealQuality"]} />
              </>
            )}
          </View>
        )}
        {loading && !draft ? <ActivityIndicator color={c.primary200} /> : null}
        {!draft && !loading && (
          <>
            {meals.length === 0 && !error && (
              <View style={[s.card, { backgroundColor: c.surface, gap: 14 }]}>
                <View style={{ alignItems: "center", gap: 6, paddingTop: 6 }}>
                  <Image
                    source={EMPTY_ART.diary}
                    resizeMode="contain"
                    accessible={false}
                    accessibilityIgnoresInvertColors
                    style={{ width: 110, height: 110 }}
                  />
                  <Text style={[txt, { fontSize: 19, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{day === localDay() ? tx("რას მიირთმევ დღეს?", "What are you eating today?") : tx("ამ დღეს ჩანაწერი არ არის", "Nothing logged this day")}</Text>
                  <Text style={[txt, { textAlign: "center", color: c.text200, lineHeight: 21, fontSize: 13 }]}>
                    {tx("აირჩიე ერთი გზა. Medi დაითვლის, შენ გადაამოწმებ და შეინახავ.", "Pick one way. Medi does the math, you review and save.")}
                  </Text>
                </View>
                <QuickLogTiles onPick={startWith} />
                {button(tx("სხვა გზები: გალერეა, ეტიკეტი, შენახული, ხელით", "More ways: gallery, label, saved, manual"), () => { newMeal(false); setTimeout(() => setSheet("methods"), 50); })}
                {day === localDay() && button(tx("გუშინდელი კვების გამეორება", "Repeat yesterday's meals"), () => void repeatYesterday(), false, false, <CopyPlus size={16} color={c.text100} />)}
              </View>
            )}
            {meals.length > 0 && day !== localDay() &&
              button(tx("ამ დღის კოპირება", "Copy this day"), () => { setCopyError(""); setCopying(meals); }, false, false, <CopyPlus size={16} color={c.text100} />)}
            {(["breakfast", "lunch", "dinner", "snack"] as const)
              .filter((type) => meals.some((m) => m.type === type))
              .map((type) => (
                <View key={type} style={{ gap: 8 }}>
                  <View style={[s.row, { paddingHorizontal: 4 }]}>
                    <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 15, flex: 1 }]}>{mealLabels[type]}</Text>
                    <Text style={[txt, { fontSize: 12, color: c.text300 }]}>{foodTotals(meals.filter((m) => m.type === type).flatMap((m) => m.items)).calories} {tx("კკალ", "kcal")}</Text>
                  </View>
                  {meals
                    .filter((m) => m.type === type)
                    .map((meal) => {
                      const mealScore = meal.healthScore ?? healthScore(meal.items);
                      const t = foodTotals(meal.items);
                      return (
                        <Pressable
                          key={meal.id}
                          accessibilityRole="button"
                          accessibilityLabel={tx(`${meal.title || meal.items.map((i) => i.name).join(", ")} · ${t.calories} კკალ · რედაქტირება`, `${meal.title || meal.items.map((i) => i.name).join(", ")} · ${t.calories} kcal · Edit`)}
                          onPress={() => {
                            openMeal(meal);
                            setEditing(null);
                            resetResult();
                          }}
                          style={[s.card, { backgroundColor: c.surface, gap: 8 }]}
                        >
                          <View style={[s.row, { alignItems: "flex-start" }]}>
                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <Text numberOfLines={2} style={[txt, { fontSize: 16, fontFamily: "NotoSansGeorgian_600SemiBold", lineHeight: 22 }]}>{meal.title || meal.items.map((i) => i.name).join(" · ")}</Text>
                              {!!meal.title && <Text numberOfLines={2} style={[txt, { fontSize: 12, color: c.text300, lineHeight: 17 }]}>{meal.items.map((i) => i.name).join(" · ")}</Text>}
                            </View>
                            <Text style={[txt, { fontSize: 18, fontFamily: "NotoSansGeorgian_700Bold" }]}>{t.calories}<Text style={{ fontSize: 11, color: c.text300, fontFamily: "NotoSansGeorgian_400Regular" }}>{tx(" კკალ", " kcal")}</Text></Text>
                          </View>
                          <View style={s.row}>
                            <View style={{ flex: 1, gap: 4 }}>
                              <MacroLine protein={t.protein} carbs={t.carbs} fat={t.fat} />
                              <Text style={[txt, { fontSize: 11, color: c.text300 }]}>{sourceLabels[meal.source] || sourceLabels.manual} · {tx("შეეხე რედაქტირებისთვის", "Tap to edit")}</Text>
                            </View>
                            <ScoreBadge score={mealScore} size="sm" />
                            <Pressable accessibilityRole="button" accessibilityLabel={tx("კვების კოპირება", "Copy meal")} onPress={() => { setCopyError(""); setCopying([meal]); }} disabled={busy} style={[s.icon, { marginRight: -12 }]}>
                              <Copy size={18} color={c.text300} />
                            </Pressable>
                            <Pressable accessibilityRole="button" accessibilityLabel={tx("კვების წაშლა", "Delete meal")} onPress={() => remove(meal)} disabled={busy} style={[s.icon, { marginRight: -10 }]}>
                              <Trash2 size={18} color={c.text300} />
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                </View>
              ))}
            {meals.length > 0 && (
              <View style={{ paddingHorizontal: 4 }}>
                <Text style={[txt, { fontSize: 11, lineHeight: 17, color: c.text300 }]}>{tx("ქულა 1–10 MEDICARD-ის საკუთარი მიახლოებითი შეფასებაა, არა სამედიცინო დასკვნა.", "The 1–10 score is MEDICARD's own approximate rating, not a medical assessment.")}</Text>
                <MedicalSourcesLink sourceIds={["mealQuality"]} />
              </View>
            )}
          </>
        )}
        {draft && editing === null && (
          <>
            {draft.items.length === 0 && (
              <NutritionScanner
                photoUri={photo?.uri}
                scanning={scanning}
                disabled={busy}
                enabled={enabled}
                label={photoMode === "label"}
                onCamera={() => void pick(true, photoMode)}
                onGallery={() => void pick(false, photoMode)}
                onMore={() => setSheet("methods")}
              />
            )}
            <View style={s.row}>
              {Object.entries(mealLabels).map(([key, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.type === key }}
                  accessibilityLabel={label}
                  onPress={() => setDraft({ ...draft, type: key as Meal["type"] })}
                  style={[s.chip, { backgroundColor: draft.type === key ? c.accent100 : c.bg200, borderColor: draft.type === key ? c.primary100 : c.bg300 }]}
                >
                  <Text numberOfLines={1} style={[txt, { fontSize: 12 }]}>{key === "snack" ? tx("ხემსი", "Snack") : label}</Text>
                </Pressable>
              ))}
            </View>
            {!!explanation && (
              <View style={[s.row, { alignItems: "flex-start", padding: 14, borderRadius: 16, backgroundColor: c.bg200 }]}>
                <Info size={18} color={c.primary100} />
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={[txt, { fontSize: 12, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{uncertainty === "high" ? tx("პორცია განსაკუთრებით ყურადღებით გადაამოწმე", "Check the portion especially carefully") : uncertainty === "low" ? tx("შეფასება საკმაოდ ზუსტია", "The estimate is fairly accurate") : tx("შეფასება მიახლოებითია", "The estimate is approximate")}</Text>
                  <Text style={[txt, { color: c.text200, lineHeight: 20, fontSize: 12 }]}>{explanation}</Text>
                </View>
              </View>
            )}
            {draft.items.map((item, index) => (
              <View key={index} style={[s.card, { backgroundColor: c.surface, gap: 12 }]}>
                <View style={s.row}>
                  <Text style={[txt, { flex: 1, fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 17 }]}>{item.name}</Text>
                  <Pressable
                    accessibilityLabel={savedItems[index] ? tx("შენახულია", "Saved") : tx("შენახულებში დამატება", "Add to saved")}
                    disabled={!!savedItems[index]}
                    onPress={() => void saveItemAsFood(item, index)}
                    style={s.icon}
                  >
                    {savedItems[index] ? <BookmarkCheck color={c.primary100} size={19} /> : <Bookmark color={c.text200} size={19} />}
                  </Pressable>
                  <Pressable accessibilityLabel={tx("საკვების ამოშლა", "Remove food")} onPress={() => setDraft({ ...draft, items: draft.items.filter((_, n) => n !== index) })} style={s.icon}>
                    <X color={c.text200} size={18} />
                  </Pressable>
                </View>
                <View style={[s.row, { alignItems: "baseline" }]}>
                  <Text style={[txt, { fontSize: 22, fontFamily: "NotoSansGeorgian_700Bold" }]}>{Math.round(item.calories)}<Text style={{ fontSize: 12, color: c.text300, fontFamily: "NotoSansGeorgian_400Regular" }}>{tx(" კკალ", " kcal")}</Text></Text>
                  <Text style={[txt, { color: c.text200, fontSize: 13 }]}>· {item.grams} {tx("გ", "g")}</Text>
                </View>
                <MacroLine protein={item.protein} carbs={item.carbs} fat={item.fat} />
                <View style={s.row}>
                  {button("½", () => setDraft({ ...draft, items: draft.items.map((v, n) => (n === index ? scaleFood(v, Math.max(0.1, v.grams / 2)) : v)) }))}
                  {button("×2", () => {
                    if (item.grams * 2 > 10000) {
                      setError(tx("პორცია ზედმეტად დიდია.", "That portion is too large."));
                      return;
                    }
                    setDraft({ ...draft, items: draft.items.map((v, n) => (n === index ? scaleFood(v, v.grams * 2) : v)) });
                  })}
                  {button(tx("რედაქტირება", "Edit"), () => editItem(index))}
                </View>
              </View>
            ))}
            {draft.items.length > 0 && enabled && (
              <View style={[s.card, { backgroundColor: c.surface, gap: 10 }]}>
                <View style={s.row}>
                  <Wand2 size={17} color={c.primary100} />
                  <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14 }]}>{tx("რამე არასწორია? უთხარი Medi-ს", "Something wrong? Tell Medi")}</Text>
                </View>
                <TextInput
                  accessibilityLabel={tx("შესწორება", "Correction")}
                  placeholder={tx("მაგ. ეს ღორის კი არა, ქათმის მწვადი იყო · ბრინჯი ნახევარი · სოუსი არ ყოფილა", "e.g. it was chicken kebab, not pork · half the rice · no sauce")}
                  placeholderTextColor={c.text300}
                  value={correction}
                  onChangeText={setCorrection}
                  maxLength={500}
                  multiline
                  style={[inputStyle, { minHeight: 56, fontSize: 14 }]}
                />
                {button(scanning ? tx("ვასწორებ…", "Fixing…") : tx("შესწორება AI-ით", "Fix with AI"), () => void fix(), false, correction.trim().length < 2 || scanning, <Sparkles size={15} color={c.text100} />)}
              </View>
            )}
            {draft.items.length > 0 && draft.items.length < 25 && button(tx("+ კიდევ საკვების დამატება", "+ Add more food"), () => setSheet("methods"), false, false, <Plus size={16} color={c.text100} />)}
            <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13 }]}>{draft.items.length ? tx("შენიშვნა", "Note") : tx("რა დაგვეხმარება შეფასებაში? (არასავალდებულო)", "Anything that helps the estimate? (optional)")}</Text>
            <TextInput
              accessibilityLabel={tx("პორციის აღწერა", "Portion description")}
              placeholder={tx("მაგ. ორი ნაჭერი, სოუსის გარეშე", "e.g. two slices, no sauce")}
              placeholderTextColor={c.text200}
              value={draft.note}
              onChangeText={(note) => setDraft({ ...draft, note })}
              maxLength={500}
              multiline
              style={[inputStyle, { minHeight: 62, fontSize: 14 }]}
            />
          </>
        )}
        {draft && editing !== null && (
          <View style={{ gap: 12 }}>
            <Text style={[txt, { fontSize: 20, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{tx("საკვების მონაცემები", "Food details")}</Text>
            <Text style={[txt, { color: c.text200 }]}>{tx("მიუთითე მთლიანი პორციის მნიშვნელობები, არა 100 გრამის. ეტიკეტიდან შეგიძლია გადაიტანო.", "Enter values for the whole portion, not per 100 g. You can copy them from the label.")}</Text>
            {Object.entries({
              name: tx("საკვების სახელი", "Food name"),
              grams: tx("პორცია · გრამი", "Portion · grams"),
              calories: tx("ენერგია · კკალ", "Energy · kcal"),
              protein: tx("ცილა · გ", "Protein · g"),
              carbs: tx("ნახშირწყლები · გ", "Carbs · g"),
              fat: tx("ცხიმი · გ", "Fat · g"),
              fiber: tx("ბოჭკო · გ (არასავალდებულო)", "Fiber · g (optional)"),
              sugar: tx("შაქარი · გ (არასავალდებულო)", "Sugar · g (optional)"),
              sodium: tx("ნატრიუმი · მგ (არასავალდებულო)", "Sodium · mg (optional)"),
            }).map(([key, label]) => (
              <View key={key} style={{ gap: 6 }}>
                <Text numberOfLines={1} style={[txt, { fontSize: 12 }]}>{label}</Text>
                <TextInput
                  accessibilityLabel={label}
                  testID={`nutrition-field-${key}`}
                  value={fields[key as keyof typeof fields]}
                  maxLength={key === "name" ? 120 : 8}
                  onChangeText={(value) => setFields({ ...fields, [key]: value })}
                  keyboardType={key === "name" ? "default" : "decimal-pad"}
                  style={inputStyle}
                />
              </View>
            ))}
            {button(tx("გაუქმება", "Cancel"), close)}
          </View>
        )}
        <Text style={[txt, { fontSize: 12, color: c.text200, lineHeight: 19 }]}>
          {tx("შეფასებული კალორიები და საკვები ნივთიერებები სავარაუდოა. ეს არ არის სამედიცინო ან დიეტოლოგიური დანიშნულება.", "Estimated calories and nutrients are approximate. This is not medical or dietary advice.")}
        </Text>
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: keyboardOpen ? 10 : Math.max(safe.bottom, 12), borderTopWidth: 1, borderColor: c.bg300, backgroundColor: c.surface }}>
        {busy ? (
          <View style={s.row}>
            <ActivityIndicator color={c.primary200} />
            <Text style={[txt, { fontSize: 13 }]}>{scanning ? tx("მიმდინარეობს შეფასება…", "Estimating…") : tx("მიმდინარეობს…", "Working…")}</Text>
          </View>
        ) : editing !== null ? (
          button(tx("საკვების დადასტურება", "Confirm food"), applyItem, true)
        ) : draft && !draft.items.length ? (
          <View style={{ gap: 8 }}>
            {photo && enabled && button(error ? tx("შეფასების ხელახლა ცდა", "Retry estimate") : photoMode === "label" ? tx("ეტიკეტის წაკითხვა", "Read label") : tx("შეფასების დაწყება", "Start estimate"), () => void analyze(), true)}
            {!photo && button(tx("როგორ ჩავწეროთ?", "How to log it?"), () => setSheet("methods"), true, false, <Plus size={17} color="#fff" />)}
            {photo && button(tx("სხვა გზა", "Another way"), () => setSheet("methods"))}
          </View>
        ) : draft ? (
          button(tx("დღიურში შენახვა", "Save to diary"), () => void save(), true, !draft.items.length)
        ) : (
          button(tx("კვების დამატება", "Add meal"), () => newMeal(true), true, loading, <Plus size={17} color="#fff" />)
        )}
      </View>
      <Stack.Screen options={{ gestureEnabled: !draft && !busy }} />
      <CopyMealsSheet meals={copying} busy={busy} error={copyError} onClose={() => setCopying(null)} onCopy={(date, type) => void copyMeals(date, type)} />
      <LogMethodSheet visible={sheet === "methods"} aiEnabled={enabled} onPick={pickMethod} onClose={() => setSheet(null)} />
      <BarcodeScannerModal visible={sheet === "barcode" && !product} busy={busy} error={sheetError} onClose={() => setSheet(null)} onCode={(code) => void lookupBarcode(code)} />
      <PortionSheet
        food={product}
        onClose={() => setProduct(null)}
        onAdd={(item) => {
          setProduct(null);
          setSheet(null);
          addItems([item], "barcode", product?.name);
        }}
      />
      <FoodSearchModal visible={sheet === "search" || sheet === "saved"} initialTab={sheet === "saved" ? "recent" : "search"} onClose={() => setSheet(null)} onPick={onFoodPick} />
      <DescribeMealModal visible={sheet === "describe"} owner={owner} busy={busy} error={sheetError} onClose={() => setSheet(null)} onSubmit={(text, voice) => void describe(text, voice)} />
      <Modal visible={!!confirmation} {...APP_MODAL_PROPS} onRequestClose={() => setConfirmation(null)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
          <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: 24, padding: 24, gap: 16 }}>
            <Text style={[txt, { fontSize: 20, fontFamily: "NotoSansGeorgian_700Bold" }]}>{confirmation?.title}</Text>
            <Text style={[txt, { color: c.text200, lineHeight: 22 }]}>{confirmation?.message}</Text>
            {button(tx("გაუქმება", "Cancel"), () => setConfirmation(null))}
            {button(
              tx("დადასტურება", "Confirm"),
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
  header: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontFamily: "NotoSansGeorgian_700Bold" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  card: { padding: 18, borderRadius: 22 },
  button: { minHeight: 46, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  chip: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, paddingVertical: 10, minHeight: 44, borderRadius: 14, borderWidth: 1 },
  input: { borderRadius: 14, borderWidth: 1, padding: 14, fontSize: 16, minHeight: 48 },
});
