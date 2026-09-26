import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { Bell, CircleCheck, Clock3, Flame, History, Minus, Plus, ShieldAlert, Timer, Trash2, Trophy, Utensils } from "lucide-react-native";
import { api } from "@/lib/api";
import { newUuid } from "@/lib/nutrition";
import { nutritionDateLabel } from "@/lib/nutritionProgram";
import {
  FASTING_PROTOCOLS,
  FAST_MAX_HOURS,
  FAST_MIN_HOURS,
  clockLabelSeconds,
  fastElapsedMinutes,
  fastMilestone,
  fastProgress,
  hoursLabel,
  protocolFor,
  timeLabel,
  type Fast,
  type FastingScreeningAnswers,
  type FastingState,
} from "@/lib/fasting";
import { getNotificationPermissionGranted, requestNotificationPermission, syncFastingNotification } from "@/lib/notifications";
import { localAccountId } from "@/lib/localAccount";
import { useAuth } from "@/store/AuthContext";
import { useIsDark, useThemeColors } from "@/theme/colors";
import { HUB, hubInk, hubText, hubTint } from "@/theme/hub";
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from "@/components/ui/appModal";
import { NButton, NError, NLoading, NScreen } from "@/components/nutrition/ProgramUI";
import { HubCard, HubSection } from "@/components/nutrition/NutritionUi";

export default function FastingScreen() {
  const { user } = useAuth();
  return <Fasting key={user?.id || "guest"} />;
}

type Confirm = { title: string; message: string; confirm: string; action: () => void } | null;
type Edit = { fast: Fast; startedAt: Date; endedAt: Date | null } | null;

