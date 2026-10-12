import { useLocalSearchParams } from 'expo-router';
import { FamilyHubScreen } from '@/components/family/FamilyHubScreen';

/** One child's page (notification taps land here): the hub with that child chosen. */
export default function FamilyChildRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FamilyHubScreen initialId={typeof id === 'string' ? id : undefined} />;
}
