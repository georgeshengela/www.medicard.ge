import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { TbilisiMovesChrome } from '@/components/tbilisiMoves/TbilisiMovesChrome';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { formatYmdKa } from '@/lib/tbilisiMoves/format';
import { cancelTbilisiMovesWork } from '@/lib/tbilisiMoves/sync';
import type { TbilisiMovesDistrict, TbilisiMovesMembership } from '@/lib/tbilisiMoves/types';
import { useThemeColors } from '@/theme/colors';

export default function TbilisiMovesMembershipScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [membership, setMembership] = useState<TbilisiMovesMembership | null>(null);
  const [cooldownDays, setCooldownDays] = useState<number>(30);
  const [districts, setDistricts] = useState<TbilisiMovesDistrict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, catalog] = await Promise.all([api.tbilisiMoves.me(), api.tbilisiMoves.catalog()]);
      setMembership(me.membership);
      setCooldownDays(me.config.cooldownDays);
      setDistricts(catalog.districts);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : ka.tbilisiMoves.loadError);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const change = async (districtId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { membership: next } = await api.tbilisiMoves.districtChange({ districtId, acceptLock: true });
      setMembership(next);
      setPicking(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : ka.common.networkError);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { membership: next } = await api.tbilisiMoves.cancelDistrictChange();
      setMembership(next);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : ka.common.networkError);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.tbilisiMoves.leave();
      cancelTbilisiMovesWork();
      setLeaveOpen(false);
      router.replace('/tbilisi-moves');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : ka.common.networkError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <TbilisiMovesChrome title={ka.tbilisiMoves.membership} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
      <Card>
        <Text style={{ fontSize: 13, color: colors.text300, fontFamily: GEO.regular }}>{ka.tbilisiMoves.currentDistrict}</Text>
        <Text style={{ marginTop: 4, fontFamily: GEO.title, fontSize: 20, color: colors.text100 }}>
          {membership?.district?.nameKa || '—'}
        </Text>
        {membership?.lockUntilDate ? (
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.text200, fontFamily: GEO.regular }}>
            {ka.tbilisiMoves.cooldown(formatYmdKa(membership.lockUntilDate))}
          </Text>
        ) : null}
        {membership?.pendingDistrict ? (
          <Text style={{ marginTop: 8, fontSize: 14, color: colors.primary200, fontFamily: GEO.regular }}>
            {ka.tbilisiMoves.pendingDistrict}: {membership.pendingDistrict.nameKa}
            {membership.pendingActivationAt ? ` · ${membership.pendingActivationAt.replace('T', ' ').slice(0, 16)}` : ''}
          </Text>
        ) : null}
        <Text style={{ marginTop: 8, fontSize: 13, color: colors.text300, fontFamily: GEO.regular }}>
          {ka.tbilisiMoves.enrollConsentLock(cooldownDays)}
        </Text>
      </Card>

      {error ? <Text style={{ color: colors.danger, fontFamily: GEO.regular }}>{error}</Text> : null}

      {membership?.pendingDistrictId ? (
        <Button label={ka.tbilisiMoves.cancelChange} variant="secondary" loading={busy} onPress={() => void cancel()} />
      ) : (
        <Button
          label={ka.tbilisiMoves.changeDistrict}
          variant="secondary"
          disabled={Boolean(membership?.changeLocked)}
          onPress={() => setPicking(true)}
        />
      )}

      {picking
        ? districts
            .filter((row) => row.id !== membership?.districtId)
            .map((row) => (
              <Pressable
                key={row.id}
                onPress={() => void change(row.id)}
                style={{
                  minHeight: 48,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: GEO.semibold, color: colors.text100 }}>{row.nameKa}</Text>
              </Pressable>
            ))
        : null}

      <Button label={ka.tbilisiMoves.leave} variant="danger" onPress={() => setLeaveOpen(true)} />

      <Modal visible={leaveOpen} {...APP_MODAL_PROPS} onRequestClose={() => setLeaveOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLeaveOpen(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
          />
          <View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 12 }}>
            <Text style={{ fontFamily: GEO.title, fontSize: 18, color: colors.text100 }}>
              {ka.tbilisiMoves.leaveTitle}
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: colors.text200, fontFamily: GEO.regular }}>{ka.tbilisiMoves.leaveBody}</Text>
            <Button label={ka.tbilisiMoves.leaveConfirm} variant="danger" loading={busy} onPress={() => void leave()} />
            <Button label={ka.common.cancel} variant="ghost" onPress={() => setLeaveOpen(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}
