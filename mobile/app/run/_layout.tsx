import { Stack,Redirect } from 'expo-router';
import {ActivityIndicator,View} from 'react-native';
import {useAuth} from '@/store/AuthContext';
import { useStackMotion } from '@/hooks/useStackMotion';
import { ModuleToneProvider } from '@/theme/colors';

export default function RunLayout() {
  const motion = useStackMotion();
  const completionMotion = useStackMotion('completion');
  const {user,ready}=useAuth();
  if(!ready)return <View style={{flex:1,justifyContent:'center'}}><ActivityIndicator color="#14B8A6"/></View>;
  if(!user)return <Redirect href="/"/>;
  // MEDIRUN keeps its teal everywhere, also when the women's Home turns the app's brand rose.
  return (
    <ModuleToneProvider tone="run">
    <Stack screenOptions={{ headerShown: false, ...motion }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="active" options={{ ...completionMotion, gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <Stack.Screen name="summary" options={{ ...completionMotion, gestureEnabled: false }} />
      <Stack.Screen name="grand" />
      <Stack.Screen name="crew" />
      <Stack.Screen name="cities" />
      <Stack.Screen name="[id]" />
    </Stack>
    </ModuleToneProvider>
  );
}
