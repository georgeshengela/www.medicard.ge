import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { WelcomeScreen } from '@/components/welcome/WelcomeScreen';
import { takePendingRoute } from '@/i18n/locale';
import { useVelvet } from '@/theme/velvet';

/**
 * Launch route of a signed-out app: the welcome screen with its intro, which starts from the native
 * launch screen's own frame (owner 2026-10-11: one movement from the splash to the page, no jump).
 */
export default function AuthLaunch() {
  const router = useRouter();
  const { palette } = useVelvet();
  // Just restarted in the language picked on welcome: continue where the person was going.
  const [pending] = useState(takePendingRoute);

  useEffect(() => {
    if (pending) router.replace(pending as never);
  }, [pending, router]);

  if (pending) return <View style={{ flex: 1, backgroundColor: palette.surface }} />;
  return <WelcomeScreen intro />;
}
