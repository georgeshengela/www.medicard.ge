import { Stack,Redirect } from 'expo-router';
import {ActivityIndicator,View} from 'react-native';
import {useAuth} from '@/store/AuthContext';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function RunLayout() {
  const {user,ready}=useAuth();
  if(!ready)return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator color="#14B8A6"/></View>;
  if(!user)return <Redirect href="/"/>;
  return (
    <Stack screenOptions={{ headerShown: false, ...STACK_PUSH }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="active" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="summary" options={{ gestureEnabled: false }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
