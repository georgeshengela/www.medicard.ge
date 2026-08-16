import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Lock, Mail, User, UserPlus } from 'lucide-react-native';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { GenderSelect } from '@/components/ui/GenderSelect';
import { Input } from '@/components/ui/Input';
import { ka } from '@/i18n/ka';
import { ApiError, type Gender } from '@/lib/api';
import { parseBirthDate } from '@/lib/birthdate';
import { useAuth } from '@/store/AuthContext';

type Errors = {
  fullName?: string;
  email?: string;
  password?: string;
  gender?: string;
  birthDate?: string;
  form?: string;
};

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Errors = {};
    if (fullName.trim().length < 2) next.fullName = ka.auth.shortName;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = ka.auth.invalidEmail;
    if (password.length < 8) next.password = ka.auth.shortPassword;
    if (!gender) next.gender = ka.auth.selectGender;

    const parsedBirthDate = parseBirthDate(birthDate);
    if (!parsedBirthDate.ok) next.birthDate = parsedBirthDate.error;

    setErrors(next);
    if (Object.keys(next).length > 0 || !gender || !parsedBirthDate.ok) return;

    setBusy(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        gender,
        birthDate: parsedBirthDate.iso,
      });
      router.replace('/(tabs)/home');
    } catch (error) {
      if (error instanceof ApiError && error.fields?.length) {
        setErrors(Object.fromEntries(error.fields.map((f) => [f.field, f.message])));
      } else {
        setErrors({ form: error instanceof ApiError ? error.message : ka.common.error });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={ka.auth.signUpTitle}
      subtitle={ka.auth.signUpSubtitle}
      footer={
        <View className="flex-row justify-center">
          <Text className="text-base text-text-200">{ka.auth.hasAccount} </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <Text className="text-base font-bold text-primary-200">{ka.auth.signIn}</Text>
            </Pressable>
          </Link>
        </View>
      }
    >
      <View className="gap-4">
        <Input
          label={ka.auth.fullName}
          placeholder={ka.auth.fullNamePlaceholder}
          icon={User}
          value={fullName}
          onChangeText={setFullName}
          error={errors.fullName}
          autoComplete="name"
          returnKeyType="next"
        />

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
          autoComplete="new-password"
          returnKeyType="next"
        />

        <GenderSelect
          label={ka.auth.gender}
          value={gender}
          onChange={(value) => {
            setGender(value);
            setErrors((current) => ({ ...current, gender: undefined }));
          }}
          error={errors.gender}
        />

        <DateField
          label={ka.auth.birthDate}
          value={birthDate}
          onChangeText={setBirthDate}
          error={errors.birthDate}
          hint={ka.auth.medicalDataHint}
        />
      </View>

      {errors.form ? (
        <View className="mt-4 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3.5">
          <Text className="text-sm text-state-danger">{errors.form}</Text>
        </View>
      ) : null}

      <View className="mt-6">
        <Button label={ka.auth.signUp} icon={UserPlus} size="lg" loading={busy} onPress={submit} />
      </View>

      <Text className="mt-4 text-center text-xs leading-5 text-text-300">{ka.auth.terms}</Text>
    </AuthShell>
  );
}
