import { Redirect, useLocalSearchParams } from 'expo-router';
import { normalizeCrewCode } from '@/lib/medipulsi/social';

/** medicard://run/crew?code=ABC234 (from medicard.ge/crew/ABC234): the MEDIRUN hub opens with the join sheet. */
export default function CrewLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const crew = normalizeCrewCode(code);
  return <Redirect href={(crew ? `/run?crew=${crew}` : '/run') as never} />;
}
