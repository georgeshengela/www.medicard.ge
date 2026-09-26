import React, { useCallback, useRef, useState } from "react";
import { Keyboard, Pressable, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ruler, Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { localDay } from "@/lib/nutrition";
import { nutritionDateLabel, type BodyMeasurement } from "@/lib/nutritionProgram";
import { useAuth } from "@/store/AuthContext";
import { useThemeColors } from "@/theme/colors";
import { NScreen, NText, NCard, NButton, NError, NLoading } from "@/components/nutrition/ProgramUI";

const FIELDS: { key: keyof Omit<BodyMeasurement, "date">; label: string }[] = [
  { key: "waistCm", label: "წელი" },
  { key: "hipsCm", label: "თეძო" },
  { key: "chestCm", label: "მკერდი" },
  { key: "armCm", label: "მკლავი" },
  { key: "thighCm", label: "ბარძაყი" },
];

export default function MeasurementsScreen() {
  const { user } = useAuth();
  return <Measurements key={user?.id || "guest"} />;
}
/** Tape measurements in centimetres: the scale is not the only progress signal. */
function Measurements() {
  const c = useThemeColors();
  const [rows, setRows] = useState<BodyMeasurement[] | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const seq = useRef(0);
  const today = localDay();
  const load = useCallback(async () => {
    const n = ++seq.current;
    setError("");
    try {
      const data = await api.nutrition.measurements.list();
      if (n !== seq.current) return;
      setRows(data.measurements);
      const current = data.measurements.find((m) => m.date === today);
      if (current) setFields(Object.fromEntries(FIELDS.map((f) => [f.key, current[f.key] == null ? "" : String(current[f.key])])));
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
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
  const save = async () => {
    const body: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const raw = (fields[f.key] || "").trim().replace(",", ".");
      if (!raw) {
        body[f.key] = null;
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 10 || value > 250) {
        setError(`${f.label}: ჩაწერე სანტიმეტრებში (10–250).`);
        return;
      }
      body[f.key] = Math.round(value * 10) / 10;
    }
    if (!Object.values(body).some((v) => v != null)) {
      setError("მიუთითე მინიმუმ ერთი ზომა.");
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.nutrition.measurements.save(today, body as Omit<BodyMeasurement, "date">);
      setMessage("ზომები შენახულია");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (date: string) => {
    setBusy(true);
    try {
      await api.nutrition.measurements.remove(date);
      if (date === today) setFields({});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const previous = rows?.find((m) => m.date !== today) || null;
  const delta = (key: keyof Omit<BodyMeasurement, "date">) => {
    const now = rows?.find((m) => m.date === today)?.[key];
    const before = previous?.[key];
    if (now == null || before == null) return "";
    const d = Math.round((now - before) * 10) / 10;
    return d === 0 ? " · უცვლელი" : ` · ${d > 0 ? "+" : ""}${d} სმ`;
  };
  return (
    <NScreen title="სხეულის ზომები" subtitle="სანტიმეტრები ხშირად სასწორზე ადრე იცვლება" footer={<NButton label={busy ? "ინახება…" : "დღეს შენახვა"} disabled={busy} onPress={() => void save()} />}>
      {!!error && <NError message={error} />}
      <NCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ruler size={20} color={c.primary100} />
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>დღეს · {nutritionDateLabel(today)}</NText>
        </View>
        {FIELDS.map((f) => (
          <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <NText style={{ flex: 1 }}>{f.label}{delta(f.key)}</NText>
            <TextInput
              accessibilityLabel={`${f.label} სანტიმეტრებში`}
              placeholder="სმ"
              placeholderTextColor={c.text300}
              value={fields[f.key] || ""}
              onChangeText={(v) => setFields({ ...fields, [f.key]: v.replace(/[^\d.,]/g, "").slice(0, 6) })}
              keyboardType="decimal-pad"
              style={{ width: 96, textAlign: "center", backgroundColor: c.bg200, color: c.text100, borderColor: c.bg300, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, minHeight: 48, fontFamily: "NotoSansGeorgian_400Regular" }}
            />
          </View>
        ))}
        <NText style={{ fontSize: 12, color: c.text200 }}>ზომე ერთსა და იმავე დროს, მაგ. დილით. ერთი ჩანაწერი დღეში — ახალი ძველს ცვლის.</NText>
        {!!message && <NText accessibilityLiveRegion="polite" style={{ color: c.success, fontSize: 13 }}>{message}</NText>}
      </NCard>
      {!rows ? (
        <NLoading />
      ) : (
        <NCard>
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>ისტორია</NText>
          {rows.length === 0 && <NText style={{ color: c.text200 }}>ჯერ ზომები არ გაქვს ჩაწერილი.</NText>}
          {rows.map((m) => (
            <View key={m.date} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13 }}>{nutritionDateLabel(m.date)}</NText>
                <NText style={{ fontSize: 12, color: c.text200 }}>
                  {FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label} ${m[f.key]}`).join(" · ")}
                </NText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="ჩანაწერის წაშლა" disabled={busy} onPress={() => void remove(m.date)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={17} color={c.text200} />
              </Pressable>
            </View>
          ))}
        </NCard>
      )}
    </NScreen>
  );
}