function Fasting() {
  const c = useThemeColors(),
    dark = useIsDark(),
    router = useRouter();
  const [state, setState] = useState<FastingState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [edit, setEdit] = useState<Edit>(null);
  const [rescreen, setRescreen] = useState(false);
  const [startPicker, setStartPicker] = useState(false);
  const seq = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      seq.current++;
    };
  }, []);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setError("");
    try {
      const data = await api.nutrition.fasting.get();
      if (alive.current && n === seq.current) setState(data);
    } catch (e) {
      if (alive.current && n === seq.current) setError((e as Error).message);
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
  const active = state?.active || null;
  // The clock ticks only while a fast runs and this screen is visible.
  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      setNow(Date.now());
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }, [active?.id]),
  );
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const afterChange = async (fast: Fast | null, notify = state?.settings.notify ?? true) => {
    await syncFastingNotification(fast, notify, localAccountId()).catch(() => false);
    await load();
  };
  const settings = state?.settings;
  const targetHours = Math.round((settings?.targetMinutes ?? 960) / 60);
  const saveSettings = (hours: number, notify = settings?.notify ?? true) =>
    run(async () => {
      const clamped = Math.max(FAST_MIN_HOURS, Math.min(FAST_MAX_HOURS, hours));
      const next = { protocol: protocolFor(clamped), targetMinutes: clamped * 60, notify };
      await api.nutrition.fasting.settings(next);
      if (alive.current) setState((s) => (s ? { ...s, settings: { ...s.settings, ...next } } : s));
      if (active) await syncFastingNotification(active, notify, localAccountId()).catch(() => false);
    });
  const toggleNotify = async (value: boolean) => {
    if (value) {
      // Permission is requested only from this switch press.
      const granted = (await getNotificationPermissionGranted().catch(() => false)) || (await requestNotificationPermission());
      if (!granted) {
        setError("შეტყობინებების ნებართვა გამორთულია. ჩართე ტელეფონის პარამეტრებში.");
        return;
      }
    }
    await saveSettings(targetHours, value);
  };
  const start = (startedAt?: Date) =>
    run(async () => {
      const { fast } = await api.nutrition.fasting.start({
        id: newUuid(),
        protocol: protocolFor(targetHours),
        targetMinutes: targetHours * 60,
        startedAt: startedAt?.toISOString(),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStartPicker(false);
      await afterChange(fast);
    });
  const end = (fast: Fast) =>
    run(async () => {
      const { fast: done } = await api.nutrition.fasting.end(fast.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await afterChange(null);
      if (alive.current)
        setMessage(done.completed ? `შესანიშნავია — ${hoursLabel(done.minutes)} შიმშილი დასრულდა.` : `დასრულდა: ${hoursLabel(done.minutes)}. ყოველი მცდელობა ითვლება.`);
    });
  const askEnd = (fast: Fast) => {
    const left = fast.targetMinutes - fastElapsedMinutes(fast, now);
    if (left <= 0) return void end(fast);
    setConfirm({
      title: "ახლა დავასრულო?",
      message: `მიზნამდე ${hoursLabel(left)} დარჩა. შეწყვეტა სრულიად ნორმალურია — განსაკუთრებით, თუ თავს ცუდად გრძნობ.`,
      confirm: "დასრულება",
      action: () => void end(fast),
    });
  };
  const saveEdit = () =>
    run(async () => {
      if (!edit) return;
      const { fast } = await api.nutrition.fasting.edit(edit.fast.id, {
        startedAt: edit.startedAt.toISOString(),
        endedAt: edit.endedAt ? edit.endedAt.toISOString() : null,
        targetMinutes: edit.fast.targetMinutes,
        note: edit.fast.note || "",
      });
      setEdit(null);
      await afterChange(fast.endedAt ? active && active.id !== fast.id ? active : null : fast);
    });
  const remove = (fast: Fast) =>
    setConfirm({
      title: "ჩანაწერის წაშლა?",
      message: "ეს შიმშილის ჩანაწერი ისტორიიდან წაიშლება.",
      confirm: "წაშლა",
      action: () =>
        void run(async () => {
          await api.nutrition.fasting.remove(fast.id);
          setEdit(null);
          await afterChange(active && active.id !== fast.id ? active : null);
        }),
    });
  const submitScreening = (answers: FastingScreeningAnswers) =>
    run(async () => {
      const next = await api.nutrition.fasting.screening(answers);
      if (alive.current) {
        setState(next);
        setRescreen(false);
      }
    });

  const e = state?.eligibility;
  const teal = hubInk("teal", dark);
  const txt = { color: c.text100, fontFamily: "NotoSansGeorgian_400Regular" } as const;
  return (
    <NScreen title="ინტერვალური შიმშილი" subtitle="ტაიმერი, ისტორია, სერია">
      {!!error && <NError message={error} retry={state ? undefined : () => void load()} />}
      {!state && !error && <NLoading />}
      {state && e && (e.needsScreening || rescreen) && (
        <Screening initial={state.screening} busy={busy} onSubmit={submitScreening} onCancel={rescreen ? () => setRescreen(false) : undefined} />
      )}
      {state && e && !e.needsScreening && !rescreen && e.blocked && (
        <HubSection first title="ამ ეტაპზე ტაიმერი არ გირჩევთ">
          <HubCard>
            <View style={s.row}>
              <View style={[s.tile, { backgroundColor: hubTint(hubInk("rose", dark), dark) }]}>
                <ShieldAlert size={20} color={hubInk("rose", dark)} />
              </View>
              <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>შენი უსაფრთხოება პირველია</Text>
            </View>
            {e.reasons.map((r) => (
              <Text key={r} style={[hubText.body, { color: c.text200 }]}>{r}</Text>
            ))}
            <Text style={[hubText.caption, { color: c.text300 }]}>კვების დღიური, წყალი და აქტივობა ჩვეულებრივ მუშაობს. თუ პასუხი შეცდომით მონიშნე, შეგიძლია გადახედო.</Text>
            <NButton secondary label="პასუხების გადახედვა" onPress={() => setRescreen(true)} />
          </HubCard>
        </HubSection>
      )}
      {state && e && !e.needsScreening && !rescreen && !e.blocked && e.needsDoctor && !e.eligible && (
        <HubSection first title="ექიმთან შეთანხმება">
          <HubCard>
            <View style={s.row}>
              <View style={[s.tile, { backgroundColor: hubTint(hubInk("amber", dark), dark) }]}>
                <ShieldAlert size={20} color={hubInk("amber", dark)} />
              </View>
              <Text style={[hubText.cardTitle, { color: c.text100, flex: 1 }]}>ჯერ ექიმს ჰკითხე</Text>
            </View>
            {e.doctorReasons.map((r) => (
              <Text key={r} style={[hubText.body, { color: c.text200 }]}>{r}</Text>
            ))}
            <Text style={[hubText.body, { color: c.text200 }]}>შიმშილის ფანჯარა შეიძლება წამლის დოზის ან მიღების დროის შეცვლას მოითხოვდეს. ტაიმერს ჩავრთავთ, როცა დაადასტურებ, რომ ექიმი ეთანხმება.</Text>
            <NButton
              label="ექიმი ეთანხმება — ჩართვა"
              disabled={busy || !state.screening}
              onPress={() => state.screening && void submitScreening({ eatingDisorder: state.screening.eatingDisorder, pregnancy: state.screening.pregnancy, diabetesMedication: state.screening.diabetesMedication, doctorApproved: true })}
            />
            <NButton secondary label="პასუხების გადახედვა" onPress={() => setRescreen(true)} />
          </HubCard>
        </HubSection>
      )}
      {state && e?.eligible && !rescreen && (
        <>
          <HubSection first title={active ? "შიმშილი მიმდინარეობს" : "ახალი შიმშილი"}>
            <HubCard style={{ alignItems: "stretch", gap: 14 }}>
              <FastRing fast={active} now={now} targetMinutes={targetHours * 60} />
              {active ? (
                <>
                  <View style={[s.row, { justifyContent: "space-between" }]}>
                    <TimeStat label="დაიწყო" value={`${timeLabel(active.startedAt)}`} />
                    <TimeStat label="მიზანი" value={hoursLabel(active.targetMinutes)} />
                    <TimeStat label="დასრულდება" value={timeLabel(active.goalAt)} />
                  </View>
                  <Text accessibilityLiveRegion="polite" style={[hubText.body, { color: c.text200, textAlign: "center" }]}>{fastMilestone(fastProgress(active, now))}</Text>
                  <NButton label={fastProgress(active, now) >= 1 ? "დასრულება — ჭამის დროა" : "დასრულება"} disabled={busy} onPress={() => askEnd(active)} />
                  <NButton secondary label="დაწყების დროის შესწორება" disabled={busy} onPress={() => setEdit({ fast: active, startedAt: new Date(active.startedAt), endedAt: null })} />
                </>
              ) : (
                <>
                  <Text style={[hubText.caption, { color: c.text300, textAlign: "center" }]}>აირჩიე ფანჯარა: შიმშილის საათები : ჭამის საათები</Text>
                  <View style={s.chips}>
                    {FASTING_PROTOCOLS.map((p) => {
                      const selected = targetHours === p.hours;
                      return (
                        <Pressable key={p.key} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${p.label}. ${p.detail}`} disabled={busy} onPress={() => void saveSettings(p.hours)} style={[s.chip, { backgroundColor: selected ? hubTint(teal, dark) : c.bg200, borderColor: selected ? teal : "transparent" }]}>
                          <Text style={[hubText.value, { color: selected ? teal : c.text100 }]}>{p.label}</Text>
                          <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{p.detail}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={[s.row, { justifyContent: "center" }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel="ერთი საათით ნაკლები" disabled={busy || targetHours <= FAST_MIN_HOURS} onPress={() => void saveSettings(targetHours - 1)} style={[s.round, { backgroundColor: c.bg200, opacity: targetHours <= FAST_MIN_HOURS ? 0.4 : 1 }]}>
                      <Minus size={18} color={c.text100} />
                    </Pressable>
                    <Text style={[hubText.value, { color: c.text100, minWidth: 120, textAlign: "center" }]}>{targetHours} სთ შიმშილი</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="ერთი საათით მეტი" disabled={busy || targetHours >= FAST_MAX_HOURS} onPress={() => void saveSettings(targetHours + 1)} style={[s.round, { backgroundColor: c.bg200, opacity: targetHours >= FAST_MAX_HOURS ? 0.4 : 1 }]}>
                      <Plus size={18} color={c.text100} />
                    </Pressable>
                  </View>
                  <NButton label={busy ? "იწყება…" : "დაწყება ახლა"} disabled={busy} onPress={() => void start()} />
                  <NButton secondary label="უკვე დავიწყე ადრე…" disabled={busy} onPress={() => setStartPicker(true)} />
                </>
              )}
              {!!message && (
                <View style={[s.row, { justifyContent: "center" }]}>
                  <CircleCheck size={16} color={c.success} />
                  <Text accessibilityLiveRegion="polite" style={[hubText.body, { color: c.success }]}>{message}</Text>
                </View>
              )}
              {!!message && !active && (
                <NButton secondary label="პირველი კვების ჩაწერა" onPress={() => router.push("/nutrition/diary")} />
              )}
            </HubCard>
          </HubSection>

          <HubSection title="შეხსენება">
            <HubCard>
              <View style={s.row}>
                <View style={[s.tile, { backgroundColor: hubTint(hubInk("sky", dark), dark) }]}>
                  <Bell size={20} color={hubInk("sky", dark)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[hubText.cardTitle, { color: c.text100 }]}>მიზნის შესრულებისას</Text>
                  <Text style={[hubText.caption, { color: c.text200 }]}>ერთი შეტყობინება, როცა შიმშილის საათები შესრულდება.</Text>
                </View>
                <Switch accessibilityLabel="შეხსენება მიზნის შესრულებისას" value={!!settings?.notify} disabled={busy} onValueChange={(v) => void toggleNotify(v)} trackColor={{ true: "#0D9488", false: c.bg300 }} thumbColor="#FFFFFF" />
              </View>
            </HubCard>
          </HubSection>

          <HubSection title="შენი სტატისტიკა">
            <HubCard>
              <View style={[s.row, { alignItems: "stretch" }]}>
                <StatTile icon={<Flame size={17} color={hubInk("amber", dark)} />} tint={hubTint(hubInk("amber", dark), dark)} value={`${state.stats.streak}`} label="დღე ზედიზედ" />
                <StatTile icon={<Trophy size={17} color={hubInk("teal", dark)} />} tint={hubTint(teal, dark)} value={`${state.stats.week.completed}/${state.stats.week.count}`} label="ამ კვირაში" />
                <StatTile icon={<Clock3 size={17} color={hubInk("blue", dark)} />} tint={hubTint(hubInk("blue", dark), dark)} value={hoursLabel(state.stats.week.averageMinutes)} label="საშუალო" />
              </View>
              <Text style={[hubText.caption, { color: c.text300 }]}>
                {state.stats.longestMinutes ? `ყველაზე გრძელი: ${hoursLabel(state.stats.longestMinutes)} · სულ ${state.stats.completed} შესრულებული.` : "პირველი დასრულებული შიმშილის შემდეგ აქ სტატისტიკა გამოჩნდება."} სერიაში ითვლება დღე, როცა მიზანი შესრულდა.
              </Text>
            </HubCard>
          </HubSection>

          {state.history.length > 0 && (
            <HubSection title="ისტორია">
              <HubCard style={{ gap: 0, paddingVertical: 6 }}>
                {state.history.map((f, i) => (
                  <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={`${nutritionDateLabel(localYmd(f.startedAt))}, ${hoursLabel(f.minutes)}. შესწორება`} onPress={() => setEdit({ fast: f, startedAt: new Date(f.startedAt), endedAt: new Date(f.endedAt!) })} style={[s.historyRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.bg300 }]}>
                    <View style={[s.dot, { backgroundColor: f.completed ? teal : c.bg300 }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[hubText.body, { color: c.text100 }]}>{nutritionDateLabel(localYmd(f.startedAt))} · {timeLabel(f.startedAt)}–{timeLabel(f.endedAt!)}</Text>
                      <Text style={[hubText.small, { color: c.text300 }]}>მიზანი {hoursLabel(f.targetMinutes)}{f.completed ? " · შესრულდა" : ""}</Text>
                    </View>
                    <Text style={[hubText.value, { color: f.completed ? teal : c.text200 }]}>{hoursLabel(f.minutes)}</Text>
                  </Pressable>
                ))}
              </HubCard>
            </HubSection>
          )}

          <HubSection title="კარგი იცოდე">
            <HubCard>
              {[
                "შიმშილის დროს წყალი, უშაქრო ჩაი და შავი ყავა შეიძლება.",
                "თავბრუსხვევის, გულის ფრიალის ან ძლიერი სისუსტისას შეწყვიტე და მიირთვი რამე.",
                "ჭამის ფანჯარაში ჩვეულებრივად და დაბალანსებულად იკვებე — შიმშილი ნაკლებ ჭამას არ ნიშნავს.",
                "ეს ტაიმერია, არა სამედიცინო რჩევა. ქრონიკული მდგომარეობისას ექიმს ჰკითხე.",
              ].map((line) => (
                <View key={line} style={[s.row, { alignItems: "flex-start" }]}>
                  <Utensils size={14} color={c.text300} style={{ marginTop: 3 }} />
                  <Text style={[hubText.body, { color: c.text200, flex: 1 }]}>{line}</Text>
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={() => setRescreen(true)} style={{ paddingVertical: 6 }}>
                <Text style={[hubText.link, { color: teal }]}>უსაფრთხოების პასუხების შეცვლა</Text>
              </Pressable>
            </HubCard>
          </HubSection>
        </>
      )}

      <StartEarlierSheet visible={startPicker} busy={busy} onClose={() => setStartPicker(false)} onPick={(d) => void start(d)} />
      <EditFastSheet edit={edit} busy={busy} onChange={setEdit} onClose={() => setEdit(null)} onSave={() => void saveEdit()} onDelete={(f) => remove(f)} />
      <Modal visible={!!confirm} {...APP_MODAL_PROPS} onRequestClose={() => setConfirm(null)}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
          <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: 24, padding: 24, gap: 14 }}>
            <Text style={[txt, { fontSize: 19, fontFamily: "NotoSansGeorgian_700Bold" }]}>{confirm?.title}</Text>
            <Text style={[txt, { color: c.text200, lineHeight: 22 }]}>{confirm?.message}</Text>
            <NButton secondary label="გაუქმება" onPress={() => setConfirm(null)} />
            <NButton
              label={confirm?.confirm || "დადასტურება"}
              onPress={() => {
                const action = confirm?.action;
                setConfirm(null);
                action?.();
              }}
            />
          </View>
        </View>
      </Modal>
    </NScreen>
  );
}

function localYmd(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Progress ring: elapsed time against the goal, a live clock in the middle. */
function FastRing({ fast, now, targetMinutes }: { fast: Fast | null; now: number; targetMinutes: number }) {
  const c = useThemeColors(),
    dark = useIsDark();
  const size = 232, stroke = 16, r = (size - stroke) / 2, circumference = 2 * Math.PI * r;
  const progress = fast ? fastProgress(fast, now) : 0;
  const elapsedMs = fast ? Math.max(0, now - new Date(fast.startedAt).getTime()) : 0;
  const leftMs = fast ? Math.max(0, new Date(fast.goalAt).getTime() - now) : targetMinutes * 60000;
  const done = !!fast && progress >= 1;
  return (
    <View accessible accessibilityLabel={fast ? `გავიდა ${clockLabelSeconds(elapsedMs)}, ${done ? "მიზანი შესრულდა" : `დარჩა ${clockLabelSeconds(leftMs)}`}` : `მიზანი ${Math.round(targetMinutes / 60)} საათი`} style={{ alignSelf: "center", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="fastRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={dark ? "#8AD5C7" : "#3EB6A0"} />
            <Stop offset="1" stopColor={dark ? "#408F85" : "#0F766E"} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.bg200} strokeWidth={stroke} fill="none" />
        {progress > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#fastRing)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {fast ? (
        <>
          <Text style={[hubText.caption, { color: c.text300 }]}>{done ? "მიზანი შესრულდა" : "გავიდა"}</Text>
          <Text style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 38, lineHeight: 48, color: c.text100, fontVariant: ["tabular-nums"] }}>{clockLabelSeconds(elapsedMs)}</Text>
          <Text style={[hubText.caption, { color: done ? hubInk("teal", dark) : c.text200 }]}>{done ? `+${clockLabelSeconds(elapsedMs - fast.targetMinutes * 60000)} ზედმეტი` : `დარჩა ${clockLabelSeconds(leftMs)}`}</Text>
        </>
      ) : (
        <>
          <Timer size={26} color={hubInk("teal", dark)} />
          <Text style={{ fontFamily: "NotoSansGeorgian_700Bold", fontSize: 34, lineHeight: 44, color: c.text100 }}>{Math.round(targetMinutes / 60)} სთ</Text>
          <Text style={[hubText.caption, { color: c.text200 }]}>ჭამის ფანჯარა {24 - Math.round(targetMinutes / 60)} სთ</Text>
        </>
      )}
    </View>
  );
}
function TimeStat({ label, value }: { label: string; value: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={[hubText.small, { color: c.text300 }]}>{label}</Text>
      <Text style={[hubText.value, { color: c.text100 }]}>{value}</Text>
    </View>
  );
}
function StatTile({ icon, tint, value, label }: { icon: React.ReactNode; tint: string; value: string; label: string }) {
  const c = useThemeColors();
  return (
    <View style={[s.stat, { backgroundColor: c.bg100 }]}>
      <View style={[s.statIcon, { backgroundColor: tint }]}>{icon}</View>
      <Text numberOfLines={1} style={[hubText.value, { color: c.text100 }]}>{value}</Text>
      <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{label}</Text>
    </View>
  );
}

/** Four explicit yes/no answers; nothing is preselected. */
function Screening({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: (FastingScreeningAnswers & { answeredAt: string }) | null;
  busy: boolean;
  onSubmit: (answers: FastingScreeningAnswers) => void;
  onCancel?: () => void;
}) {
  const c = useThemeColors(),
    dark = useIsDark();
  const [answers, setAnswers] = useState<Partial<FastingScreeningAnswers>>(
    initial ? { eatingDisorder: initial.eatingDisorder, pregnancy: initial.pregnancy, diabetesMedication: initial.diabetesMedication, doctorApproved: initial.doctorApproved } : {},
  );
  const questions: [keyof FastingScreeningAnswers, string, string][] = [
    ["eatingDisorder", "გქონია კვებითი ქცევის სირთულე?", "მაგ. ანორექსია, ბულიმია, კომპულსიური ჭამა — ახლა ან წარსულში."],
    ["pregnancy", "ორსულად ხარ ან ძუძუთი კვებავ?", ""],
    ["diabetesMedication", "იღებ ინსულინს ან შაქრის დამწევ წამალს?", "შიმშილისას შაქარი შეიძლება საშიშად დაეცეს."],
  ];
  const complete = questions.every(([k]) => typeof answers[k] === "boolean");
  const teal = hubInk("teal", dark);
  return (
    <HubSection first title="სანამ დავიწყებთ">
      <HubCard>
        <Text style={[hubText.body, { color: c.text200 }]}>ინტერვალური შიმშილი ყველასთვის არ არის. სამ მოკლე კითხვას უპასუხე — პასუხები მხოლოდ შენს ანგარიშში ინახება და მხოლოდ ტაიმერის უსაფრთხოებისთვის გამოიყენება.</Text>
        {questions.map(([key, question, hint]) => (
          <View key={key} style={{ gap: 8 }}>
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>{question}</Text>
            {!!hint && <Text style={[hubText.caption, { color: c.text300 }]}>{hint}</Text>}
            <View style={s.row}>
              {([
                [true, "კი"],
                [false, "არა"],
              ] as const).map(([value, label]) => {
                const selected = answers[key] === value;
                return (
                  <Pressable key={label} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${question} ${label}`} disabled={busy} onPress={() => setAnswers((a) => ({ ...a, [key]: value }))} style={[s.answer, { backgroundColor: selected ? hubTint(teal, dark) : c.bg200, borderColor: selected ? teal : "transparent" }]}>
                    <Text style={[hubText.link, { color: selected ? teal : c.text100 }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {answers.diabetesMedication === true && (
          <View style={[s.row, { paddingVertical: 4 }]}>
            <Text style={[hubText.body, { color: c.text100, flex: 1 }]}>ექიმმა შიმშილის ფანჯარა დამიდასტურა</Text>
            <Switch accessibilityLabel="ექიმმა შიმშილის ფანჯარა დამიდასტურა" value={!!answers.doctorApproved} onValueChange={(v) => setAnswers((a) => ({ ...a, doctorApproved: v }))} trackColor={{ true: "#0D9488", false: c.bg300 }} thumbColor="#FFFFFF" />
          </View>
        )}
        <NButton
          label={busy ? "ინახება…" : "გაგრძელება"}
          disabled={!complete || busy}
          onPress={() =>
            onSubmit({
              eatingDisorder: !!answers.eatingDisorder,
              pregnancy: !!answers.pregnancy,
              diabetesMedication: !!answers.diabetesMedication,
              doctorApproved: !!answers.diabetesMedication && !!answers.doctorApproved,
            })
          }
        />
        {onCancel && <NButton secondary label="გაუქმება" onPress={onCancel} />}
      </HubCard>
    </HubSection>
  );
}

/** Same-day or overnight clock time: a time later than now means yesterday. */
function pastDateFromClock(date: Date) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), date.getHours(), date.getMinutes(), 0, 0);
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
  return d;
}
function StartEarlierSheet({ visible, busy, onClose, onPick }: { visible: boolean; busy: boolean; onClose: () => void; onPick: (d: Date) => void }) {
  const c = useThemeColors();
  const [iosTime, setIosTime] = useState<Date | null>(null);
  useEffect(() => {
    if (!visible) setIosTime(null);
  }, [visible]);
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60000);
  const other = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: ago(60), mode: "time", is24Hour: true, onValueChange: (_e, d) => d && onPick(pastDateFromClock(d)), onDismiss: () => {} });
      return;
    }
    setIosTime(ago(60));
  };
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface }]}>
          <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17 }]}>როდის შეწყვიტე ჭამა?</Text>
          <View style={s.chips}>
            {[30, 60, 120, 180, 240, 360].map((m) => (
              <Pressable key={m} accessibilityRole="button" disabled={busy} onPress={() => onPick(ago(m))} style={[s.chip, { backgroundColor: c.bg200, borderColor: "transparent" }]}>
                <Text style={[hubText.value, { color: c.text100 }]}>{m < 60 ? `${m} წთ წინ` : `${m / 60} სთ წინ`}</Text>
                <Text style={[hubText.small, { color: c.text300 }]}>{timeLabel(ago(m).toISOString())}</Text>
              </Pressable>
            ))}
          </View>
          {Platform.OS !== "web" && <NButton secondary label="ზუსტი დრო…" onPress={other} />}
          {iosTime && (
            <>
              <DateTimePicker value={iosTime} mode="time" display="spinner" is24Hour onChange={(_e, d) => d && setIosTime(d)} />
              <NButton label={`დაწყება ${timeLabel(pastDateFromClock(iosTime).toISOString())}-დან`} disabled={busy} onPress={() => onPick(pastDateFromClock(iosTime))} />
            </>
          )}
          <NButton secondary label="დახურვა" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Nudge start and end in 15-minute or 1-hour steps; the server validates the result. */
