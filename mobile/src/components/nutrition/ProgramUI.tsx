import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type TextProps,
  type ViewProps,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowUpRight } from "lucide-react-native";
import { useThemeColors } from "@/theme/colors";
import { useAuth } from "@/store/AuthContext";
import {
  nutritionProgramApi,
  type NutritionDashboard,
} from "@/lib/nutritionProgram";
export function NText({ style, ...props }: TextProps) {
  const c = useThemeColors();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: "NotoSansGeorgian_400Regular",
          fontSize: 14,
          lineHeight: 22,
          color: c.text100,
        },
        style,
      ]}
    />
  );
}
export function NCard({ style, ...props }: ViewProps) {
  const c = useThemeColors();
  return (
    <View
      {...props}
      style={[
        { backgroundColor: c.surface, borderRadius: 24, padding: 20, gap: 14 },
        style,
      ]}
    />
  );
}
export function NButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 16,
        backgroundColor: secondary ? c.bg200 : "#0F766E",
        opacity: disabled ? 0.45 : 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <NText
        style={{
          color: secondary ? c.text100 : "#fff",
          fontFamily: "NotoSansGeorgian_600SemiBold",
          textAlign: "center",
        }}
      >
        {label}
      </NText>
    </Pressable>
  );
}
export function NLink({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingVertical: 14,
        minHeight: 64,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 15,
          backgroundColor: c.bg200,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <NText style={{ fontFamily: "NotoSansGeorgian_600SemiBold" }}>
          {title}
        </NText>
        {!!subtitle && (
          <NText style={{ fontSize: 12, color: c.text200, lineHeight: 19 }}>
            {subtitle}
          </NText>
        )}
      </View>
      <ArrowUpRight size={18} color={c.text200} />
    </Pressable>
  );
}
export function NScreen({
  title,
  subtitle,
  children,
  footer,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
}) {
  const c = useThemeColors(),
    safe = useSafeAreaInsets(),
    router = useRouter();
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () => setKeyboard(true)),
      b = Keyboard.addListener("keyboardDidHide", () => setKeyboard(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: c.bg100, paddingTop: safe.top }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="უკან"
          onPress={
            onBack ||
            (() =>
              router.canGoBack() ? router.back() : router.replace("/nutrition"))
          }
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={22} color={c.text100} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <NText
            style={{
              fontSize: 20,
              fontFamily: "NotoSansGeorgian_600SemiBold",
              lineHeight: 29,
            }}
          >
            {title}
          </NText>
          {!!subtitle && !keyboard && (
            <NText style={{ fontSize: 12, color: c.text200, lineHeight: 18 }}>
              {subtitle}
            </NText>
          )}
        </View>
      </View>
      <ScrollView
        key={subtitle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
        contentContainerStyle={{
          padding: 18,
          paddingBottom: 24 + (footer ? 0 : safe.bottom),
          gap: 20,
          maxWidth: 640,
          width: "100%",
          alignSelf: "center",
        }}
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 10,
            paddingBottom: keyboard ? 10 : Math.max(safe.bottom, 14),
            backgroundColor: c.bg100,
            borderTopWidth: 1,
            borderColor: c.bg300,
          }}
        >
          <View
            style={{
              maxWidth: 604,
              width: "100%",
              alignSelf: "center",
              gap: 8,
            }}
          >
            {footer}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
export function useNutritionDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<NutritionDashboard | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    setData(null);
  }, [user?.id]);
  const seq = useRef(0),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      seq.current++;
    };
  }, []);
  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const d = await nutritionProgramApi.dashboard();
      if (alive.current && n === seq.current) setData(d);
    } catch (e) {
      if (alive.current && n === seq.current) {
        setData(null);
        setError((e as Error).message);
      }
    } finally {
      if (alive.current && n === seq.current) setLoading(false);
    }
  }, [user?.id]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        seq.current++;
      };
    }, [load]),
  );
  return { data, error, loading, load };
}
export function NError({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const c = useThemeColors();
  return (
    <NCard>
      <NText accessibilityRole="alert" style={{ color: c.danger }}>
        {message}
      </NText>
      {retry && <NButton label="ხელახლა ცდა" onPress={retry} secondary />}
    </NCard>
  );
}
export function NLoading() {
  const c = useThemeColors();
  return (
    <ActivityIndicator
      accessibilityLabel="იტვირთება"
      color={c.primary100}
      style={{ padding: 30 }}
    />
  );
}
export {
  EnergyRing,
  MacroRails,
  WeightChart,
  IntakeWeekChart,
} from "./NutritionCharts";
