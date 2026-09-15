import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { CompetitionAvatar } from '@/components/tbilisiMoves/CompetitionAvatar';
import { TbilisiMovesChrome } from '@/components/tbilisiMoves/TbilisiMovesChrome';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { AVATAR_IDS } from '@/constants/avatarAssets';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { runCompetitionSync, ENROLL_SYNC_BUDGET_MS } from '@/lib/tbilisiMoves/sync';
import { isNativeCompetitionRuntime } from '@/lib/tbilisiMoves/sensor';
import type { TbilisiMovesDistrict } from '@/lib/tbilisiMoves/types';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

export default function TbilisiMovesEnrollScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<'intro' | 'district' | 'identity' | 'confirm'>('intro');
  const [districts, setDistricts] = useState<TbilisiMovesDistrict[]>([]);
  const [cooldownDays, setCooldownDays] = useState(30);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [avatarId, setAvatarId] = useState<string>(AVATAR_IDS[0]);
  const [acceptLock, setAcceptLock] = useState(false);
  const [acceptPublic, setAcceptPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const status = await api.tbilisiMoves.status();
      if (!status.schemaReady) {
        setUnavailable(ka.tbilisiMoves.schemaUnavailable);
        return;
      }
      if (!status.featureEnabled) {
        setUnavailable(ka.tbilisiMoves.featureOff);
        return;
      }
      const catalog = await api.tbilisiMoves.catalog();
      setDistricts(catalog.districts);
      setCooldownDays(catalog.cooldownDays);
      setUnavailable(null);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 404 || caught.status === 503)) {
        setUnavailable(caught.status === 503 ? ka.tbilisiMoves.schemaUnavailable : ka.tbilisiMoves.featureOff);
        return;
      }
      setError(caught instanceof Error ? caught.message : ka.tbilisiMoves.loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const selected = districts.find((row) => row.id === districtId) || null;

  const goBack = () => {
    if (step === 'district') setStep('intro');
    else if (step === 'identity') setStep('district');
    else if (step === 'confirm') setStep('identity');
    else router.back();
  };

  const submit = async () => {
    if (submitting || !districtId || !acceptLock || !acceptPublic) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.tbilisiMoves.enroll({
        districtId,
        publicHandle: handle.trim(),
        publicAvatarId: avatarId,
        acceptLock: true,
        acceptPublicBoard: true,
      });
      try {
        if (user?.id && isNativeCompetitionRuntime()) {
          const sync = runCompetitionSync({ userId: user.id, reason: 'enroll', force: true });
          await Promise.race([
            sync,
            new Promise<void>((resolve) => setTimeout(resolve, ENROLL_SYNC_BUDGET_MS)),
          ]);
        }
      } catch {
        /* Enrollment already succeeded. Hub shows retry if this read/PUT failed. */
      }
      router.replace('/tbilisi-moves');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : ka.common.networkError);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        <TbilisiMovesChrome title={ka.tbilisiMoves.enroll} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={colors.primary200} />
          <Text style={{ fontFamily: GEO.regular, fontSize: 15, color: colors.text300 }}>{ka.tbilisiMoves.enrollLoading}</Text>
        </View>
      </View>
    );
  }

  if (unavailable) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
        <TbilisiMovesChrome title={ka.tbilisiMoves.enroll} />
        <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
          <Text style={{ fontFamily: GEO.title, fontSize: 22, color: colors.text100 }}>{ka.tbilisiMoves.unavailableTitle}</Text>
          <Text style={{ marginTop: 10, fontFamily: GEO.regular, fontSize: 15, lineHeight: 22, color: colors.text200 }}>
            {unavailable}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <TbilisiMovesChrome title={ka.tbilisiMoves.enroll} onBack={goBack} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.bg100 }}
      >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg100 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {step === 'intro' ? (
          <>
            <Text style={{ fontFamily: GEO.regular, fontSize: 15, lineHeight: 22, color: colors.text200 }}>
              {ka.tbilisiMoves.enrollExplain}
            </Text>
            <Text style={{ fontFamily: GEO.regular, fontSize: 13, lineHeight: 20, color: colors.text300 }}>
              {ka.tbilisiMoves.enrollNoGps}
            </Text>
            <Button label={ka.common.continue} onPress={() => setStep('district')} />
          </>
        ) : null}

        {step === 'district' ? (
          <>
            <Text style={{ fontFamily: GEO.title, fontSize: 18, color: colors.text100 }}>{ka.tbilisiMoves.enrollDistrict}</Text>
            {districts.map((district) => {
              const selectedRow = districtId === district.id;
              return (
                <Pressable
                  key={district.id}
                  accessibilityRole="button"
                  onPress={() => setDistrictId(district.id)}
                  style={{
                    minHeight: 52,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 16,
                    borderWidth: selectedRow ? 2 : 1,
                    borderColor: selectedRow ? colors.primary200 : colors.bg300,
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <Text
                    style={{ flex: 1, fontFamily: GEO.semibold, fontSize: 16, color: colors.text100 }}
                    numberOfLines={2}
                  >
                    {district.nameKa}
                  </Text>
                  {selectedRow ? (
                    <Text style={{ color: colors.primary200, fontFamily: GEO.title }}>✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
            <Button
              label={ka.common.continue}
              disabled={!districtId}
              onPress={() => districtId && setStep('identity')}
            />
          </>
        ) : null}

        {step === 'identity' ? (
          <>
            <Input
              label={ka.tbilisiMoves.enrollHandle}
              value={handle}
              onChangeText={setHandle}
              placeholder={ka.tbilisiMoves.enrollHandlePh}
            />
            <Text style={{ fontFamily: GEO.semibold, fontSize: 14, color: colors.text100 }}>{ka.tbilisiMoves.enrollAvatar}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {AVATAR_IDS.map((id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  onPress={() => setAvatarId(id)}
                  style={{
                    minWidth: 56,
                    minHeight: 56,
                    borderWidth: avatarId === id ? 2 : 1,
                    borderColor: avatarId === id ? colors.primary200 : colors.bg300,
                    borderRadius: 28,
                    padding: 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CompetitionAvatar avatarId={id} size={52} />
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setAcceptLock((value) => !value)}
              style={{ flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'flex-start' }}
            >
              <Text style={{ fontSize: 18, color: colors.primary200 }}>{acceptLock ? '☑' : '☐'}</Text>
              <Text style={{ flex: 1, fontFamily: GEO.regular, fontSize: 14, lineHeight: 20, color: colors.text200 }}>
                {ka.tbilisiMoves.enrollConsentLock(cooldownDays)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAcceptPublic((value) => !value)}
              style={{ flexDirection: 'row', gap: 10, minHeight: 44, alignItems: 'flex-start' }}
            >
              <Text style={{ fontSize: 18, color: colors.primary200 }}>{acceptPublic ? '☑' : '☐'}</Text>
              <Text style={{ flex: 1, fontFamily: GEO.regular, fontSize: 14, lineHeight: 20, color: colors.text200 }}>
                {ka.tbilisiMoves.enrollConsentPublic}
              </Text>
            </Pressable>
            <Button
              label={ka.common.continue}
              disabled={!handle.trim() || !acceptLock || !acceptPublic}
              onPress={() => setStep('confirm')}
            />
          </>
        ) : null}

        {step === 'confirm' ? (
          <>
            <Card>
              <Text style={{ fontFamily: GEO.title, fontSize: 18, color: colors.text100 }}>{selected?.nameKa}</Text>
              <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <CompetitionAvatar avatarId={avatarId} handle={handle} size={56} />
                <Text style={{ flex: 1, fontFamily: GEO.semibold, fontSize: 16, color: colors.text100 }} numberOfLines={2}>
                  {handle.trim()}
                </Text>
              </View>
              <Text style={{ marginTop: 12, fontFamily: GEO.regular, fontSize: 13, lineHeight: 20, color: colors.text300 }}>
                {ka.tbilisiMoves.enrollConsentLock(cooldownDays)}
              </Text>
            </Card>
            {error ? (
              <Text style={{ color: colors.danger, fontFamily: GEO.regular }}>{error}</Text>
            ) : null}
            <Button label={ka.tbilisiMoves.enrollSubmit} loading={submitting} disabled={submitting} onPress={() => void submit()} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}
