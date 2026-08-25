import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { resolveInitialRoute, getHomeLanding } from '@/lib/homeScreenPrefs';
import { needsHealthAssessment, needsProfileSetup, useAuth } from '@/store/AuthContext';
import { useEffect, useState } from 'react';

export default function Index() {
  const { user, ready, healthProfile, refreshHealthProfile } = useAuth();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      setHref('/(auth)');
      return;
    }

    let cancelled = false;

    (async () => {
      const profile = healthProfile ?? (await refreshHealthProfile());
      if (cancelled) return;

      if (needsHealthAssessment(profile)) {
        setHref('/(auth)/assessment');
        return;
      }

      if (needsProfileSetup(profile)) {
        setHref('/(auth)/profile-setup');
        return;
      }

      const landing = await getHomeLanding();
      if (!cancelled) setHref(resolveInitialRoute(landing, user.gender));
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user, healthProfile, refreshHealthProfile]);

  if (!ready || href === null) return <View className="flex-1 bg-bg-100" />;

  return <Redirect href={href as never} />;
}

