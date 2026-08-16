import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Share } from 'react-native';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Baby, Heart, Link2, Lock, Sparkles } from 'lucide-react-native';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CyclePrimaryButton,
  CycleSection,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle, type CycleMode } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

const MODES: { id: CycleMode; label: string; hint: string; icon: typeof Heart }[] = [
  {
    id: 'TRACK_PERIOD',
    label: ka.cycle.modePeriod,
    hint: 'პროგნოზები და სიმპტომები',
    icon: Heart,
  },
  {
    id: 'TRY_TO_CONCEIVE',
    label: ka.cycle.modeTtc,
    hint: 'ნაყოფიერი ფანჯარა · BBT',
    icon: Sparkles,
  },
  {
    id: 'PREGNANCY',
    label: ka.cycle.modePregnancy,
    hint: 'კვირები და ჩეკლისტი',
    icon: Baby,
  },
];

export default function CycleSettings() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [mode, setMode] = useState<CycleMode>('TRACK_PERIOD');
  const [avgCycle, setAvgCycle] = useState('28');
  const [avgPeriod, setAvgPeriod] = useState('5');
  const [lastPeriod, setLastPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [irregular, setIrregular] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.settings));
  }, [navigation, c]);

  useEffect(() => {
    api.cycle
      .get()
      .then((data) => {
        setBundle(data);
        setMode(data.profile.mode);
        setAvgCycle(String(data.profile.avgCycleLength));
        setAvgPeriod(String(data.profile.avgPeriodLength));
        setLastPeriod(data.profile.lastPeriodStart || '');
        setDueDate(data.profile.dueDate || '');
        setIrregular(data.profile.isIrregular);
        setPrivacy(data.profile.privacyEnabled);
      })
      .catch((err) => setMsg(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const data = await api.cycle.updateProfile({
        mode,
        avgCycleLength: Math.min(45, Math.max(21, Number(avgCycle) || 28)),
        avgPeriodLength: Math.min(10, Math.max(2, Number(avgPeriod) || 5)),
        lastPeriodStart: /^\d{4}-\d{2}-\d{2}$/.test(lastPeriod) ? lastPeriod : null,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
        isIrregular: irregular,
        privacyEnabled: privacy,
      });
      setBundle(data);
      setMsg(ka.profile.profileSaved);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  const toggleShare = async (on: boolean) => {
    try {
      const data = await api.cycle.updateProfile({ enablePartnerShare: on });
      setBundle(data);
      if (on && data.profile.partnerShareCode) {
        const url = `https://medicard.ge/api/cycle/share/${data.profile.partnerShareCode}`;
        await Share.share({ message: url });
        setMsg(ka.common.share);
      }
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    }
  };

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CycleSection title="რეჟიმი" subtitle="აირჩიეთ თქვენი მიზანი" delay={40}>
          <View style={{ gap: 10 }}>
            {MODES.map((m, i) => {
              const on = mode === m.id;
              const Icon = m.icon;
              return (
                <Animated.View key={m.id} entering={FadeInUp.delay(60 + i * 40).duration(360)}>
                  <Pressable
                    onPress={() => setMode(m.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: on ? c.rose : c.card,
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: on ? 0 : 1,
                      borderColor: c.border,
                    }}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: on ? 'rgba(255,255,255,0.2)' : c.roseSoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} color={on ? '#fff' : c.rose} strokeWidth={2.1} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '800', fontSize: 15 }}>
                        {m.label}
                      </Text>
                      <Text
                        style={{
                          color: on ? 'rgba(255,255,255,0.8)' : c.muted,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {m.hint}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </CycleSection>

        <CycleSection title="ციკლის პარამეტრები" delay={120}>
          <CycleCard>
            <Stepper
              label={ka.cycle.avgCycle}
              value={Number(avgCycle) || 28}
              min={21}
              max={45}
              onChange={(n) => setAvgCycle(String(n))}
              c={c}
            />
            <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
            <Stepper
              label={ka.cycle.avgPeriod}
              value={Number(avgPeriod) || 5}
              min={2}
              max={10}
              onChange={(n) => setAvgPeriod(String(n))}
              c={c}
            />
          </CycleCard>
        </CycleSection>

        <CycleSection title={ka.cycle.lastPeriod} subtitle="YYYY-MM-DD" delay={160}>
          <Field value={lastPeriod} onChange={setLastPeriod} c={c} placeholder="2026-08-01" />
        </CycleSection>

        {mode === 'PREGNANCY' ? (
          <CycleSection title={ka.cycle.dueDate} subtitle="YYYY-MM-DD" delay={180}>
            <Field value={dueDate} onChange={setDueDate} c={c} placeholder="2027-03-15" />
          </CycleSection>
        ) : null}

        <CycleCard style={{ marginBottom: 14 }} delay={200}>
          <RowSwitch
            icon={Sparkles}
            label={ka.cycle.irregular}
            value={irregular}
            onChange={setIrregular}
            c={c}
          />
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
          <RowSwitch
            icon={Lock}
            label={ka.cycle.privacy}
            value={privacy}
            onChange={setPrivacy}
            c={c}
          />
        </CycleCard>

        <CycleSection title={ka.cycle.partnerShare} delay={240}>
          <CycleCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Link2 size={18} color={c.lavender} />
              <Text style={{ color: c.muted, marginLeft: 8, fontSize: 13, flex: 1 }}>
                უსაფრთხო ბმული პარტნიორისთვის
              </Text>
            </View>
            {bundle?.profile.partnerShareCode ? (
              <Text
                style={{ color: c.ink, fontSize: 12, marginBottom: 12, fontWeight: '600' }}
                selectable
              >
                medicard.ge/api/cycle/share/{bundle.profile.partnerShareCode}
              </Text>
            ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => toggleShare(true)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              backgroundColor: c.lavenderSoft,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 10,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{ color: c.ink, fontWeight: '700', fontSize: 13 }}
            >
              {ka.cycle.partnerOn}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => toggleShare(false)}
            style={({ pressed }) => ({
              flex: 1,
              minWidth: 0,
              backgroundColor: c.creamDeep,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 10,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              numberOfLines={1}
              style={{ color: c.muted, fontWeight: '700', fontSize: 13 }}
            >
              {ka.cycle.partnerOff}
            </Text>
          </Pressable>
        </View>
          </CycleCard>
        </CycleSection>

        {msg ? (
          <Text
            style={{
              color: c.rose,
              marginBottom: 12,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            {msg}
          </Text>
        ) : null}
        <CyclePrimaryButton
          label={saving ? ka.common.loading : ka.common.save}
          onPress={save}
          loading={saving}
          disabled={saving}
        />
      </ScrollView>
    </CycleAtmosphere>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  c,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  c: ReturnType<typeof useCycleColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: c.ink, fontWeight: '700', flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: c.roseSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.rose, fontWeight: '800', fontSize: 18 }}>−</Text>
        </Pressable>
        <Text style={{ color: c.ink, fontWeight: '800', fontSize: 20, minWidth: 28, textAlign: 'center' }}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: c.roseSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.rose, fontWeight: '800', fontSize: 18 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field({
  value,
  onChange,
  c,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  c: ReturnType<typeof useCycleColors>;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.mutedSoft}
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
        padding: 16,
        color: c.ink,
        fontSize: 16,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: c.border,
      }}
    />
  );
}

function RowSwitch({
  icon: Icon,
  label,
  value,
  onChange,
  c,
}: {
  icon: typeof Lock;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  c: ReturnType<typeof useCycleColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
        <Icon size={18} color={c.rose} strokeWidth={2.1} />
        <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 10 }}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.blushDeep, false: c.creamDeep }}
        thumbColor="#fff"
      />
    </View>
  );
}
