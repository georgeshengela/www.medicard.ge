import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Flame, Footprints, Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { localDay, newUuid, shiftDay } from "@/lib/nutrition";
import { nutritionDateLabel, type NutritionActivity } from "@/lib/nutritionProgram";
import { useAuth } from "@/store/AuthContext";
import { useThemeColors } from "@/theme/colors";
import { NScreen, NText, NCard, NButton, NError, NLoading } from "@/components/nutrition/ProgramUI";

const KINDS: { key: string; label: string }[] = [
  { key: "walk", label: "სიარული" },
  { key: "run", label: "სირბილი" },
  { key: "cycle", label: "ველოსიპედი" },
  { key: "strength", label: "ძალოვანი" },
  { key: "swim", label: "ცურვა" },
  { key: "yoga", label: "იოგა" },
  { key: "hiit", label: "HIIT" },
  { key: "sport", label: "სპორტი" },
  { key: "dance", label: "ცეკვა" },
  { key: "other", label: "სხვა" },
];
const MINUTES = [15, 30, 45, 60, 90];

export default function NutritionActivityScreen() {
  const { user } = useAuth();
  return <Activity key={user?.id || "guest"} />;
}
/** Exercise log: kind, minutes, optional own calorie figure. MET estimate otherwise. */
function Activity() {
  const c = useThemeColors();
  const [rows, setRows] = useState<NutritionActivity[]>([]);
  const [labels, setLabels] = useState<Record<string, { met: number; label: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("walk");
  const [minutes, setMinutes] = useState("30");
  const [kcal, setKcal] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const seq = useRef(0);
  const today = localDay();
  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const data = await api.nutrition.activities.list(shiftDay(today, -13), today);
      if (n !== seq.current) return;
      setRows(data.activities);
      setLabels(data.kinds);
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [today]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        seq.current++;
      };
    }, [load]),
  );
  useEffect(() => () => {
    seq.current++;
  }, []);
  const save = async () => {
    const mins = Number(minutes);
    const own = kcal.trim() ? Number(kcal) : null;
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) {
      setError("წუთები 1-დან 600-მდე უნდა იყოს.");
      return;
    }
    if (own != null && (!Number.isInteger(own) || own < 0 || own > 5000)) {
      setError("კალორია მთელი რიცხვი უნდა იყოს, 5000-მდე.");
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.nutrition.activities.save({ id: newUuid(), date: today, kind, minutes: mins, kcal: own, note: note.trim() });
      setMessage(result.estimated ? `ჩაიწერა · ≈${result.activity.kcal} კკალ (MET შეფასება)` : `ჩაიწერა · ${result.activity.kcal} კკალ`);
      setKcal("");
      setNote("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api.nutrition.activities.remove(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const todayRows = rows.filter((r) => r.date === today);
  const todayKcal = todayRows.reduce((s, r) => s + r.kcal, 0);
  const chip = (active: boolean, label: string, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, borderWidth: 1, minHeight: 40, justifyContent: "center", backgroundColor: active ? c.accent100 : c.bg200, borderColor: active ? c.primary100 : c.bg300 }}>
      <NText style={{ fontSize: 13 }}>{label}</NText>
    </Pressable>
  );
  const input = { backgroundColor: c.bg200, color: c.text100, borderColor: c.bg300, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, minHeight: 48, fontFamily: "NotoSansGeorgian_400Regular" } as const;
  return (
    <NScreen title="ვარჯიში და ენერგია" subtitle="დამწვარი კალორია შენი არჩევანით ბიუჯეტში ჩაითვლება" footer={<NButton label={busy ? "ინახება…" : "დღეს ჩაწერა"} disabled={busy} onPress={() => void save()} />}>
      {!!error && <NError message={error} />}
      <NCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Flame size={20} color={c.primary100} />
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", flex: 1 }}>დღეს · {nutritionDateLabel(today)}</NText>
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 18 }}>{todayKcal} კკალ</NText>
        </View>
        <NText style={{ fontSize: 12, color: c.text200 }}>ნაბიჯების ენერგია ავტომატურად ითვლება ჯანმრთელობის სინქრონიდან. ბიუჯეტში დამატება პარამეტრებში ირთვება.</NText>
      </NCard>
      <NCard>
        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>რა გააკეთე?</NText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{KINDS.map((k) => chip(kind === k.key, k.label, () => setKind(k.key)))}</View>
        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>რამდენი წუთი?</NText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {MINUTES.map((m) => chip(minutes === String(m), `${m} წთ`, () => setMinutes(String(m))))}
          <TextInput accessibilityLabel="წუთები" value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, "").slice(0, 3))} keyboardType="number-pad" style={[input, { width: 84, textAlign: "center" }]} />
        </View>
        <NText style={{ fontSize: 12, color: c.text200 }}>თუ საათი ან აპი ზუსტ კალორიას გაჩვენებს, ჩაწერე აქ; თუ არა — MET ფორმულით შევაფასებთ.</NText>
        <TextInput accessibilityLabel="დამწვარი კალორია (არასავალდებულო)" placeholder="კკალ · არასავალდებულო" placeholderTextColor={c.text300} value={kcal} onChangeText={(v) => setKcal(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" style={input} />
        <TextInput accessibilityLabel="შენიშვნა" placeholder="შენიშვნა, მაგ. სწრაფი სიარული პარკში" placeholderTextColor={c.text300} value={note} onChangeText={setNote} maxLength={200} style={input} />
        {!!message && <NText accessibilityLiveRegion="polite" style={{ color: c.success, fontSize: 13 }}>{message}</NText>}
      </NCard>
      {loading && !rows.length ? (
        <NLoading />
      ) : (
        <NCard>
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>ბოლო 14 დღე</NText>
          {rows.length === 0 && <NText style={{ color: c.text200 }}>ჯერ ვარჯიში არ ჩაგიწერია.</NText>}
          {rows.map((row) => (
            <View key={row.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <Footprints size={17} color={c.text200} />
              <View style={{ flex: 1 }}>
                <NText>{labels[row.kind]?.label || row.kind} · {row.minutes} წთ · {row.kcal} კკალ</NText>
                <NText style={{ fontSize: 12, color: c.text200 }}>{nutritionDateLabel(row.date)}{row.note ? ` · ${row.note}` : ""}</NText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="ჩანაწერის წაშლა" disabled={busy} onPress={() => void remove(row.id)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={17} color={c.text200} />
              </Pressable>
            </View>
          ))}
        </NCard>
      )}
    </NScreen>
  );
}
