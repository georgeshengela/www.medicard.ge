import { Redirect } from 'expo-router';

/** Old package links remain usable, without plans or an upgrade screen. */
export default function RetiredPackageScreen() {
  return <Redirect href="/profile" />;
}
