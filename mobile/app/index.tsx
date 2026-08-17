import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { getHomeLanding, resolveInitialRoute } from '@/lib/homeScreenPrefs';
import { useAuth } from '@/store/AuthContext';

export default function Index() {
  const { user, ready } = useAuth();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      setHref('/(auth)/sign-in');
      return;
    }

    let cancelled = false;
    getHomeLanding().then((landing) => {
      if (!cancelled) setHref(resolveInitialRoute(landing, user.gender));
    });

    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  if (!ready || href === null) return <View className="flex-1 bg-bg-100" />;
  return <Redirect href={href as never} />;
}
