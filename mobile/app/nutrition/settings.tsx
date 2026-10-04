import React, { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from 'react-native';
import { Switch } from '@/components/ui/AppSwitch';
import { useFocusEffect, useRouter } from "expo-router";
import { Bell, Flame, Footprints, HeartPulse, Minus, PieChart, Plus, RefreshCcw } from "lucide-react-native";
import { api } from "@/lib/api";
import { defaultNutritionPreferences, MACRO_BOUNDS, MACRO_PRESETS, macroGrams, nutritionProgramApi, type MacroShares, type NutritionPreferences } from "@/lib/nutritionProgram";
import {
  backfillNutritionToHealth,
  disableNutritionHealthWrite,
  enableNutritionHealthWrite,
  isNutritionHealthWriteEnabled,
  nutritionHealthName,
} from "@/lib/nutritionHealth";
import { getNotificationPermissionGranted, requestNotificationPermission, syncNutritionReminders } from "@/lib/notifications";
import { isReminderFamilyOn, setReminderFamily } from "@/lib/reminderPrefs";
import { localAccountId } from "@/lib/localAccount";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { useAuth } from "@/store/AuthContext";
import { tx } from "@/i18n/locale";
import { useThemeColors } from "@/theme/colors";
import { NScreen, NText, NCard, NButton, NError, NLoading } from "@/components/nutrition/ProgramUI";

const TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

export default function NutritionSettingsScreen() {
  const { user } = useAuth();
  return <Settings key={user?.id || "guest"} />;
}
/** Budget rules (rollover, burned energy, steps) and meal reminders. */
function Settings() {
  const c = useThemeColors();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NutritionPreferences | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [permission, setPermission] = useState<boolean | null>(null);
  const [calories, setCalories] = useState<number | null>(null);
  const [healthOn, setHealthOn] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthNote, setHealthNote] = useState("");
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setError("");
    try {
      const [data, granted, dashboard, health, remindersOn] = await Promise.all([
        api.nutrition.preferences.get(),
        getNotificationPermissionGranted().catch(() => false),
        nutritionProgramApi.dashboard().catch(() => null),
        isNutritionHealthWriteEnabled().catch(() => false),
        isReminderFamilyOn("nutrition"),
      ]);
      if (n !== seq.current) return;
      // On/off is the shared switch (Profile → შეტყობინებები, default on); the server row holds the times.
      const loaded = { ...defaultNutritionPreferences(), ...data.preferences };
      setPrefs({ ...loaded, reminders: { ...loaded.reminders, enabled: remindersOn } });
      setPermission(granted);
      setCalories(dashboard?.targets?.calories ?? null);
      setHealthOn(health);
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        seq.current++;
      };
    }, [load]),
  );
  const save = async (next: NutritionPreferences) => {
    setPrefs(next);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const owner = localAccountId();
      await setReminderFamily("nutrition", next.reminders.enabled);
      const saved = await api.nutrition.preferences.save(next);
      const count = await syncNutritionReminders(saved.preferences.reminders, owner);
      setMessage(next.reminders.enabled ? (count ? tx(`შენახულია · ${count} შეხსენება დაიგეგმა`, `Saved · ${count} ${count === 1 ? "reminder" : "reminders"} scheduled`) : tx("შენახულია · შეხსენებას ნებართვა სჭირდება", "Saved · reminders need permission")) : tx("შენახულია", "Saved"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const enableReminders = async () => {
    if (!prefs) return;
    // Permission is requested only from this button press, never from an effect.
    const granted = permission || (await requestNotificationPermission());
    setPermission(granted);
    if (!granted) {
      setError(tx("შეტყობინებების ნებართვა არ არის ჩართული. ჩართე პარამეტრებში და სცადე თავიდან.", "Notifications aren't allowed. Turn them on in Settings and try again."));
      return;
    }
    await save({ ...prefs, reminders: { ...prefs.reminders, enabled: true } });
  };
  const shares: MacroShares = prefs ? { protein: prefs.macros.protein, carbs: prefs.macros.carbs, fat: prefs.macros.fat } : { protein: 20, carbs: 50, fat: 30 };
  const custom = prefs?.macros.mode === "custom";
  const choosePreset = (preset: MacroShares, key: string) => {
    if (!prefs) return;
    void save({ ...prefs, macros: { mode: key === "balanced" ? "auto" : "custom", ...preset } });
  };
  /** Moving protein or carbs by 5 points takes the difference from fat, so the total stays 100. */
  const nudge = (key: "protein" | "carbs", delta: number) => {
    if (!prefs) return;
    const next = { ...shares, [key]: shares[key] + delta, fat: shares.fat - delta };
    const inside = (k: keyof MacroShares) => next[k] >= MACRO_BOUNDS[k][0] && next[k] <= MACRO_BOUNDS[k][1];
    if (!inside(key) || !inside("fat")) return;
    void save({ ...prefs, macros: { mode: "custom", ...next } });
  };
  const healthName = nutritionHealthName();
  const toggleHealth = async (value: boolean) => {
    setHealthBusy(true);
    setHealthNote("");
    setError("");
    try {
      if (!value) {
        await disableNutritionHealthWrite();
        setHealthOn(false);
        setHealthNote(tx(`${healthName}-ში ახალი კვებები აღარ ჩაიწერება. უკვე ჩაწერილი იქ რჩება.`, `New meals won't be written to ${healthName} anymore. What's already there stays.`));
        return;
      }
      // The system sheet is shown only from this switch press.
      const result = await enableNutritionHealthWrite();
      if (!result.ok) {
        setHealthNote(
          result.reason === "expo_go"
            ? tx("Expo Go-ში ჯანმრთელობის აპთან კავშირი არ მუშაობს — საჭიროა აპის build.", "Connecting to the health app doesn't work in Expo Go — an app build is needed.")
            : result.reason === "not_installed"
              ? tx("Health Connect არ არის დაყენებული. დააყენე და სცადე თავიდან.", "Health Connect isn't installed. Install it and try again.")
              : result.reason === "denied"
                ? tx(`${healthName}-მა ჩაწერის ნებართვა არ მისცა. ჩართე კვების ჩაწერა ${healthName}-ის პარამეტრებში.`, `${healthName} didn't allow writing. Turn on nutrition writing in ${healthName} settings.`)
                : tx("კავშირი ვერ შედგა. სცადე თავიდან.", "Couldn't connect. Try again."),
        );
        return;
      }
      setHealthOn(true);
      const count = await backfillNutritionToHealth(7).catch(() => 0);
      setHealthNote(count ? tx(`ჩართულია · ბოლო 7 დღის ${count} კვება ჩაიწერა`, `On · ${count} ${count === 1 ? "meal" : "meals"} from the last 7 days written`) : tx("ჩართულია · ახალი კვებები ავტომატურად ჩაიწერება", "On · new meals will be written automatically"));
    } finally {
      setHealthBusy(false);
    }
  };
  const row = (icon: React.ReactNode, title: string, detail: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.bg200, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{title}</NText>
        <NText style={{ fontSize: 12, color: c.text200, lineHeight: 18 }}>{detail}</NText>
      </View>
      <Switch accessibilityLabel={title} value={value} disabled={busy} onValueChange={onChange} trackColor={{ true: c.primary200, false: c.bg300 }} thumbColor="#FFFFFF" />
    </View>
  );
  const timePicker = (label: string, key: "breakfast" | "lunch" | "dinner") => (
    <View style={{ gap: 6 }}>
      <NText style={{ fontSize: 12, color: c.text200 }}>{label} · {prefs?.reminders[key]}</NText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {TIMES.filter((t) => (key === "breakfast" ? t < "10:00" : key === "lunch" ? t >= "12:00" && t < "15:00" : t >= "18:00")).map((t) => {
          const active = prefs?.reminders[key] === t;
          return (
            <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: active }} disabled={busy} onPress={() => prefs && void save({ ...prefs, reminders: { ...prefs.reminders, [key]: t } })} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, borderWidth: 1, backgroundColor: active ? c.accent100 : c.bg200, borderColor: active ? c.primary100 : c.bg300 }}>
              <Text style={{ fontFamily: "NotoSansGeorgian_400Regular", fontSize: 12, color: c.text100 }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
  return (
    <NScreen title={tx("კვების პარამეტრები", "Nutrition settings")} subtitle={tx("ბიუჯეტი, მაკროები, შეხსენებები", "Budget, macros, reminders")}>
      {!!error && <NError message={error} retry={() => void load()} />}
      {!prefs ? (
        <NLoading />
      ) : (
        <>
          <NCard>
            <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 16 }}>{tx("დღის ბიუჯეტი", "Daily budget")}</NText>
            {row(<Flame size={20} color={c.primary100} />, tx("დამწვარი კალორია ბიუჯეტში", "Burned calories in budget"), tx("ვარჯიშისა და ნაბიჯების ენერგია დღის სამიზნეს ემატება.", "Energy from exercise and steps is added to your daily target."), prefs.addBurned, (v) => void save({ ...prefs, addBurned: v }))}
            {row(<Footprints size={20} color={c.primary100} />, tx("ნაბიჯების ჩათვლა", "Count steps"), tx("ნაბიჯების სინქრონიდან სავარაუდო ენერგია დამწვარში ჩაითვლება.", "Estimated energy from synced steps counts as burned."), prefs.countSteps, (v) => void save({ ...prefs, countSteps: v }))}
            {row(<RefreshCcw size={20} color={c.primary100} />, tx("გუშინდელი ნაშთის გადმოტანა", "Roll over yesterday's leftover"), tx("თუ გუშინ სამიზნეზე ნაკლები მიიღე, 200 კკალ-მდე დღეს გადმოგყვება. გადაჭარბება არასდროს „ივალება“.", "If you ate less than your target yesterday, up to 200 kcal carries over to today. Going over is never counted as debt."), prefs.rollover, (v) => void save({ ...prefs, rollover: v }))}
          </NCard>
          <NCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <PieChart size={20} color={c.primary100} />
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 16, flex: 1 }}>{tx("მაკროების განაწილება", "Macro split")}</NText>
            </View>
            <NText style={{ fontSize: 12, color: c.text200, lineHeight: 18 }}>
              {tx("დღის კალორიას გეგმა ითვლის; აქ ირჩევ, როგორ გადანაწილდეს ცილაზე, ნახშირწყლებსა და ცხიმზე.", "Your plan sets your daily calories; here you choose how they split between protein, carbs and fat.")}
            </NText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {MACRO_PRESETS.map((p) => {
                const active = p.shares.protein === shares.protein && p.shares.carbs === shares.carbs && p.shares.fat === shares.fat;
                return (
                  <Pressable key={p.key} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={tx(`${p.label}: ცილა ${p.shares.protein}%, ნახშირწყლები ${p.shares.carbs}%, ცხიმი ${p.shares.fat}%`, `${p.label}: protein ${p.shares.protein}%, carbs ${p.shares.carbs}%, fat ${p.shares.fat}%`)} disabled={busy} onPress={() => choosePreset(p.shares, p.key)} style={{ width: "48%", flexGrow: 1, minHeight: 60, padding: 10, borderRadius: 14, borderWidth: 1.5, backgroundColor: active ? c.accent100 : c.bg200, borderColor: active ? c.primary100 : "transparent", gap: 2 }}>
                    <Text style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13, color: c.text100 }}>{p.label}</Text>
                    <Text style={{ fontFamily: "NotoSansGeorgian_400Regular", fontSize: 11, color: c.text200 }}>{p.shares.protein} / {p.shares.carbs} / {p.shares.fat} · {p.detail}</Text>
                  </Pressable>
                );
              })}
            </View>
            {([
              ["protein", tx("ცილა", "Protein")],
              ["carbs", tx("ნახშირწყლები", "Carbs")],
              ["fat", tx("ცხიმი", "Fat")],
            ] as const).map(([key, label]) => {
              const grams = calories ? macroGrams(calories, shares)[key] : null;
              return (
                <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
                  <View style={{ flex: 1 }}>
                    <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{label} · {shares[key]}%</NText>
                    <NText style={{ fontSize: 12, color: c.text200 }}>{grams != null ? tx(`${grams} გ დღეში`, `${grams} g a day`) : tx("გრამები გეგმის შექმნის შემდეგ გამოჩნდება", "Grams appear once you create a plan")}</NText>
                  </View>
                  {key !== "fat" && (
                    <>
                      <Pressable accessibilityRole="button" accessibilityLabel={tx(`${label} 5%-ით ნაკლები`, `${label} 5% less`)} disabled={busy} onPress={() => nudge(key, -5)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.bg200, alignItems: "center", justifyContent: "center" }}>
                        <Minus size={16} color={c.text100} />
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={tx(`${label} 5%-ით მეტი`, `${label} 5% more`)} disabled={busy} onPress={() => nudge(key, 5)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.bg200, alignItems: "center", justifyContent: "center" }}>
                        <Plus size={16} color={c.text100} />
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })}
            <NText style={{ fontSize: 11, color: c.text300, lineHeight: 17 }}>
              {custom ? tx("საკუთარი განაწილება · ცხიმი ავტომატურად ავსებს 100%-ს.", "Custom split · fat fills up to 100% automatically.") : tx("ნაგულისხმევი: 20 / 50 / 30.", "Default: 20 / 50 / 30.")} {tx("რეკომენდებული დიაპაზონი (AMDR): ცილა 10–35%, ნახშირწყლები 45–65%, ცხიმი 20–35%. აპის ზღვრები უფრო ფართოა: ცილა 10–40%, ნახშირწყლები 15–65%, ცხიმი 15–50%. თირკმლის დაავადებისას ცილის რაოდენობა ექიმთან შეათანხმე.", "Recommended range (AMDR): protein 10–35%, carbs 45–65%, fat 20–35%. The app's limits are wider: protein 10–40%, carbs 15–65%, fat 15–50%. If you have kidney disease, agree on your protein amount with your doctor.")}
            </NText>
            <MedicalSourcesLink sourceIds={["macroRanges", "energyTarget"]} />
          </NCard>
          {healthName && (
            <NCard>
              {row(
                <HeartPulse size={20} color={c.primary100} />,
                tx(`${healthName}-ში ჩაწერა`, `Write to ${healthName}`),
                tx(`დადასტურებული კვების კალორია, ცილა, ნახშირწყლები და ცხიმი ${healthName}-ში გადავა — სხვა აპები და საათი დაინახავს.`, `Calories, protein, carbs and fat from confirmed meals go to ${healthName} — other apps and your watch will see them.`),
                healthOn,
                (v) => void toggleHealth(v),
              )}
              {healthBusy && <NText style={{ fontSize: 12, color: c.text200 }}>{tx("მიმდინარეობს…", "Working…")}</NText>}
              {!!healthNote && <NText accessibilityLiveRegion="polite" style={{ fontSize: 12, color: c.text200 }}>{healthNote}</NText>}
            </NCard>
          )}
          <NCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Bell size={20} color={c.primary100} />
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 16, flex: 1 }}>{tx("კვების შეხსენებები", "Meal reminders")}</NText>
              <Switch accessibilityLabel={tx("შეხსენებები", "Reminders")} value={prefs.reminders.enabled} disabled={busy} onValueChange={(v) => (v ? void enableReminders() : void save({ ...prefs, reminders: { ...prefs.reminders, enabled: false } }))} trackColor={{ true: c.primary200, false: c.bg300 }} thumbColor="#FFFFFF" />
            </View>
            <NText style={{ fontSize: 12, color: c.text200 }}>{tx("სამი მოკლე შეხსენება ტელეფონზე. არ ამოწმებს რა ჭამე — უბრალოდ დროზე გახსენებს.", "Three short reminders on your phone. They don't check what you ate — they just remind you on time.")}</NText>
            {prefs.reminders.enabled && (
              <>
                {timePicker(tx("საუზმე", "Breakfast"), "breakfast")}
                {timePicker(tx("სადილი", "Lunch"), "lunch")}
                {timePicker(tx("ვახშამი", "Dinner"), "dinner")}
              </>
            )}
            {permission === false && prefs.reminders.enabled && <NText style={{ fontSize: 12, color: c.danger }}>{tx("შეტყობინებების ნებართვა გამორთულია — შეხსენებები ვერ გამოჩნდება.", "Notifications are off — reminders can't appear.")}</NText>}
          </NCard>
          {!!message && <NText accessibilityLiveRegion="polite" style={{ color: c.success, fontSize: 13, textAlign: "center" }}>{message}</NText>}
          <NButton secondary label={tx("მიზნისა და გეგმის ნახვა", "See goal and plan")} onPress={() => router.push("/nutrition/goal")} />
        </>
      )}
    </NScreen>
  );
}
