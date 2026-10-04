import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from 'react-native';
import { Switch } from '@/components/ui/AppSwitch';
import { useFocusEffect, useRouter } from "expo-router";
import { Bell, Flame, Footprints, HeartPulse, RefreshCcw, type LucideIcon } from "lucide-react-native";
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
import { NScreen, NText, NCard, NButton, NChip, NError, NLoading, NNotice, NStepper, useMedifood, withMedifood } from "@/components/nutrition/ProgramUI";
import { HubSection } from "@/components/nutrition/NutritionUi";

const TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"];

export default withMedifood(function NutritionSettingsScreen() {
  const { user } = useAuth();
  return <Settings key={user?.id || "guest"} />;
});
/** Budget rules (rollover, burned energy, steps) and meal reminders. */
function Settings() {
  const c = useThemeColors();
  const M = useMedifood();
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
  const row = (icon: LucideIcon, title: string, detail: string, value: boolean, onChange: (v: boolean) => void, first = false) => {
    const Icon = icon;
    return (
      <View style={[s.toggle, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
        <View style={[s.tile, { backgroundColor: M.inkSoft }]}>
          <Icon size={19} color={M.ink} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14.5 }}>{title}</NText>
          <NText style={{ fontSize: 12, color: c.text200, lineHeight: 17 }}>{detail}</NText>
        </View>
        <Switch accessibilityLabel={title} value={value} disabled={busy} onValueChange={onChange} trackColor={{ true: c.primary200, false: c.bg300 }} thumbColor="#FFFFFF" />
      </View>
    );
  };
  const timePicker = (label: string, key: "breakfast" | "lunch" | "dinner") => (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <NText style={{ fontSize: 13, fontFamily: "NotoSansGeorgian_600SemiBold" }}>{label}</NText>
        <NText style={{ fontSize: 13, color: M.ink, fontFamily: "NotoSansGeorgian_600SemiBold", fontVariant: ["tabular-nums"] }}>{prefs?.reminders[key]}</NText>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {TIMES.filter((t) => (key === "breakfast" ? t < "10:00" : key === "lunch" ? t >= "12:00" && t < "15:00" : t >= "18:00")).map((t) => (
          <NChip
            key={t}
            on="card"
            label={t}
            accessibilityLabel={`${label} ${t}`}
            selected={prefs?.reminders[key] === t}
            disabled={busy}
            onPress={() => prefs && void save({ ...prefs, reminders: { ...prefs.reminders, [key]: t } })}
            style={{ minHeight: 34, paddingHorizontal: 11 }}
          />
        ))}
      </View>
    </View>
  );
  return (
    <NScreen title={tx("პარამეტრები", "Settings")}>
      {!!error && <NError message={error} retry={() => void load()} />}
      {!prefs ? (
        <NLoading />
      ) : (
        <>
          <HubSection first title={tx("დღის ბიუჯეტი", "Daily budget")}>
            <NCard style={{ gap: 0, paddingVertical: 6 }}>
              {row(Flame, tx("დამწვარი კალორია ბიუჯეტში", "Burned calories in budget"), tx("ვარჯიშისა და ნაბიჯების ენერგია დღის სამიზნეს ემატება.", "Energy from exercise and steps is added to your daily target."), prefs.addBurned, (v) => void save({ ...prefs, addBurned: v }), true)}
              {row(Footprints, tx("ნაბიჯების ჩათვლა", "Count steps"), tx("ნაბიჯების სინქრონიდან სავარაუდო ენერგია დამწვარში ჩაითვლება.", "Estimated energy from synced steps counts as burned."), prefs.countSteps, (v) => void save({ ...prefs, countSteps: v }))}
              {row(RefreshCcw, tx("გუშინდელი ნაშთის გადმოტანა", "Roll over yesterday's leftover"), tx("თუ გუშინ სამიზნეზე ნაკლები მიიღე, 200 კკალ-მდე დღეს გადმოგყვება. გადაჭარბება არასდროს „ივალება“.", "If you ate less than your target yesterday, up to 200 kcal carries over to today. Going over is never counted as debt."), prefs.rollover, (v) => void save({ ...prefs, rollover: v }))}
            </NCard>
          </HubSection>

          <HubSection title={tx("მაკროების განაწილება", "Macro split")}>
            <NCard>
              <NText style={{ fontSize: 12, color: c.text200, lineHeight: 18 }}>
                {tx("დღის კალორიას გეგმა ითვლის; აქ ირჩევ, როგორ გადანაწილდეს ცილაზე, ნახშირწყლებსა და ცხიმზე.", "Your plan sets your daily calories; here you choose how they split between protein, carbs and fat.")}
              </NText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {MACRO_PRESETS.map((p) => {
                  const active = p.shares.protein === shares.protein && p.shares.carbs === shares.carbs && p.shares.fat === shares.fat;
                  return (
                    <NChip
                      key={p.key}
                      on="card"
                      label={p.label}
                      detail={`${p.shares.protein} / ${p.shares.carbs} / ${p.shares.fat} · ${p.detail}`}
                      accessibilityLabel={tx(`${p.label}: ცილა ${p.shares.protein}%, ნახშირწყლები ${p.shares.carbs}%, ცხიმი ${p.shares.fat}%`, `${p.label}: protein ${p.shares.protein}%, carbs ${p.shares.carbs}%, fat ${p.shares.fat}%`)}
                      selected={active}
                      disabled={busy}
                      onPress={() => choosePreset(p.shares, p.key)}
                      lines={2}
                      style={{ width: "48%", flexGrow: 1, alignItems: "flex-start", justifyContent: "flex-start", paddingVertical: 10 }}
                    />
                  );
                })}
              </View>
              <View>
                {(
                  [
                    ["protein", tx("ცილა", "Protein")],
                    ["carbs", tx("ნახშირწყლები", "Carbs")],
                    ["fat", tx("ცხიმი", "Fat")],
                  ] as const
                ).map(([key, label], index) => {
                  const grams = calories ? macroGrams(calories, shares)[key] : null;
                  return (
                    <View key={key} style={[s.macro, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
                          {label} · <NText style={{ fontFamily: "NotoSansGeorgian_700Bold", color: M.ink }}>{shares[key]}%</NText>
                        </NText>
                        <NText style={{ fontSize: 12, lineHeight: 17, color: c.text200 }}>{grams != null ? tx(`${grams} გ დღეში`, `${grams} g a day`) : tx("გრამები გეგმის შემდეგ გამოჩნდება", "Grams appear once you have a plan")}</NText>
                      </View>
                      {key !== "fat" ? (
                        <NStepper
                          value={`${shares[key]}%`}
                          width={44}
                          minusLabel={tx(`${label} 5%-ით ნაკლები`, `${label} 5% less`)}
                          plusLabel={tx(`${label} 5%-ით მეტი`, `${label} 5% more`)}
                          minusDisabled={busy}
                          plusDisabled={busy}
                          onMinus={() => nudge(key, -5)}
                          onPlus={() => nudge(key, 5)}
                        />
                      ) : (
                        <NText style={{ fontSize: 12, color: c.text300 }}>{tx("ავტომატური", "Automatic")}</NText>
                      )}
                    </View>
                  );
                })}
              </View>
              <NText style={{ fontSize: 11, color: c.text300, lineHeight: 17 }}>
                {custom ? tx("საკუთარი განაწილება · ცხიმი ავტომატურად ავსებს 100%-ს.", "Custom split · fat fills up to 100% automatically.") : tx("ნაგულისხმევი: 20 / 50 / 30.", "Default: 20 / 50 / 30.")} {tx("რეკომენდებული დიაპაზონი (AMDR): ცილა 10–35%, ნახშირწყლები 45–65%, ცხიმი 20–35%. აპის ზღვრები უფრო ფართოა: ცილა 10–40%, ნახშირწყლები 15–65%, ცხიმი 15–50%. თირკმლის დაავადებისას ცილის რაოდენობა ექიმთან შეათანხმე.", "Recommended range (AMDR): protein 10–35%, carbs 45–65%, fat 20–35%. The app's limits are wider: protein 10–40%, carbs 15–65%, fat 15–50%. If you have kidney disease, agree on your protein amount with your doctor.")}
              </NText>
              <MedicalSourcesLink sourceIds={["macroRanges", "energyTarget"]} />
            </NCard>
          </HubSection>

          {healthName && (
            <HubSection title={healthName}>
              <NCard style={{ gap: 0, paddingVertical: 6 }}>
                {row(
                  HeartPulse,
                  tx(`${healthName}-ში ჩაწერა`, `Write to ${healthName}`),
                  tx(`დადასტურებული კვების კალორია, ცილა, ნახშირწყლები და ცხიმი ${healthName}-ში გადავა — სხვა აპები და საათი დაინახავს.`, `Calories, protein, carbs and fat from confirmed meals go to ${healthName} — other apps and your watch will see them.`),
                  healthOn,
                  (v) => void toggleHealth(v),
                  true,
                )}
                {healthBusy && <NText style={{ fontSize: 12, color: c.text200, paddingBottom: 8 }}>{tx("მიმდინარეობს…", "Working…")}</NText>}
                {!!healthNote && <NText accessibilityLiveRegion="polite" style={{ fontSize: 12, lineHeight: 18, color: c.text200, paddingBottom: 8 }}>{healthNote}</NText>}
              </NCard>
            </HubSection>
          )}

          <HubSection title={tx("შეხსენებები", "Reminders")}>
            <NCard>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[s.tile, { backgroundColor: M.inkSoft }]}>
                  <Bell size={19} color={M.ink} strokeWidth={1.9} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14.5 }}>{tx("კვების შეხსენებები", "Meal reminders")}</NText>
                  <NText style={{ fontSize: 12, color: c.text200, lineHeight: 17 }}>{tx("სამი მოკლე შეხსენება — უბრალოდ დროზე გახსენებს.", "Three short reminders — they just remind you on time.")}</NText>
                </View>
                <Switch accessibilityLabel={tx("შეხსენებები", "Reminders")} value={prefs.reminders.enabled} disabled={busy} onValueChange={(v) => (v ? void enableReminders() : void save({ ...prefs, reminders: { ...prefs.reminders, enabled: false } }))} trackColor={{ true: c.primary200, false: c.bg300 }} thumbColor="#FFFFFF" />
              </View>
              {prefs.reminders.enabled && (
                <>
                  {timePicker(tx("საუზმე", "Breakfast"), "breakfast")}
                  {timePicker(tx("სადილი", "Lunch"), "lunch")}
                  {timePicker(tx("ვახშამი", "Dinner"), "dinner")}
                </>
              )}
              {permission === false && prefs.reminders.enabled && <NText style={{ fontSize: 12, color: c.danger }}>{tx("შეტყობინებების ნებართვა გამორთულია — შეხსენებები ვერ გამოჩნდება.", "Notifications are off — reminders can't appear.")}</NText>}
            </NCard>
          </HubSection>
          {!!message && <NNotice>{message}</NNotice>}
          <NButton secondary label={tx("მიზნისა და გეგმის ნახვა", "See goal and plan")} onPress={() => router.push("/nutrition/goal")} />
        </>
      )}
    </NScreen>
  );
}

const s = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  macro: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 6 },
});
