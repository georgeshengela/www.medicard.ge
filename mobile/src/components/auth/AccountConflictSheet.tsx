import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { SUPPORT_EMAIL } from '@/constants/legal';
import { tx } from '@/i18n/locale';
import { api, type AccountConflict, type SignInMethods } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

const WHAT = {
  phone: () => tx('ეს ნომერი', 'This number'),
  email: () => tx('ეს ელ-ფოსტა', 'This email'),
  apple: () => tx('ეს Apple ID', 'This Apple ID'),
  google: () => tx('ეს Google ანგარიში', 'This Google account'),
};

export type ConflictOutcome = { action: 'move_here'; methods: SignInMethods } | { action: 'switch' };

/**
 * A phone / email / Apple / Google the person just proved already belongs to another of their
 * MEDICARD accounts. They bring it here (the other account is empty and goes) or switch to the other
 * account (this one goes only when it is empty). Health data is never merged or lost here.
 */
export function AccountConflictSheet({
  conflict,
  onClose,
  onDone,
}: {
  conflict: AccountConflict | null;
  onClose: () => void;
  onDone: (outcome: ConflictOutcome) => void;
}) {
  const colors = useThemeColors();
  const { setUser, switchToAccount } = useAuth();
  const [busy, setBusy] = useState<null | 'move_here' | 'switch'>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  if (!conflict) return null;

  const close = () => {
    if (busy) return;
    setError(null);
    onClose();
  };

  const resolve = async (action: 'move_here' | 'switch') => {
    if (lock.current) return;
    lock.current = true;
    setBusy(action);
    setError(null);
    try {
      const result = await api.auth.conflictResolve({ token: conflict.token, action });
      if (result.action === 'move_here') {
        setUser(result.user);
        onDone({ action: 'move_here', methods: result.methods });
      } else {
        await switchToAccount(result, result.deletedCurrent);
        onDone({ action: 'switch' });
      }
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const created = conflict.otherCreatedAt ? formatDate(conflict.otherCreatedAt) : '';
  const moveFirst = conflict.canMoveHere;
  const bothHaveData = conflict.otherHasData && conflict.currentHasData;

  const moveButton = conflict.canMoveHere ? (
    <Choice
      key="move"
      primary={moveFirst}
      busy={busy === 'move_here'}
      disabled={busy !== null}
      title={tx('აქ გადმოტანა', 'Bring it here')}
      hint={tx(
        'ის ანგარიში ცარიელია: მისი შესვლის გზები ამ ანგარიშზე გადმოვა, ის კი წაიშლება.',
        'That account is empty: its sign-in methods move to this account and it is deleted.',
      )}
      onPress={() => void resolve('move_here')}
    />
  ) : null;

  const switchButton = conflict.canSwitch ? (
    <Choice
      key="switch"
      primary={!moveFirst}
      busy={busy === 'switch'}
      disabled={busy !== null}
      title={tx('იმ ანგარიშზე გადასვლა', 'Switch to that account')}
      hint={
        conflict.switchDeletesCurrent
          ? tx(
              'ეს ანგარიში ცარიელია: მისი შესვლის გზები იქ გადავა, ის კი წაიშლება.',
              'This account is empty: its sign-in methods move there and it is deleted.',
            )
          : tx(
              'ეს ანგარიში თავისი მონაცემებით დარჩება — მასში მოგვიანებითაც შეგიძლია შესვლა.',
              'This account stays with its data — you can still sign in to it later.',
            )
      }
      onPress={() => void resolve('switch')}
    />
  ) : null;

  return (
    <Modal visible {...APP_MODAL_PROPS} onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('დახურვა', 'Close')}
          onPress={close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
        />
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderRadius: 22,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 12,
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 26, color: colors.text100 }}>
            {tx('ეს უკვე შენს სხვა ანგარიშზეა', 'This is on another of your accounts')}
          </Text>
          <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: colors.text200 }}>
            {created
              ? tx(
                  `${WHAT[conflict.kind]()} MEDICARD-ის სხვა ანგარიშზეა მიბმული (შექმნილი ${created}). აირჩიე, რომელით გააგრძელებ.`,
                  `${WHAT[conflict.kind]()} is on another MEDICARD account (created ${created}). Choose which one to keep using.`,
                )
              : tx(
                  `${WHAT[conflict.kind]()} MEDICARD-ის სხვა ანგარიშზეა მიბმული. აირჩიე, რომელით გააგრძელებ.`,
                  `${WHAT[conflict.kind]()} is on another MEDICARD account. Choose which one to keep using.`,
                )}
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            {moveFirst ? [moveButton, switchButton] : [switchButton, moveButton]}
          </View>

          {bothHaveData ? (
            <Text style={{ marginTop: 12, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 19, color: colors.text300 }}>
              {tx(
                `ორივე ანგარიშზე შენი მონაცემებია. მათ გასაერთიანებლად მოგვწერე: ${SUPPORT_EMAIL}`,
                `Both accounts hold your data. To merge them, write to us: ${SUPPORT_EMAIL}`,
              )}
            </Text>
          ) : null}

          {error ? (
            <Text accessibilityLiveRegion="polite" style={{ marginTop: 12, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13.5, lineHeight: 20, color: colors.danger }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={close}
            style={{ marginTop: 8, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text200 }}>
              {tx('გაუქმება', 'Cancel')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Choice({
  title,
  hint,
  primary,
  busy,
  disabled,
  onPress,
}: {
  title: string;
  hint: string;
  primary: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const auth = useFigmaAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: primary ? auth.primaryBg : colors.bg200,
        opacity: disabled && !busy ? 0.6 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 22, color: primary ? '#FFFFFF' : colors.text100 }}>
          {title}
        </Text>
        {busy ? <ActivityIndicator color={primary ? '#FFFFFF' : colors.text200} /> : null}
      </View>
      <Text style={{ marginTop: 2, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 18, color: primary ? 'rgba(255,255,255,0.88)' : colors.text200 }}>
        {hint}
      </Text>
    </Pressable>
  );
}
