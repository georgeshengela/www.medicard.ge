import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import {
  FLOW_OPTIONS,
  MOOD_OPTIONS,
  MUCUS_OPTIONS,
  PHYSICAL_SYMPTOMS,
  SEXUAL_OPTIONS,
} from '@/constants/cycle';
import {
  CycleAtmosphere,
  CycleCard,
  CycleChipGrid,
  CycleLoading,
  CyclePrimaryButton,
  CycleSection,
  formatCycleDateKa,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleLog } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function CycleLogScreen() {
  const { date: paramDate } = useLocalSearchParams<{ date?: string }>();
  const date = useMemo(() => {
    if (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) return paramDate;
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }, [paramDate]);

  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flow, setFlow] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [sexual, setSexual] = useState(false);
  const [libido, setLibido] = useState<number | null>(null);
  const [bbt, setBbt] = useState('');
  const [mucus, setMucus] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState('TRACK_PERIOD');
  const [symExpanded, setSymExpanded] = useState(false);
  const [moodExpanded, setMoodExpanded] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.logToday));
  }, [navigation, c]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bundle = await api.cycle.get();
        if (!alive) return;
        setMode(bundle.profile.mode);
        const existing = bundle.logs.find((l) => l.date === date) as CycleLog | undefined;
        if (existing) {
          setFlow(existing.flow);
          setSymptoms(existing.symptoms || []);
          setMoods(existing.moods || []);
          setSexual(Boolean(existing.sexualActivity));
          setLibido(existing.libido);
          setBbt(existing.bbt != null ? String(existing.bbt) : '');
          setMucus(existing.cervicalMucus);
          setNotes(existing.notes || '');
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const bbtNum = bbt.trim() ? Number(bbt.replace(',', '.')) : null;
      await api.cycle.upsertLog(date, {
        flow,
        symptoms,
        moods,
        sexualActivity: sexual,
        libido,
        bbt: bbtNum != null && Number.isFinite(bbtNum) ? bbtNum : null,
        cervicalMucus: mucus,
        notes: notes.trim() || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CycleLoading />;

  const selectedCount = symptoms.length + moods.length + (flow ? 1 : 0);

  return (
    <CycleAtmosphere>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 36 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(360)} style={{ marginBottom: 18 }}>
            <CycleCard>
              <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
                თარიღი
              </Text>
              <Text style={{ color: c.ink, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
                {formatCycleDateKa(date)}
              </Text>
              <Text style={{ color: c.muted, marginTop: 6, fontSize: 13 }}>
                {selectedCount > 0
                  ? `${selectedCount} მონიშნული`
                  : 'აირჩიეთ სიმპტომები და განწყობა'}
              </Text>
            </CycleCard>
          </Animated.View>

          {error ? (
            <Text style={{ color: c.danger, marginBottom: 12, fontWeight: '600' }}>{error}</Text>
          ) : null}

          <CycleSection title={ka.cycle.flow} subtitle="როგორია გამონადენი დღეს?" delay={40}>
            <CycleChipGrid
              options={FLOW_OPTIONS}
              active={flow}
              onPick={(id) => setFlow(id === flow ? null : id)}
              multi={false}
              accent={c.period}
            />
          </CycleSection>

          <CycleSection
            title={ka.cycle.symptoms}
            subtitle="ფიზიკური შეგრძნებები"
            delay={80}
          >
            <CycleCard padded>
              <CycleChipGrid
                options={PHYSICAL_SYMPTOMS}
                activeList={symptoms}
                onPick={(id) => setSymptoms((s) => toggle(s, id))}
                multi
                accent={c.rose}
                limit={12}
                expanded={symExpanded}
                onToggleExpand={() => setSymExpanded((v) => !v)}
              />
            </CycleCard>
          </CycleSection>

          <CycleSection title={ka.cycle.moods} subtitle="როგორ გრძნობ თავს?" delay={120}>
            <CycleCard padded>
              <CycleChipGrid
                options={MOOD_OPTIONS}
                activeList={moods}
                onPick={(id) => setMoods((s) => toggle(s, id))}
                multi
                accent={c.lavender}
                limit={10}
                expanded={moodExpanded}
                onToggleExpand={() => setMoodExpanded((v) => !v)}
              />
            </CycleCard>
          </CycleSection>

          <CycleSection title={ka.cycle.sexual} delay={160}>
            <CycleCard>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: sexual ? 14 : 0,
                }}
              >
                <Text style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>
                  {ka.cycle.sexual}
                </Text>
                <Switch
                  value={sexual}
                  onValueChange={setSexual}
                  trackColor={{ true: c.blushDeep, false: c.creamDeep }}
                  thumbColor="#fff"
                />
              </View>
              {sexual ? (
                <CycleChipGrid
                  options={SEXUAL_OPTIONS}
                  activeList={symptoms}
                  onPick={(id) => setSymptoms((s) => toggle(s, id))}
                  multi
                  accent={c.blushDeep}
                />
              ) : null}
            </CycleCard>
          </CycleSection>

          <CycleSection title={ka.cycle.libido} subtitle="1 — დაბალი · 5 — მაღალი" delay={200}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = libido === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => undefined);
                      setLibido(on ? null : n);
                    }}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: on ? c.rose : c.card,
                      borderWidth: on ? 0 : 1,
                      borderColor: c.border,
                    }}
                  >
                    <Text style={{ color: on ? '#fff' : c.ink, fontWeight: '800', fontSize: 16 }}>
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </CycleSection>

          {(mode === 'TRY_TO_CONCEIVE' || mode === 'PREGNANCY') && (
            <>
              <CycleSection title={ka.cycle.bbt} delay={220}>
                <TextInput
                  value={bbt}
                  onChangeText={setBbt}
                  keyboardType="decimal-pad"
                  placeholder="36.5"
                  placeholderTextColor={c.mutedSoft}
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 16,
                    padding: 16,
                    color: c.ink,
                    fontSize: 18,
                    fontWeight: '700',
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                />
              </CycleSection>
              <CycleSection title={ka.cycle.mucus} delay={240}>
                <CycleChipGrid
                  options={MUCUS_OPTIONS}
                  active={mucus}
                  onPick={(id) => setMucus(id === mucus ? null : id)}
                  multi={false}
                  accent={c.fertile}
                />
              </CycleSection>
            </>
          )}

          <CycleSection title={ka.cycle.notes} delay={260}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="დამატებითი შენიშვნა…"
              placeholderTextColor={c.mutedSoft}
              style={{
                backgroundColor: c.card,
                borderRadius: 18,
                padding: 16,
                color: c.ink,
                minHeight: 100,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: c.border,
                fontSize: 15,
                lineHeight: 22,
              }}
            />
          </CycleSection>

          <CyclePrimaryButton
            label={saving ? ka.common.loading : ka.cycle.saveLog}
            onPress={save}
            loading={saving}
            disabled={saving}
            icon={Check}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </CycleAtmosphere>
  );
}
