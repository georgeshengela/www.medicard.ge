import { Redirect } from 'expo-router';

/** Pregnancy is a Cycle mode, not a fourth pane. */
export default function PregnancyScreen() {
  return <Redirect href="/cycle" />;
}
