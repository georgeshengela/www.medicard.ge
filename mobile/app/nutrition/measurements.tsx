import React, { useCallback, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ruler } from "lucide-react-native";
import { api } from "@/lib/api";
import { localDay } from "@/lib/nutrition";
import { nutritionDateLabel, type BodyMeasurement } from "@/lib/nutritionProgram";
import { useAuth } from "@/store/AuthContext";
import { useThemeColors } from "@/theme/colors";
import { HUB } from "@/theme/hub";
import { NScreen, NText, NCard, NCardTitle, NButton, NError, NLoading, NNotice, withMedifood } from "@/components/nutrition/ProgramUI";
import { HubSection } from "@/components/nutrition/NutritionUi";
import { SwipeDeleteRow, SwipeGroup } from "@/components/records/SwipeDeleteRow";
import { UndoToast } from "@/components/records/UndoToast";
import { useUndoDelete } from "@/components/records/useUndoDelete";
import { tx } from '@/i18n/locale';

const FIELDS: { key: keyof Omit<BodyMeasurement, "date">; label: string }[] = [
  { key: "waistCm", label: tx("წელი", "Waist") },
  { key: "hipsCm", label: tx("თეძო", "Hips") },
  { key: "chestCm", label: tx("მკერდი", "Chest") },
  { key: "armCm", label: tx("მკლავი", "Arm") },
  { key: "thighCm", label: tx("ბარძაყი", "Thigh") },
];

export default withMedifood(function MeasurementsScreen() {
  const { user } = useAuth();
  return <Measurements key={user?.id || "guest"} />;
});
/** Tape measurements in centimetres: the scale is not the only progress signal. */
function Measurements() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
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
  // A swiped-away day disappears at once; the real delete runs after the 5 s „დაბრუნება“ window.
  const { held, remove: hold, undo } = useUndoDelete<string>((date) => {
    void api.nutrition.measurements
      .remove(date)
      .then(() => {
        if (date === today) setFields({});
        return load();
      })
      .catch((e) => {
        setError((e as Error).message);
        void load();
      });
  });
  const shown = rows ? rows.filter((m) => m.date !== held) : null;
  const previous = shown?.find((m) => m.date !== today) || null;
  const delta = (key: keyof Omit<BodyMeasurement, "date">) => {
    const now = shown?.find((m) => m.date === today)?.[key];
    const before = previous?.[key];
    if (now == null || before == null) return "";
    const d = Math.round((now - before) * 10) / 10;
    return d === 0 ? tx("უცვლელი", "no change") : `${d > 0 ? "+" : ""}${d} ${tx("სმ", "cm")}`;
  };
  return (
    <>
      <NScreen
        title={tx("სხეულის ზომები", "Body measurements")}
        footer={<NButton label={busy ? tx("ინახება…", "Saving…") : tx("დღეს შენახვა", "Save for today")} disabled={busy} onPress={() => void save()} />}
      >
        {!!error && <NError message={error} />}
        <NCard style={{ gap: 4 }}>
          <View style={{ marginBottom: 6 }}>
            <NCardTitle icon={Ruler} title={tx("დღეს", "Today")} detail={nutritionDateLabel(today)} />
          </View>
          {FIELDS.map((f, index) => {
            const change = delta(f.key);
            return (
              <View key={f.key} style={[s.field, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14.5 }}>{f.label}</NText>
                  {change ? <NText style={{ fontSize: 12, lineHeight: 16, color: c.text300 }}>{change}</NText> : null}
                </View>
                <TextInput
                  accessibilityLabel={tx(`${f.label} სანტიმეტრებში`, `${f.label} in centimeters`)}
                  placeholder={tx("სმ", "cm")}
                  placeholderTextColor={c.text300}
                  value={fields[f.key] || ""}
                  onChangeText={(v) => setFields({ ...fields, [f.key]: v.replace(/[^\d.,]/g, "").slice(0, 6) })}
                  keyboardType="decimal-pad"
                  style={[s.input, { backgroundColor: c.bg200, color: c.text100 }]}
                />
              </View>
            );
          })}
        </NCard>
        <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300, marginTop: -8, marginHorizontal: 4 }}>
          {tx("სანტიმეტრები ხშირად სასწორზე ადრე იცვლება. ზომე ერთსა და იმავე დროს, მაგ. დილით. ერთი ჩანაწერი დღეში — ახალი ძველს ცვლის.", "Centimeters often change before the scale does. Measure at the same time, e.g. in the morning. One entry per day — a new one replaces the old.")}
        </NText>
        {!!message && <NNotice>{message}</NNotice>}
        <HubSection title={tx("ისტორია", "History")}>
          {!shown ? (
            <NLoading />
          ) : shown.length === 0 ? (
            <NCard>
              <NText style={{ color: c.text200 }}>{tx("ჯერ ზომები არ გაქვს ჩაწერილი.", "You haven't logged any measurements yet.")}</NText>
            </NCard>
          ) : (
            <SwipeGroup>
              <View style={[s.list, { backgroundColor: c.surface }]}>
                {shown.map((m, index) => {
                  const values = FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label} ${m[f.key]}`).join(" · ");
                  return (
                    <SwipeDeleteRow key={m.date} onDelete={() => hold(m.date)}>
                      {(open, a11y) => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${nutritionDateLabel(m.date)}: ${values}`}
                          {...a11y}
                          onLongPress={open}
                          delayLongPress={350}
                          style={{ backgroundColor: c.surface, paddingHorizontal: 14 }}
                        >
                          <View style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
                            <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 13.5 }}>{nutritionDateLabel(m.date)}</NText>
                            <NText style={{ fontSize: 12, lineHeight: 18, color: c.text200 }}>{values}</NText>
                          </View>
                        </Pressable>
                      )}
                    </SwipeDeleteRow>
                  );
                })}
              </View>
            </SwipeGroup>
          )}
          {shown && shown.length > 0 ? <NText style={{ fontSize: 11, lineHeight: 16, color: c.text300, marginTop: 8, marginHorizontal: 4 }}>{tx("წასაშლელად გადაწიე მარცხნივ.", "Swipe left to delete.")}</NText> : null}
        </HubSection>
      </NScreen>
      {held ? <UndoToast key={held} title={tx("ჩანაწერი წაიშალა", "Entry deleted")} bottom={insets.bottom + 90} onUndo={undo} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, paddingVertical: 6 },
  input: { width: 92, minHeight: 44, borderRadius: 12, textAlign: "center", fontSize: 16, fontFamily: "NotoSansGeorgian_600SemiBold", paddingVertical: 8 },
  list: { borderRadius: HUB.cardRadius, overflow: "hidden" },
  row: { paddingVertical: 10, minHeight: 58, justifyContent: "center", gap: 1 },
});
