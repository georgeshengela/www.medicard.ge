import React, { useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, User } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { AuthScreenTitle } from '@/components/auth/AuthScreenTitle';
import { SignUpSwitchLink } from '@/components/auth/AuthSwitchLink';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { PasswordStrengthHint } from '@/components/auth/PasswordStrengthHint';
import { Input } from '@/components/ui/Input';
import { ka } from '@/i18n/ka';
import { ApiError } from '@/lib/api';
import { isPasswordStrongEnough, scorePassword } from '@/lib/passwordStrength';
import { useAuth } from '@/store/AuthContext';

type Errors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
};

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const strength = useMemo(() => scorePassword(password), [password]);
  const canSubmit =
    fullName.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    isPasswordStrongEnough(password) &&
    password === confirmPassword;

  const submit = async () => {
    Keyboard.dismiss();
    const next: Errors = {};
    if (fullName.trim().length < 2) next.fullName = ka.auth.shortName;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = ka.auth.invalidEmail;
    if (!isPasswordStrongEnough(password)) next.password = ka.auth.shortPassword;
    if (password !== confirmPassword) next.confirmPassword = ka.auth.passwordMismatch;

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace('/(auth)/assessment');
    } catch (error) {
      if (error instanceof ApiError && error.fields?.length) {
        const knownFields = new Set(['fullName', 'email', 'password']);
        const mapped: Errors = {};
        for (const field of error.fields) {
          if (knownFields.has(field.field)) {
            (mapped as Record<string, string>)[field.field] = field.message;
          }
        }
        const extra = error.fields.filter((f) => !knownFields.has(f.field));
        const legacyProfileFields = extra.some((f) => f.field === 'gender' || f.field === 'birthDate');
        if (legacyProfileFields) {
          mapped.form = ka.auth.legacyServerRegister;
        } else if (extra.length > 0 || Object.keys(mapped).length === 0) {
          mapped.form =
            extra.map((f) => f.message).join(' ') || error.message || ka.common.error;
        }
        setErrors(mapped);
      } else {
        setErrors({ form: error instanceof ApiError ? error.message : ka.common.error });
      }
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <AuthScreenTitle>{ka.auth.signUp}</AuthScreenTitle>
      <SignUpSwitchLink />

      <View style={{ gap: 16 }}>
        <Input
          label={ka.auth.fullName}
          placeholder={ka.auth.fullNamePlaceholder}
          icon={User}
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          autoComplete="name"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => emailRef.current?.focus()}
          figma
        />

        <Input
          ref={emailRef}
          label={ka.auth.email}
          placeholder={ka.auth.emailPlaceholder}
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
          figma
        />

        <View>
          <Input
            ref={passwordRef}
            label={ka.auth.password}
            placeholder={ka.auth.passwordPlaceholder}
            icon={Lock}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secure
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmRef.current?.focus()}
            figma
          />
          <PasswordStrengthHint level={strength.level} />
        </View>

        <Input
          ref={confirmRef}
          label={ka.auth.confirmPassword}
          placeholder={ka.auth.confirmPasswordPlaceholder}
          icon={Lock}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          figma
        />
      </View>

      {errors.form ? (
        <View className="mt-4 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
          <Text className="font-sans text-sm text-state-danger">{errors.form}</Text>
        </View>
      ) : null}

      <View className="mt-6">
        <AuthPrimaryButton label={ka.auth.signUp} loading={busy} disabled={!canSubmit} onPress={submit} />
      </View>

      <Text className="mt-4 text-center font-sans text-xs leading-5 text-text-300">{ka.auth.terms}</Text>
    </AuthShell>
  );
}
