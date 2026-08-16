import { Redirect } from 'expo-router';
import { useAuth } from '@/store/AuthContext';

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/(tabs)/home' : '/(auth)/sign-in'} />;
}
