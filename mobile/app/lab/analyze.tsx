import { Redirect } from 'expo-router';

/** Old links, push routes and Medi handoffs: the lab upload now lives in MEDISCAN. */
export default function Legacy() {
  return <Redirect href="/scan?type=lab" />;
}
