import { Redirect } from 'expo-router';

/** Phone sign-in lives on the sign-in screen (Phone | Email switch); old links land there. */
export default function PhoneAuth() {
  return <Redirect href={'/(auth)/sign-in?method=phone' as never} />;
}
