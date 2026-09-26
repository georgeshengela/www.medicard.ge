import { Redirect } from 'expo-router';

/** Old links and push routes: lab upload now lives under the one lab home. */
export default function LabModuleRedirect() {
  return <Redirect href="/lab/analyze" />;
}
