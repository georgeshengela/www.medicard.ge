import { Stack,Redirect } from 'expo-router';
import {ActivityIndicator,View} from 'react-native';
import {useAuth} from '@/store/AuthContext';
import { useStackMotion } from '@/hooks/useStackMotion';

export default function RunLayout() {
  const motion = useStackMotion();
  const completionMotion = useStackMotion('completion');
  const {user,ready}=useAuth();
  if(!ready)return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator color="#14B8A6"/></View>;
  if(!user)return <Redirect href="/"/>;
  return (
    <Stack screenOptions={{ headerShown: false, ...motion }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="active" options={{ ...completionMotion, gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="summary" options={{ ...completionMotion, gestureEnabled: false }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
