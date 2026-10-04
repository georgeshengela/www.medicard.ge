import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Keyboard,
  Linking,
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
import { requestPhotoLibraryAccess } from "@/lib/photoLibraryAccess";
import * as Haptics from "expo-haptics";
import {
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  CopyPlus,
  Info,
  Plus,
  Sparkles,
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
import { HUB, hubText } from "@/theme/hub";
import { ModuleHeaderButton, ModuleStackHeader } from "@/components/brand/ModuleHeader";
import { KeyboardFormShell } from "@/components/ui/KeyboardFormShell";
import { NConfirm, NSegment, useMedifood, withMedifood } from "@/components/nutrition/ProgramUI";
import { SwipeDeleteRow, SwipeGroup } from "@/components/records/SwipeDeleteRow";
import { UndoToast } from "@/components/records/UndoToast";
import { useUndoDelete } from "@/components/records/useUndoDelete";
import { useAuth } from "@/store/AuthContext";
import { useAccountQuery } from "@/hooks/useAccountQuery";
import { accountKey, FRESH, queryClient } from "@/lib/queryClient";
import { aiConsentDeclinedText, isAiConsentDeclined } from "@/lib/aiConsentDecline";
import { AiConsentDeclinedNote } from "@/components/ui/AiConsentDeclinedNote";

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

export default withMedifood(function NutritionDiary() {
  const { user } = useAuth();
  return <NutritionScreen key={user?.id || "guest"} owner={user?.id || ""} />;
});
function NutritionScreen({ owner }: { owner: string }) {
  const c = useThemeColors(),
    M = useMedifood(),
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
  const [scanning, setScanning] = useState(false);
  const [uncertainty, setUncertainty] = useState<"low" | "medium" | "high" | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [sheetError, setSheetError] = useState("");
  // Declined / closed the AI disclosure — a choice, not an error (App Review 2026-09-22). Which estimate
  // „ხელახლა ცდა“ runs again; the photo, note and correction stay. The describe sheet gets a calm line.
  const [aiDeclined, setAiDeclined] = useState<"analyze" | "fix" | null>(null);
  const [describeNotice, setDescribeNotice] = useState("");
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
    setAiDeclined(null);
    try {
      await work();
    } catch (e) {
      if (alive.current && !isAiConsentDeclined(e)) setError((e as Error).message);
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
      const permission = await (camera ? ImagePicker.requestCameraPermissionsAsync() : requestPhotoLibraryAccess());
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
        if (isAiConsentDeclined(e)) { if (alive.current) setAiDeclined("analyze"); return; }
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
      setDescribeNotice("");
      try {
        const result = await api.nutrition.estimate(null, { mode: "text", description: text });
        if (!alive.current) return;
        applyEstimate(result, voice ? "voice" : "text", !draft.items.length);
        setDraft((current) => (current ? { ...current, note: current.note || text } : current));
        setSheet(null);
      } catch (e) {
        // The sheet stays open with the text; „დათვალე“ asks again.
        if (isAiConsentDeclined(e)) { if (alive.current) setDescribeNotice(aiConsentDeclinedText()); return; }
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
      } catch (e) {
        if (isAiConsentDeclined(e)) { if (alive.current) setAiDeclined("fix"); return; }
        throw e;
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
    setDescribeNotice("");
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
  // A swiped-away meal disappears at once; the real delete runs after the 5 s „დაბრუნება“ window.
  const { held, remove: holdMeal, undo } = useUndoDelete<Meal>((meal) => {
    void api.nutrition
      .remove(meal.id)
      .then(() => {
        void removeMealFromHealth(meal.id);
        patchDayMeals(meal.date, (list) => withoutMeal(list, meal.id));
        refreshNutritionDashboard();
      })
      .catch((e) => {
        if (alive.current) setError((e as Error).message);
        void queryClient.invalidateQueries({ queryKey: accountKey(...mealsKey(meal.date)) });
      });
  });
  const remove = (meal: Meal) => {
    if (busy) return;
    void Haptics.selectionAsync().catch(() => {});
    holdMeal(meal);
  };
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
  // A meal waiting in the undo window is already gone from the list and the totals.
  const shown = held ? meals.filter((m) => m.id !== held.id) : meals;
  const sum = foodTotals(draft?.items || shown.flatMap((m) => m.items));
  const score = draft?.items.length ? healthScore(draft.items) : null;
  const txt = { color: c.text100, fontFamily: "NotoSansGeorgian_400Regular" };
  const button = (label: string, action: () => void, primary = false, disabled = false, icon?: React.ReactNode, compact = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={action}
      style={[s.button, compact && s.buttonCompact, { backgroundColor: primary ? M.ink : c.bg200, opacity: busy || disabled ? 0.5 : 1 }]}
    >
      {icon}
      <Text style={[txt, { color: primary ? M.onInk : c.text100, fontFamily: primary ? "NotoSansGeorgian_700Bold" : "NotoSansGeorgian_600SemiBold", fontSize: compact ? 14 : 15 }]}>{label}</Text>
    </Pressable>
  );
  const fieldStyle = (onCard: boolean) => [s.input, { backgroundColor: onCard ? c.bg200 : c.surface, color: c.text100 }];
  const today = localDay();
  const title = !draft
    ? tx("კვების დღიური", "Food diary")
    : editing !== null
      ? tx("საკვების მონაცემები", "Food details")
      : draft.items.length
        ? tx("გადაამოწმე და შეინახე", "Review and save")
        : tx("ახალი ჩანაწერი", "New entry");
  const footer = busy ? (
    <View style={[s.row, { minHeight: 50, justifyContent: "center" }]}>
      <ActivityIndicator color={M.ink} />
      <Text style={[txt, { fontSize: 14 }]}>{scanning ? tx("მიმდინარეობს შეფასება…", "Estimating…") : tx("მიმდინარეობს…", "Working…")}</Text>
    </View>
  ) : editing !== null ? (
    button(tx("საკვების დადასტურება", "Confirm food"), applyItem, true)
  ) : draft && !draft.items.length ? (
    <View style={{ gap: 8 }}>
      {photo && enabled && button(error ? tx("შეფასების ხელახლა ცდა", "Retry estimate") : photoMode === "label" ? tx("ეტიკეტის წაკითხვა", "Read label") : tx("შეფასების დაწყება", "Start estimate"), () => void analyze(), true)}
      {!photo && button(tx("როგორ ჩავწეროთ?", "How to log it?"), () => setSheet("methods"), true, false, <Plus size={17} color={M.onInk} />)}
      {photo && button(tx("სხვა გზა", "Another way"), () => setSheet("methods"))}
    </View>
  ) : draft ? (
    button(tx("დღიურში შენახვა", "Save to diary"), () => void save(), true, !draft.items.length)
  ) : undefined;
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !draft && !busy }} />
      <SwipeGroup>
        <KeyboardFormShell
          background={c.bg100}
          scrollRef={scroll}
          header={
            <ModuleStackHeader
              module="food"
              subtitle={title}
              onBack={close}
              right={!draft ? <ModuleHeaderButton label={tx("კვების დამატება", "Add meal")} icon={Plus} onPress={() => newMeal(true)} /> : undefined}
            />
          }
          contentStyle={{ paddingTop: 4, paddingHorizontal: HUB.gutter, gap: 16, width: "100%", maxWidth: 680, alignSelf: "center" }}
          footer={footer ? <View style={{ width: "100%", maxWidth: 640, alignSelf: "center" }}>{footer}</View> : undefined}
        >
          <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 16 }}>
            {!!error && (
              <View accessibilityRole="alert" style={[s.card, { backgroundColor: c.dangerBg, gap: 10, padding: 14 }]}>
                <Text style={[txt, { color: c.danger, fontSize: 14, lineHeight: 21 }]}>{error}</Text>
                {!draft && button(tx("ხელახლა ცდა", "Try again"), () => void load(), false, false, undefined, true)}
              </View>
            )}
            {!!aiDeclined && !error && !!draft && (
              <AiConsentDeclinedNote busy={busy} onRetry={() => void (aiDeclined === "fix" ? fix() : analyze())} />
            )}
            {!!message && !draft && (
              <View style={[s.row, { gap: 8, paddingHorizontal: 4 }]}>
                <CircleCheck size={16} color={c.success} />
                <Text accessibilityLiveRegion="polite" style={[txt, { color: c.success, fontSize: 14, flex: 1 }]}>{message}</Text>
              </View>
            )}
            {!draft && (
              <View style={[s.dayBar, { backgroundColor: c.surface }]}>
                <Pressable accessibilityRole="button" accessibilityLabel={tx("წინა დღე", "Previous day")} onPress={() => setDay(shiftDay(day, -1))} style={[s.dayButton, { backgroundColor: c.bg200 }]}>
                  <ChevronLeft size={19} color={c.text100} />
                </Pressable>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 15 }]}>
                    {day === today ? tx("დღეს", "Today") : day === shiftDay(today, -1) ? tx("გუშინ", "Yesterday") : new Date(day + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "long" })}
                  </Text>
                  {day !== today ? (
                    <Pressable accessibilityRole="button" onPress={() => setDay(today)} hitSlop={8}>
                      <Text style={[hubText.small, { color: M.ink, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{tx("დღევანდელზე დაბრუნება", "Back to today")}</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={tx("შემდეგი დღე", "Next day")} disabled={day >= today} onPress={() => setDay(shiftDay(day, 1))} style={[s.dayButton, { backgroundColor: c.bg200, opacity: day >= today ? 0.35 : 1 }]}>
                  <ChevronRight size={19} color={c.text100} />
                </Pressable>
              </View>
            )}
            {draft && editing === null && <NutritionScanSteps stage={draft.items.length ? 1 : 0} />}
            {draft && draft.items.length > 0 && editing === null && !!explanation && (
              <View style={[s.row, { alignItems: "flex-start" }]}>
                {photo && <Image source={{ uri: photo.uri }} style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: c.bg200 }} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={[s.row, { gap: 6 }]}>
                    <CircleCheck size={17} color={M.ink} />
                    <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 16 }]}>{tx("შეფასება მზადაა", "Estimate ready")}</Text>
                  </View>
                  <Text style={[hubText.caption, { color: c.text200 }]}>{tx("გადაამოწმე საკვები და პორცია, შემდეგ შეინახე.", "Check the food and portion, then save.")}</Text>
                </View>
              </View>
            )}
            {editing === null && (draft ? draft.items.length > 0 : shown.length > 0) && (
              <View style={[s.card, { backgroundColor: c.surface, gap: 10 }]}>
                <View style={s.row}>
                  <Text style={[hubText.caption, { color: c.text200, flex: 1 }]}>{draft ? tx("არჩეული პორცია", "Selected portion") : tx("დღის ჯამი", "Day total")}</Text>
                  <ScoreBadge score={score} />
                </View>
                {draft && (
                  <TextInput
                    accessibilityLabel={tx("კერძის სახელი", "Dish name")}
                    placeholder={tx("კერძის სახელი (არასავალდებულო)", "Dish name (optional)")}
                    placeholderTextColor={c.text300}
                    value={draft.title || ""}
                    onChangeText={(next) => setDraft({ ...draft, title: next })}
                    maxLength={120}
                    style={[txt, { fontSize: 18, fontFamily: "NotoSansGeorgian_600SemiBold", paddingVertical: 2 }]}
                  />
                )}
                <Text style={[txt, { fontSize: 34, lineHeight: 42, fontFamily: "NotoSansGeorgian_700Bold", fontVariant: ["tabular-nums"] }]}>
                  {sum.calories}
                  <Text style={{ fontSize: 15, fontFamily: "NotoSansGeorgian_400Regular", color: c.text200 }}>{tx(" კკალ", " kcal")}</Text>
                </Text>
                <View style={[s.macroGrid, { borderTopColor: c.bg300 }]}>
                  {(
                    [
                      [tx("ცილა", "Protein"), sum.protein, tx("გ", "g")],
                      [tx("ნახშირწყ.", "Carbs"), sum.carbs, tx("გ", "g")],
                      [tx("ცხიმი", "Fat"), sum.fat, tx("გ", "g")],
                      [tx("ბოჭკო", "Fiber"), sum.fiber, tx("გ", "g")],
                      [tx("შაქარი", "Sugar"), sum.sugar, tx("გ", "g")],
                      [tx("ნატრიუმი", "Sodium"), sum.sodium != null ? Math.round(sum.sodium) : null, tx("მგ", "mg")],
                    ] as const
                  ).map(([label, value, unit], index) => (
                    <View key={label} style={s.macroCell}>
                      <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{label}</Text>
                      <Text numberOfLines={1} style={[txt, { fontSize: index < 3 ? 15 : 13, fontFamily: index < 3 ? "NotoSansGeorgian_600SemiBold" : "NotoSansGeorgian_400Regular", color: value == null ? c.text300 : index < 3 ? c.text100 : c.text200 }]}>
                        {value == null ? "—" : `${value} ${unit}`}
                      </Text>
                    </View>
                  ))}
                </View>
                {score != null && (
                  <>
                    <Text style={[hubText.small, { color: c.text300 }]}>{tx("ქულა 1–10 MEDICARD-ის საკუთარი მიახლოებითი შეფასებაა, არა სამედიცინო დასკვნა.", "The 1–10 score is MEDICARD's own approximate rating, not a medical assessment.")}</Text>
                    <MedicalSourcesLink sourceIds={["mealQuality"]} />
                  </>
                )}
              </View>
            )}
            {loading && !draft ? <ActivityIndicator color={M.ink} style={{ paddingVertical: 20 }} /> : null}
            {!draft && !loading && (
              <>
                {shown.length === 0 && !error && (
                  <View style={[s.card, { backgroundColor: c.surface, gap: 14 }]}>
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <Image source={EMPTY_ART.diary} resizeMode="contain" accessible={false} accessibilityIgnoresInvertColors style={{ width: 96, height: 96 }} />
                      <Text style={[txt, { fontSize: 18, fontFamily: "NotoSansGeorgian_700Bold", textAlign: "center" }]}>{day === today ? tx("რას მიირთმევ დღეს?", "What are you eating today?") : tx("ამ დღეს ჩანაწერი არ არის", "Nothing logged this day")}</Text>
                      <Text style={[hubText.body, { textAlign: "center", color: c.text200 }]}>{tx("აირჩიე ერთი გზა. Medi დაითვლის, შენ გადაამოწმებ და შეინახავ.", "Pick one way. Medi does the math, you review and save.")}</Text>
                    </View>
                    <QuickLogTiles onPick={startWith} />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>{button(tx("სხვა გზები", "More ways"), () => { newMeal(false); setTimeout(() => setSheet("methods"), 50); }, false, false, <Plus size={16} color={c.text100} />, true)}</View>
                      {day === today ? <View style={{ flex: 1 }}>{button(tx("გუშინდელი", "Yesterday's"), () => void repeatYesterday(), false, false, <CopyPlus size={16} color={c.text100} />, true)}</View> : null}
                    </View>
                  </View>
                )}
                {(["breakfast", "lunch", "dinner", "snack"] as const)
                  .filter((type) => shown.some((m) => m.type === type))
                  .map((type) => {
                    const group = shown.filter((m) => m.type === type);
                    return (
                      <View key={type}>
                        <View style={[s.row, { paddingHorizontal: 4, marginBottom: 8 }]}>
                          <Text style={[hubText.sectionTitle, { color: c.text100, flex: 1, fontSize: 16 }]}>{mealLabels[type]}</Text>
                          <Text style={[hubText.caption, { color: c.text300 }]}>{foodTotals(group.flatMap((m) => m.items)).calories} {tx("კკალ", "kcal")}</Text>
                        </View>
                        <View style={[s.list, { backgroundColor: c.surface }]}>
                          {group.map((meal, index) => {
                            const mealScore = meal.healthScore ?? healthScore(meal.items);
                            const t = foodTotals(meal.items);
                            const name = meal.title || meal.items.map((i) => i.name).join(" · ");
                            return (
                              <SwipeDeleteRow key={meal.id} onDelete={() => remove(meal)}>
                                {(openActions, a11y) => (
                                  <View style={{ backgroundColor: c.surface, paddingHorizontal: 14 }}>
                                    <View style={[s.mealRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
                                    <Pressable
                                      accessibilityRole="button"
                                      accessibilityLabel={tx(`${name} · ${t.calories} კკალ · რედაქტირება`, `${name} · ${t.calories} kcal · Edit`)}
                                      {...a11y}
                                      onPress={() => {
                                        openMeal(meal);
                                        setEditing(null);
                                        resetResult();
                                      }}
                                      onLongPress={openActions}
                                      delayLongPress={350}
                                      style={s.mealMain}
                                    >
                                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                                        <Text numberOfLines={1} style={[hubText.cardTitle, { color: c.text100, fontSize: 14.5 }]}>{name}</Text>
                                        <MacroLine protein={t.protein} carbs={t.carbs} fat={t.fat} />
                                        <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{sourceLabels[meal.source] || sourceLabels.manual}</Text>
                                      </View>
                                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                                        <Text style={[txt, { fontSize: 16, fontFamily: "NotoSansGeorgian_700Bold" }]}>
                                          {t.calories}
                                          <Text style={{ fontSize: 11, color: c.text300, fontFamily: "NotoSansGeorgian_400Regular" }}>{tx(" კკალ", " kcal")}</Text>
                                        </Text>
                                        <ScoreBadge score={mealScore} size="sm" />
                                      </View>
                                    </Pressable>
                                    <Pressable accessibilityRole="button" accessibilityLabel={tx("კვების კოპირება", "Copy meal")} onPress={() => { setCopyError(""); setCopying([meal]); }} disabled={busy} hitSlop={4} style={[s.icon, { marginRight: -10 }]}>
                                      <Copy size={17} color={c.text300} />
                                    </Pressable>
                                    </View>
                                  </View>
                                )}
                              </SwipeDeleteRow>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })}
                {shown.length > 0 && (
                  <View style={{ paddingHorizontal: 4, gap: 2 }}>
                    <Text style={[hubText.small, { color: c.text300 }]}>
                      {tx("შეეხე რედაქტირებისთვის, წასაშლელად გადაწიე მარცხნივ. ქულა 1–10 MEDICARD-ის მიახლოებითი შეფასებაა, არა სამედიცინო დასკვნა.", "Tap to edit, swipe left to delete. The 1–10 score is MEDICARD's approximate rating, not a medical assessment.")}
                    </Text>
                    <MedicalSourcesLink sourceIds={["mealQuality"]} />
                  </View>
                )}
                {shown.length > 0 && day !== today && button(tx("ამ დღის კოპირება", "Copy this day"), () => { setCopyError(""); setCopying(shown); }, false, false, <CopyPlus size={16} color={c.text100} />, true)}
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
                <NSegment
                  value={draft.type}
                  onChange={(type) => setDraft({ ...draft, type })}
                  options={(Object.keys(mealLabels) as Meal["type"][]).map((key) => ({ value: key, label: key === "snack" ? tx("ხემსი", "Snack") : mealLabels[key] }))}
                />
                {!!explanation && (
                  <View style={[s.row, { alignItems: "flex-start", padding: 14, borderRadius: 18, backgroundColor: M.inkSoft }]}>
                    <Info size={18} color={M.ink} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[txt, { fontSize: 13, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{uncertainty === "high" ? tx("პორცია განსაკუთრებით ყურადღებით გადაამოწმე", "Check the portion especially carefully") : uncertainty === "low" ? tx("შეფასება საკმაოდ ზუსტია", "The estimate is fairly accurate") : tx("შეფასება მიახლოებითია", "The estimate is approximate")}</Text>
                      <Text style={[hubText.caption, { color: c.text200 }]}>{explanation}</Text>
                    </View>
                  </View>
                )}
                {draft.items.map((item, index) => (
                  <View key={index} style={[s.card, { backgroundColor: c.surface, gap: 8 }]}>
                    <View style={[s.row, { gap: 4 }]}>
                      <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, flex: 1, fontSize: 16 }]}>{item.name}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={savedItems[index] ? tx("შენახულია", "Saved") : tx("შენახულებში დამატება", "Add to saved")}
                        disabled={!!savedItems[index]}
                        onPress={() => void saveItemAsFood(item, index)}
                        style={s.icon}
                      >
                        {savedItems[index] ? <BookmarkCheck color={M.ink} size={19} /> : <Bookmark color={c.text200} size={19} />}
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={tx("საკვების ამოშლა", "Remove food")} onPress={() => setDraft({ ...draft, items: draft.items.filter((_, n) => n !== index) })} style={[s.icon, { marginRight: -10 }]}>
                        <X color={c.text200} size={18} />
                      </Pressable>
                    </View>
                    <View style={[s.row, { alignItems: "baseline", gap: 8 }]}>
                      <Text style={[txt, { fontSize: 22, fontFamily: "NotoSansGeorgian_700Bold" }]}>
                        {Math.round(item.calories)}
                        <Text style={{ fontSize: 12, color: c.text300, fontFamily: "NotoSansGeorgian_400Regular" }}>{tx(" კკალ", " kcal")}</Text>
                      </Text>
                      <Text style={[txt, { color: c.text200, fontSize: 13 }]}>· {item.grams} {tx("გ", "g")}</Text>
                    </View>
                    <MacroLine protein={item.protein} carbs={item.carbs} fat={item.fat} />
                    <View style={[s.row, { gap: 8, marginTop: 2 }]}>
                      {button("½", () => setDraft({ ...draft, items: draft.items.map((v, n) => (n === index ? scaleFood(v, Math.max(0.1, v.grams / 2)) : v)) }), false, false, undefined, true)}
                      {button("×2", () => {
                        if (item.grams * 2 > 10000) {
                          setError(tx("პორცია ზედმეტად დიდია.", "That portion is too large."));
                          return;
                        }
                        setDraft({ ...draft, items: draft.items.map((v, n) => (n === index ? scaleFood(v, v.grams * 2) : v)) });
                      }, false, false, undefined, true)}
                      <View style={{ flex: 1 }}>{button(tx("რედაქტირება", "Edit"), () => editItem(index), false, false, undefined, true)}</View>
                    </View>
                  </View>
                ))}
                {draft.items.length > 0 && enabled && (
                  <View style={[s.card, { backgroundColor: c.surface, gap: 10 }]}>
                    <View style={[s.row, { gap: 8 }]}>
                      <Wand2 size={17} color={M.ink} />
                      <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14 }]}>{tx("რამე არასწორია? უთხარი Medi-ს", "Something wrong? Tell Medi")}</Text>
                    </View>
                    <TextInput
                      accessibilityLabel={tx("შესწორება", "Correction")}
                      placeholder={tx("მაგ. ქათმის მწვადი იყო · ბრინჯი ნახევარი · სოუსის გარეშე", "e.g. it was chicken kebab · half the rice · no sauce")}
                      placeholderTextColor={c.text300}
                      value={correction}
                      onChangeText={setCorrection}
                      maxLength={500}
                      multiline
                      style={[fieldStyle(true), { minHeight: 56, fontSize: 14 }]}
                    />
                    {button(scanning ? tx("ვასწორებ…", "Fixing…") : tx("შესწორება AI-ით", "Fix with AI"), () => void fix(), false, correction.trim().length < 2 || scanning, <Sparkles size={15} color={c.text100} />, true)}
                  </View>
                )}
                {draft.items.length > 0 && draft.items.length < 25 && button(tx("კიდევ საკვების დამატება", "Add more food"), () => setSheet("methods"), false, false, <Plus size={16} color={c.text100} />, true)}
                <View style={{ gap: 6 }}>
                  <Text style={[txt, { fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13, color: c.text200, marginHorizontal: 2 }]}>{draft.items.length ? tx("შენიშვნა", "Note") : tx("რა დაგვეხმარება შეფასებაში? (არასავალდებულო)", "Anything that helps the estimate? (optional)")}</Text>
                  <TextInput
                    accessibilityLabel={tx("პორციის აღწერა", "Portion description")}
                    placeholder={tx("მაგ. ორი ნაჭერი, სოუსის გარეშე", "e.g. two slices, no sauce")}
                    placeholderTextColor={c.text300}
                    value={draft.note}
                    onChangeText={(note) => setDraft({ ...draft, note })}
                    maxLength={500}
                    multiline
                    style={[fieldStyle(false), { minHeight: 62, fontSize: 14 }]}
                  />
                </View>
              </>
            )}
            {draft && editing !== null && (
              <View style={{ gap: 12 }}>
                <Text style={[hubText.body, { color: c.text200 }]}>{tx("მიუთითე მთლიანი პორციის მნიშვნელობები, არა 100 გრამის. ეტიკეტიდან შეგიძლია გადაიტანო.", "Enter values for the whole portion, not per 100 g. You can copy them from the label.")}</Text>
                {(
                  [
                    [["name", tx("საკვების სახელი", "Food name")]],
                    [
                      ["grams", tx("პორცია, გ", "Portion, g")],
                      ["calories", tx("ენერგია, კკალ", "Energy, kcal")],
                    ],
                    [
                      ["protein", tx("ცილა, გ", "Protein, g")],
                      ["carbs", tx("ნახშ., გ", "Carbs, g")],
                      ["fat", tx("ცხიმი, გ", "Fat, g")],
                    ],
                    [
                      ["fiber", tx("ბოჭკო, გ", "Fiber, g")],
                      ["sugar", tx("შაქარი, გ", "Sugar, g")],
                      ["sodium", tx("ნატრიუმი, მგ", "Sodium, mg")],
                    ],
                  ] as const
                ).map((row, rowIndex) => (
                  <View key={rowIndex} style={{ gap: 6 }}>
                    {rowIndex === 3 ? <Text style={[hubText.caption, { color: c.text300, marginHorizontal: 2 }]}>{tx("არასავალდებულო", "Optional")}</Text> : null}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {row.map(([key, label]) => (
                        <View key={key} style={{ flex: 1, minWidth: 0, gap: 6 }}>
                          <Text numberOfLines={1} style={[hubText.caption, { color: c.text200, marginHorizontal: 2, fontFamily: "NotoSansGeorgian_600SemiBold" }]}>{label}</Text>
                          <TextInput
                            accessibilityLabel={label}
                            testID={`nutrition-field-${key}`}
                            value={fields[key]}
                            maxLength={key === "name" ? 120 : 8}
                            onChangeText={(value) => setFields({ ...fields, [key]: value })}
                            keyboardType={key === "name" ? "default" : "decimal-pad"}
                            style={[fieldStyle(false), key !== "name" && { textAlign: "center", paddingHorizontal: 8 }]}
                          />
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
                {button(tx("გაუქმება", "Cancel"), close, false, false, undefined, true)}
              </View>
            )}
            <Text style={[hubText.small, { color: c.text300, paddingHorizontal: 4 }]}>
              {tx("შეფასებული კალორიები და საკვები ნივთიერებები სავარაუდოა. ეს არ არის სამედიცინო ან დიეტოლოგიური დანიშნულება.", "Estimated calories and nutrients are approximate. This is not medical or dietary advice.")}
            </Text>
          </View>
        </KeyboardFormShell>
      </SwipeGroup>
      {held && !draft ? <UndoToast key={held.id} title={tx("კვება წაიშალა", "Meal deleted")} bottom={safe.bottom + 16} onUndo={undo} /> : null}
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
      <DescribeMealModal visible={sheet === "describe"} owner={owner} busy={busy} error={sheetError} consentNotice={describeNotice} onClose={() => setSheet(null)} onSubmit={(text, voice) => void describe(text, voice)} />
      <NConfirm
        visible={!!confirmation}
        title={confirmation?.title || ""}
        message={confirmation?.message}
        cancelLabel={tx("დარჩენა", "Stay")}
        confirmLabel={tx("გასვლა", "Discard")}
        danger
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          const action = confirmation?.action;
          setConfirmation(null);
          action?.();
        }}
      />
    </>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  card: { padding: HUB.cardPad, borderRadius: HUB.cardRadius },
  list: { borderRadius: HUB.cardRadius, overflow: "hidden" },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 66 },
  mealMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  dayBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 6, borderRadius: 18, minHeight: 56 },
  dayButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  macroGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  macroCell: { width: "33.33%", gap: 1 },
  button: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  buttonCompact: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 14 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 50 },
});
