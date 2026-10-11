import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserRoundCheck } from 'lucide-react-native';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { tx } from '@/i18n/locale';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { velvetField, velvetRaised, useVelvet } from '@/theme/velvet';

/**
 * First screen of a brand-new account (owner 2026-10-05): „MEDICARD უკვე გამოგიყენებია?“.
 * Someone who started on the web with a phone and now signed up in the app with an email says
 * „კი“ here: the just-created empty account is removed and they go back to sign in the old way.
 */
export function ExistingAccountCheck({
  onNew,
  onHaveAccount,
}: {
  onNew: () => void;
  /** Removes the new account and signs out; throws when it is not allowed (it already holds data). */
  onHaveAccount: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { palette: p } = useVelvet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const haveAccount = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onHaveAccount();
    } catch (e) {
      setError(authErrorMessage(e));
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.surface, paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 4 }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: p.surface, boxShadow: velvetRaised(p) }}>
          <View style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: p.field, boxShadow: velvetField(p) }}>
            <UserRoundCheck size={24} color={p.pulse} strokeWidth={2} />
          </View>
        </View>
        <Text accessibilityRole="header" style={{ marginTop: 28, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 26, lineHeight: 35, color: p.text }}>
          {tx('MEDICARD უკვე გამოგიყენებია?', 'Have you used MEDICARD before?')}
        </Text>
        <Text style={{ marginTop: 10, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 23, color: p.ink2 }}>
          {tx(
            'თუ ანგარიში უკვე გაქვს — ნომრით, ელ-ფოსტით, Apple-ით ან Google-ით, აპში ან ვებზე — შედი იმავე გზით. ასე ყველაფერი ერთ ანგარიშზე დარჩება.',
            'If you already have an account — with a phone number, email, Apple or Google, in the app or on the web — sign in the same way. That keeps everything on one account.',
          )}
        </Text>
        {error ? (
          <View style={{ marginTop: 16 }}>
            <VelvetNotice palette={p} text={error} />
          </View>
        ) : null}
      </View>

      <View style={{ gap: 14 }}>
        <VelvetButton palette={p} label={tx('არა, პირველად ვარ', 'No, I am new here')} disabled={busy} onPress={onNew} />
        <VelvetButton palette={p} tone="quiet" label={tx('კი, ანგარიში უკვე მაქვს', 'Yes, I already have an account')} busy={busy} onPress={() => void haveAccount()} />
      </View>
    </View>
  );
}
