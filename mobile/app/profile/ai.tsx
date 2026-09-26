import { Redirect } from 'expo-router';

/** The Medi model picker was removed (the server chooses the engine); keep old links working. */
export default function AiSettingsRedirect() {
  return <Redirect href="/profile/ai-data" />;
}
