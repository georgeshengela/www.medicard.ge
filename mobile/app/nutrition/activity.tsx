import React, { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Flame, Footprints } from "lucide-react-native";
import { api } from "@/lib/api";
import { localDay, newUuid, shiftDay } from "@/lib/nutrition";
import { nutritionDateLabel, type NutritionActivity } from "@/lib/nutritionProgram";
import { useAuth } from "@/store/AuthContext";
import { hubInk, hubTint, HUB } from "@/theme/hub";
import { NScreen, NText, NCard, NCardTitle, NButton, NChip, NError, NField, NLabel, NLoading, NNotice, useMedifood, withMedifood } from "@/components/nutrition/ProgramUI";
import { HubSection } from "@/components/nutrition/NutritionUi";
import { MedicalSourcesLink } from "@/components/health/MedicalSourcesLink";
import { SwipeDeleteRow, SwipeGroup } from "@/components/records/SwipeDeleteRow";
import { UndoToast } from "@/components/records/UndoToast";
import { useUndoDelete } from "@/components/records/useUndoDelete";
import { tx } from "@/i18n/locale";

const KINDS: { key: string; label: string }[] = [
  { key: "walk", label: tx("სიარული", "Walking") },
  { key: "run", label: tx("სირბილი", "Running") },
  { key: "cycle", label: tx("ველოსიპედი", "Cycling") },
  { key: "strength", label: tx("ძალოვანი", "Strength") },
  { key: "swim", label: tx("ცურვა", "Swimming") },
  { key: "yoga", label: tx("იოგა", "Yoga") },
  { key: "hiit", label: "HIIT" },
  { key: "sport", label: tx("სპორტი", "Sports") },
  { key: "dance", label: tx("ცეკვა", "Dance") },
  { key: "other", label: tx("სხვა", "Other") },
];
const MINUTES = [15, 30, 45, 60, 90];

export default withMedifood(function NutritionActivityScreen() {
  const { user } = useAuth();
  return <Activity key={user?.id || "guest"} />;
});

