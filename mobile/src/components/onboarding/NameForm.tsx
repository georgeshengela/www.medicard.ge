import React, { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { User } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { VelvetAuthHeader } from '@/components/auth/VelvetAuthHeader';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetInput } from '@/components/velvet/VelvetInput';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { tx } from '@/i18n/locale';
import { AUTH_KEYBOARD_OPEN_PX } from '@/lib/authChrome';
import { useKeyboardMetrics } from '@/lib/useKeyboardHeight';
import type { VelvetPalette } from '@/theme/velvet';

type Props = {
  palette: VelvetPalette;
  dark: boolean;
  firstName: string;
  lastName: string;
  onChange: (next: { firstName?: string; lastName?: string }) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
  subtitle: string;
  submitLabel: string;
  /** Under the button while the keyboard is down (sign-out links in registration, „მოგვიანებით“ on Home). */
  below?: React.ReactNode;
};

/**
 * „როგორ მოგმართოთ?“ — the standard sign-up page: sign-in's heartbeat disc, first and last name (2+ letters
 * each). Used right after the SMS code for a new number and once for older accounts without a full name.
 */
export function NameForm({ palette: p, dark, firstName, lastName, onChange, onSubmit, busy, error, subtitle, submitLabel, below }: Props) {
  const lastRef = useRef<TextInput>(null);
  const [touched, setTouched] = useState<{ first?: boolean; last?: boolean }>({});
  const { height: keyboardHeight } = useKeyboardMetrics();
  const keyboardOpen = keyboardHeight > AUTH_KEYBOARD_OPEN_PX;
  const firstOk = firstName.trim().length >= 2;
  const lastOk = lastName.trim().length >= 2;

  return (
    <AuthShell
      backgroundColor={p.surface}
      renderHeader={(compact, durationMs) => (
        <VelvetAuthHeader palette={p} dark={dark} title={tx('როგორ მოგმართოთ?', 'What should we call you?')} titleKind="heading" subtitle={subtitle} compact={compact} durationMs={durationMs} />
      )}
      footer={
        <View style={{ gap: 4 }}>
          <VelvetButton palette={p} label={submitLabel} busy={busy} disabled={!firstOk || !lastOk} onPress={onSubmit} />
          {keyboardOpen ? null : below}
        </View>
      }
    >
      <View style={{ gap: 18 }}>
        <VelvetInput
          palette={p}
          label={tx('სახელი', 'First name')}
          placeholder={tx('მაგ. ნინო', 'e.g. Nino')}
          icon={User}
          value={firstName}
          onChangeText={(value) => onChange({ firstName: value })}
          onBlur={() => setTouched((t) => ({ ...t, first: true }))}
          error={touched.first && !firstOk ? tx('შეიყვანე სახელი', 'Enter your first name') : null}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => lastRef.current?.focus()}
          maxLength={60}
        />
        <VelvetInput
          ref={lastRef}
          palette={p}
          label={tx('გვარი', 'Last name')}
          placeholder={tx('მაგ. ბერიძე', 'e.g. Beridze')}
          icon={User}
          value={lastName}
          onChangeText={(value) => onChange({ lastName: value })}
          onBlur={() => setTouched((t) => ({ ...t, last: true }))}
          error={touched.last && !lastOk ? tx('შეიყვანე გვარი', 'Enter your last name') : null}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (firstOk && lastOk) onSubmit();
          }}
          maxLength={60}
        />
        {error ? <VelvetNotice palette={p} text={error} /> : null}
        <Text style={{ marginTop: 2, marginHorizontal: 4, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 19, color: p.inkOff }}>
          {tx('სახელი და გვარი ჩანს შენს პროფილში და ჯანმრთელობის პასპორტში.', 'Your name shows on your profile and in your health passport.')}
        </Text>
      </View>
    </AuthShell>
  );
}
