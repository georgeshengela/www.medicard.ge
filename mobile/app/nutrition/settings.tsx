import React, { useCallback, useRef, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Bell, Flame, Footprints, RefreshCcw } from "lucide-react-native";
import { api } from "@/lib/api";
import { defaultNutritionPreferences, type NutritionPreferences } from "@/lib/nutritionProgram";
import { getNotificationPermissionGranted, requestNotificationPermission, syncNutritionReminders } from "@/lib/notifications";
import { localAccountId } from "@/lib/localAccount";
import { useAuth } from "@/store/AuthContext";
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
  const seq = useRef(0);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setError("");
    try {
      const [data, granted] = await Promise.all([api.nutrition.preferences.get(), getNotificationPermissionGranted().catch(() => false)]);
      if (n !== seq.current) return;
      setPrefs({ ...defaultNutritionPreferences(), ...data.preferences });
      setPermission(granted);
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
      const saved = await api.nutrition.preferences.save(next);
      const count = await syncNutritionReminders(saved.preferences.reminders, owner);
      setMessage(saved.preferences.reminders.enabled ? (count ? `შენახულია · ${count} შეხსენება დაიგეგმა` : "შენახულია · შეხსენებას ნებართვა სჭირდება") : "შენახულია");
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
      setError("შეტყობინებების ნებართვა არ არის ჩართული. ჩართე პარამეტრებში და სცადე თავიდან.");
      return;
    }
    await save({ ...prefs, reminders: { ...prefs.reminders, enabled: true } });
  };
  const row = (icon: React.ReactNode, title: string, detail: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: c.bg200, alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{title}</NText>
        <NText style={{ fontSize: 12, color: c.text200, lineHeight: 18 }}>{detail}</NText>
      </View>
      <Switch accessibilityLabel={title} value={value} disabled={busy} onValueChange={onChange} trackColor={{ true: "#0D9488", false: c.bg300 }} thumbColor="#FFFFFF" />
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
    <NScreen title="კვების პარამეტრები" subtitle="ბიუჯეტის წესები და შეხსენებები">
      {!!error && <NError message={error} retry={() => void load()} />}
      {!prefs ? (
        <NLoading />
      ) : (
        <>
          <NCard>
            <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 16 }}>დღის ბიუჯეტი</NText>
            {row(<Flame size={20} color={c.primary100} />, "დამწვარი კალორია ბიუჯეტში", "ვარჯიშისა და ნაბიჯების ენერგია დღის სამიზნეს ემატება. Cal AI-ს „add burned calories“ წესი.", prefs.addBurned, (v) => void save({ ...prefs, addBurned: v }))}
            {row(<Footprints size={20} color={c.primary100} />, "ნაბიჯების ჩათვლა", "ნაბიჯების სინქრონიდან სავარაუდო ენერგია დამწვარში ჩაითვლება.", prefs.countSteps, (v) => void save({ ...prefs, countSteps: v }))}
            {row(<RefreshCcw size={20} color={c.primary100} />, "გუშინდელი ნაშთის გადმოტანა", "თუ გუშინ სამიზნეზე ნაკლები მიიღე, 200 კკალ-მდე დღეს გადმოგყვება. გადაჭარბება არასდროს „ივალება“.", prefs.rollover, (v) => void save({ ...prefs, rollover: v }))}
          </NCard>
          <NCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Bell size={20} color={c.primary100} />
              <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 16, flex: 1 }}>კვების შეხსენებები</NText>
              <Switch accessibilityLabel="შეხსენებები" value={prefs.reminders.enabled} disabled={busy} onValueChange={(v) => (v ? void enableReminders() : void save({ ...prefs, reminders: { ...prefs.reminders, enabled: false } }))} trackColor={{ true: "#0D9488", false: c.bg300 }} thumbColor="#FFFFFF" />
            </View>
            <NText style={{ fontSize: 12, color: c.text200 }}>სამი მოკლე შეხსენება ტელეფონზე. არ ამოწმებს რა ჭამე — უბრალოდ დროზე გახსენებს.</NText>
            {prefs.reminders.enabled && (
              <>
                {timePicker("საუზმე", "breakfast")}
                {timePicker("სადილი", "lunch")}
                {timePicker("ვახშამი", "dinner")}
              </>
            )}
            {permission === false && prefs.reminders.enabled && <NText style={{ fontSize: 12, color: c.danger }}>შეტყობინებების ნებართვა გამორთულია — შეხსენებები ვერ გამოჩნდება.</NText>}
          </NCard>
          {!!message && <NText accessibilityLiveRegion="polite" style={{ color: c.success, fontSize: 13, textAlign: "center" }}>{message}</NText>}
          <NButton secondary label="მიზნისა და გეგმის ნახვა" onPress={() => router.push("/nutrition/goal")} />
        </>
      )}
    </NScreen>
  );
}
