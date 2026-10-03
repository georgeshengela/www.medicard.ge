import { Redirect } from 'expo-router';

/** Old links, push routes and Medi handoffs: the skin photo check now lives in MEDISCAN. */
export default function Legacy() {
  return <Redirect href="/scan?type=skin" />;
}
