import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Minus, Plus } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { HydrationAppBar } from '@/components/hydration/HydrationChrome';
import { DrinkTypeIcon, HydrationContainerIcon, HydrationDrop } from '@/components/hydration/HydrationIcons';
import { WaterLoggedModal } from '@/components/hydration/WaterLoggedModal';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { useHydration } from '@/hooks/useHydration';
import { ka } from '@/i18n/ka';
import { monthGrid, todayYmd } from '@/lib/hydration';
import { HYDRATION_COLORS, HYDRATION_CONTAINERS, type HydrationContainer, type HydrationDrink } from '@/types/hydration';

const DRINKS: HydrationDrink[] = ['water', 'coffee', 'tea', 'other'];

export default function HydrationLogScreen() {
  const T = useFigmaHydration();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addLog } = useHydration();
  const [date, setDate] = useState(todayYmd());
  const [pickDate, setPickDate] = useState(false);
  const [container, setContainer] = useState<HydrationContainer>('medium');
  const [ml, setMl] = useState(350);
  const [drink, setDrink] = useState<HydrationDrink>('water');
  const [color, setColor] = useState<string>(HYDRATION_COLORS[0]);
  const [logged, setLogged] = useState<number | null>(null);

  const dateLabel = useMemo(
    () => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    [date],
  );

  const pickContainer = (key: HydrationContainer) => {
    setContainer(key);
    setMl(HYDRATION_CONTAINERS.find((item) => item.key === key)?.ml ?? 250);
  };

  const save = async () => {
    await addLog({ date, ml, container, drink, color });
    setLogged(ml);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <HydrationAppBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, color: T.textPrimary }}>
            {ka.hydration.logTitle}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 24, color: T.textSecondary }}>
            {ka.hydration.logSubtitle}
          </Text>
        </View>

        <Field label={ka.hydration.date} color={T}>
          <Pressable onPress={() => setPickDate(true)} style={fieldBox(T)}>
            <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, color: T.textSecondary }}>
              {date === todayYmd() ? ka.hydration.todayDate(dateLabel) : dateLabel}
            </Text>
            <Calendar size={20} color={T.textSecondary} />
          </Pressable>
        </Field>

        <Field label={ka.hydration.amount} color={T}>
          <View style={fieldBox(T)}>
            <HydrationDrop size={20} color={T.waterMid} />
            <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, color: T.textSecondary }}>{ml}</Text>
            <Pressable onPress={() => setMl((n) => Math.max(50, n - 50))} style={stepBtn(T)}>
              <Minus size={18} color={T.textPrimary} />
            </Pressable>
            <Pressable onPress={() => setMl((n) => Math.min(2000, n + 50))} style={[stepBtn(T), { borderLeftWidth: 1, borderColor: T.borderStrong }]}>
              <Plus size={18} color={T.textPrimary} />
            </Pressable>
          </View>
        </Field>

        <Field label={ka.hydration.container} color={T}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {HYDRATION_CONTAINERS.map((item) => {
              const on = container === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => pickContainer(item.key)}
                  style={{
                    flex: 1,
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: on ? T.brand : T.borderStrong,
                    backgroundColor: on ? T.brandQuaternary : T.pageBg,
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <HydrationContainerIcon type={item.key} size={56} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>{ka.hydration.containers[item.key]}</Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: T.textSecondary }}>{item.ml}ml</Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: T.textTertiary }}>{item.oz}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label={ka.hydration.drinkType} color={T}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
            {DRINKS.map((key) => {
              const on = drink === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setDrink(key)}
                  style={{
                    minHeight: 40,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: on ? T.brand : T.borderStrong,
                    backgroundColor: on ? T.brandQuaternary : T.cardBg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <DrinkTypeIcon type={key} size={20} color={on ? T.brand : T.textPrimary} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 16, color: on ? T.brand : T.textPrimary }}>
                    {ka.hydration.drinks[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label={ka.hydration.color} color={T}>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            {HYDRATION_COLORS.map((hex, i) => {
              return (
                <Pressable
                  key={`${hex}-${i}`}
                  onPress={() => setColor(hex)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: hex,
                    borderWidth: color === hex ? 2 : 0,
                    borderColor: T.textPrimary,
                    padding: 2,
                  }}
                />
              );
            })}
          </View>
        </Field>
      </ScrollView>

      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void save()}
          style={{ minHeight: 48, borderRadius: 16, backgroundColor: T.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: '#FFFFFF' }}>{ka.hydration.logCta}</Text>
          <Plus size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <Modal visible={pickDate} {...APP_MODAL_PROPS} onRequestClose={() => setPickDate(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }}
            onPress={() => setPickDate(false)}
          />
          <View
            style={{ backgroundColor: T.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: T.textPrimary, marginBottom: 12 }}>
              {ka.hydration.date}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {monthGrid(new Date().getFullYear(), new Date().getMonth()).map((cell) => {
                const on = cell.ymd === date;
                const future = cell.ymd > todayYmd();
                return (
                  <Pressable
                    key={cell.ymd}
                    disabled={future || !cell.inMonth}
                    onPress={() => {
                      setDate(cell.ymd);
                      setPickDate(false);
                    }}
                    style={{
                      width: `${100 / 7}%` as `${number}%`,
                      alignItems: 'center',
                      paddingVertical: 8,
                      opacity: cell.inMonth && !future ? 1 : 0.3,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: on ? T.brand : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: on ? '#FFFFFF' : T.textPrimary }}>
                        {Number(cell.ymd.slice(8))}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <WaterLoggedModal
        visible={logged != null}
        ml={logged ?? 0}
        onClose={() => {
          setLogged(null);
          router.replace('/health-metrics/hydration' as never);
        }}
      />
    </View>
  );
}

function Field({ label, color: T, children }: { label: string; color: ReturnType<typeof useFigmaHydration>; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.textPrimary }}>{label}</Text>
      {children}
    </View>
  );
}

function fieldBox(T: ReturnType<typeof useFigmaHydration>) {
  return {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.borderStrong,
    backgroundColor: T.pageBg,
    paddingLeft: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    overflow: 'hidden' as const,
  };
}

function stepBtn(T: ReturnType<typeof useFigmaHydration>) {
  return { width: 48, height: 48, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: T.pageBg };
}
