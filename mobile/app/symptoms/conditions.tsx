import { Redirect } from 'expo-router';

/** Legacy route — results page now includes the conditions list. */
export default function SymptomConditionsRedirect() {
  return <Redirect href="/symptoms/results" />;
}
