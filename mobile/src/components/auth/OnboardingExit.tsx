import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { Button } from '@/components/ui/Button';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { ApiError } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

export type OnboardingExitStage = 'menu' | 'delete';

type CardProps = {
  visible: boolean;
  /** 'delete' opens straight at the account deletion confirmation. */
  stage?: OnboardingExitStage;
  title?: string;
  body?: string;
  /** The button that closes the card and keeps the person on the screen. */
  stayLabel?: string;
  onClose: () => void;
};

/**
 * The way out of onboarding: sign out (the answers stay saved and signing in the same way resumes
 * here) or delete the account with everything stored so far. One centered card with two phases —
 * never two RN Modals at once (iOS does not present the second while the first is dismissing).
 */
export function OnboardingExitCard({ visible, stage = 'menu', title, body, stayLabel, onClose }: CardProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const { signOut, deleteAccount } = useAuth();
  const [phase, setPhase] = useState<OnboardingExitStage>(stage);
  const [openedAs, setOpenedAs] = useState<OnboardingExitStage | null>(visible ? stage : null);
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState<'signout' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  // Reset while rendering (not in an effect) so the card never flashes the previous phase on open.
  if (visible && openedAs === null) {
    setOpenedAs(stage);
    setPhase(stage);
    setAcked(false);
    setError(null);
  } else if (!visible && openedAs !== null) {
    setOpenedAs(null);
  }

  const close = () => {
    if (lock.current) return;
    onClose();
  };

  const leave = async (kind: 'signout' | 'delete') => {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'delete') await deleteAccount();
      else await signOut();
      // AuthGate never redirects inside the (auth) group, so this screen navigates itself.
      router.replace('/(auth)/sign-in');
    } catch (e) {
      lock.current = false;
      setBusy(null);
      setError(
        kind === 'delete'
          ? e instanceof ApiError && e.status > 0
            ? e.message
            : ka.profile.deleteAccountFailed
          : authErrorMessage(e),
      );
    }
  };

  const errorLine = error ? (
    <Text
      accessibilityRole="alert"
      style={{ marginTop: 12, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 19, color: colors.danger }}
    >
      {error}
    </Text>
  ) : null;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.cancel}
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
            paddingBottom: 16,
          }}
        >
          {phase === 'menu' ? (
            <>
              <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 26, color: colors.text100 }}>
                {title ?? tx('გასვლა გინდა?', 'Leave for now?')}
              </Text>
              <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: colors.text200 }}>
                {body ??
                  tx(
                    'შენი პასუხები შენახულია — როცა იმავე გზით შეხვალ, აქედან გააგრძელებ. თუ MEDICARD აღარ გინდა, ანგარიში და შენახული პასუხები შეგიძლია წაშალო.',
                    'Your answers are saved — sign in the same way to continue from here. If you no longer want MEDICARD, you can delete your account and the answers stored with it.',
                  )}
              </Text>
              {errorLine}
              <View style={{ marginTop: 18, gap: 10 }}>
                <Button label={stayLabel ?? tx('დარჩენა', 'Stay')} disabled={busy !== null} onPress={close} />
                <Button
                  label={ka.auth.signOut}
                  variant="secondary"
                  loading={busy === 'signout'}
                  disabled={busy !== null}
                  onPress={() => void leave('signout')}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy !== null}
                  onPress={() => {
                    setError(null);
                    setAcked(false);
                    setPhase('delete');
                  }}
                  style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.danger }}>
                    {ka.profile.deleteAccount}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 26, color: colors.text100 }}>
                {ka.profile.deleteAccountTitle}
              </Text>
              <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: colors.text200 }}>
                {ka.profile.deleteAccountBody}
              </Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acked, disabled: busy !== null }}
                disabled={busy !== null}
                onPress={() => setAcked((v) => !v)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    borderColor: acked ? colors.danger : colors.bg300,
                    backgroundColor: acked ? colors.danger : 'transparent',
                    marginTop: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {acked ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
                </View>
                <Text
                  style={{ flex: 1, marginLeft: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: colors.text200 }}
                >
                  {ka.profile.deleteAccountAck}
                </Text>
              </Pressable>
              {errorLine}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !acked || busy !== null, busy: busy === 'delete' }}
                disabled={!acked || busy !== null}
                onPress={() => void leave('delete')}
                style={{
                  marginTop: 18,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: !acked || busy !== null ? colors.bg200 : colors.danger,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {busy === 'delete' ? (
                  <ActivityIndicator color={colors.text200} />
                ) : (
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: !acked ? colors.text300 : '#fff' }}>
                    {ka.profile.deleteAccountConfirm}
                  </Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy !== null}
                onPress={() => {
                  if (openedAs === 'delete') close();
                  else {
                    setError(null);
                    setPhase('menu');
                  }
                }}
                style={{ marginTop: 12, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text200 }}>
                  {ka.common.cancel}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Quiet „გასვლა“ link under an onboarding step (and „ანგარიშის წაშლა“ where the person cannot go
 * on, e.g. under 18). Never shown in /profile/complete — only before the account is set up.
 */
export function OnboardingExitLinks({
  showDelete = false,
  disabled = false,
  color,
}: {
  showDelete?: boolean;
  disabled?: boolean;
  /** Link colour on a coloured background (e.g. white on the teal „preparing“ screen). */
  color?: string;
}) {
  const colors = useThemeColors();
  const [open, setOpen] = useState<OnboardingExitStage | null>(null);
  const ink = color ?? colors.text200;
  const linkText = { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: ink } as const;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 12 }}>
        <Pressable accessibilityRole="button" disabled={disabled} hitSlop={8} onPress={() => setOpen('menu')} style={{ paddingVertical: 4 }}>
          <Text style={linkText}>{ka.auth.signOut}</Text>
        </Pressable>
        {showDelete ? (
          <Pressable accessibilityRole="button" disabled={disabled} hitSlop={8} onPress={() => setOpen('delete')} style={{ paddingVertical: 4 }}>
            <Text style={linkText}>{ka.profile.deleteAccount}</Text>
          </Pressable>
        ) : null}
      </View>
      <OnboardingExitCard visible={open !== null} stage={open ?? 'menu'} onClose={() => setOpen(null)} />
    </>
  );
}
