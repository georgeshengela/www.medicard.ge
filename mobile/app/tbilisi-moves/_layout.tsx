import { Stack } from 'expo-router';
import { ka } from '@/i18n/ka';
import { STACK_PUSH } from '@/theme/stackMotion';

export default function TbilisiMovesLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: ka.common.back,
        headerTitleStyle: { fontFamily: 'NotoSansGeorgian_700Bold', fontWeight: '700' },
        ...STACK_PUSH,
      }}
    >
      <Stack.Screen name="index" options={{ title: ka.tbilisiMoves.title }} />
      <Stack.Screen name="enroll" options={{ title: ka.tbilisiMoves.enroll }} />
      <Stack.Screen name="membership" options={{ title: ka.tbilisiMoves.membership }} />
      <Stack.Screen name="history/index" options={{ title: ka.tbilisiMoves.history }} />
      <Stack.Screen name="history/[date]" options={{ title: ka.tbilisiMoves.history }} />
      <Stack.Screen name="awards" options={{ title: ka.tbilisiMoves.myAwards }} />
    </Stack>
  );
}