function EditFastSheet({
  edit,
  busy,
  onChange,
  onClose,
  onSave,
  onDelete,
}: {
  edit: Edit;
  busy: boolean;
  onChange: (e: Edit) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (f: Fast) => void;
}) {
  const c = useThemeColors();
  if (!edit) return null;
  const shift = (field: "startedAt" | "endedAt", minutes: number) => {
    const base = edit[field];
    if (!base) return;
    const next = new Date(base.getTime() + minutes * 60000);
    if (next.getTime() > Date.now()) return;
    onChange({ ...edit, [field]: next });
  };
  const minutes = Math.round(((edit.endedAt?.getTime() ?? Date.now()) - edit.startedAt.getTime()) / 60000);
  const row = (label: string, field: "startedAt" | "endedAt") => {
    const value = edit[field];
    if (!value) return null;
    return (
      <View style={{ gap: 8 }}>
        <View style={[s.row, { justifyContent: "space-between" }]}>
          <Text style={[hubText.body, { color: c.text200 }]}>{label}</Text>
          <Text style={[hubText.value, { color: c.text100 }]}>
            {nutritionDateLabel(localYmd(value.toISOString()))} · {timeLabel(value.toISOString())}
          </Text>
        </View>
        <View style={s.row}>
          {[
            [-60, "−1 სთ"],
            [-15, "−15 წთ"],
            [15, "+15 წთ"],
            [60, "+1 სთ"],
          ].map(([m, text]) => (
            <Pressable key={String(m)} accessibilityRole="button" accessibilityLabel={`${label} ${text}`} disabled={busy} onPress={() => shift(field, m as number)} style={[s.step, { backgroundColor: c.bg200 }]}>
              <Text style={[hubText.link, { color: c.text100 }]}>{text}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };
  return (
    <Modal visible {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface }]}>
          <View style={s.row}>
            <History size={18} color={c.text200} />
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 17, flex: 1 }]}>{edit.endedAt ? "ჩანაწერის შესწორება" : "დაწყების დრო"}</Text>
            {edit.endedAt && (
              <Pressable accessibilityRole="button" accessibilityLabel="ჩანაწერის წაშლა" onPress={() => onDelete(edit.fast)} style={s.round}>
                <Trash2 size={18} color={c.text300} />
              </Pressable>
            )}
          </View>
          {row("დაწყება", "startedAt")}
          {row("დასრულება", "endedAt")}
          <Text style={[hubText.caption, { color: c.text300 }]}>ხანგრძლივობა: {minutes > 0 ? hoursLabel(minutes) : "—"}</Text>
          {busy ? <ActivityIndicator color={c.primary200} /> : <NButton label="შენახვა" disabled={minutes <= 0} onPress={onSave} />}
          <NButton secondary label="გაუქმება" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { width: "31%", flexGrow: 1, minHeight: 58, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 8, gap: 2 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  answer: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stat: { flex: 1, minWidth: 0, borderRadius: 16, padding: 12, gap: 6 },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, gap: 14 },
  step: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