/** Exercise log: kind, minutes, optional own calorie figure. MET estimate otherwise. */
function Activity() {
  const M = useMedifood();
  const c = M.c;
  const insets = useSafeAreaInsets();
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
  useEffect(
    () => () => {
      seq.current++;
    },
    [],
  );
  const save = async () => {
    const mins = Number(minutes);
    const own = kcal.trim() ? Number(kcal) : null;
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) {
      setError(tx("წუთები 1-დან 600-მდე უნდა იყოს.", "Minutes must be between 1 and 600."));
      return;
    }
    if (own != null && (!Number.isInteger(own) || own < 0 || own > 5000)) {
      setError(tx("კალორია მთელი რიცხვი უნდა იყოს, 5000-მდე.", "Calories must be a whole number up to 5000."));
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.nutrition.activities.save({ id: newUuid(), date: today, kind, minutes: mins, kcal: own, note: note.trim() });
      setMessage(result.estimated ? tx(`ჩაიწერა · ≈${result.activity.kcal} კკალ (MET შეფასება)`, `Logged · ≈${result.activity.kcal} kcal (MET estimate)`) : tx(`ჩაიწერა · ${result.activity.kcal} კკალ`, `Logged · ${result.activity.kcal} kcal`));
      setKcal("");
      setNote("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // A swiped-away entry disappears at once; the real delete runs after the 5 s „დაბრუნება“ window.
  const { held, remove: hold, undo } = useUndoDelete<string>((id) => {
    void api.nutrition.activities
      .remove(id)
      .then(() => load())
      .catch((e) => {
        setError((e as Error).message);
        void load();
      });
  });
  const shown = held ? rows.filter((r) => r.id !== held) : rows;
  const todayKcal = shown.filter((r) => r.date === today).reduce((sum, r) => sum + r.kcal, 0);
  const amber = hubInk("amber", M.dark);
  return (
    <>
      <NScreen
        title={tx("ვარჯიში და ენერგია", "Exercise and energy")}
        footer={<NButton label={busy ? tx("ინახება…", "Saving…") : tx("დღეს ჩაწერა", "Log for today")} disabled={busy} onPress={() => void save()} />}
      >
        {!!error && <NError message={error} />}
        <NCard>
          <NCardTitle
            icon={Flame}
            ink={amber}
            title={tx("დღეს დამწვარი", "Burned today")}
            detail={nutritionDateLabel(today)}
            right={
              <NText style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 20, lineHeight: 26, fontVariant: ["tabular-nums"] }}>
                {todayKcal} <NText style={{ fontSize: 12, color: c.text300 }}>{tx("კკალ", "kcal")}</NText>
              </NText>
            }
          />
          <NText style={{ fontSize: 12, lineHeight: 18, color: c.text300 }}>{tx("ნაბიჯების ენერგია ავტომატურად ითვლება ჯანმრთელობის სინქრონიდან. ბიუჯეტში დამატება პარამეტრებში ირთვება.", "Energy from steps is counted automatically from health sync. Adding it to your budget is turned on in settings.")}</NText>
          <MedicalSourcesLink sourceIds={["activityMet"]} />
        </NCard>

        <NLabel>{tx("რა გააკეთე?", "What did you do?")}</NLabel>
        <View style={s.wrap}>
          {KINDS.map((k) => (
            <NChip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>

        <NLabel>{tx("რამდენი წუთი?", "How many minutes?")}</NLabel>
        <View style={[s.wrap, { alignItems: "center" }]}>
          {MINUTES.map((m) => (
            <NChip key={m} label={tx(`${m} წთ`, `${m} min`)} selected={minutes === String(m)} onPress={() => setMinutes(String(m))} />
          ))}
          <TextInput
            accessibilityLabel={tx("წუთები", "Minutes")}
            // A preset chip already shows its number; the field is for any other length.
            value={MINUTES.includes(Number(minutes)) ? "" : minutes}
            onChangeText={(v) => setMinutes(v.replace(/\D/g, "").slice(0, 3))}
            keyboardType="number-pad"
            placeholder={tx("სხვა", "Other")}
            placeholderTextColor={c.text300}
            style={[s.minutes, { backgroundColor: c.surface, color: c.text100, borderColor: minutes && !MINUTES.includes(Number(minutes)) ? M.ink : "transparent" }]}
          />
        </View>

        <NField
          label={tx("დამწვარი კალორია · არასავალდებულო", "Calories burned · optional")}
          placeholder={tx("კკალ", "kcal")}
          value={kcal}
          onChangeText={(v) => setKcal(v.replace(/\D/g, "").slice(0, 4))}
          keyboardType="number-pad"
          hint={tx("თუ საათი ან აპი ზუსტ კალორიას გაჩვენებს, ჩაწერე აქ; თუ არა — MET ფორმულით შევაფასებთ.", "If your watch or an app shows exact calories, enter them here; if not, we'll estimate with the MET formula.")}
        />
        <NField label={tx("შენიშვნა", "Note")} placeholder={tx("მაგ. სწრაფი სიარული პარკში", "e.g. brisk walk in the park")} value={note} onChangeText={setNote} maxLength={200} />
        {!!message && <NNotice>{message}</NNotice>}

        <HubSection title={tx("ბოლო 14 დღე", "Last 14 days")}>
          {loading && !rows.length ? (
            <NLoading />
          ) : shown.length === 0 ? (
            <NCard>
              <NText style={{ color: c.text200 }}>{tx("ჯერ ვარჯიში არ ჩაგიწერია.", "You haven't logged any exercise yet.")}</NText>
            </NCard>
          ) : (
            <SwipeGroup>
              <View style={[s.list, { backgroundColor: c.surface }]}>
                {shown.map((row, index) => (
                  <SwipeDeleteRow key={row.id} onDelete={() => hold(row.id)}>
                    {(open, a11y) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${labels[row.kind]?.label || row.kind}, ${row.minutes} ${tx("წუთი", "minutes")}, ${row.kcal} ${tx("კკალ", "kcal")}, ${nutritionDateLabel(row.date)}`}
                        {...a11y}
                        onLongPress={open}
                        delayLongPress={350}
                        style={{ backgroundColor: c.surface, paddingHorizontal: 14 }}
                      >
                        <View style={[s.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bg300 }]}>
                          <View style={[s.tile, { backgroundColor: hubTint(amber, M.dark) }]}>
                            <Footprints size={17} color={amber} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <NText numberOfLines={1} style={{ fontFamily: "NotoSansGeorgian_600SemiBold", fontSize: 14 }}>
                              {labels[row.kind]?.label || row.kind} · {row.minutes} {tx("წთ", "min")}
                            </NText>
                            <NText numberOfLines={1} style={{ fontSize: 12, lineHeight: 17, color: c.text300 }}>
                              {nutritionDateLabel(row.date)}
                              {row.note ? ` · ${row.note}` : ""}
                            </NText>
                          </View>
                          <NText style={{ fontFamily: "NotoSansGeorgian_700Bold", fontVariant: ["tabular-nums"] }}>
                            {row.kcal} <NText style={{ fontSize: 11, color: c.text300 }}>{tx("კკალ", "kcal")}</NText>
                          </NText>
                        </View>
                      </Pressable>
                    )}
                  </SwipeDeleteRow>
                ))}
              </View>
            </SwipeGroup>
          )}
          {shown.length > 0 ? <NText style={{ fontSize: 11, lineHeight: 16, color: c.text300, marginTop: 8, marginHorizontal: 4 }}>{tx("წასაშლელად გადაწიე მარცხნივ.", "Swipe left to delete.")}</NText> : null}
        </HubSection>
      </NScreen>
      {held ? <UndoToast key={held} title={tx("ვარჯიში წაიშალა", "Workout deleted")} bottom={insets.bottom + 90} onUndo={undo} /> : null}
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  minutes: { width: 84, minHeight: 38, borderRadius: 19, borderWidth: 1.5, textAlign: "center", fontSize: 15, fontFamily: "NotoSansGeorgian_600SemiBold", paddingVertical: 6 },
  list: { borderRadius: HUB.cardRadius, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, minHeight: 60 },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
