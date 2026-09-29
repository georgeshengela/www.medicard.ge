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
import { tx } from '@/i18n/locale';

const FIELDS: { key: keyof Omit<BodyMeasurement, "date">; label: string }[] = [
  { key: "waistCm", label: tx("წელი", "Waist") },
  { key: "hipsCm", label: tx("თეძო", "Hips") },
  { key: "chestCm", label: tx("მკერდი", "Chest") },
  { key: "armCm", label: tx("მკლავი", "Arm") },
  { key: "thighCm", label: tx("ბარძაყი", "Thigh") },
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
        setError(tx(`${f.label}: ჩაწერე სანტიმეტრებში (10–250).`, `${f.label}: enter it in centimeters (10–250).`));
        return;
      }
      body[f.key] = Math.round(value * 10) / 10;
    }
    if (!Object.values(body).some((v) => v != null)) {
      setError(tx("მიუთითე მინიმუმ ერთი ზომა.", "Enter at least one measurement."));
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.nutrition.measurements.save(today, body as Omit<BodyMeasurement, "date">);
      setMessage(tx("ზომები შენახულია", "Measurements saved"));
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
    return d === 0 ? tx(" · უცვლელი", " · no change") : ` · ${d > 0 ? "+" : ""}${d} ${tx("სმ", "cm")}`;
  };
  return (
    <NScreen title={tx("სხეულის ზომები", "Body measurements")} subtitle={tx("სანტიმეტრები ხშირად სასწორზე ადრე იცვლება", "Centimeters often change before the scale does")} footer={<NButton label={busy ? tx("ინახება…", "Saving…") : tx("დღეს შენახვა", "Save for today")} disabled={busy} onPress={() => void save()} />}>
      {!!error && <NError message={error} />}
      <NCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ruler size={20} color={c.primary100} />
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{tx("დღეს", "Today")} · {nutritionDateLabel(today)}</NText>
        </View>
        {FIELDS.map((f) => (
          <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <NText style={{ flex: 1 }}>{f.label}{delta(f.key)}</NText>
            <TextInput
              accessibilityLabel={tx(`${f.label} სანტიმეტრებში`, `${f.label} in centimeters`)}
              placeholder={tx("სმ", "cm")}
              placeholderTextColor={c.text300}
              value={fields[f.key] || ""}
              onChangeText={(v) => setFields({ ...fields, [f.key]: v.replace(/[^\d.,]/g, "").slice(0, 6) })}
              keyboardType="decimal-pad"
              style={{ width: 96, textAlign: "center", backgroundColor: c.bg200, color: c.text100, borderColor: c.bg300, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, minHeight: 48, fontFamily: "NotoSansGeorgian_400Regular" }}
            />
          </View>
        ))}
        <NText style={{ fontSize: 12, color: c.text200 }}>{tx("ზომე ერთსა და იმავე დროს, მაგ. დილით. ერთი ჩანაწერი დღეში — ახალი ძველს ცვლის.", "Measure at the same time each day, e.g. in the morning. One entry per day — a new one replaces the old.")}</NText>
        {!!message && <NText accessibilityLiveRegion="polite" style={{ color: c.success, fontSize: 13 }}>{message}</NText>}
      </NCard>
      {!rows ? (
        <NLoading />
      ) : (
        <NCard>
          <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>{tx("ისტორია", "History")}</NText>
          {rows.length === 0 && <NText style={{ color: c.text200 }}>{tx("ჯერ ზომები არ გაქვს ჩაწერილი.", "You haven't logged any measurements yet.")}</NText>}
          {rows.map((m) => (
            <View key={m.date} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13 }}>{nutritionDateLabel(m.date)}</NText>
                <NText style={{ fontSize: 12, color: c.text200 }}>
                  {FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label} ${m[f.key]}`).join(" · ")}
                </NText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={tx("ჩანაწერის წაშლა", "Delete entry")} disabled={busy} onPress={() => void remove(m.date)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={17} color={c.text200} />
              </Pressable>
            </View>
          ))}
        </NCard>
      )}
    </NScreen>
  );
}
