import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound, Lock, Mail } from 'lucide-react-native';
import { AccountConflictSheet } from '@/components/auth/AccountConflictSheet';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { Input } from '@/components/ui/Input';
import { tx } from '@/i18n/locale';
import { accountConflictOf, api, type AccountConflict } from '@/lib/api';
import { authErrorMessage } from '@/lib/authErrorMessage';
import { localAccountId } from '@/lib/localAccount';
import { useAuth } from '@/store/AuthContext';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * Profile → „შესვლის გზები“ → ელ-ფოსტა: an account made with a phone (or a hidden Apple address)
 * gets a real email and a password, so email sign-in reaches the same account. The address is
 * proven with a 6-digit code; one that already has an account opens the account-conflict sheet.
 */
export default function AddEmailScreen() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<AccountConflict | null>(null);
  const lock = useRef(false);
  const owner = useRef(localAccountId());

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/profile/sign-in-methods' as never));
  const address = email.replace(/ /g, ' ').trim().toLowerCase();

  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      const found = accountConflictOf(e);
      if (found) setConflict(found);
      else setError(authErrorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const send = () => run(async () => {
    if (!EMAIL_RE.test(address)) {
      setError(tx('შეიყვანე სწორი ელ-ფოსტა.', 'Enter a valid email.'));
      return;
    }
    await api.auth.emailAddStart(address);
    setSentTo(address);
    setCode('');
  });

  const confirm = () => run(async () => {
    if (!sentTo) return;
    if (password.length < 8) {
      setError(tx('პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს.', 'Your password needs at least 8 characters.'));
      return;
    }
    const result = await api.auth.emailAddVerify({ email: sentTo, code: code.trim(), password });
    if (owner.current !== localAccountId()) return; // account switched while waiting
    setUser(result.user);
    leave();
  });

  if (!user) return null;

  const sheet = (
    <AccountConflictSheet
      conflict={conflict}
      onClose={() => setConflict(null)}
      onDone={(outcome) => {
        setConflict(null);
        if (outcome.action === 'switch') router.replace('/(tabs)/home' as never);
        else leave();
      }}
    />
  );

  return sentTo ? (
    <ProfileSetupShell
      title={tx('შეიყვანე კოდი და პაროლი', 'Enter the code and a password')}
      body={tx(
        `6-ნიშნა კოდი გავაგზავნეთ მისამართზე ${sentTo}. პაროლით ამ ელ-ფოსტით შეხვალ.`,
        `We sent a 6-digit code to ${sentTo}. You will sign in with this email and the password.`,
      )}
      primaryLabel={tx('დამატება', 'Add email')}
      onPrimary={() => void confirm()}
      onBack={() => { setSentTo(null); setError(null); }}
      loading={busy}
      showStepper={false}
      canBack
      primaryDisabled={!/^\d{6}$/.test(code.trim()) || password.length < 1}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 14 }}>
        <Input
          label={tx('კოდი ელ-ფოსტიდან', 'Code from the email')}
          placeholder="000000"
          icon={KeyRound}
          value={code}
          onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(null); }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          returnKeyType="next"
        />
        <Input
          label={tx('ახალი პაროლი', 'New password')}
          placeholder={tx('მინიმუმ 8 სიმბოლო', 'At least 8 characters')}
          icon={Lock}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(null); }}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => void confirm()}
          error={error}
        />
      </View>
      {sheet}
    </ProfileSetupShell>
  ) : (
    <ProfileSetupShell
      title={tx('ელ-ფოსტის დამატება', 'Add an email')}
      body={tx(
        'დაამატე ელ-ფოსტა და პაროლი — მერე ამ ანგარიშში ელ-ფოსტითაც შეხვალ, აპშიც და ვებზეც.',
        'Add an email and a password — then you can sign in to this account with email too, in the app and on the web.',
      )}
      primaryLabel={tx('კოდის გაგზავნა', 'Send code')}
      onPrimary={() => void send()}
      onBack={leave}
      loading={busy}
      showStepper={false}
      canBack
      primaryDisabled={!EMAIL_RE.test(address)}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Input
          label={tx('ელ-ფოსტა', 'Email')}
          placeholder="name@example.com"
          icon={Mail}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          error={error}
        />
      </View>
      {sheet}
    </ProfileSetupShell>
  );
}
