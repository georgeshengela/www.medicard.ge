import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LogIn, Mail, Lock, Smartphone } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ka } from '@/i18n/ka';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = ka.auth.invalidEmail;
    if (password.length < 1) next.password = ka.common.required;

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/home');
    } catch (error) {
      setErrors({ form: error instanceof ApiError ? error.message : ka.common.error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={ka.auth.signInTitle}
      subtitle={ka.auth.signInSubtitle}
      footer={
        <View className="flex-row justify-center">
          <Text className="text-base text-text-200">{ka.auth.noAccount} </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <Text className="text-base font-bold text-primary-200">{ka.auth.signUp}</Text>
            </Pressable>
          </Link>
        </View>
      }
    >
      <View className="gap-4">
        <Input
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
        />

        <Input
          label={ka.auth.password}
          placeholder={ka.auth.passwordPlaceholder}
          icon={Lock}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>

      {errors.form ? (
        <View className="mt-4 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
          <Text className="text-sm text-state-danger">{errors.form}</Text>
        </View>
      ) : null}

      <View className="mt-6">
        <Button label={ka.auth.signIn} icon={LogIn} size="lg" loading={busy} onPress={submit} />
      </View>

      <View className="my-5 flex-row items-center">
        <View className="h-px flex-1 bg-bg-300" />
        <Text className="mx-3 text-sm text-text-300">{ka.auth.orDivider}</Text>
        <View className="h-px flex-1 bg-bg-300" />
      </View>

      <Button
        label={ka.auth.continueWithPhone}
        icon={Smartphone}
        variant="secondary"
        size="lg"
        onPress={() => router.push('/(auth)/phone')}
      />
    </AuthShell>
  );
}
